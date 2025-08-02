"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ValidationUtils = void 0;
const crypto_1 = require("./crypto");
class ValidationUtils {
    static validateOrder(order) {
        if (!order.hashlock || !crypto_1.CryptoUtils.isValidHashlock(order.hashlock)) {
            throw new Error('Invalid hashlock format');
        }
        if (!order.timelock || order.timelock <= Date.now() / 1000) {
            throw new Error('Timelock must be in the future');
        }
        if (!order.makerAmount || order.makerAmount <= 0) {
            throw new Error('Maker amount must be positive');
        }
        if (!order.takerAmount || order.takerAmount <= 0) {
            throw new Error('Taker amount must be positive');
        }
        if (!order.maker || !order.makerChain || !ValidationUtils.isValidAddress(order.maker, order.makerChain)) {
            throw new Error('Invalid maker address');
        }
        if (!order.makerChain || !['ethereum', 'stellar'].includes(order.makerChain)) {
            throw new Error('Invalid maker chain');
        }
        if (!order.takerChain || !['ethereum', 'stellar'].includes(order.takerChain)) {
            throw new Error('Invalid taker chain');
        }
        if (order.makerChain === order.takerChain) {
            throw new Error('Cross-chain swap required - maker and taker chains must be different');
        }
    }
    static isValidAddress(address, chain) {
        if (chain === 'ethereum') {
            return /^0x[a-fA-F0-9]{40}$/.test(address);
        }
        else if (chain === 'stellar') {
            return /^G[A-Z2-7]{55}$/.test(address);
        }
        return false;
    }
    static validateSecret(secret, hashlock) {
        if (!crypto_1.CryptoUtils.isValidSecret(secret)) {
            throw new Error('Invalid secret format');
        }
        if (!crypto_1.CryptoUtils.verifyHashlock(secret, hashlock)) {
            throw new Error('Secret does not match hashlock');
        }
    }
}
exports.ValidationUtils = ValidationUtils;
//# sourceMappingURL=validation.js.map