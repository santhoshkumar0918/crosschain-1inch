import { LiquidityManager as ILiquidityManager, LiquidityStatus } from "../types/liquidity";
import { AssetManager } from "./AssetManager";
import { BalanceTracker } from "./BalanceTracker";
import { ReservationTracker } from "./ReservationTracker";
export declare class LiquidityManager implements ILiquidityManager {
    private assetManager;
    private balanceTracker;
    private reservationTracker;
    private logger;
    private monitoringInterval;
    private isMonitoring;
    constructor(assetManager: AssetManager, balanceTracker: BalanceTracker, reservationTracker: ReservationTracker);
    hasLiquidity(asset: string, amount: string): Promise<boolean>;
    reserveLiquidity(orderId: string, asset: string, amount: string): Promise<boolean>;
    releaseLiquidity(orderId: string): Promise<void>;
    getAvailableBalance(asset: string): Promise<string>;
    getTotalBalance(asset: string): Promise<string>;
    getReservedBalance(asset: string): Promise<string>;
    setMinimumThreshold(asset: string, threshold: string): void;
    getMinimumThreshold(asset: string): string;
    getLiquidityStatus(): Promise<LiquidityStatus>;
    startMonitoring(): void;
    stopMonitoring(): void;
    private getAssetLiquidityStatus;
    private checkLiquidityAlerts;
    private handleBalanceChange;
    refreshAllBalances(): Promise<void>;
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
    canHandleOrder(asset: string, amount: string, orderId?: string): Promise<{
        canHandle: boolean;
        reason?: string;
        availableBalance: string;
        requiredAmount: string;
        minimumThreshold: string;
    }>;
    shutdown(): void;
}
//# sourceMappingURL=LiquidityManager.d.ts.map