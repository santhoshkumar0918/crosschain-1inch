"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretManager = void 0;
const crypto_1 = require("../utils/crypto");
const validation_1 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
class SecretManager {
    constructor(storage) {
        this.secretCache = new Map(); // orderId -> secret
        this.storage = storage;
    }
    async storeSecret(orderId, secret, chain, txHash, revealer) {
        try {
            // Get order to validate hashlock
            const order = await this.storage.getOrder(orderId);
            if (!order) {
                throw new Error('Order not found');
            }
            // Validate secret against hashlock
            validation_1.ValidationUtils.validateSecret(secret, order.hashlock);
            // Create secret reveal record
            const secretReveal = {
                orderId,
                secret,
                hashlock: order.hashlock,
                chain,
                txHash,
                revealer,
                timestamp: new Date(),
            };
            // Store in storage
            await this.storage.storeSecret(orderId, secretReveal);
            // Cache for quick access
            this.secretCache.set(orderId, secret);
            logger_1.default.info(`🔐 Secret stored for order ${orderId} from ${chain}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to store secret for order ${orderId}:`, error);
            throw error;
        }
    }
    async getSecret(orderId) {
        // Check cache first
        if (this.secretCache.has(orderId)) {
            return this.secretCache.get(orderId);
        }
        // Query storage
        const secret = await this.storage.getSecret(orderId);
        if (secret) {
            this.secretCache.set(orderId, secret);
        }
        return secret;
    }
    async isSecretRevealed(orderId) {
        return await this.storage.isSecretRevealed(orderId);
    }
    generateSecret() {
        return crypto_1.CryptoUtils.generateSecret();
    }
    hashSecret(secret) {
        return crypto_1.CryptoUtils.hashSecret(secret);
    }
    verifySecret(secret, hashlock) {
        return crypto_1.CryptoUtils.verifyHashlock(secret, hashlock);
    }
    async getRevealHistory(orderId) {
        return await this.storage.getSecretHistory(orderId);
    }
    clearCache() {
        this.secretCache.clear();
        logger_1.default.info('🧹 Secret cache cleared');
    }
    async getSecretStats() {
        const stats = await this.storage.getStats();
        return {
            totalSecrets: stats.totalSecrets,
            cacheSize: this.secretCache.size,
        };
    }
}
exports.SecretManager = SecretManager;
//# sourceMappingURL=SecretManager.js.map