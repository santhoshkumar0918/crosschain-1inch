import { HTLCOrder, OrderStatus, EscrowState } from '../types';
import { InMemoryStorage } from '../storage/InMemoryStorage';
export declare class OrderManager {
    private storage;
    constructor(storage: InMemoryStorage);
    createOrder(orderData: Partial<HTLCOrder>): Promise<HTLCOrder>;
    getOrder(orderId: string): Promise<HTLCOrder | null>;
    updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
    addEscrow(orderId: string, escrow: EscrowState): Promise<void>;
    getEscrowsForOrder(orderId: string): Promise<EscrowState[]>;
    updateEscrowStatus(orderId: string, chain: 'ethereum' | 'stellar', status: 'created' | 'claimed' | 'refunded'): Promise<void>;
    getActiveOrders(): Promise<HTLCOrder[]>;
    getOrdersByStatus(status: OrderStatus): Promise<HTLCOrder[]>;
    getAllOrders(): Promise<HTLCOrder[]>;
    isSwapComplete(orderId: string): Promise<boolean>;
    getExpiredOrders(): Promise<HTLCOrder[]>;
    markOrderAsExpired(orderId: string): Promise<void>;
    getOrderStats(): Promise<{
        total: number;
        byStatus: Record<string, number>;
        active: number;
        completed: number;
        expired: number;
    }>;
    cleanupExpiredOrders(): Promise<void>;
}
//# sourceMappingURL=OrderManager.d.ts.map