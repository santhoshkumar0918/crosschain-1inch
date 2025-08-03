export interface LiquidityManager {
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
}
export interface BalanceTracker {
    getBalance(network: "ethereum" | "stellar", asset: string): Promise<string>;
    getCachedBalance(network: "ethereum" | "stellar", asset: string): string | null;
    updateBalance(network: "ethereum" | "stellar", asset: string): Promise<string>;
    invalidateCache(network: "ethereum" | "stellar", asset?: string): void;
    startBalanceMonitoring(intervalMs: number): void;
    stopBalanceMonitoring(): void;
    onBalanceChange(callback: (network: string, asset: string, newBalance: string) => void): void;
}
export interface ReservationTracker {
    reserve(orderId: string, asset: string, amount: string): boolean;
    release(orderId: string): void;
    releaseByAsset(asset: string, amount: string): void;
    getReservedAmount(asset: string): string;
    getReservationsByOrder(orderId: string): AssetReservation[];
    getAllReservations(): Map<string, AssetReservation[]>;
    cleanupExpiredReservations(): void;
}
export interface AssetManager {
    registerAsset(config: AssetConfig): void;
    getAssetConfig(asset: string): AssetConfig | null;
    getSupportedAssets(): string[];
    convertToDecimal(asset: string, rawAmount: string): string;
    convertFromDecimal(asset: string, decimalAmount: string): string;
    isValidAsset(asset: string): boolean;
    isValidAmount(asset: string, amount: string): boolean;
}
export interface LiquidityStatus {
    totalAssets: number;
    healthyAssets: number;
    warningAssets: number;
    criticalAssets: number;
    lastUpdated: number;
    assets: AssetLiquidityStatus[];
}
export interface AssetLiquidityStatus {
    asset: string;
    network: "ethereum" | "stellar";
    totalBalance: string;
    availableBalance: string;
    reservedBalance: string;
    minimumThreshold: string;
    status: "healthy" | "warning" | "critical";
    lastUpdated: number;
}
export interface AssetReservation {
    orderId: string;
    asset: string;
    amount: string;
    timestamp: number;
    expiresAt: number;
}
export interface AssetConfig {
    address: string;
    symbol: string;
    decimals: number;
    network: "ethereum" | "stellar";
    minimumThreshold: string;
    warningThreshold: string;
    isNative: boolean;
}
export interface BalanceCache {
    balance: string;
    timestamp: number;
    ttl: number;
}
export declare enum LiquidityError {
    INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
    ASSET_NOT_SUPPORTED = "ASSET_NOT_SUPPORTED",
    RESERVATION_FAILED = "RESERVATION_FAILED",
    BALANCE_FETCH_FAILED = "BALANCE_FETCH_FAILED",
    INVALID_AMOUNT = "INVALID_AMOUNT",
    NETWORK_ERROR = "NETWORK_ERROR",
    RESERVATION_EXPIRED = "RESERVATION_EXPIRED",
    CONFIGURATION_ERROR = "CONFIGURATION_ERROR"
}
export declare class LiquidityException extends Error {
    code: LiquidityError;
    details?: any | undefined;
    constructor(code: LiquidityError, message: string, details?: any | undefined);
}
export interface BalanceChangeEvent {
    network: "ethereum" | "stellar";
    asset: string;
    oldBalance: string;
    newBalance: string;
    timestamp: number;
}
export interface LiquidityAlertEvent {
    asset: string;
    network: "ethereum" | "stellar";
    alertType: "warning" | "critical";
    currentBalance: string;
    threshold: string;
    timestamp: number;
}
export interface LiquidityConfig {
    assets: Record<string, Record<string, AssetConfig>>;
    cache: {
        ttlSeconds: number;
        updateIntervalSeconds: number;
    };
    reservations: {
        timeoutSeconds: number;
        cleanupIntervalSeconds: number;
    };
    monitoring: {
        checkIntervalSeconds: number;
        lowLiquidityThreshold: number;
        criticalLiquidityThreshold: number;
    };
}
export type NetworkType = "ethereum" | "stellar";
export type AssetStatus = "healthy" | "warning" | "critical";
export type AlertType = "warning" | "critical";
export declare const DEFAULT_CACHE_TTL = 30;
export declare const DEFAULT_RESERVATION_TIMEOUT = 300;
export declare const DEFAULT_MONITORING_INTERVAL = 10;
export declare const DEFAULT_LOW_LIQUIDITY_THRESHOLD = 0.2;
export declare const DEFAULT_CRITICAL_LIQUIDITY_THRESHOLD = 0.05;
export declare const ASSET_DECIMALS: {
    readonly ETH: 18;
    readonly XLM: 7;
    readonly USDC: 6;
    readonly USDT: 6;
};
export declare const NETWORK_NATIVE_ASSETS: {
    readonly ethereum: "ETH";
    readonly stellar: "XLM";
};
//# sourceMappingURL=liquidity.d.ts.map