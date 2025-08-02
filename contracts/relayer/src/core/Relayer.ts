import { EventMonitor } from './EventMonitor';
import { OrderManager } from './OrderManager';
import { SecretManager } from './SecretManager';
import { EthereumClient } from '../chains/ethereum/EthereumClient';
import { StellarClient } from '../chains/stellar/StellarClient';
import { InMemoryStorage } from '../storage/InMemoryStorage';
import { HTLCOrder, OrderStatus } from '../types';
import logger from '../utils/logger';
import cron from 'node-cron';

export class Relayer {
  private eventMonitor: EventMonitor;
  private orderManager: OrderManager;
  private secretManager: SecretManager;
  private storage: InMemoryStorage;
  private ethereumClient: EthereumClient;
  private stellarClient: StellarClient;
  private isRunning: boolean = false;
  private cronJobs: cron.ScheduledTask[] = [];

  constructor(
    ethereumClient: EthereumClient,
    stellarClient: StellarClient
  ) {
    this.ethereumClient = ethereumClient;
    this.stellarClient = stellarClient;
    
    // Initialize storage
    this.storage = new InMemoryStorage();
    
    // Initialize managers
    this.orderManager = new OrderManager(this.storage);
    this.secretManager = new SecretManager(this.storage);
    
    // Initialize event monitor
    this.eventMonitor = new EventMonitor(ethereumClient, stellarClient);
    
    this.setupEventHandlers();
  }

  async start(): Promise<void> {
    if (this.isRunning) return;

    logger.info('🚀 Starting Cross-Chain HTLC Relayer...');

    try {
      // Connect to both chains
      await Promise.all([
        this.ethereumClient.connect(),
        this.stellarClient.connect()
      ]);

      // Start monitoring events
      await this.eventMonitor.startMonitoring();

      // Start periodic tasks
      this.startPeriodicTasks();

      this.isRunning = true;
      logger.info('✅ Cross-Chain HTLC Relayer started successfully');
    } catch (error) {
      logger.error('❌ Failed to start relayer:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info('⏹️ Stopping Cross-Chain HTLC Relayer...');

    // Stop periodic tasks
    this.stopPeriodicTasks();

    // Stop monitoring events
    this.eventMonitor.stopMonitoring();

    // Disconnect from chains
    await Promise.all([
      this.ethereumClient.disconnect(),
      this.stellarClient.disconnect()
    ]);

    this.isRunning = false;
    logger.info('✅ Cross-Chain HTLC Relayer stopped');
  }

  private setupEventHandlers(): void {
    this.eventMonitor.on('escrowCreated', this.handleEscrowCreated.bind(this));
    this.eventMonitor.on('secretRevealed', this.handleSecretRevealed.bind(this));
    this.eventMonitor.on('escrowClaimed', this.handleEscrowClaimed.bind(this));
    this.eventMonitor.on('escrowRefunded', this.handleEscrowRefunded.bind(this));
    this.eventMonitor.on('error', this.handleError.bind(this));
  }

  private async handleEscrowCreated(event: any): Promise<void> {
    try {
      logger.info(`📦 Processing escrow creation on ${event.chain}: ${event.orderId}`);

      // Add escrow to order
      await this.orderManager.addEscrow(event.orderId, event);

      // Notify connected clients about escrow creation
      this.notifyClients('escrowCreated', event);
    } catch (error) {
      logger.error(`❌ Failed to handle escrow creation:`, error);
    }
  }

  private async handleSecretRevealed(event: any): Promise<void> {
    try {
      logger.info(`🔐 Processing secret revelation on ${event.chain}: ${event.orderId}`);

      // Store the secret
      await this.secretManager.storeSecret(
        event.orderId,
        event.secret,
        event.chain,
        event.txHash,
        event.revealer
      );

      // Propagate secret to the other chain
      await this.propagateSecret(event);

      // Notify connected clients
      this.notifyClients('secretRevealed', event);
    } catch (error) {
      logger.error(`❌ Failed to handle secret revelation:`, error);
    }
  }

  private async propagateSecret(event: any): Promise<void> {
    try {
      const otherChain = event.chain === 'ethereum' ? 'stellar' : 'ethereum';
      const client = otherChain === 'ethereum' ? this.ethereumClient : this.stellarClient;

      logger.info(`🔄 Propagating secret from ${event.chain} to ${otherChain}`);

      // Find the corresponding escrow on the other chain
      const escrows = await this.orderManager.getEscrowsForOrder(event.orderId);
      const otherEscrow = escrows.find(e => e.chain === otherChain);

      if (otherEscrow) {
        // Claim the escrow with the revealed secret
        const txHash = await client.claimEscrow(otherEscrow.contractAddress, event.secret);
        logger.info(`✅ Secret propagated to ${otherChain}, tx: ${txHash}`);
        
        // Update escrow status
        await this.orderManager.updateEscrowStatus(event.orderId, otherChain, 'claimed');
      } else {
        logger.warn(`⚠️ No escrow found on ${otherChain} for order ${event.orderId}`);
      }
    } catch (error) {
      logger.error(`❌ Failed to propagate secret:`, error);
    }
  }

  private async handleEscrowClaimed(event: any): Promise<void> {
    try {
      logger.info(`✅ Processing escrow claim on ${event.chain}: ${event.orderId}`);

      // Update escrow status
      await this.orderManager.updateEscrowStatus(event.orderId, event.chain, 'claimed');

      // Check if swap is complete
      const isComplete = await this.orderManager.isSwapComplete(event.orderId);
      if (isComplete) {
        await this.orderManager.updateOrderStatus(event.orderId, OrderStatus.COMPLETED);
        logger.info(`🎉 Swap ${event.orderId} completed successfully!`);
        
        // Notify clients about completion
        this.notifyClients('swapCompleted', { orderId: event.orderId });
      }

      // Notify connected clients
      this.notifyClients('escrowClaimed', event);
    } catch (error) {
      logger.error(`❌ Failed to handle escrow claim:`, error);
    }
  }

  private async handleEscrowRefunded(event: any): Promise<void> {
    try {
      logger.info(`🔄 Processing escrow refund on ${event.chain}: ${event.orderId}`);

      // Update escrow status
      await this.orderManager.updateEscrowStatus(event.orderId, event.chain, 'refunded');

      // Mark order as expired
      await this.orderManager.updateOrderStatus(event.orderId, OrderStatus.EXPIRED);

      // Notify connected clients
      this.notifyClients('escrowRefunded', event);
    } catch (error) {
      logger.error(`❌ Failed to handle escrow refund:`, error);
    }
  }

  private handleError(event: any): void {
    logger.error(`❌ Chain error on ${event.chain}:`, event.error);
    
    // Notify connected clients about the error
    this.notifyClients('chainError', event);
  }

  private startPeriodicTasks(): void {
    // Check for expired orders every minute
    const expiredOrdersJob = cron.schedule('* * * * *', async () => {
      await this.checkExpiredOrders();
    }, { scheduled: false });

    // Health check every 30 seconds
    const healthCheckJob = cron.schedule('*/30 * * * * *', async () => {
      await this.performHealthCheck();
    }, { scheduled: false });

    // Cleanup task every hour
    const cleanupJob = cron.schedule('0 * * * *', async () => {
      await this.performCleanup();
    }, { scheduled: false });

    // Start all jobs
    expiredOrdersJob.start();
    healthCheckJob.start();
    cleanupJob.start();

    this.cronJobs = [expiredOrdersJob, healthCheckJob, cleanupJob];
    logger.info('⏰ Periodic tasks started');
  }

  private stopPeriodicTasks(): void {
    this.cronJobs.forEach(job => job.stop());
    this.cronJobs = [];
    logger.info('⏰ Periodic tasks stopped');
  }
  
  private async checkExpiredOrders(): Promise<void> {
    try {
      const expiredOrders = await this.orderManager.getExpiredOrders();
      
      for (const order of expiredOrders) {
        logger.info(`⏰ Order ${order.id} expired, initiating refund process`);
        await this.initiateRefund(order);
      }
    } catch (error) {
      logger.error('❌ Error checking expired orders:', error);
    }
  }

  private async initiateRefund(order: HTLCOrder): Promise<void> {
    try {
      const escrows = await this.orderManager.getEscrowsForOrder(order.id);

      for (const escrow of escrows) {
        if (escrow.status === 'created') {
          try {
            const client = escrow.chain === 'ethereum' ? this.ethereumClient : this.stellarClient;
            const txHash = await client.refundEscrow(escrow.contractAddress);
            logger.info(`💰 Refund initiated for ${escrow.chain}, tx: ${txHash}`);
          } catch (error) {
            logger.error(`❌ Refund failed for ${escrow.chain}:`, error);
          }
        }
      }

      // Mark order as expired
      await this.orderManager.markOrderAsExpired(order.id);
    } catch (error) {
      logger.error(`❌ Failed to initiate refund for order ${order.id}:`, error);
    }
  }

  private async performHealthCheck(): Promise<void> {
    try {
      const status = this.eventMonitor.getMonitoringStatus();
      
      if (!status.ethereumConnected || !status.stellarConnected) {
        logger.warn('⚠️ Chain connection issues detected');
      }

      if (!status.ethereumMonitoring || !status.stellarMonitoring) {
        logger.warn('⚠️ Chain monitoring issues detected');
      }
    } catch (error) {
      logger.error('❌ Health check failed:', error);
    }
  }

  private async performCleanup(): Promise<void> {
    try {
      // Cleanup expired orders
      await this.orderManager.cleanupExpiredOrders();
      
      // Clear secret cache
      this.secretManager.clearCache();
      
      logger.info('🧹 Cleanup completed');
    } catch (error) {
      logger.error('❌ Cleanup failed:', error);
    }
  }

  private notifyClients(event: string, data: any): void {
    // This would notify connected WebSocket clients
    // Implementation depends on the API server
    logger.debug(`📡 Notifying clients: ${event}`, data);
  }

  // Public API methods
  async createOrder(orderData: Partial<HTLCOrder>): Promise<HTLCOrder> {
    return await this.orderManager.createOrder(orderData);
  }

  async getOrder(orderId: string): Promise<HTLCOrder | null> {
    return await this.orderManager.getOrder(orderId);
  }

  async getActiveOrders(): Promise<HTLCOrder[]> {
    return await this.orderManager.getActiveOrders();
  }

  async getOrderStats(): Promise<any> {
    return await this.orderManager.getOrderStats();
  }

  async getRelayerStatus(): Promise<{
    isRunning: boolean;
    monitoring: any;
    stats: any;
  }> {
    return {
      isRunning: this.isRunning,
      monitoring: this.eventMonitor.getMonitoringStatus(),
      stats: await this.orderManager.getOrderStats(),
    };
  }

  isRelayerRunning(): boolean {
    return this.isRunning;
  }
}