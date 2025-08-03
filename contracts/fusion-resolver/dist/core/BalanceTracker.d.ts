import { BalanceTracker as IBalanceTracker, NetworkType } from "../types/liquidity";
import { AssetManager } from "./AssetManager";
export declare class BalanceTracker implements IBalanceTracker {
    private assetManager;
    private logger;
    private balanceCache;
    private monitoringInterval;
    private balanceChangeCallbacks;
    private ethProvider;
    private stellarServer;
    private readonly ERC20_ABI;
    constructor(assetManager: AssetManager);
    getBalance(network: NetworkType, asset: string): Promise<string>;
    getCachedBalance(network: NetworkType, asset: string, ignoreTTL?: boolean): string | null;
    updateBalance(network: NetworkType, asset: string): Promise<string>;
    invalidateCache(network: NetworkType, asset?: string): void;
    startBalanceMonitoring(intervalMs: number): void;
    stopBalanceMonitoring(): void;
    onBalanceChange(callback: (network: string, asset: string, newBalance: string) => void): void;
    private fetchBalance;
    private fetchEthereumBalance;
    private fetchStellarBalance;
    private setCachedBalance;
    private getCacheKey;
    private updateAllBalances;
    private triggerBalanceChangeEvent;
    getCacheStats(): {
        totalEntries: number;
        validEntries: number;
        expiredEntries: number;
    };
    clearExpiredCache(): void;
    getAllCachedBalances(): Map<string, {
        balance: string;
        timestamp: number;
        isExpired: boolean;
    }>;
    refreshAllBalances(): Promise<void>;
    getBalanceWithRetry(network: NetworkType, asset: string, maxRetries?: number, retryDelayMs?: number): Promise<string>;
}
//# sourceMappingURL=BalanceTracker.d.ts.map