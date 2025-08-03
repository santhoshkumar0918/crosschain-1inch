// contracts/fusion-resolver/src/core/AssetManager.ts
import {
  AssetManager as IAssetManager,
  AssetConfig,
  LiquidityError,
  LiquidityException,
  ASSET_DECIMALS,
  NETWORK_NATIVE_ASSETS,
} from "../types/liquidity";
import { Logger } from "../utils/logger";
import { config } from "../utils/config";

export class AssetManager implements IAssetManager {
  private logger = new Logger("AssetManager");
  private assets = new Map<string, AssetConfig>();

  constructor() {
    this.initializeDefaultAssets();
    this.logger.info("AssetManager initialized", {
      supportedAssets: this.getSupportedAssets().length,
    });
  }

  // Initialize default assets based on current configuration
  private initializeDefaultAssets(): void {
    // Ethereum native asset (ETH)
    this.registerAsset({
      address: config.ethereum.htlcAddress,
      symbol: "ETH",
      decimals: ASSET_DECIMALS.ETH,
      network: "ethereum",
      minimumThreshold: "0.1", // 0.1 ETH
      warningThreshold: "0.5", // 0.5 ETH
      isNative: true,
    });

    // Stellar native asset (XLM)
    this.registerAsset({
      address: config.stellar.htlcContractId,
      symbol: "XLM",
      decimals: ASSET_DECIMALS.XLM,
      network: "stellar",
      minimumThreshold: "1000", // 1000 XLM
      warningThreshold: "5000", // 5000 XLM
      isNative: true,
    });

    this.logger.info("Default assets initialized", {
      ethereum: "ETH",
      stellar: "XLM",
    });
  }

  // Asset configuration management
  registerAsset(assetConfig: AssetConfig): void {
    try {
      // Validate asset configuration
      this.validateAssetConfig(assetConfig);

      // Store asset configuration
      this.assets.set(assetConfig.address, assetConfig);

      this.logger.info("Asset registered", {
        address: assetConfig.address,
        symbol: assetConfig.symbol,
        network: assetConfig.network,
        decimals: assetConfig.decimals,
      });
    } catch (error) {
      this.logger.error("Failed to register asset", error);
      throw new LiquidityException(
        LiquidityError.CONFIGURATION_ERROR,
        `Failed to register asset: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { assetConfig }
      );
    }
  }

  getAssetConfig(asset: string): AssetConfig | null {
    return this.assets.get(asset) || null;
  }

  getSupportedAssets(): string[] {
    return Array.from(this.assets.keys());
  }

  // Decimal handling methods
  convertToDecimal(asset: string, rawAmount: string): string {
    const assetConfig = this.getAssetConfig(asset);
    if (!assetConfig) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    try {
      // Convert raw amount (wei/stroops) to decimal format
      const rawBigInt = BigInt(rawAmount);
      const divisor = BigInt(10 ** assetConfig.decimals);

      // Handle division with precision
      const wholePart = rawBigInt / divisor;
      const fractionalPart = rawBigInt % divisor;

      if (fractionalPart === BigInt(0)) {
        return wholePart.toString();
      }

      // Format fractional part with proper decimal places
      const fractionalStr = fractionalPart
        .toString()
        .padStart(assetConfig.decimals, "0");
      const trimmedFractional = fractionalStr.replace(/0+$/, "");

      if (trimmedFractional === "") {
        return wholePart.toString();
      }

      return `${wholePart}.${trimmedFractional}`;
    } catch (error) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Failed to convert raw amount to decimal: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, rawAmount }
      );
    }
  }

  convertFromDecimal(asset: string, decimalAmount: string): string {
    const assetConfig = this.getAssetConfig(asset);
    if (!assetConfig) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    try {
      // Convert decimal amount to raw format (wei/stroops)
      const parts = decimalAmount.split(".");
      const wholePart = parts[0] || "0";
      const fractionalPart = (parts[1] || "").padEnd(assetConfig.decimals, "0");

      if (fractionalPart.length > assetConfig.decimals) {
        throw new Error(
          `Too many decimal places. Maximum: ${assetConfig.decimals}`
        );
      }

      const wholePartBigInt = BigInt(wholePart);
      const fractionalPartBigInt = BigInt(fractionalPart);
      const multiplier = BigInt(10 ** assetConfig.decimals);

      const rawAmount = wholePartBigInt * multiplier + fractionalPartBigInt;

      return rawAmount.toString();
    } catch (error) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Failed to convert decimal amount to raw: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, decimalAmount }
      );
    }
  }

  // Validation methods
  isValidAsset(asset: string): boolean {
    return this.assets.has(asset);
  }

  isValidAmount(asset: string, amount: string): boolean {
    try {
      // Check if asset is supported
      if (!this.isValidAsset(asset)) {
        return false;
      }

      // Check if amount is a valid number
      if (!amount || amount.trim() === "") {
        return false;
      }

      // Try to parse as BigInt to ensure it's a valid integer
      const amountBigInt = BigInt(amount);

      // Check if amount is non-negative
      if (amountBigInt < 0) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Utility methods
  getAssetSymbol(asset: string): string {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.symbol || "UNKNOWN";
  }

  getAssetDecimals(asset: string): number {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.decimals || 18; // Default to 18 decimals
  }

  getAssetNetwork(asset: string): "ethereum" | "stellar" | null {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.network || null;
  }

  isNativeAsset(asset: string): boolean {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.isNative || false;
  }

  // Threshold management
  getMinimumThreshold(asset: string): string {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.minimumThreshold || "0";
  }

  getWarningThreshold(asset: string): string {
    const assetConfig = this.getAssetConfig(asset);
    return assetConfig?.warningThreshold || "0";
  }

  setMinimumThreshold(asset: string, threshold: string): void {
    const assetConfig = this.getAssetConfig(asset);
    if (!assetConfig) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    if (!this.isValidDecimalAmount(threshold)) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Invalid threshold amount: ${threshold}`,
        { asset, threshold }
      );
    }

    assetConfig.minimumThreshold = threshold;
    this.assets.set(asset, assetConfig);

    this.logger.info("Minimum threshold updated", {
      asset: assetConfig.symbol,
      threshold,
    });
  }

  setWarningThreshold(asset: string, threshold: string): void {
    const assetConfig = this.getAssetConfig(asset);
    if (!assetConfig) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    if (!this.isValidDecimalAmount(threshold)) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Invalid threshold amount: ${threshold}`,
        { asset, threshold }
      );
    }

    assetConfig.warningThreshold = threshold;
    this.assets.set(asset, assetConfig);

    this.logger.info("Warning threshold updated", {
      asset: assetConfig.symbol,
      threshold,
    });
  }

  // Private helper methods
  private validateAssetConfig(assetConfig: AssetConfig): void {
    if (!assetConfig.address) {
      throw new Error("Asset address is required");
    }

    if (!assetConfig.symbol) {
      throw new Error("Asset symbol is required");
    }

    if (assetConfig.decimals < 0 || assetConfig.decimals > 18) {
      throw new Error("Asset decimals must be between 0 and 18");
    }

    if (!["ethereum", "stellar"].includes(assetConfig.network)) {
      throw new Error("Asset network must be 'ethereum' or 'stellar'");
    }

    if (!this.isValidDecimalAmount(assetConfig.minimumThreshold)) {
      throw new Error("Invalid minimum threshold");
    }

    if (!this.isValidDecimalAmount(assetConfig.warningThreshold)) {
      throw new Error("Invalid warning threshold");
    }
  }

  private isValidDecimalAmount(amount: string): boolean {
    try {
      const num = parseFloat(amount);
      return !isNaN(num) && num >= 0;
    } catch {
      return false;
    }
  }

  // Debug and utility methods
  getAllAssetConfigs(): Map<string, AssetConfig> {
    return new Map(this.assets);
  }

  getAssetsByNetwork(network: "ethereum" | "stellar"): AssetConfig[] {
    return Array.from(this.assets.values()).filter(
      (asset) => asset.network === network
    );
  }

  // Compare amounts in decimal format
  compareAmounts(asset: string, amount1: string, amount2: string): number {
    if (!this.isValidAsset(asset)) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    try {
      const amount1BigInt = BigInt(amount1);
      const amount2BigInt = BigInt(amount2);

      if (amount1BigInt < amount2BigInt) return -1;
      if (amount1BigInt > amount2BigInt) return 1;
      return 0;
    } catch (error) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Failed to compare amounts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, amount1, amount2 }
      );
    }
  }

  // Add amounts in raw format
  addAmounts(asset: string, amount1: string, amount2: string): string {
    if (!this.isValidAsset(asset)) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    try {
      const amount1BigInt = BigInt(amount1);
      const amount2BigInt = BigInt(amount2);
      return (amount1BigInt + amount2BigInt).toString();
    } catch (error) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Failed to add amounts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, amount1, amount2 }
      );
    }
  }

  // Subtract amounts in raw format
  subtractAmounts(asset: string, amount1: string, amount2: string): string {
    if (!this.isValidAsset(asset)) {
      throw new LiquidityException(
        LiquidityError.ASSET_NOT_SUPPORTED,
        `Asset not supported: ${asset}`,
        { asset }
      );
    }

    try {
      const amount1BigInt = BigInt(amount1);
      const amount2BigInt = BigInt(amount2);
      const result = amount1BigInt - amount2BigInt;

      if (result < 0) {
        throw new Error("Result would be negative");
      }

      return result.toString();
    } catch (error) {
      throw new LiquidityException(
        LiquidityError.INVALID_AMOUNT,
        `Failed to subtract amounts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        { asset, amount1, amount2 }
      );
    }
  }
}
