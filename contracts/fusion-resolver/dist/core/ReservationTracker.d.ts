import { ReservationTracker as IReservationTracker, AssetReservation } from "../types/liquidity";
import { AssetManager } from "./AssetManager";
export declare class ReservationTracker implements IReservationTracker {
    private assetManager;
    private logger;
    private reservations;
    private assetReservations;
    private cleanupInterval;
    private reservationTimeoutMs;
    constructor(assetManager: AssetManager, reservationTimeoutSeconds?: number);
    reserve(orderId: string, asset: string, amount: string): boolean;
    release(orderId: string): void;
    releaseByAsset(asset: string, amount: string): void;
    getReservedAmount(asset: string): string;
    getReservationsByOrder(orderId: string): AssetReservation[];
    getAllReservations(): Map<string, AssetReservation[]>;
    cleanupExpiredReservations(): void;
    private releaseReservation;
    private startCleanupInterval;
    getReservationStats(): {
        totalOrders: number;
        totalReservations: number;
        assetBreakdown: Array<{
            asset: string;
            symbol: string;
            reservedAmount: string;
            reservationCount: number;
        }>;
    };
    getExpiredReservations(): AssetReservation[];
    hasReservations(orderId: string): boolean;
    getTotalReservedValue(): Array<{
        asset: string;
        symbol: string;
        amount: string;
    }>;
    extendReservation(orderId: string, additionalTimeMs: number): boolean;
    shutdown(): void;
}
//# sourceMappingURL=ReservationTracker.d.ts.map