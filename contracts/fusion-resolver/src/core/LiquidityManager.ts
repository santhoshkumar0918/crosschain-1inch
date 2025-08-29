// contracts/fusion-resolver/src/core/LiquidityManager.ts
import {
  LiquidityManager as ILiquidityManager,
  LiquidityStatus,
  AssetLiquidityStatus,
  LiquidityError,
  LiquidityException,
  AssetStatus,
  DEFAULT_MONITORING_INTERVAL,
  DEFAULT_LOW_LIQUIDITY_THRESHOLD,
  DEFAULT_CRITICAL_LIQUIDITY_THRESHOLD,
} from "../types/liquidity";
import { AssetManager } from "./AssetManager";
import { BalanceTracker } from "./BalanceTracker";
import { ReservationTracker } from "./ReservationTracker";
import { Logger } from "../utils/logger";

export class LiquidityManager implements ILiquidityManager {
  private logger = new Logger("LiquidityManager");
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;

  constructor(
    private assetManager: AssetManager,
    private balanceTracker: BalanceTracker,
    private reservationTracker: ReservationTracker
  ) {
    this.logger.info("LiquidityManager initialized");

    // Set up balance change monitoring
    this.balanceTracker.onBalanceChange((network, asset, newBalance) => {
      this.handleBalanceChange(network, asset, newBalance);
    });
  }

  // Core liquidity checking
  async hasLiquidity(asset: string, amount: string): Promise<boolean> {
    try {
      this.logger.debug("Checking liquidity", {
        asset: this.assetManager.getAssetSymbol(asset),
        requestedAmount: this.assetManager.convertToDecimal(asset, amount),
      });

      // Validate inputs
      if (!this.assetManager.isValidAsset(asset)) {
        throw new LiquidityException(
          LiquidityError.ASSET_NOT_SUPPORTED,
          `Asset not supported: ${asset}`,
          { asset, amount }
        );
      }

      if (!this.assetManager.isValidAmount(asset, amount)) {
        throw new LiquidityException(
          LiquidityError.INVALID_AMOUNT,
          `Invalid amount: ${amount}`,
          { asset, amount }
        );
      }

      // Get asset configuration
      const assetConfig = this.assetManager.getAssetConfig(asset);
      if (!assetConfig) {
        throw new LiquidityException(
          LiquidityError.ASSET_NOT_SUPPORTED,
          `Asset configuration not found: ${asset}`,
          { asset }
        );
      }

      // Get current balance
      const totalBalance = await this.balanceTracker.getBalance(
        assetConfig.network,
        asset
      );

      // Get reserved amount
      const reservedAmount = this.reservationTracker.getReservedAmount(asset);

      // Calculate available balance
      const availableBalance = this.assetManager.subtractAmounts(
        asset,
        totalBalance,
        reservedAmount
      );

      // Check if we have enough available balance
      const hasEnough =
        this.assetManager.compareAmounts(asset, availableBalance, amount) >= 0;

      // Also check minimum threshold
      const minimumThreshold = this.assetManager.convertFromDecimal(
        asset,
        assetConfig.minimumThreshold
      );
      const remainingAfterUse = hasEnough
        ? this.assetManager.subtractAmounts(asset, availableBalance, amount)
        : availableBalance;

      const meetsMinimum =
        this.assetManager.compareAmounts(
          asset,
          remainingAfterUse,
          minimumThreshold
        ) >= 0;

      const result = hasEnough && meetsMinimum;

      this.logger.info("Liquidity check completed", {
        asset: this.assetManager.getAssetSymbol(asset),
        requestedAmount: this.assetManager.convertToDecimal(asset, amount),
        totalBalance: this.assetManager.convertToDecimal(asset, totalBalance),
        reservedAmount: this.assetManager.convertToDecimal(
          asset,
          reservedAmount
        ),
        availableBalance: this.assetManager.convertToDecimal(
          asset,
          availableBalance
        ),
        minimumThreshold: assetConfig.minimumThreshold,
        remainingAfterUse: this.assetManager.convertToDecimal(
          asset,
          remainingAfterUse
        ),
        hasEnough,
        meetsMinimum,
        result,
      });

      return result;
    } catch (error) {
      this.logger.error("Failed to check liquidity", {
        asset: this.assetManager.getAssetSymbol(asset),
        amount,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof LiquidityException) {
        throw error;
      }

      throw new LiquidityException(
        LiquidityError.BALANCE_FETCH_FAILED,
        `Failed to check liquidity: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, amount, error }
      );
    }
  }

  // Reservation system
  async reserveLiquidity(
    orderId: string,
    asset: string,
    amount: string
  ): Promise<boolean> {
    try {
      this.logger.info("Attempting to reserve liquidity", {
        orderId,
        asset: this.assetManager.getAssetSymbol(asset),
        amount: this.assetManager.convertToDecimal(asset, amount),
      });

      // First check if we have enough liquidity
      const hasEnough = await this.hasLiquidity(asset, amount);
      if (!hasEnough) {
        this.logger.warn("Insufficient liquidity for reservation", {
          orderId,
          asset: this.assetManager.getAssetSymbol(asset),
          amount: this.assetManager.convertToDecimal(asset, amount),
        });
        return false;
      }

      // Reserve the liquidity
      const reserved = this.reservationTracker.reserve(orderId, asset, amount);

      if (reserved) {
        this.logger.info("Liquidity reserved successfully", {
          orderId,
          asset: this.assetManager.getAssetSymbol(asset),
          amount: this.assetManager.convertToDecimal(asset, amount),
        });
      }

      return reserved;
    } catch (error) {
      this.logger.error("Failed to reserve liquidity", {
        orderId,
        asset: this.assetManager.getAssetSymbol(asset),
        amount,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof LiquidityException) {
        throw error;
      }

      throw new LiquidityException(
        LiquidityError.RESERVATION_FAILED,
        `Failed to reserve liquidity: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { orderId, asset, amount, error }
      );
    }
  }

  async releaseLiquidity(orderId: string): Promise<void> {
    try {
      this.logger.info("Releasing liquidity for order", { orderId });

      const reservations =
        this.reservationTracker.getReservationsByOrder(orderId);
      if (reservations.length === 0) {
        this.logger.debug("No reservations found for order", { orderId });
        return;
      }

      this.reservationTracker.release(orderId);

      this.logger.info("Liquidity released successfully", {
        orderId,
        reservationsReleased: reservations.length,
      });
    } catch (error) {
      this.logger.error("Failed to release liquidity", {
        orderId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // Balance management
  async getAvailableBalance(asset: string): Promise<string> {
    try {
      if (!this.assetManager.isValidAsset(asset)) {
        throw new LiquidityException(
          LiquidityError.ASSET_NOT_SUPPORTED,
          `Asset not supported: ${asset}`,
          { asset }
        );
      }

      const assetConfig = this.assetManager.getAssetConfig(asset)!;
      const totalBalance = await this.balanceTracker.getBalance(
        assetConfig.network,
        asset
      );
      const reservedAmount = this.reservationTracker.getReservedAmount(asset);

      return this.assetManager.subtractAmounts(
        asset,
        totalBalance,
        reservedAmount
      );
    } catch (error) {
      this.logger.error("Failed to get available balance", {
        asset: this.assetManager.getAssetSymbol(asset),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async getTotalBalance(asset: string): Promise<string> {
    try {
      if (!this.assetManager.isValidAsset(asset)) {
        throw new LiquidityException(
          LiquidityError.ASSET_NOT_SUPPORTED,
          `Asset not supported: ${asset}`,
          { asset }
        );
      }

      const assetConfig = this.assetManager.getAssetConfig(asset)!;
      return await this.balanceTracker.getBalance(assetConfig.network, asset);
    } catch (error) {
      this.logger.error("Failed to get total balance", {
        asset: this.assetManager.getAssetSymbol(asset),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  async getReservedBalance(asset: string): Promise<string> {
    try {
      if (!this.assetManager.isValidAsset(asset)) {
        throw new LiquidityException(
          LiquidityError.ASSET_NOT_SUPPORTED,
          `Asset not supported: ${asset}`,
          { asset }
        );
      }

      return this.reservationTracker.getReservedAmount(asset);
    } catch (error) {
      this.logger.error("Failed to get reserved balance", {
        asset: this.assetManager.getAssetSymbol(asset),
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Configuration
  setMinimumThreshold(asset: string, threshold: string): void {
    try {
      this.assetManager.setMinimumThreshold(asset, threshold);
      this.logger.info("Minimum threshold updated", {
        asset: this.assetManager.getAssetSymbol(asset),
        threshold,
      });
    } catch (error) {
      this.logger.error("Failed to set minimum threshold", {
        asset: this.assetManager.getAssetSymbol(asset),
        threshold,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  getMinimumThreshold(asset: string): string {
    return this.assetManager.getMinimumThreshold(asset);
  }

  // Monitoring
  async getLiquidityStatus(): Promise<LiquidityStatus> {
    try {
      const supportedAssets = this.assetManager.getSupportedAssets();
      const assetStatuses: AssetLiquidityStatus[] = [];

      let healthyAssets = 0;
      let warningAssets = 0;
      let criticalAssets = 0;

      for (const asset of supportedAssets) {
        try {
          const assetStatus = await this.getAssetLiquidityStatus(asset);
          assetStatuses.push(assetStatus);

          switch (assetStatus.status) {
            case "healthy":
              healthyAssets++;
              break;
            case "warning":
              warningAssets++;
              break;
            case "critical":
              criticalAssets++;
              break;
          }
        } catch (error) {
          this.logger.warn("Failed to get status for asset", {
            asset: this.assetManager.getAssetSymbol(asset),
            error: error instanceof Error ? error.message : "Unknown error",
          });

          // Add as critical status
          const assetConfig = this.assetManager.getAssetConfig(asset)!;
          assetStatuses.push({
            asset,
            network: assetConfig.network,
            totalBalance: "0",
            availableBalance: "0",
            reservedBalance: "0",
            minimumThreshold: assetConfig.minimumThreshold,
            status: "critical",
            lastUpdated: Date.now(),
          });
          criticalAssets++;
        }
      }

      const status: LiquidityStatus = {
        totalAssets: supportedAssets.length,
        healthyAssets,
        warningAssets,
        criticalAssets,
        lastUpdated: Date.now(),
        assets: assetStatuses,
      };

      return status;
    } catch (error) {
      this.logger.error("Failed to get liquidity status", error);
      throw new LiquidityException(
        LiquidityError.BALANCE_FETCH_FAILED,
        `Failed to get liquidity status: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { error }
      );
    }
  }

  startMonitoring(): void {
    if (this.isMonitoring) {
      this.logger.warn("Monitoring is already active");
      return;
    }

    // Start balance monitoring
    this.balanceTracker.startBalanceMonitoring(
      DEFAULT_MONITORING_INTERVAL * 1000
    );

    // Start liquidity status monitoring
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkLiquidityAlerts();
      } catch (error) {
        this.logger.error("Error during liquidity monitoring", error);
      }
    }, DEFAULT_MONITORING_INTERVAL * 1000);

    this.isMonitoring = true;
    this.logger.info("Liquidity monitoring started", {
      intervalSeconds: DEFAULT_MONITORING_INTERVAL,
    });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    // Stop balance monitoring
    this.balanceTracker.stopBalanceMonitoring();

    // Stop liquidity monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.isMonitoring = false;
    this.logger.info("Liquidity monitoring stopped");
  }

  // Private helper methods
  private async getAssetLiquidityStatus(
    asset: string
  ): Promise<AssetLiquidityStatus> {
    const assetConfig = this.assetManager.getAssetConfig(asset)!;
    const totalBalance = await this.balanceTracker.getBalance(
      assetConfig.network,
      asset
    );
    const reservedBalance = this.reservationTracker.getReservedAmount(asset);
    const availableBalance = this.assetManager.subtractAmounts(
      asset,
      totalBalance,
      reservedBalance
    );

    // Determine status based on thresholds
    const minimumThreshold = this.assetManager.convertFromDecimal(
      asset,
      assetConfig.minimumThreshold
    );
    const warningThreshold = this.assetManager.convertFromDecimal(
      asset,
      assetConfig.warningThreshold
    );

    let status: AssetStatus = "healthy";

    if (
      this.assetManager.compareAmounts(
        asset,
        availableBalance,
        minimumThreshold
      ) < 0
    ) {
      status = "critical";
    } else if (
      this.assetManager.compareAmounts(
        asset,
        availableBalance,
        warningThreshold
      ) < 0
    ) {
      status = "warning";
    }

    return {
      asset,
      network: assetConfig.network,
      totalBalance: this.assetManager.convertToDecimal(asset, totalBalance),
      availableBalance: this.assetManager.convertToDecimal(
        asset,
        availableBalance
      ),
      reservedBalance: this.assetManager.convertToDecimal(
        asset,
        reservedBalance
      ),
      minimumThreshold: assetConfig.minimumThreshold,
      status,
      lastUpdated: Date.now(),
    };
  }

  private async checkLiquidityAlerts(): Promise<void> {
    try {
      const status = await this.getLiquidityStatus();

      for (const assetStatus of status.assets) {
        if (assetStatus.status === "critical") {
          this.logger.error(
            "🚨 CRITICAL: Asset liquidity below minimum threshold",
            {
              asset: this.assetManager.getAssetSymbol(assetStatus.asset),
              availableBalance: assetStatus.availableBalance,
              minimumThreshold: assetStatus.minimumThreshold,
              network: assetStatus.network,
            }
          );
        } else if (assetStatus.status === "warning") {
          this.logger.warn(
            "⚠️ WARNING: Asset liquidity below warning threshold",
            {
              asset: this.assetManager.getAssetSymbol(assetStatus.asset),
              availableBalance: assetStatus.availableBalance,
              warningThreshold: this.assetManager.getWarningThreshold(
                assetStatus.asset
              ),
              network: assetStatus.network,
            }
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to check liquidity alerts", error);
    }
  }

  private handleBalanceChange(
    network: string,
    asset: string,
    newBalance: string
  ): void {
    this.logger.info("Balance change detected", {
      network,
      asset: this.assetManager.getAssetSymbol(asset),
      newBalance: this.assetManager.convertToDecimal(asset, newBalance),
    });
  }

  // Utility methods
  async refreshAllBalances(): Promise<void> {
    try {
      await this.balanceTracker.refreshAllBalances();
      this.logger.info("All balances refreshed");
    } catch (error) {
      this.logger.error("Failed to refresh all balances", error);
      throw error;
    }
  }

  getReservationStats() {
    return this.reservationTracker.getReservationStats();
  }

  // Check if we can handle a specific order amount
  async canHandleOrder(
    asset: string,
    amount: string,
    orderId?: string
  ): Promise<{
    canHandle: boolean;
    reason?: string;
    availableBalance: string;
    requiredAmount: string;
    minimumThreshold: string;
  }> {
    try {
      const availableBalance = await this.getAvailableBalance(asset);
      const assetConfig = this.assetManager.getAssetConfig(asset)!;
      const minimumThreshold = this.assetManager.convertFromDecimal(
        asset,
        assetConfig.minimumThreshold
      );

      // Check if we have enough available balance
      const hasEnough =
        this.assetManager.compareAmounts(asset, availableBalance, amount) >= 0;

      if (!hasEnough) {
        return {
          canHandle: false,
          reason: "Insufficient available balance",
          availableBalance: this.assetManager.convertToDecimal(
            asset,
            availableBalance
          ),
          requiredAmount: this.assetManager.convertToDecimal(asset, amount),
          minimumThreshold: assetConfig.minimumThreshold,
        };
      }

      // Check if we would still meet minimum threshold after using this amount
      const remainingAfterUse = this.assetManager.subtractAmounts(
        asset,
        availableBalance,
        amount
      );
      const meetsMinimum =
        this.assetManager.compareAmounts(
          asset,
          remainingAfterUse,
          minimumThreshold
        ) >= 0;

      if (!meetsMinimum) {
        return {
          canHandle: false,
          reason: "Would fall below minimum threshold",
          availableBalance: this.assetManager.convertToDecimal(
            asset,
            availableBalance
          ),
          requiredAmount: this.assetManager.convertToDecimal(asset, amount),
          minimumThreshold: assetConfig.minimumThreshold,
        };
      }

      return {
        canHandle: true,
        availableBalance: this.assetManager.convertToDecimal(
          asset,
          availableBalance
        ),
        requiredAmount: this.assetManager.convertToDecimal(asset, amount),
        minimumThreshold: assetConfig.minimumThreshold,
      };
    } catch (error) {
      return {
        canHandle: false,
        reason: `Error checking liquidity: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        availableBalance: "0",
        requiredAmount: this.assetManager.convertToDecimal(asset, amount),
        minimumThreshold: "0",
      };
    }
  }

  // Shutdown cleanup
  shutdown(): void {
    this.stopMonitoring();
    this.reservationTracker.shutdown();
    this.logger.info("LiquidityManager shutdown completed");
  }
}
