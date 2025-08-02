"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderManager = void 0;
const types_1 = require("../types");
const crypto_1 = require("../utils/crypto");
const validation_1 = require("../utils/validation");
const logger_1 = __importDefault(require("../utils/logger"));
class OrderManager {
    constructor(storage) {
        this.storage = storage;
    }
    async createOrder(orderData) {
        try {
            // Validate order data
            validation_1.ValidationUtils.validateOrder(orderData);
            // Create complete order object
            const order = {
                id: crypto_1.CryptoUtils.generateOrderId(),
                status: types_1.OrderStatus.PENDING,
                createdAt: new Date(),
                nonce: BigInt(Date.now()),
                signature: '', // Would be provided by the maker
                ...orderData
            };
            // Store order
            await this.storage.createOrder(order);
            logger_1.default.info(`📝 Order created: ${order.id}`);
            return order;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to create order:`, error);
            throw error;
        }
    }
    async getOrder(orderId) {
        return await this.storage.getOrder(orderId);
    }
    async updateOrderStatus(orderId, status) {
        try {
            await this.storage.updateOrderStatus(orderId, status);
            logger_1.default.info(`📊 Order ${orderId} status updated to ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to update order status:`, error);
            throw error;
        }
    }
    async addEscrow(orderId, escrow) {
        try {
            await this.storage.addEscrow(orderId, escrow);
            logger_1.default.info(`🏦 Escrow added for order ${orderId} on ${escrow.chain}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to add escrow:`, error);
            throw error;
        }
    }
    async getEscrowsForOrder(orderId) {
        return await this.storage.getEscrowsForOrder(orderId);
    }
    async updateEscrowStatus(orderId, chain, status) {
        try {
            await this.storage.updateEscrowStatus(orderId, chain, status);
            logger_1.default.info(`🏦 Escrow status updated for order ${orderId} on ${chain}: ${status}`);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to update escrow status:`, error);
            throw error;
        }
    }
    async getActiveOrders() {
        return await this.storage.getActiveOrders();
    }
    async getOrdersByStatus(status) {
        return await this.storage.getOrdersByStatus(status);
    }
    async getAllOrders() {
        return await this.storage.getAllOrders();
    }
    async isSwapComplete(orderId) {
        try {
            const escrows = await this.getEscrowsForOrder(orderId);
            // Check if both escrows exist and are claimed
            if (escrows.length !== 2)
                return false;
            const ethereumEscrow = escrows.find(e => e.chain === 'ethereum');
            const stellarEscrow = escrows.find(e => e.chain === 'stellar');
            return ethereumEscrow?.status === 'claimed' && stellarEscrow?.status === 'claimed';
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to check swap completion:`, error);
            return false;
        }
    }
    async getExpiredOrders() {
        const activeOrders = await this.getActiveOrders();
        const now = Date.now() / 1000;
        return activeOrders.filter(order => order.timelock < now);
    }
    async markOrderAsExpired(orderId) {
        await this.updateOrderStatus(orderId, types_1.OrderStatus.EXPIRED);
    }
    async getOrderStats() {
        const stats = await this.storage.getStats();
        const activeOrders = await this.getActiveOrders();
        const completedOrders = await this.getOrdersByStatus(types_1.OrderStatus.COMPLETED);
        const expiredOrders = await this.getOrdersByStatus(types_1.OrderStatus.EXPIRED);
        return {
            total: stats.totalOrders,
            byStatus: stats.ordersByStatus,
            active: activeOrders.length,
            completed: completedOrders.length,
            expired: expiredOrders.length,
        };
    }
    async cleanupExpiredOrders() {
        try {
            await this.storage.cleanupExpiredOrders();
            logger_1.default.info('🧹 Expired orders cleanup completed');
        }
        catch (error) {
            logger_1.default.error('❌ Failed to cleanup expired orders:', error);
        }
    }
}
exports.OrderManager = OrderManager;
//# sourceMappingURL=OrderManager.js.map