// contracts/fusion-resolver/src/types/liquidity.ts

// Core liquidity management interfaces
export interface LiquidityManager {
  // Core liquidity checking
  hasLiquidity(asset: string, amount: string): Promise<boolean>;

  // Reservation system
  reserveLiquidity(
    orderId: string,
    asset: string,
    amount: string
  ): Promise<boolean>;
  releaseLiquidity(orderId: string): Promise<void>;

  // Balance management
  getAvailableBalance(asset: string): Promise<string>;
  getTotalBalance(asset: string): Promise<string>;
  getReservedBalance(asset: string): Promise<string>;

  // Configuration
  setMinimumThreshold(asset: string, threshold: string): void;
  getMinimumThreshold(asset: string): string;

  // Monitoring
  getLiquidityStatus(): Promise<LiquidityStatus>;
  startMonitoring(): void;
  stopMonitoring(): void;
}

export interface BalanceTracker {
  // Balance queries
  getBalance(network: "ethereum" | "stellar", asset: string): Promise<string>;
  getCachedBalance(
    network: "ethereum" | "stellar",
    asset: string
  ): string | null;

  // Cache management
  updateBalance(
    network: "ethereum" | "stellar",
    asset: string
  ): Promise<string>;
  invalidateCache(network: "ethereum" | "stellar", asset?: string): void;

  // Monitoring
  startBalanceMonitoring(intervalMs: number): void;
  stopBalanceMonitoring(): void;

  // Events
  onBalanceChange(
    callback: (network: string, asset: string, newBalance: string) => void
  ): void;
}

export interface ReservationTracker {
  // Reservation management
  reserve(orderId: string, asset: string, amount: string): boolean;
  release(orderId: string): void;
  releaseByAsset(asset: string, amount: string): void;

  // Queries
  getReservedAmount(asset: string): string;
  getReservationsByOrder(orderId: string): AssetReservation[];
  getAllReservations(): Map<string, AssetReservation[]>;

  // Cleanup
  cleanupExpiredReservations(): void;
}

export interface AssetManager {
  // Asset configuration
  registerAsset(config: AssetConfig): void;
  getAssetConfig(asset: string): AssetConfig | null;
  getSupportedAssets(): string[];

  // Decimal handling
  convertToDecimal(asset: string, rawAmount: string): string;
  convertFromDecimal(asset: string, decimalAmount: string): string;

  // Validation
  isValidAsset(asset: string): boolean;
  isValidAmount(asset: string, amount: string): boolean;
}

// Data models
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

// Error types
export enum LiquidityError {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ASSET_NOT_SUPPORTED = "ASSET_NOT_SUPPORTED",
  RESERVATION_FAILED = "RESERVATION_FAILED",
  BALANCE_FETCH_FAILED = "BALANCE_FETCH_FAILED",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  NETWORK_ERROR = "NETWORK_ERROR",
  RESERVATION_EXPIRED = "RESERVATION_EXPIRED",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",
}

export class LiquidityException extends Error {
  constructor(
    public code: LiquidityError,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = "LiquidityException";
  }
}

// Event types
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

// Configuration types
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

// Utility types
export type NetworkType = "ethereum" | "stellar";
export type AssetStatus = "healthy" | "warning" | "critical";
export type AlertType = "warning" | "critical";

// Constants
export const DEFAULT_CACHE_TTL = 30; // seconds
export const DEFAULT_RESERVATION_TIMEOUT = 300; // seconds
export const DEFAULT_MONITORING_INTERVAL = 10; // seconds
export const DEFAULT_LOW_LIQUIDITY_THRESHOLD = 0.2; // 20%
export const DEFAULT_CRITICAL_LIQUIDITY_THRESHOLD = 0.05; // 5%

// Asset decimals constants
export const ASSET_DECIMALS = {
  ETH: 18,
  XLM: 7,
  USDC: 6,
  USDT: 6,
} as const;

// Network-specific constants
export const NETWORK_NATIVE_ASSETS = {
  ethereum: "ETH",
  stellar: "XLM",
} as const;
