"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CryptoUtils = void 0;
const crypto_1 = __importDefault(require("crypto"));
class CryptoUtils {
    static generateSecret() {
        const secret = crypto_1.default.randomBytes(32).toString('hex');
        const hashlock = this.hashSecret(secret);
        return { secret: `0x${secret}`, hashlock: `0x${hashlock}` };
    }
    static hashSecret(secret) {
        const cleanSecret = secret.replace('0x', '');
        return crypto_1.default.createHash('sha256')
            .update(Buffer.from(cleanSecret, 'hex'))
            .digest('hex');
    }
    static isValidSecret(secret) {
        const hexPattern = /^(0x)?[0-9a-fA-F]{64}$/;
        return hexPattern.test(secret);
    }
    static isValidHashlock(hashlock) {
        const hexPattern = /^(0x)?[0-9a-fA-F]{64}$/;
        return hexPattern.test(hashlock);
    }
    static generateOrderId() {
        return `order_${Date.now()}_${crypto_1.default.randomBytes(4).toString('hex')}`;
    }
    static verifyHashlock(secret, hashlock) {
        const computedHash = this.hashSecret(secret);
        const cleanHashlock = hashlock.replace('0x', '');
        return computedHash === cleanHashlock;
    }
}
exports.CryptoUtils = CryptoUtils;
//# sourceMappingURL=crypto.js.map