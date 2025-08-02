import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { OrderManager } from '../core/OrderManager.js';
import { SwapParams, OrderStatus } from '../../../shared/types.js';
import { RESOLVER_CONFIG } from '../config/networks.js';

export class APIServer {
  private app: express.Application;
  private orderManager: OrderManager;
  private wsServer: WebSocketServer;

  constructor() {
    this.app = express();
    this.orderManager = new OrderManager();
    this.wsServer = new WebSocketServer({ port: RESOLVER_CONFIG.port + 1 });
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  private setupMiddleware(): void {
    this.app.use(cors());
    this.app.use(express.json());
    
    // Logging middleware
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Get resolver info
    this.app.get('/info', async (req, res) => {
      try {
        const orderStats = this.orderManager.getOrderStats();
        
        res.json({
          resolver: 'CrossChain ETH ↔ Stellar Resolver',
          supportedChains: ['ethereum', 'stellar'],
          supportedTokens: {
            ethereum: ['ETH'],
            stellar: ['XLM']
          },
          stats: orderStats,
          config: {
            defaultTimelockDuration: RESOLVER_CONFIG.defaultTimelockDuration,
            safetyDepositPercentage: RESOLVER_CONFIG.safetyDepositPercentage,
            minConfirmationBlocks: RESOLVER_CONFIG.minConfirmationBlocks
          }
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get resolver info' });
      }
    });

    // Submit a new cross-chain swap order
    this.app.post('/api/orders', async (req, res) => {
      try {
        const params: SwapParams = req.body;
        
        // Validate required fields
        const requiredFields = ['srcChain', 'dstChain', 'srcToken', 'dstToken', 'amount', 'receiver'];
        for (const field of requiredFields) {
          if (!params[field as keyof SwapParams]) {
            return res.status(400).json({ error: `Missing required field: ${field}` });
          }
        }

        // Validate chain support
        if (!['ethereum', 'stellar'].includes(params.srcChain) || 
            !['ethereum', 'stellar'].includes(params.dstChain)) {
          return res.status(400).json({ error: 'Unsupported chain' });
        }

        // Validate cross-chain (not same chain)
        if (params.srcChain === params.dstChain) {
          return res.status(400).json({ error: 'Source and destination chains must be different' });
        }

        // Calculate safety deposit if not provided
        if (!params.safetyDeposit) {
          const amountNum = parseFloat(params.amount);
          params.safetyDeposit = (amountNum * RESOLVER_CONFIG.safetyDepositPercentage / 100).toString();
        }

        const order = await this.orderManager.createOrder(params);
        
        // Broadcast to WebSocket clients
        this.broadcastOrderUpdate(order);
        
        res.status(201).json({
          success: true,
          orderId: order.id,
          order
        });
      } catch (error) {
        console.error('❌ Failed to create order:', error);
        res.status(500).json({ 
          error: 'Failed to create order',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get order status
    this.app.get('/api/orders/:orderId', async (req, res) => {
      try {
        const { orderId } = req.params;
        const order = this.orderManager.getOrder(orderId);
        
        if (!order) {
          return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json({
          success: true,
          order
        });
      } catch (error) {
        console.error('❌ Failed to get order:', error);
        res.status(500).json({ error: 'Failed to get order' });
      }
    });

    // Get all orders
    this.app.get('/api/orders', async (req, res) => {
      try {
        const { status, limit = '50' } = req.query;
        let orders = this.orderManager.getAllOrders();
        
        // Filter by status if provided
        if (status && typeof status === 'string') {
          orders = orders.filter(order => order.status === status);
        }
        
        // Apply limit
        const limitNum = parseInt(limit as string);
        if (limitNum > 0) {
          orders = orders.slice(0, limitNum);
        }
        
        // Sort by creation time (newest first)
        orders.sort((a, b) => b.createdAt - a.createdAt);
        
        res.json({
          success: true,
          orders,
          total: orders.length
        });
      } catch (error) {
        console.error('❌ Failed to get orders:', error);
        res.status(500).json({ error: 'Failed to get orders' });
      }
    });

    // Execute a complete swap (for testing)
    this.app.post('/api/swap', async (req, res) => {
      try {
        const params: SwapParams = req.body;
        
        // Calculate safety deposit if not provided
        if (!params.safetyDeposit) {
          const amountNum = parseFloat(params.amount);
          params.safetyDeposit = (amountNum * RESOLVER_CONFIG.safetyDepositPercentage / 100).toString();
        }

        console.log(`🚀 Processing complete swap: ${params.srcChain} → ${params.dstChain}`);
        
        const orderId = await this.orderManager.processCompleteSwap(params);
        const order = this.orderManager.getOrder(orderId);
        
        // Broadcast completion to WebSocket clients
        if (order) {
          this.broadcastOrderUpdate(order);
        }
        
        res.json({
          success: true,
          orderId,
          message: 'Swap completed successfully',
          order
        });
      } catch (error) {
        console.error('❌ Failed to process swap:', error);
        res.status(500).json({ 
          error: 'Failed to process swap',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Get resolver statistics
    this.app.get('/api/stats', async (req, res) => {
      try {
        const orderStats = this.orderManager.getOrderStats();
        
        res.json({
          success: true,
          stats: orderStats,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Failed to get stats:', error);
        res.status(500).json({ error: 'Failed to get stats' });
      }
    });

    // Error handling middleware
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('❌ Unhandled API error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    });
  }

  private setupWebSocket(): void {
    console.log(`🔌 WebSocket server starting on port ${RESOLVER_CONFIG.port + 1}`);
    
    this.wsServer.on('connection', (ws) => {
      console.log('👋 New WebSocket client connected');
      
      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to CrossChain Resolver',
        timestamp: new Date().toISOString()
      }));
      
      // Handle client messages
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📨 WebSocket message received:', message);
          
          // Handle different message types
          switch (message.type) {
            case 'subscribe':
              // Client wants to subscribe to order updates
              ws.send(JSON.stringify({
                type: 'subscribed',
                message: 'Subscribed to order updates'
              }));
              break;
            default:
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unknown message type'
              }));
          }
        } catch (error) {
          console.error('❌ WebSocket message parsing error:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('👋 WebSocket client disconnected');
      });
    });
  }

  private broadcastOrderUpdate(order: any): void {
    const message = JSON.stringify({
      type: 'orderUpdate',
      order,
      timestamp: new Date().toISOString()
    });
    
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.app.listen(RESOLVER_CONFIG.port, () => {
        console.log(`🚀 Resolver API server running on port ${RESOLVER_CONFIG.port}`);
        console.log(`🔌 WebSocket server running on port ${RESOLVER_CONFIG.port + 1}`);
        console.log(`📋 API endpoints:`);
        console.log(`   GET  /health                - Health check`);
        console.log(`   GET  /info                  - Resolver information`);
        console.log(`   POST /api/orders            - Create new order`);
        console.log(`   GET  /api/orders            - Get all orders`);
        console.log(`   GET  /api/orders/:id        - Get specific order`);
        console.log(`   POST /api/swap              - Execute complete swap`);
        console.log(`   GET  /api/stats             - Get statistics`);
        
        // Start auto-execution monitoring
        this.orderManager.startAutoExecution();
        
        resolve();
      });
    });
  }
}