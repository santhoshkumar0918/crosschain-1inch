// contracts/fusion-resolver/src/core/DutchAuction.ts
import { FusionOrder, AuctionBid } from '../types';
import { Logger } from '../utils/logger';
import { config } from '../utils/config';
import { OrderBook } from './OrderBook';
import { HTLCManager } from './HTLCManager';

export class DutchAuction {
  private logger = new Logger('DutchAuction');
  private activeBids = new Map<string, AuctionBid[]>();
  private priceUpdateIntervals = new Map<string, NodeJS.Timeout>();

  constructor(
    private orderBook: OrderBook,
    private htlcManager: HTLCManager
  ) {}

  // Start monitoring auctions
  async startAuctionMonitoring(): Promise<void> {
    this.logger.info('Starting Dutch auction monitoring...');
    
    // Check for new auctions every 10 seconds
    setInterval(async () => {
      await this.processActiveAuctions();
    }, 10000);

    // Update auction prices every 5 seconds
    setInterval(async () => {
      await this.updateAuctionPrices();
    }, 5000);
  }

  // Process all active auctions
  private async processActiveAuctions(): Promise<void> {
    const activeOrders = this.orderBook.getActiveOrders({ 
      status: 'auction_active' 
    });

    for (const order of activeOrders) {
      await this.processAuction(order);
    }
  }

  // Process individual auction
  private async processAuction(order: FusionOrder): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    
    // Check if auction has expired
    if (now > order.auctionEndTime) {
      await this.expireAuction(order);
      return;
    }

    // Check if we should participate as a resolver
    const shouldParticipate = await this.shouldParticipateInAuction(order);
    
    if (shouldParticipate) {
      await this.participateInAuction(order);
    }
  }

  // Determine if we should participate in this auction
  private async shouldParticipateInAuction(order: FusionOrder): Promise<boolean> {
    try {
      // Check if we support this trading pair
      if (!this.isSupportedPair(order.makerAsset, order.takerAsset)) {
        return false;
      }

      // Check if we have sufficient liquidity
      const hasLiquidity = await this.checkLiquidity(order);
      if (!hasLiquidity) {
        this.logger.debug('Insufficient liquidity for order', { orderHash: order.orderHash });
        return false;
      }

      // Check profitability
      const currentPrice = await this.getCurrentAuctionPrice(order);
      const reservePrice = parseFloat(order.reservePrice || '0');
      const isProfitable = parseFloat(currentPrice) >= reservePrice;

      if (!isProfitable) {
        this.logger.debug('Order not profitable at current price', { 
          orderHash: order.orderHash,
          currentPrice,
          reservePrice 
        });
        return false;
      }

      // Check if we already have an active bid
      const existingBids = this.activeBids.get(order.orderHash) || [];
      const ourBid = existingBids.find(bid => 
        bid.bidder.toLowerCase() === config.resolver.address.toLowerCase()
      );

      if (ourBid) {
        this.logger.debug('Already have active bid for order', { orderHash: order.orderHash });
        return false;
      }

      this.logger.info('Should participate in auction', {
        orderHash: order.orderHash,
        currentPrice,
        reservePrice,
        profitable: isProfitable
      });

      return true;
    } catch (error) {
      this.logger.error('Error checking auction participation', error);
      return false;
    }
  }

  // Participate in auction by creating HTLCs
  private async participateInAuction(order: FusionOrder): Promise<void> {
    try {
      this.logger.info('Participating in auction', { orderHash: order.orderHash });

      // Create cross-chain HTLCs
      const htlcPair = await this.htlcManager.createCrossChainHTLCs({
        order,
        resolver: config.resolver.address,
      });

      // Record our bid
      const bid: AuctionBid = {
        bidder: config.resolver.address,
        price: await this.getCurrentAuctionPrice(order),
        timestamp: Math.floor(Date.now() / 1000),
        htlcAddress: htlcPair.ethereumContractId,
      };

      this.addBid(order.orderHash, bid);

      // Update order with HTLC information
      this.orderBook.updateOrderStatus(order.orderHash, 'htlc_created', {
        htlcPair,
      });

      this.logger.info('Successfully participated in auction', {
        orderHash: order.orderHash,
        ethereumHTLC: htlcPair.ethereumContractId,
        stellarHTLC: htlcPair.stellarContractId,
      });

    } catch (error) {
      this.logger.error('Failed to participate in auction', error);
    }
  }

  // Get current auction price
  async getCurrentAuctionPrice(order: FusionOrder): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    // Dutch auction: price decreases linearly over time
    const totalDuration = order.auctionEndTime - order.auctionStartTime;
    const elapsed = now - order.auctionStartTime;
    const progress = Math.min(elapsed / totalDuration, 1);

    // Price decreases from 105% to 95% of base price
    const startMultiplier = 1.05;
    const endMultiplier = 0.95;
    const currentMultiplier = startMultiplier - (progress * (startMultiplier - endMultiplier));

    // Calculate based on the making/taking amounts
    const baseRate = parseFloat(order.takingAmount) / parseFloat(order.makingAmount);
    const currentRate = baseRate * currentMultiplier;
    
    return (parseFloat(order.makingAmount) * currentRate).toString();
  }

  // Update prices for all active auctions
  private async updateAuctionPrices(): Promise<void> {
    const activeOrders = this.orderBook.getActiveOrders({ 
      status: 'auction_active' 
    });

    for (const order of activeOrders) {
      const newPrice = await this.getCurrentAuctionPrice(order);
      
      // Update order with new current price
      this.orderBook.updateOrderStatus(order.orderHash, 'auction_active', {
        currentPrice: newPrice,
      });
    }
  }

  // Expire auction if no bids received
  private async expireAuction(order: FusionOrder): Promise<void> {
    this.logger.info('Auction expired', { orderHash: order.orderHash });
    
    const bids = this.activeBids.get(order.orderHash) || [];
    
    if (bids.length === 0) {
      // No bids received, mark as expired
      this.orderBook.updateOrderStatus(order.orderHash, 'expired');
    } else {
      // Handle winning bid
      await this.selectWinningBid(order, bids);
    }

    // Cleanup
    this.activeBids.delete(order.orderHash);
    const interval = this.priceUpdateIntervals.get(order.orderHash);
    if (interval) {
      clearInterval(interval);
      this.priceUpdateIntervals.delete(order.orderHash);
    }
  }

  // Select winning bid and process
  private async selectWinningBid(order: FusionOrder, bids: AuctionBid[]): Promise<void> {
    // Sort bids by price (highest first) and timestamp (earliest first)
    const sortedBids = bids.sort((a, b) => {
      const priceDiff = parseFloat(b.price) - parseFloat(a.price);
      if (priceDiff !== 0) return priceDiff;
      return a.timestamp - b.timestamp;
    });

    const winningBid = sortedBids[0];
    
    this.logger.info('Selected winning bid', {
      orderHash: order.orderHash,
      winner: winningBid.bidder,
      price: winningBid.price,
    });

    // Update order status
    this.orderBook.updateOrderStatus(order.orderHash, 'filled');

    // If we won, handle the completion
    if (winningBid.bidder.toLowerCase() === config.resolver.address.toLowerCase()) {
      await this.handleOurWinningBid(order, winningBid);
    }
  }

  // Handle our winning bid
  private async handleOurWinningBid(order: FusionOrder, bid: AuctionBid): Promise<void> {
    this.logger.info('We won the auction!', { 
      orderHash: order.orderHash,
      price: bid.price 
    });

    try {
      // Monitor for secret revelation and handle completion
      await this.htlcManager.monitorHTLCCompletion(order.orderHash);
      
    } catch (error) {
      this.logger.error('Error handling winning bid', error);
    }
  }

  // Add bid to auction
  private addBid(orderHash: string, bid: AuctionBid): void {
    const existingBids = this.activeBids.get(orderHash) || [];
    existingBids.push(bid);
    this.activeBids.set(orderHash, existingBids);
    
    this.logger.debug('Added bid to auction', {
      orderHash,
      bidder: bid.bidder,
      price: bid.price,
    });
  }

  // Check if we support this trading pair
  private isSupportedPair(makerAsset: string, takerAsset: string): boolean {
    const supportedAssets = [
      config.ethereum.htlcAddress,
      config.stellar.htlcContractId,
    ];

    return supportedAssets.includes(makerAsset) && supportedAssets.includes(takerAsset);
  }

  // Check if we have sufficient liquidity
  private async checkLiquidity(order: FusionOrder): Promise<boolean> {
    try {
      // Check Ethereum balance if we need to provide ETH
      if (order.takerAsset === config.ethereum.htlcAddress) {
        const ethBalance = await this.htlcManager.getEthereumBalance();
        const required = parseFloat(order.takingAmount);
        
        if (ethBalance < required * 1.1) { // 10% buffer
          return false;
        }
      }

      // Check Stellar balance if we need to provide XLM
      if (order.takerAsset === config.stellar.htlcContractId) {
        const xlmBalance = await this.htlcManager.getStellarBalance();
        const required = parseFloat(order.takingAmount);
        
        if (xlmBalance < required * 1.1) { // 10% buffer
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking liquidity', error);
      return false;
    }
  }

  // Get auction statistics
  getAuctionStats(): {
    activeAuctions: number;
    totalBids: number;
    winRate: number;
    avgPrice: string;
  } {
    const activeBids = Array.from(this.activeBids.values()).flat();
    const ourBids = activeBids.filter(bid => 
      bid.bidder.toLowerCase() === config.resolver.address.toLowerCase()
    );

    return {
      activeAuctions: this.activeBids.size,
      totalBids: ourBids.length,
      winRate: 0, // Calculate based on historical data
      avgPrice: ourBids.length > 0 
        ? (ourBids.reduce((sum, bid) => sum + parseFloat(bid.price), 0) / ourBids.length).toString()
        : '0',
    };
  }
}
