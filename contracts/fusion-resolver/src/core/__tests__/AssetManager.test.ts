// contracts/fusion-resolver/src/core/__tests__/AssetManager.test.ts
import { AssetManager } from "../AssetManager";
import {
  LiquidityError,
  LiquidityException,
  AssetConfig,
} from "../../types/liquidity";

describe("AssetManager", () => {
  let assetManager: AssetManager;

  beforeEach(() => {
    assetManager = new AssetManager();
  });

  describe("Asset Configuration", () => {
    it("should initialize with default assets", () => {
      const supportedAssets = assetManager.getSupportedAssets();
      expect(supportedAssets.length).toBeGreaterThan(0);

      // Should have ETH and XLM by default
      const ethConfig = assetManager.getAssetConfig(supportedAssets[0]);
      const xlmConfig = assetManager.getAssetConfig(supportedAssets[1]);

      expect(ethConfig).toBeTruthy();
      expect(xlmConfig).toBeTruthy();
    });

    it("should register new asset successfully", () => {
      const usdcConfig: AssetConfig = {
        address: "0xa0b86a33e6e55d1c7b2e8f3d3a9f4c9a8b3f5e6d",
        symbol: "USDC",
        decimals: 6,
        network: "ethereum",
        minimumThreshold: "100",
        warningThreshold: "500",
        isNative: false,
      };

      assetManager.registerAsset(usdcConfig);

      const retrievedConfig = assetManager.getAssetConfig(usdcConfig.address);
      expect(retrievedConfig).toEqual(usdcConfig);
      expect(assetManager.isValidAsset(usdcConfig.address)).toBe(true);
    });

    it("should throw error for invalid asset configuration", () => {
      const invalidConfig: AssetConfig = {
        address: "",
        symbol: "INVALID",
        decimals: -1,
        network: "ethereum",
        minimumThreshold: "100",
        warningThreshold: "500",
        isNative: false,
      };

      expect(() => assetManager.registerAsset(invalidConfig)).toThrow(
        LiquidityException
      );
    });
  });

  describe("Decimal Conversion", () => {
    beforeEach(() => {
      // Register test assets
      assetManager.registerAsset({
        address: "test-eth",
        symbol: "ETH",
        decimals: 18,
        network: "ethereum",
        minimumThreshold: "0.1",
        warningThreshold: "0.5",
        isNative: true,
      });

      assetManager.registerAsset({
        address: "test-usdc",
        symbol: "USDC",
        decimals: 6,
        network: "ethereum",
        minimumThreshold: "100",
        warningThreshold: "500",
        isNative: false,
      });
    });

    describe("convertToDecimal", () => {
      it("should convert ETH wei to decimal correctly", () => {
        // 1 ETH = 1000000000000000000 wei
        const result = assetManager.convertToDecimal(
          "test-eth",
          "1000000000000000000"
        );
        expect(result).toBe("1");
      });

      it("should convert fractional ETH wei to decimal correctly", () => {
        // 0.5 ETH = 500000000000000000 wei
        const result = assetManager.convertToDecimal(
          "test-eth",
          "500000000000000000"
        );
        expect(result).toBe("0.5");
      });

      it("should convert USDC to decimal correctly", () => {
        // 100 USDC = 100000000 (6 decimals)
        const result = assetManager.convertToDecimal("test-usdc", "100000000");
        expect(result).toBe("100");
      });

      it("should handle zero amounts", () => {
        const result = assetManager.convertToDecimal("test-eth", "0");
        expect(result).toBe("0");
      });

      it("should throw error for unsupported asset", () => {
        expect(() =>
          assetManager.convertToDecimal("unsupported", "1000")
        ).toThrow(LiquidityException);
      });
    });

    describe("convertFromDecimal", () => {
      it("should convert decimal ETH to wei correctly", () => {
        const result = assetManager.convertFromDecimal("test-eth", "1");
        expect(result).toBe("1000000000000000000");
      });

      it("should convert fractional decimal ETH to wei correctly", () => {
        const result = assetManager.convertFromDecimal("test-eth", "0.5");
        expect(result).toBe("500000000000000000");
      });

      it("should convert decimal USDC to raw correctly", () => {
        const result = assetManager.convertFromDecimal("test-usdc", "100");
        expect(result).toBe("100000000");
      });

      it("should handle zero amounts", () => {
        const result = assetManager.convertFromDecimal("test-eth", "0");
        expect(result).toBe("0");
      });

      it("should throw error for too many decimal places", () => {
        // USDC has 6 decimals, so 7 decimal places should fail
        expect(() =>
          assetManager.convertFromDecimal("test-usdc", "100.1234567")
        ).toThrow(LiquidityException);
      });
    });

    describe("Round-trip conversion", () => {
      it("should maintain precision in round-trip conversion", () => {
        const originalAmount = "1500000000000000000"; // 1.5 ETH in wei
        const decimal = assetManager.convertToDecimal(
          "test-eth",
          originalAmount
        );
        const backToRaw = assetManager.convertFromDecimal("test-eth", decimal);
        expect(backToRaw).toBe(originalAmount);
      });
    });
  });

  describe("Validation", () => {
    beforeEach(() => {
      assetManager.registerAsset({
        address: "test-asset",
        symbol: "TEST",
        decimals: 18,
        network: "ethereum",
        minimumThreshold: "1",
        warningThreshold: "5",
        isNative: false,
      });
    });

    describe("isValidAsset", () => {
      it("should return true for supported asset", () => {
        expect(assetManager.isValidAsset("test-asset")).toBe(true);
      });

      it("should return false for unsupported asset", () => {
        expect(assetManager.isValidAsset("unsupported")).toBe(false);
      });
    });

    describe("isValidAmount", () => {
      it("should return true for valid positive amount", () => {
        expect(assetManager.isValidAmount("test-asset", "1000")).toBe(true);
      });

      it("should return true for zero amount", () => {
        expect(assetManager.isValidAmount("test-asset", "0")).toBe(true);
      });

      it("should return false for negative amount", () => {
        expect(assetManager.isValidAmount("test-asset", "-1000")).toBe(false);
      });

      it("should return false for invalid string", () => {
        expect(assetManager.isValidAmount("test-asset", "invalid")).toBe(false);
      });

      it("should return false for empty string", () => {
        expect(assetManager.isValidAmount("test-asset", "")).toBe(false);
      });

      it("should return false for unsupported asset", () => {
        expect(assetManager.isValidAmount("unsupported", "1000")).toBe(false);
      });
    });
  });

  describe("Amount Operations", () => {
    beforeEach(() => {
      assetManager.registerAsset({
        address: "test-asset",
        symbol: "TEST",
        decimals: 18,
        network: "ethereum",
        minimumThreshold: "1",
        warningThreshold: "5",
        isNative: false,
      });
    });

    describe("compareAmounts", () => {
      it("should return -1 when first amount is smaller", () => {
        const result = assetManager.compareAmounts(
          "test-asset",
          "1000",
          "2000"
        );
        expect(result).toBe(-1);
      });

      it("should return 1 when first amount is larger", () => {
        const result = assetManager.compareAmounts(
          "test-asset",
          "2000",
          "1000"
        );
        expect(result).toBe(1);
      });

      it("should return 0 when amounts are equal", () => {
        const result = assetManager.compareAmounts(
          "test-asset",
          "1000",
          "1000"
        );
        expect(result).toBe(0);
      });
    });

    describe("addAmounts", () => {
      it("should add amounts correctly", () => {
        const result = assetManager.addAmounts("test-asset", "1000", "2000");
        expect(result).toBe("3000");
      });

      it("should handle zero amounts", () => {
        const result = assetManager.addAmounts("test-asset", "1000", "0");
        expect(result).toBe("1000");
      });
    });

    describe("subtractAmounts", () => {
      it("should subtract amounts correctly", () => {
        const result = assetManager.subtractAmounts(
          "test-asset",
          "2000",
          "1000"
        );
        expect(result).toBe("1000");
      });

      it("should throw error for negative result", () => {
        expect(() =>
          assetManager.subtractAmounts("test-asset", "1000", "2000")
        ).toThrow(LiquidityException);
      });
    });
  });

  describe("Threshold Management", () => {
    beforeEach(() => {
      assetManager.registerAsset({
        address: "test-asset",
        symbol: "TEST",
        decimals: 18,
        network: "ethereum",
        minimumThreshold: "1",
        warningThreshold: "5",
        isNative: false,
      });
    });

    it("should get minimum threshold", () => {
      const threshold = assetManager.getMinimumThreshold("test-asset");
      expect(threshold).toBe("1");
    });

    it("should set minimum threshold", () => {
      assetManager.setMinimumThreshold("test-asset", "2");
      const threshold = assetManager.getMinimumThreshold("test-asset");
      expect(threshold).toBe("2");
    });

    it("should throw error when setting threshold for unsupported asset", () => {
      expect(() =>
        assetManager.setMinimumThreshold("unsupported", "1")
      ).toThrow(LiquidityException);
    });
  });

  describe("Utility Methods", () => {
    beforeEach(() => {
      assetManager.registerAsset({
        address: "test-asset",
        symbol: "TEST",
        decimals: 6,
        network: "stellar",
        minimumThreshold: "1",
        warningThreshold: "5",
        isNative: true,
      });
    });

    it("should get asset symbol", () => {
      const symbol = assetManager.getAssetSymbol("test-asset");
      expect(symbol).toBe("TEST");
    });

    it("should get asset decimals", () => {
      const decimals = assetManager.getAssetDecimals("test-asset");
      expect(decimals).toBe(6);
    });

    it("should get asset network", () => {
      const network = assetManager.getAssetNetwork("test-asset");
      expect(network).toBe("stellar");
    });

    it("should check if asset is native", () => {
      const isNative = assetManager.isNativeAsset("test-asset");
      expect(isNative).toBe(true);
    });

    it("should get assets by network", () => {
      const stellarAssets = assetManager.getAssetsByNetwork("stellar");
      expect(stellarAssets.length).toBeGreaterThan(0);
      expect(stellarAssets.every((asset) => asset.network === "stellar")).toBe(
        true
      );
    });
  });
});

// Additional test for BalanceTracker integration
import { BalanceTracker } from "../BalanceTracker";

describe("BalanceTracker", () => {
  let assetManager: AssetManager;
  let balanceTracker: BalanceTracker;

  beforeEach(() => {
    assetManager = new AssetManager();
    balanceTracker = new BalanceTracker(assetManager);
  });

  afterEach(() => {
    balanceTracker.stopBalanceMonitoring();
  });

  describe("Cache Management", () => {
    it("should return null for non-existent cached balance", () => {
      const cached = balanceTracker.getCachedBalance(
        "ethereum",
        "non-existent"
      );
      expect(cached).toBeNull();
    });

    it("should invalidate cache correctly", () => {
      // This test would require mocking the actual balance fetching
      // For now, we test the cache invalidation logic
      balanceTracker.invalidateCache("ethereum", "test-asset");
      const cached = balanceTracker.getCachedBalance("ethereum", "test-asset");
      expect(cached).toBeNull();
    });

    it("should clear expired cache entries", () => {
      balanceTracker.clearExpiredCache();
      const stats = balanceTracker.getCacheStats();
      expect(stats.expiredEntries).toBe(0);
    });
  });

  describe("Balance Change Events", () => {
    it("should register balance change callback", () => {
      let callbackCalled = false;

      balanceTracker.onBalanceChange((network, asset, newBalance) => {
        callbackCalled = true;
      });

      // The callback registration should not throw
      expect(callbackCalled).toBe(false);
    });
  });

  describe("Monitoring", () => {
    it("should start and stop monitoring without errors", () => {
      expect(() => {
        balanceTracker.startBalanceMonitoring(5000);
        balanceTracker.stopBalanceMonitoring();
      }).not.toThrow();
    });
  });

  describe("Cache Statistics", () => {
    it("should return correct cache statistics", () => {
      const stats = balanceTracker.getCacheStats();
      expect(stats).toHaveProperty("totalEntries");
      expect(stats).toHaveProperty("validEntries");
      expect(stats).toHaveProperty("expiredEntries");
      expect(typeof stats.totalEntries).toBe("number");
    });
  });
});
