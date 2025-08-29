"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BalanceTracker = void 0;
// contracts/fusion-resolver/src/core/BalanceTracker.ts
const ethers_1 = require("ethers");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const liquidity_1 = require("../types/liquidity");
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
class BalanceTracker {
    assetManager;
    logger = new logger_1.Logger("BalanceTracker");
    balanceCache = new Map();
    monitoringInterval = null;
    balanceChangeCallbacks = [];
    // Network providers
    ethProvider;
    stellarServer;
    // ERC20 ABI for token balance queries
    ERC20_ABI = [
        "function balanceOf(address owner) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)",
    ];
    constructor(assetManager) {
        this.assetManager = assetManager;
        // Initialize network providers
        this.ethProvider = new ethers_1.ethers.JsonRpcProvider(config_1.config.ethereum.rpcUrl);
        this.stellarServer = new stellar_sdk_1.Horizon.Server(config_1.config.stellar.rpcUrl);
        this.logger.info("BalanceTracker initialized", {
            ethereumRpc: config_1.config.ethereum.rpcUrl,
            stellarRpc: config_1.config.stellar.rpcUrl,
        });
    }
    // Balance queries
    async getBalance(network, asset) {
        try {
            // Check cache first
            const cached = this.getCachedBalance(network, asset);
            if (cached !== null) {
                this.logger.debug("Returning cached balance", {
                    network,
                    asset,
                    balance: cached,
                });
                return cached;
            }
            // Fetch fresh balance
            const balance = await this.fetchBalance(network, asset);
            // Cache the result
            this.setCachedBalance(network, asset, balance);
            this.logger.info("Balance fetched successfully", {
                network,
                asset: this.assetManager.getAssetSymbol(asset),
                balance: this.assetManager.convertToDecimal(asset, balance),
            });
            return balance;
        }
        catch (error) {
            this.logger.error("Failed to get balance", { network, asset, error });
            // Try to return cached balance as fallback
            const cached = this.getCachedBalance(network, asset, true); // ignore TTL
            if (cached !== null) {
                this.logger.warn("Using stale cached balance as fallback", {
                    network,
                    asset,
                    balance: cached,
                });
                return cached;
            }
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.BALANCE_FETCH_FAILED, `Failed to fetch balance for ${asset} on ${network}: ${error instanceof Error ? error.message : "Unknown error"}`, { network, asset, error });
        }
    }
    getCachedBalance(network, asset, ignoreTTL = false) {
        const cacheKey = this.getCacheKey(network, asset);
        const cached = this.balanceCache.get(cacheKey);
        if (!cached) {
            return null;
        }
        // Check if cache is still valid
        if (!ignoreTTL && Date.now() > cached.timestamp + cached.ttl * 1000) {
            this.balanceCache.delete(cacheKey);
            return null;
        }
        return cached.balance;
    }
    // Cache management
    async updateBalance(network, asset) {
        try {
            const oldBalance = this.getCachedBalance(network, asset, true);
            const newBalance = await this.fetchBalance(network, asset);
            // Update cache
            this.setCachedBalance(network, asset, newBalance);
            // Trigger balance change event if balance changed
            if (oldBalance !== null && oldBalance !== newBalance) {
                this.triggerBalanceChangeEvent(network, asset, oldBalance, newBalance);
            }
            return newBalance;
        }
        catch (error) {
            this.logger.error("Failed to update balance", { network, asset, error });
            throw error;
        }
    }
    invalidateCache(network, asset) {
        if (asset) {
            // Invalidate specific asset cache
            const cacheKey = this.getCacheKey(network, asset);
            this.balanceCache.delete(cacheKey);
            this.logger.debug("Cache invalidated for specific asset", {
                network,
                asset,
            });
        }
        else {
            // Invalidate all cache entries for the network
            const keysToDelete = [];
            for (const key of this.balanceCache.keys()) {
                if (key.startsWith(`${network}:`)) {
                    keysToDelete.push(key);
                }
            }
            keysToDelete.forEach((key) => this.balanceCache.delete(key));
            this.logger.debug("Cache invalidated for network", {
                network,
                entriesCleared: keysToDelete.length,
            });
        }
    }
    // Monitoring
    startBalanceMonitoring(intervalMs) {
        if (this.monitoringInterval) {
            this.stopBalanceMonitoring();
        }
        this.monitoringInterval = setInterval(async () => {
            await this.updateAllBalances();
        }, intervalMs);
        this.logger.info("Balance monitoring started", { intervalMs });
    }
    stopBalanceMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
            this.logger.info("Balance monitoring stopped");
        }
    }
    // Events
    onBalanceChange(callback) {
        this.balanceChangeCallbacks.push(callback);
    }
    // Private methods
    async fetchBalance(network, asset) {
        const assetConfig = this.assetManager.getAssetConfig(asset);
        if (!assetConfig) {
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.ASSET_NOT_SUPPORTED, `Asset not supported: ${asset}`, { asset });
        }
        if (assetConfig.network !== network) {
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.ASSET_NOT_SUPPORTED, `Asset ${asset} is not available on ${network} network`, { asset, network, expectedNetwork: assetConfig.network });
        }
        switch (network) {
            case "ethereum":
                return await this.fetchEthereumBalance(asset, assetConfig);
            case "stellar":
                return await this.fetchStellarBalance(asset, assetConfig);
            default:
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.NETWORK_ERROR, `Unsupported network: ${network}`, { network });
        }
    }
    async fetchEthereumBalance(asset, assetConfig) {
        try {
            if (assetConfig.isNative) {
                // Native ETH balance
                const balance = await this.ethProvider.getBalance(config_1.config.resolver.address);
                return balance.toString();
            }
            else {
                // ERC20 token balance
                const tokenContract = new ethers_1.ethers.Contract(asset, this.ERC20_ABI, this.ethProvider);
                const balance = await tokenContract.balanceOf(config_1.config.resolver.address);
                return balance.toString();
            }
        }
        catch (error) {
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.NETWORK_ERROR, `Failed to fetch Ethereum balance: ${error instanceof Error ? error.message : "Unknown error"}`, { asset, error });
        }
    }
    async fetchStellarBalance(asset, assetConfig) {
        try {
            // Use Horizon testnet for account balance queries
            const horizonServer = new stellar_sdk_1.Horizon.Server("https://horizon-testnet.stellar.org");
            const account = await horizonServer.loadAccount(config_1.config.resolver.stellarAddress);
            if (assetConfig.isNative) {
                // Native XLM balance
                const nativeBalance = account.balances.find((b) => b.asset_type === "native");
                if (!nativeBalance) {
                    return "0";
                }
                // Convert from decimal to stroops (7 decimals)
                const balanceInStroops = this.assetManager.convertFromDecimal(asset, nativeBalance.balance);
                return balanceInStroops;
            }
            else {
                // Custom Stellar asset balance
                const assetBalance = account.balances.find((b) => b.asset_type !== "native" &&
                    "asset_code" in b &&
                    b.asset_code === assetConfig.symbol);
                if (!assetBalance) {
                    return "0";
                }
                // Convert from decimal to raw units
                const balanceInRaw = this.assetManager.convertFromDecimal(asset, assetBalance.balance);
                return balanceInRaw;
            }
        }
        catch (error) {
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.NETWORK_ERROR, `Failed to fetch Stellar balance: ${error instanceof Error ? error.message : "Unknown error"}`, { asset, error });
        }
    }
    setCachedBalance(network, asset, balance) {
        const cacheKey = this.getCacheKey(network, asset);
        const cacheEntry = {
            balance,
            timestamp: Date.now(),
            ttl: liquidity_1.DEFAULT_CACHE_TTL,
        };
        this.balanceCache.set(cacheKey, cacheEntry);
    }
    getCacheKey(network, asset) {
        return `${network}:${asset}`;
    }
    async updateAllBalances() {
        const supportedAssets = this.assetManager.getSupportedAssets();
        const updatePromises = [];
        for (const asset of supportedAssets) {
            const assetConfig = this.assetManager.getAssetConfig(asset);
            if (assetConfig) {
                updatePromises.push((async () => {
                    try {
                        await this.updateBalance(assetConfig.network, asset);
                    }
                    catch (error) {
                        this.logger.warn("Failed to update balance during monitoring", {
                            network: assetConfig.network,
                            asset: assetConfig.symbol,
                            error: error instanceof Error ? error.message : "Unknown error",
                        });
                    }
                })());
            }
        }
        await Promise.allSettled(updatePromises);
    }
    triggerBalanceChangeEvent(network, asset, oldBalance, newBalance) {
        const event = {
            network,
            asset,
            oldBalance,
            newBalance,
            timestamp: Date.now(),
        };
        this.logger.info("Balance changed", {
            network,
            asset: this.assetManager.getAssetSymbol(asset),
            oldBalance: this.assetManager.convertToDecimal(asset, oldBalance),
            newBalance: this.assetManager.convertToDecimal(asset, newBalance),
        });
        // Notify all callbacks
        this.balanceChangeCallbacks.forEach((callback) => {
            try {
                callback(network, asset, newBalance);
            }
            catch (error) {
                this.logger.error("Error in balance change callback", { error });
            }
        });
    }
    // Utility methods
    getCacheStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;
        for (const cache of this.balanceCache.values()) {
            if (now <= cache.timestamp + cache.ttl * 1000) {
                validEntries++;
            }
            else {
                expiredEntries++;
            }
        }
        return {
            totalEntries: this.balanceCache.size,
            validEntries,
            expiredEntries,
        };
    }
    clearExpiredCache() {
        const now = Date.now();
        const keysToDelete = [];
        for (const [key, cache] of this.balanceCache.entries()) {
            if (now > cache.timestamp + cache.ttl * 1000) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach((key) => this.balanceCache.delete(key));
        if (keysToDelete.length > 0) {
            this.logger.debug("Expired cache entries cleared", {
                count: keysToDelete.length,
            });
        }
    }
    // Get all cached balances for debugging
    getAllCachedBalances() {
        const now = Date.now();
        const result = new Map();
        for (const [key, cache] of this.balanceCache.entries()) {
            result.set(key, {
                balance: cache.balance,
                timestamp: cache.timestamp,
                isExpired: now > cache.timestamp + cache.ttl * 1000,
            });
        }
        return result;
    }
    // Force refresh all balances
    async refreshAllBalances() {
        this.logger.info("Refreshing all balances");
        // Clear all cache
        this.balanceCache.clear();
        // Update all balances
        await this.updateAllBalances();
        this.logger.info("All balances refreshed");
    }
    // Get balance with retry logic
    async getBalanceWithRetry(network, asset, maxRetries = 3, retryDelayMs = 1000) {
        let lastError = null;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.getBalance(network, asset);
            }
            catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    this.logger.warn(`Balance fetch attempt ${attempt} failed, retrying...`, {
                        network,
                        asset: this.assetManager.getAssetSymbol(asset),
                        error: error instanceof Error ? error.message : "Unknown error",
                        nextRetryIn: retryDelayMs,
                    });
                    // Exponential backoff
                    await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
                }
            }
        }
        throw lastError || new Error("Max retries exceeded");
    }
}
exports.BalanceTracker = BalanceTracker;
//# sourceMappingURL=BalanceTracker.js.map