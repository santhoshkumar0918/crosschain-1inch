import { HTLCOrder, EscrowState, SecretReveal, OrderStatus } from '../types';
import logger from '../utils/logger';

export class InMemoryStorage {
  private orders: Map<string, HTLCOrder> = new Map();
  private escrows: Map<string, EscrowState[]> = new Map();
  private secrets: Map<string, SecretReveal[]> = new Map();
  private ordersByStatus: Map<OrderStatus, Set<string>> = new Map();

  constructor() {
    // Initialize status maps
    Object.values(OrderStatus).forEach(status => {
      this.ordersByStatus.set(status, new Set());
    });
  }

  // Order operations
  async createOrder(order: HTLCOrder): Promise<HTLCOrder> {
    this.orders.set(order.id, order);
    this.ordersByStatus.get(order.status)?.add(order.id);
    logger.info(`Order created: ${order.id}`);
    return order;
  }

  async getOrder(orderId: string): Promise<HTLCOrder | null> {
    return this.orders.get(orderId) || null;
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
    const order = this.orders.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Remove from old status set
    this.ordersByStatus.get(order.status)?.delete(orderId);
    
    // Update order
    order.status = status;
    this.orders.set(orderId, order);
    
    // Add to new status set
    this.ordersByStatus.get(status)?.add(orderId);
    
    logger.info(`Order ${orderId} status updated to ${status}`);
  }

  async getOrdersByStatus(status: OrderStatus): Promise<HTLCOrder[]> {
    const orderIds = this.ordersByStatus.get(status) || new Set();
    const orders: HTLCOrder[] = [];
    
    for (const orderId of orderIds) {
      const order = this.orders.get(orderId);
      if (order) {
        orders.push(order);
      }
    }
    
    return orders;
  }

  async getActiveOrders(): Promise<HTLCOrder[]> {
    const activeStatuses = [
      OrderStatus.PENDING,
      OrderStatus.ESCROW_CREATED,
      OrderStatus.BOTH_ESCROWED,
      OrderStatus.SECRET_REVEALED
    ];
    
    const activeOrders: HTLCOrder[] = [];
    
    for (const status of activeStatuses) {
      const orders = await this.getOrdersByStatus(status);
      activeOrders.push(...orders);
    }
    
    return activeOrders;
  }

  // Escrow operations
  async addEscrow(orderId: string, escrow: EscrowState): Promise<void> {
    const orderEscrows = this.escrows.get(orderId) || [];
    orderEscrows.push(escrow);
    this.escrows.set(orderId, orderEscrows);
    
    logger.info(`Escrow added for order ${orderId} on ${escrow.chain}`);
    
    // Update order status based on escrow count
    if (orderEscrows.length === 1) {
      await this.updateOrderStatus(orderId, OrderStatus.ESCROW_CREATED);
    } else if (orderEscrows.length === 2) {
      await this.updateOrderStatus(orderId, OrderStatus.BOTH_ESCROWED);
    }
  }

  async getEscrowsForOrder(orderId: string): Promise<EscrowState[]> {
    return this.escrows.get(orderId) || [];
  }

  async updateEscrowStatus(orderId: string, chain: 'ethereum' | 'stellar', status: 'created' | 'claimed' | 'refunded'): Promise<void> {
    const escrows = this.escrows.get(orderId) || [];
    const escrow = escrows.find(e => e.chain === chain);
    
    if (escrow) {
      escrow.status = status;
      this.escrows.set(orderId, escrows);
      logger.info(`Escrow status updated for order ${orderId} on ${chain}: ${status}`);
    }
  }

  // Secret operations
  async storeSecret(orderId: string, secretReveal: SecretReveal): Promise<void> {
    const orderSecrets = this.secrets.get(orderId) || [];
    orderSecrets.push(secretReveal);
    this.secrets.set(orderId, orderSecrets);
    
    logger.info(`Secret stored for order ${orderId} from ${secretReveal.chain}`);
    
    // Update order status
    await this.updateOrderStatus(orderId, OrderStatus.SECRET_REVEALED);
  }

  async getSecret(orderId: string): Promise<string | null> {
    const secrets = this.secrets.get(orderId) || [];
    return secrets.length > 0 ? secrets[0].secret : null;
  }

  async isSecretRevealed(orderId: string): Promise<boolean> {
    const secrets = this.secrets.get(orderId) || [];
    return secrets.length > 0;
  }

  async getSecretHistory(orderId: string): Promise<SecretReveal[]> {
    return this.secrets.get(orderId) || [];
  }

  // Utility methods
  async getAllOrders(): Promise<HTLCOrder[]> {
    return Array.from(this.orders.values());
  }

  async getOrderCount(): Promise<number> {
    return this.orders.size;
  }

  async getStats(): Promise<{
    totalOrders: number;
    ordersByStatus: Record<string, number>;
    totalEscrows: number;
    totalSecrets: number;
  }> {
    const stats = {
      totalOrders: this.orders.size,
      ordersByStatus: {} as Record<string, number>,
      totalEscrows: Array.from(this.escrows.values()).reduce((sum, escrows) => sum + escrows.length, 0),
      totalSecrets: Array.from(this.secrets.values()).reduce((sum, secrets) => sum + secrets.length, 0),
    };

    // Count orders by status
    for (const [status, orderIds] of this.ordersByStatus.entries()) {
      stats.ordersByStatus[status] = orderIds.size;
    }

    return stats;
  }

  // Cleanup methods
  async cleanupExpiredOrders(): Promise<void> {
    const now = Date.now() / 1000;
    const expiredOrders: string[] = [];

    for (const [orderId, order] of this.orders.entries()) {
      if (order.timelock < now && order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.EXPIRED) {
        expiredOrders.push(orderId);
      }
    }

    for (const orderId of expiredOrders) {
      await this.updateOrderStatus(orderId, OrderStatus.EXPIRED);
      logger.info(`Order ${orderId} marked as expired`);
    }
  }

  async clearAll(): Promise<void> {
    this.orders.clear();
    this.escrows.clear();
    this.secrets.clear();
    
    // Clear status maps
    for (const statusSet of this.ordersByStatus.values()) {
      statusSet.clear();
    }
    
    logger.info('All storage cleared');
  }
}