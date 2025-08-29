import { FusionOrder, OrderStatus, OrderFilters, OrderStats, CreateOrderParams } from "../types";
export declare class OrderBook {
    private orders;
    private logger;
    constructor();
    createOrder(params: CreateOrderParams): Promise<FusionOrder>;
    private startAuction;
    getOrder(orderHash: string): FusionOrder | undefined;
    getActiveOrders(filters?: OrderFilters): FusionOrder[];
    updateOrderStatus(orderHash: string, status: OrderStatus, metadata?: Record<string, any>): boolean;
    private generateOrderHash;
    private calculateReservePrice;
    getStats(): OrderStats;
    private calculateTotalVolume;
    cleanupExpiredOrders(): void;
    getOrdersByMaker(maker: string): FusionOrder[];
    getOrdersByStatus(status: OrderStatus): FusionOrder[];
    hasOrder(orderHash: string): boolean;
    getTotalOrders(): number;
    startPeriodicCleanup(): void;
}
//# sourceMappingURL=OrderBook.d.ts.map