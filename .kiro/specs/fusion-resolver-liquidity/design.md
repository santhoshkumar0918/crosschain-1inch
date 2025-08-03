# Fusion Resolver Liquidity Management - Design

## Overview

The fusion resolver currently fails to participate in Dutch auctions due to inadequate liquidity management. The core issue is in the `checkLiquidity` method within `DutchAuction.ts`, which performs basic balance checks but lacks proper decimal handling, balance caching, liquidity reservation, and multi-asset support.

This design addresses the liquidity management problem by implementing a comprehensive `LiquidityManager` component that will:

- Track real-time balances across Ethereum and Stellar networks
- Handle decimal precision correctly for different asset types
- Implement liquidity reservation for active orders
- Provide monitoring and alerting capabilities
- Support multiple asset pairs with configurable thresholds

## Architecture

### Current Architecture Issues

The existing `DutchAuction.checkLiquidity()` method has several problems:

1. **Decimal Precision**: Compares raw amounts without proper decimal conversion
2. **No Caching**: Makes RPC calls for every liquidity check
3. **No Reservation**: Doesn't account for liquidity already committed to other orders
4. **Limited Assets**: Only supports ETH and XLM
5. **No Monitoring**: No alerts when liquidity is low

### New Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   DutchAuction  │    │ LiquidityManager│    │  BalanceTracker │
│                 │────│                 │────│                 │
│ checkLiquidity()│    │ hasLiquidity()  │    │ getBalance()    │
└─────────────────┘    │ reserveLiquidity│    │ updateBalance() │
                       │ releaseLiquidity│    │ startMonitoring │
                       └─────────────────┘    └─────────────────┘
                                │
                                │
                       ┌─────────────────┐
                       │ReservationTracker│
                       │                 │
                       │ reserve()       │
                       │ release()       │
                       │ getAvailable()  │
                       └─────────────────┘
```

## Components and Interfaces

### 1. LiquidityManager

The main orchestrator for all liquidity operations.

```typescript
interface LiquidityManager {
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
  getLiquidityStatus(): LiquidityStatus;
  startMonitoring(): void;
  stopMonitoring(): void;
}
```

### 2. BalanceTracker

Handles real-time balance tracking with caching and automatic updates.

```typescript
interface BalanceTracker {
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
```

### 3. ReservationTracker

Manages liquidity reservations for active orders.

```typescript
interface ReservationTracker {
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
```

### 4. AssetManager

Handles asset-specific configurations and decimal conversions.

```typescript
interface AssetManager {
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
```

## Data Models

### Core Data Structures

```typescript
interface LiquidityStatus {
  totalAssets: number;
  healthyAssets: number;
  warningAssets: number;
  criticalAssets: number;
  lastUpdated: number;
  assets: AssetLiquidityStatus[];
}

interface AssetLiquidityStatus {
  asset: string;
  network: "ethereum" | "stellar";
  totalBalance: string;
  availableBalance: string;
  reservedBalance: string;
  minimumThreshold: string;
  status: "healthy" | "warning" | "critical";
  lastUpdated: number;
}

interface AssetReservation {
  orderId: string;
  asset: string;
  amount: string;
  timestamp: number;
  expiresAt: number;
}

interface AssetConfig {
  address: string;
  symbol: string;
  decimals: number;
  network: "ethereum" | "stellar";
  minimumThreshold: string;
  warningThreshold: string;
  isNative: boolean;
}

interface BalanceCache {
  balance: string;
  timestamp: number;
  ttl: number;
}
```

## Error Handling

### Error Types

```typescript
enum LiquidityError {
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  ASSET_NOT_SUPPORTED = "ASSET_NOT_SUPPORTED",
  RESERVATION_FAILED = "RESERVATION_FAILED",
  BALANCE_FETCH_FAILED = "BALANCE_FETCH_FAILED",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  NETWORK_ERROR = "NETWORK_ERROR",
}

class LiquidityException extends Error {
  constructor(
    public code: LiquidityError,
    message: string,
    public details?: any
  ) {
    super(message);
  }
}
```

### Error Handling Strategy

1. **Network Failures**: Retry with exponential backoff, use cached values as fallback
2. **Insufficient Liquidity**: Log warning, skip auction participation
3. **Invalid Assets**: Log error, reject request immediately
4. **Reservation Conflicts**: Use first-come-first-served with timeout
5. **Balance Fetch Failures**: Use cached values if available, otherwise assume zero balance

## Testing Strategy

### Unit Tests

1. **LiquidityManager Tests**

   - Test liquidity checking with various asset amounts
   - Test reservation and release cycles
   - Test threshold management
   - Test error handling scenarios

2. **BalanceTracker Tests**

   - Test balance fetching from both networks
   - Test cache behavior and TTL
   - Test balance monitoring and updates
   - Test network failure scenarios

3. **ReservationTracker Tests**

   - Test reservation creation and release
   - Test concurrent reservation attempts
   - Test expiration cleanup
   - Test edge cases with zero amounts

4. **AssetManager Tests**
   - Test decimal conversion accuracy
   - Test asset configuration management
   - Test validation functions
   - Test unsupported asset handling

### Integration Tests

1. **End-to-End Liquidity Flow**

   - Create order → Check liquidity → Reserve → Participate → Release
   - Test with real network connections (testnet)
   - Test with multiple concurrent orders

2. **Network Integration**

   - Test Ethereum balance fetching with various tokens
   - Test Stellar balance fetching with native and custom assets
   - Test network failure recovery

3. **Performance Tests**
   - Test balance checking performance under load
   - Test cache effectiveness
   - Test memory usage with many reservations

### Mock Testing

1. **Network Mocks**

   - Mock Ethereum RPC responses
   - Mock Stellar Horizon API responses
   - Simulate network delays and failures

2. **Time-based Mocks**
   - Mock cache expiration
   - Mock reservation timeouts
   - Mock balance update intervals

## Implementation Phases

### Phase 1: Core Infrastructure

- Implement `AssetManager` with decimal handling
- Implement `BalanceTracker` with caching
- Create basic `LiquidityManager` interface
- Add comprehensive logging

### Phase 2: Reservation System

- Implement `ReservationTracker`
- Add reservation logic to `LiquidityManager`
- Integrate with existing `DutchAuction` class
- Add reservation cleanup mechanisms

### Phase 3: Monitoring and Alerts

- Add balance monitoring with configurable intervals
- Implement threshold-based alerting
- Add liquidity status reporting
- Create health check endpoints

### Phase 4: Multi-Asset Support

- Extend asset configurations for ERC20 tokens
- Add support for Stellar custom assets
- Implement cross-asset liquidity calculations
- Add asset-specific trading rules

### Phase 5: Optimization and Reliability

- Implement advanced caching strategies
- Add circuit breakers for network calls
- Optimize for high-frequency trading
- Add comprehensive metrics and monitoring

## Configuration

### Environment Variables

```bash
# Liquidity thresholds (in decimal format)
LIQUIDITY_ETH_MIN_THRESHOLD=0.1
LIQUIDITY_XLM_MIN_THRESHOLD=1000
LIQUIDITY_USDC_MIN_THRESHOLD=100

# Cache settings
BALANCE_CACHE_TTL_SECONDS=30
BALANCE_UPDATE_INTERVAL_SECONDS=15

# Reservation settings
RESERVATION_TIMEOUT_SECONDS=300
RESERVATION_CLEANUP_INTERVAL_SECONDS=60

# Monitoring settings
LIQUIDITY_CHECK_INTERVAL_SECONDS=10
LOW_LIQUIDITY_ALERT_THRESHOLD=0.2
CRITICAL_LIQUIDITY_ALERT_THRESHOLD=0.05
```

### Asset Configuration

```json
{
  "assets": {
    "ethereum": {
      "native": {
        "address": "0x0000000000000000000000000000000000000000",
        "symbol": "ETH",
        "decimals": 18,
        "minimumThreshold": "0.1",
        "warningThreshold": "0.5"
      },
      "usdc": {
        "address": "0xa0b86a33e6e55d1c7b2e8f3d3a9f4c9a8b3f5e6d",
        "symbol": "USDC",
        "decimals": 6,
        "minimumThreshold": "100",
        "warningThreshold": "500"
      }
    },
    "stellar": {
      "native": {
        "address": "native",
        "symbol": "XLM",
        "decimals": 7,
        "minimumThreshold": "1000",
        "warningThreshold": "5000"
      }
    }
  }
}
```

This design provides a robust foundation for solving the liquidity management issues while maintaining compatibility with the existing codebase and allowing for future extensibility.
