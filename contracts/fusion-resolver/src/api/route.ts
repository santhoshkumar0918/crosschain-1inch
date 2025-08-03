// contracts/fusion-resolver/src/api/routes.ts
import express from 'express';
import { OrderBook } from '../core/OrderBook';
import { DutchAuction } from '../core/DutchAuction';
import { HTLCManager } from '../core/HTLCManager';
import { QuoteCalculator } from '../core/QuoteCalculator';
import { Logger } from '../utils/logger';
import { config } from '../utils/config';

// Helper function to safely get error message
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function createFusionRoutes(
  orderBook: OrderBook,
  dutchAuction: DutchAuction,
  htlcManager: HTLCManager,
  quoteCalculator: QuoteCalculator
) {
  const router = express.Router();
  const logger = new Logger('FusionAPI');

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      service: 'fusion-resolver',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      chains: ['ethereum', 'stellar'],
      features: ['dutch-auction', 'cross-chain-htlc', '1inch-compatible'],
    });
  });

  // Get quote (1inch Fusion+ compatible)
  router.post('/quote', async (req, res) => {
    try {
      const { srcChain, dstChain, srcToken, dstToken, amount, walletAddress, slippage } = req.body;

      if (!srcChain || !dstChain || !srcToken || !dstToken || !amount || !walletAddress) {
        return res.status(400).json({
          success: false,
          error: 'Missing required parameters: srcChain, dstChain, srcToken, dstToken, amount, walletAddress',
        });
      }

      const quote = await quoteCalculator.calculateQuote({
        srcChain,
        dstChain,
        srcToken,
        dstToken,
        amount,
        walletAddress,
        slippage,
      });

      res.json({
        success: true,
        quote,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Quote calculation failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate quote',
        details: getErrorMessage(error),
      });
    }
  });

  // Submit order (1inch Fusion+ compatible)
  router.post('/submit', async (req, res) => {
    try {
      const {
        maker,
        receiver,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        srcChainId,
        dstChainId,
        timelock,
        secretHashes,
      } = req.body;

      if (!maker || !receiver || !makerAsset || !takerAsset || !makingAmount || !takingAmount) {
        return res.status(400).json({
          success: false,
          error: 'Missing required order parameters',
        });
      }

      const order = await orderBook.createOrder({
        maker,
        receiver,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        srcChainId: srcChainId || config.ethereum.chainId,
        dstChainId: dstChainId || 'stellar',
        timelock,
        secretHashes,
      });

      logger.info('Order submitted successfully', { orderHash: order.orderHash });

      res.json({
        success: true,
        orderHash: order.orderHash,
        order,
        message: 'Order submitted to Fusion+ auction',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Order submission failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to submit order',
        details: getErrorMessage(error),
      });
    }
  });

  // Get active orders (1inch Fusion+ compatible)
  router.get('/orders', async (req, res) => {
    try {
      const { maker, srcChain, dstChain, status, page = 1, limit = 10 } = req.query;

      const filters: any = {};
      if (maker) filters.maker = maker as string;
      if (srcChain) filters.srcChain = srcChain;
      if (dstChain) filters.dstChain = dstChain;
      if (status) filters.status = status;

      const allOrders = orderBook.getActiveOrders(filters);
      
      // Pagination
      const startIndex = (Number(page) - 1) * Number(limit);
      const endIndex = startIndex + Number(limit);
      const orders = allOrders.slice(startIndex, endIndex);

      res.json({
        success: true,
        orders,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: allOrders.length,
          pages: Math.ceil(allOrders.length / Number(limit)),
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to get orders', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get orders',
        details: getErrorMessage(error),
      });
    }
  });

  // Get specific order
  router.get('/orders/:orderHash', async (req, res) => {
    try {
      const { orderHash } = req.params;
      const order = orderBook.getOrder(orderHash);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Order not found',
        });
      }

      // Get HTLC pair if exists
      const htlcPair = htlcManager.getHTLCPair(orderHash);

      res.json({
        success: true,
        order,
        htlcPair,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to get order', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get order',
        details: getErrorMessage(error),
      });
    }
  });

  // Get auction status
  router.get('/auctions/:orderHash', async (req, res) => {
    try {
      const { orderHash } = req.params;
      const order = orderBook.getOrder(orderHash);

      if (!order) {
        return res.status(404).json({
          success: false,
          error: 'Auction not found',
        });
      }

      const currentPrice = await dutchAuction.getCurrentAuctionPrice(order);
      const timeRemaining = Math.max(0, order.auctionEndTime - Math.floor(Date.now() / 1000));

      res.json({
        success: true,
        auction: {
          orderHash,
          status: order.status,
          currentPrice,
          reservePrice: order.reservePrice,
          timeRemaining,
          auctionEndTime: order.auctionEndTime,
          participantCount: 1, // Mock data
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to get auction status', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get auction status',
        details: getErrorMessage(error),
      });
    }
  });

  // Get resolver statistics
  router.get('/stats', async (req, res) => {
    try {
      const orderStats = orderBook.getStats();
      const auctionStats = dutchAuction.getAuctionStats();

      res.json({
        success: true,
        stats: {
          orders: orderStats,
          auctions: auctionStats,
          resolver: {
            address: config.resolver.address,
            stellarAddress: config.resolver.stellarAddress,
            ethBalance: await htlcManager.getEthereumBalance(),
            xlmBalance: await htlcManager.getStellarBalance(),
          },
          system: {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            version: '1.0.0',
          },
        },
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to get stats', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get stats',
        details: getErrorMessage(error),
      });
    }
  });

  // Get supported trading pairs
  router.get('/pairs', async (req, res) => {
    try {
      const pairs = quoteCalculator.getSupportedPairs();

      res.json({
        success: true,
        pairs,
        supportedChains: config.supportedChains,
        supportedTokens: config.supportedTokens,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to get trading pairs', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get trading pairs',
        details: getErrorMessage(error),
      });
    }
  });

  // Cancel order (if supported)
  router.delete('/orders/:orderHash', async (req, res) => {
    try {
      const { orderHash } = req.params;
      const success = orderBook.updateOrderStatus(orderHash, 'cancelled');

      if (!success) {
        return res.status(404).json({
          success: false,
          error: 'Order not found or cannot be cancelled',
        });
      }

      res.json({
        success: true,
        message: 'Order cancelled successfully',
        orderHash,
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('Failed to cancel order', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel order',
        details: getErrorMessage(error),
      });
    }
  });

  return router;
}