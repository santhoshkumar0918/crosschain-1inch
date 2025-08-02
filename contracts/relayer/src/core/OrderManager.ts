import { HTLCOrder, OrderStatus, EscrowState } from '../types';
import { InMemoryStorage } from '../storage/InMemoryStorage';
import { CryptoUtils } from '../utils/crypto';
import { ValidationUtils } from '../utils/validation';
import logger from '../utils/logger';

export class OrderManager {
  private storage: InMemoryStorage;

  constructor(storage: InMemoryStorage) {
    this.storage = storage;
  }

  async createOrder(orderData: Partial<HTLCOrder>): Promise<HTLCOrder> {
    try {
      // Validate order data
      ValidationUtils.validateOrder(orderData);

      // Create complete order object
      const order: HTLCOrder = {
        id: CryptoUtils.generateOrderId(),
        status: OrderStatus.PENDING,
        createdAt: new Date(),
        nonce: BigInt(Date.now()),
        signature: '', // Would be provided by the maker
        ...orderData
      } as HTLCOrder;

      // Store order
      await this.storage.createOrder(order);

      logger.info(`📝 Order created: ${order.id}`);
      return order;
    } catch (error) {
      logger.error(`❌ Failed to create order:`, error);
      throw error;
    }
  }

  async getOrder(orderId: string): Promise<HTLCOrder | null> {
    return await this.storage.getOrder(orderId);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    try {
      await this.storage.updateOrderStatus(orderId, status);
      logger.info(`📊 Order ${orderId} status updated to ${status}`);
    } catch (error) {
      logger.error(`❌ Failed to update order status:`, error);
      throw error;
    }
  }

  async addEscrow(orderId: string, escrow: EscrowState): Promise<void> {
    try {
      await this.storage.addEscrow(orderId, escrow);
      logger.info(`🏦 Escrow added for order ${orderId} on ${escrow.chain}`);
    } catch (error) {
      logger.error(`❌ Failed to add escrow:`, error);
      throw error;
    }
  }

  async getEscrowsForOrder(orderId: string): Promise<EscrowState[]> {
    return await this.storage.getEscrowsForOrder(orderId);
  }

  async updateEscrowStatus(
    orderId: string, 
    chain: 'ethereum' | 'stellar', 
    status: 'created' | 'claimed' | 'refunded'
  ): Promise<void> {
    try {
      await this.storage.updateEscrowStatus(orderId, chain, status);
      logger.info(`🏦 Escrow status updated for order ${orderId} on ${chain}: ${status}`);
    } catch (error) {
      logger.error(`❌ Failed to update escrow status:`, error);
      throw error;
    }
  }

  async getActiveOrders(): Promise<HTLCOrder[]> {
    return await this.storage.getActiveOrders();
  }

  async getOrdersByStatus(status: OrderStatus): Promise<HTLCOrder[]> {
    return await this.storage.getOrdersByStatus(status);
  }

  async getAllOrders(): Promise<HTLCOrder[]> {
    return await this.storage.getAllOrders();
  }

  async isSwapComplete(orderId: string): Promise<boolean> {
    try {
      const escrows = await this.getEscrowsForOrder(orderId);
      
      // Check if both escrows exist and are claimed
      if (escrows.length !== 2) return false;
      
      const ethereumEscrow = escrows.find(e => e.chain === 'ethereum');
      const stellarEscrow = escrows.find(e => e.chain === 'stellar');
      
      return ethereumEscrow?.status === 'claimed' && stellarEscrow?.status === 'claimed';
    } catch (error) {
      logger.error(`❌ Failed to check swap completion:`, error);
      return false;
    }
  }

  async getExpiredOrders(): Promise<HTLCOrder[]> {
    const activeOrders = await this.getActiveOrders();
    const now = Date.now() / 1000;
    
    return activeOrders.filter(order => order.timelock < now);
  }

  async markOrderAsExpired(orderId: string): Promise<void> {
    await this.updateOrderStatus(orderId, OrderStatus.EXPIRED);
  }

  async getOrderStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    active: number;
    completed: number;
    expired: number;
  }> {
    const stats = await this.storage.getStats();
    const activeOrders = await this.getActiveOrders();
    const completedOrders = await this.getOrdersByStatus(OrderStatus.COMPLETED);
    const expiredOrders = await this.getOrdersByStatus(OrderStatus.EXPIRED);

    return {
      total: stats.totalOrders,
      byStatus: stats.ordersByStatus,
      active: activeOrders.length,
      completed: completedOrders.length,
      expired: expiredOrders.length,
    };
  }

  async cleanupExpiredOrders(): Promise<void> {
    try {
      await this.storage.cleanupExpiredOrders();
      logger.info('🧹 Expired orders cleanup completed');
    } catch (error) {
      logger.error('❌ Failed to cleanup expired orders:', error);
    }
  }
}