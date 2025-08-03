# Fusion Resolver Liquidity Management - Requirements

## Introduction

The fusion resolver is currently unable to participate in Dutch auctions due to insufficient liquidity detection. The resolver logs show `hasLiquidity: false` for orders, preventing it from fulfilling atomic swap requests. This creates a critical bottleneck in the cross-chain swap functionality where users cannot complete their transactions.

The core issue is that the resolver needs proper liquidity management to:

1. Maintain sufficient balances on both Ethereum and Stellar networks
2. Accurately assess available liquidity for incoming orders
3. Participate in Dutch auctions when it has the required assets
4. Handle liquidity across multiple asset pairs

## Requirements

### Requirement 1: Implement Liquidity Balance Tracking

**User Story:** As a fusion resolver, I want to accurately track my available balances on both Ethereum and Stellar networks so that I can determine if I have sufficient liquidity for orders.

#### Acceptance Criteria

1. WHEN the resolver starts THEN it SHALL query and cache current balances for all supported assets on Ethereum
2. WHEN the resolver starts THEN it SHALL query and cache current balances for all supported assets on Stellar
3. WHEN a balance changes THEN the resolver SHALL update its cached balance within 30 seconds
4. WHEN checking liquidity THEN the resolver SHALL use real-time balance data
5. IF balance queries fail THEN the resolver SHALL retry with exponential backoff
6. WHEN balances are below minimum thresholds THEN the resolver SHALL log warnings

### Requirement 2: Fix Liquidity Assessment Logic

**User Story:** As a fusion resolver, I want to accurately assess whether I have sufficient liquidity for an order so that I can participate in auctions when possible.

#### Acceptance Criteria

1. WHEN receiving an order THEN the resolver SHALL check if it has sufficient balance of the taking asset
2. WHEN checking liquidity THEN the resolver SHALL account for decimal precision correctly
3. WHEN multiple orders exist THEN the resolver SHALL account for reserved liquidity
4. WHEN an order requires 158333332 units THEN the resolver SHALL convert to proper decimal format for comparison
5. IF the resolver has sufficient balance THEN hasLiquidity SHALL return true
6. WHEN liquidity check fails THEN the resolver SHALL log the specific reason (insufficient balance, conversion error, etc.)

### Requirement 3: Implement Liquidity Reservation System

**User Story:** As a fusion resolver, I want to reserve liquidity for active orders so that I don't over-commit my available balances.

#### Acceptance Criteria

1. WHEN participating in an auction THEN the resolver SHALL reserve the required taking amount
2. WHEN an order is filled THEN the resolver SHALL release the reserved liquidity
3. WHEN an order expires THEN the resolver SHALL release the reserved liquidity
4. WHEN checking new orders THEN the resolver SHALL exclude reserved amounts from available liquidity
5. IF reservation fails THEN the resolver SHALL not participate in the auction
6. WHEN multiple orders compete for the same asset THEN the resolver SHALL handle reservations fairly

### Requirement 4: Add Liquidity Monitoring and Alerts

**User Story:** As a system operator, I want to monitor resolver liquidity levels so that I can ensure adequate funding for operations.

#### Acceptance Criteria

1. WHEN liquidity falls below 20% of target levels THEN the resolver SHALL log warning alerts
2. WHEN liquidity falls below 5% of target levels THEN the resolver SHALL log critical alerts
3. WHEN balance queries fail repeatedly THEN the resolver SHALL alert about connectivity issues
4. WHEN the resolver participates in auctions THEN it SHALL log liquidity usage metrics
5. IF an asset has zero balance THEN the resolver SHALL skip orders requiring that asset
6. WHEN liquidity is restored THEN the resolver SHALL resume normal operations

### Requirement 5: Support Multi-Asset Liquidity Management

**User Story:** As a fusion resolver, I want to manage liquidity across multiple asset pairs so that I can support various cross-chain swap combinations.

#### Acceptance Criteria

1. WHEN supporting ETH-XLM swaps THEN the resolver SHALL track both ETH and XLM balances
2. WHEN supporting token swaps THEN the resolver SHALL track ERC20 and Stellar token balances
3. WHEN adding new asset pairs THEN the resolver SHALL automatically include them in liquidity tracking
4. WHEN asset prices change THEN the resolver SHALL adjust liquidity calculations accordingly
5. IF an asset pair becomes unprofitable THEN the resolver SHALL have configurable participation rules
6. WHEN rebalancing is needed THEN the resolver SHALL provide recommendations or automation
