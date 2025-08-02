import { CrossChainOrder, OrderStatus, SwapParams } from '../../../shared/types.js';
import { EthereumAdapter } from '../adapters/EthereumAdapter.js';
import { StellarAdapter } from '../adapters/StellarAdapter.js';
import { SecretManager } from './SecretManager.js';
import { RESOLVER_CONFIG } from '../config/networks.js';

export class OrderManager {
  private orders: Map<string, CrossChainOrder> = new Map();
  private ethereumAdapter: EthereumAdapter;
  private stellarAdapter: StellarAdapter;
  private secretManager: SecretManager;

  constructor() {
    this.ethereumAdapter = new EthereumAdapter();
    this.stellarAdapter = new StellarAdapter();
    this.secretManager = new SecretManager();
  }

  /**
   * Create a new cross-chain swap order
   */
  async createOrder(params: SwapParams): Promise<CrossChainOrder> {
    const orderId = this.generateOrderId();
    const secret = this.secretManager.generateSecret(orderId);
    
    const order: CrossChainOrder = {
      id: orderId,
      srcChain: params.srcChain,
      dstChain: params.dstChain,
      srcToken: params.srcToken,
      dstToken: params.dstToken,
      amount: params.amount,
      maker: this.getAdapterForChain(params.srcChain).getAddress(),
      receiver: params.receiver,
      hashlock: secret.hashlock,
      timelock: params.timelock || (Math.floor(Date.now() / 1000) + RESOLVER_CONFIG.defaultTimelockDuration),
      safetyDeposit: params.safetyDeposit,
      status: OrderStatus.Created,
      createdAt: Date.now()
    };

    this.orders.set(orderId, order);
    console.log(`📋 Created cross-chain order: ${orderId} (${params.srcChain} → ${params.dstChain})`);
    
    return order;
  }

  /**
   * Deploy HTLCs on both source and destination chains
   */
  async deployHTLCs(orderId: string): Promise<{ srcContractId: string; dstContractId: string }> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    try {
      console.log(`🚀 Deploying HTLCs for order ${orderId}...`);
      
      // Get adapters for both chains
      const srcAdapter = this.getAdapterForChain(order.srcChain);
      const dstAdapter = this.getAdapterForChain(order.dstChain);

      // Deploy source chain HTLC (user's tokens)
      const srcContractId = await srcAdapter.createHTLC(
        order.receiver,           // receiver gets the tokens
        order.amount,            // amount to lock
        order.hashlock,          // same hashlock for both
        order.timelock,          // timelock
        order.safetyDeposit      // safety deposit
      );

      // Deploy destination chain HTLC (resolver's tokens)
      const dstContractId = await dstAdapter.createHTLC(
        order.maker,             // maker (resolver) gets the tokens
        order.amount,            // equivalent amount
        order.hashlock,          // same hashlock
        order.timelock - 1800,   // 30 min earlier expiry (safety margin)
        order.safetyDeposit      // safety deposit
      );

      // Update order status
      order.status = OrderStatus.EscrowsDeployed;
      this.orders.set(orderId, order);

      console.log(`✅ HTLCs deployed for order ${orderId}:`);
      console.log(`   Source (${order.srcChain}): ${srcContractId}`);
      console.log(`   Destination (${order.dstChain}): ${dstContractId}`);

      return { srcContractId, dstContractId };
    } catch (error) {
      console.error(`❌ Failed to deploy HTLCs for order ${orderId}:`, error);
      order.status = OrderStatus.Failed;
      this.orders.set(orderId, order);
      throw error;
    }
  }

  /**
   * Execute the atomic swap by revealing the secret
   */
  async executeSwap(orderId: string, srcContractId: string, dstContractId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    const secret = this.secretManager.getSecretByOrderId(orderId);
    if (!secret) throw new Error(`Secret not found for order ${orderId}`);

    try {
      console.log(`⚡ Executing atomic swap for order ${orderId}...`);
      
      const srcAdapter = this.getAdapterForChain(order.srcChain);
      const dstAdapter = this.getAdapterForChain(order.dstChain);

      // Step 1: Withdraw from destination chain (resolver gets user's desired tokens)
      await dstAdapter.withdraw(dstContractId, secret.preimage);
      console.log(`✅ Resolver withdrew from ${order.dstChain} HTLC`);

      // Step 2: Withdraw from source chain (user gets their desired tokens)
      await srcAdapter.withdraw(srcContractId, secret.preimage);
      console.log(`✅ User withdrew from ${order.srcChain} HTLC`);

      // Mark secret as revealed and order as completed
      this.secretManager.revealSecret(secret.hashlock);
      order.status = OrderStatus.Completed;
      this.orders.set(orderId, order);

      console.log(`🎉 Atomic swap completed for order ${orderId}!`);
    } catch (error) {
      console.error(`❌ Failed to execute swap for order ${orderId}:`, error);
      order.status = OrderStatus.Failed;
      this.orders.set(orderId, order);
      throw error;
    }
  }

  /**
   * Refund HTLCs if something goes wrong
   */
  async refundHTLCs(orderId: string, srcContractId: string, dstContractId: string): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) throw new Error(`Order ${orderId} not found`);

    try {
      console.log(`🔄 Refunding HTLCs for order ${orderId}...`);
      
      const srcAdapter = this.getAdapterForChain(order.srcChain);
      const dstAdapter = this.getAdapterForChain(order.dstChain);

      // Refund both HTLCs
      await Promise.allSettled([
        srcAdapter.refund(srcContractId),
        dstAdapter.refund(dstContractId)
      ]);

      order.status = OrderStatus.Refunded;
      this.orders.set(orderId, order);

      console.log(`✅ HTLCs refunded for order ${orderId}`);
    } catch (error) {
      console.error(`❌ Failed to refund HTLCs for order ${orderId}:`, error);
      throw error;
    }
  }

  /**
   * Get order by ID
   */
  getOrder(orderId: string): CrossChainOrder | undefined {
    return this.orders.get(orderId);
  }

  /**
   * Get all orders
   */
  getAllOrders(): CrossChainOrder[] {
    return Array.from(this.orders.values());
  }

  /**
   * Get orders by status
   */
  getOrdersByStatus(status: OrderStatus): CrossChainOrder[] {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  /**
   * Process a complete cross-chain swap from start to finish
   */
  async processCompleteSwap(params: SwapParams): Promise<string> {
    try {
      // Step 1: Create order
      const order = await this.createOrder(params);
      
      // Step 2: Deploy HTLCs on both chains
      const { srcContractId, dstContractId } = await this.deployHTLCs(order.id);
      
      // Step 3: Wait a bit for confirmations (in production, would monitor events)
      await this.sleep(10000); // 10 seconds
      
      // Step 4: Execute the atomic swap
      await this.executeSwap(order.id, srcContractId, dstContractId);
      
      return order.id;
    } catch (error) {
      console.error('❌ Failed to process complete swap:', error);
      throw error;
    }
  }

  /**
   * Monitor and auto-execute pending swaps
   */
  async startAutoExecution(): Promise<void> {
    console.log('🤖 Starting automatic swap execution...');
    
    setInterval(async () => {
      const pendingOrders = this.getOrdersByStatus(OrderStatus.EscrowsDeployed);
      
      for (const order of pendingOrders) {
        try {
          // In a real implementation, you'd check if both HTLCs are confirmed
          // and then execute the swap automatically
          console.log(`🔍 Checking order ${order.id} for auto-execution...`);
        } catch (error) {
          console.error(`❌ Error in auto-execution for order ${order.id}:`, error);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  private generateOrderId(): string {
    return 'order_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private getAdapterForChain(chain: 'ethereum' | 'stellar') {
    switch (chain) {
      case 'ethereum': return this.ethereumAdapter;
      case 'stellar': return this.stellarAdapter;
      default: throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics about orders
   */
  getOrderStats(): {
    total: number;
    byStatus: Record<OrderStatus, number>;
    byChainPair: Record<string, number>;
  } {
    const orders = Array.from(this.orders.values());
    const byStatus: Record<OrderStatus, number> = {} as any;
    const byChainPair: Record<string, number> = {};

    // Initialize status counters
    Object.values(OrderStatus).forEach(status => {
      byStatus[status] = 0;
    });

    orders.forEach(order => {
      byStatus[order.status]++;
      
      const chainPair = `${order.srcChain}-to-${order.dstChain}`;
      byChainPair[chainPair] = (byChainPair[chainPair] || 0) + 1;
    });

    return {
      total: orders.length,
      byStatus,
      byChainPair
    };
  }
}