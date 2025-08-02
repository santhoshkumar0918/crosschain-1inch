import { HTLCOrder, EscrowState, SecretReveal, OrderStatus } from '../types';
export declare class InMemoryStorage {
    private orders;
    private escrows;
    private secrets;
    private ordersByStatus;
    constructor();
    createOrder(order: HTLCOrder): Promise<HTLCOrder>;
    getOrder(orderId: string): Promise<HTLCOrder | null>;
    updateOrderStatus(orderId: string, status: OrderStatus): Promise<void>;
    getOrdersByStatus(status: OrderStatus): Promise<HTLCOrder[]>;
    getActiveOrders(): Promise<HTLCOrder[]>;
    addEscrow(orderId: string, escrow: EscrowState): Promise<void>;
    getEscrowsForOrder(orderId: string): Promise<EscrowState[]>;
    updateEscrowStatus(orderId: string, chain: 'ethereum' | 'stellar', status: 'created' | 'claimed' | 'refunded'): Promise<void>;
    storeSecret(orderId: string, secretReveal: SecretReveal): Promise<void>;
    getSecret(orderId: string): Promise<string | null>;
    isSecretRevealed(orderId: string): Promise<boolean>;
    getSecretHistory(orderId: string): Promise<SecretReveal[]>;
    getAllOrders(): Promise<HTLCOrder[]>;
    getOrderCount(): Promise<number>;
    getStats(): Promise<{
        totalOrders: number;
        ordersByStatus: Record<string, number>;
        totalEscrows: number;
        totalSecrets: number;
    }>;
    cleanupExpiredOrders(): Promise<void>;
    clearAll(): Promise<void>;
}
//# sourceMappingURL=InMemoryStorage.d.ts.map