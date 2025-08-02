"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InMemoryStorage = void 0;
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
class InMemoryStorage {
    constructor() {
        this.orders = new Map();
        this.escrows = new Map();
        this.secrets = new Map();
        this.ordersByStatus = new Map();
        // Initialize status maps
        Object.values(types_1.OrderStatus).forEach(status => {
            this.ordersByStatus.set(status, new Set());
        });
    }
    // Order operations
    async createOrder(order) {
        this.orders.set(order.id, order);
        this.ordersByStatus.get(order.status)?.add(order.id);
        logger_1.default.info(`Order created: ${order.id}`);
        return order;
    }
    async getOrder(orderId) {
        return this.orders.get(orderId) || null;
    }
    async updateOrderStatus(orderId, status) {
        const order = this.orders.get(orderId);
        if (!order) {
            throw new Error(`Order ${orderId} not found`);
        }
        // Remove from old status set
        this.ordersByStatus.get(order.status)?.delete(orderId);
        // Update order
        order.status = status;
        this.orders.set(orderId, order);
        // Add to new status set
        this.ordersByStatus.get(status)?.add(orderId);
        logger_1.default.info(`Order ${orderId} status updated to ${status}`);
    }
    async getOrdersByStatus(status) {
        const orderIds = this.ordersByStatus.get(status) || new Set();
        const orders = [];
        for (const orderId of orderIds) {
            const order = this.orders.get(orderId);
            if (order) {
                orders.push(order);
            }
        }
        return orders;
    }
    async getActiveOrders() {
        const activeStatuses = [
            types_1.OrderStatus.PENDING,
            types_1.OrderStatus.ESCROW_CREATED,
            types_1.OrderStatus.BOTH_ESCROWED,
            types_1.OrderStatus.SECRET_REVEALED
        ];
        const activeOrders = [];
        for (const status of activeStatuses) {
            const orders = await this.getOrdersByStatus(status);
            activeOrders.push(...orders);
        }
        return activeOrders;
    }
    // Escrow operations
    async addEscrow(orderId, escrow) {
        const orderEscrows = this.escrows.get(orderId) || [];
        orderEscrows.push(escrow);
        this.escrows.set(orderId, orderEscrows);
        logger_1.default.info(`Escrow added for order ${orderId} on ${escrow.chain}`);
        // Update order status based on escrow count
        if (orderEscrows.length === 1) {
            await this.updateOrderStatus(orderId, types_1.OrderStatus.ESCROW_CREATED);
        }
        else if (orderEscrows.length === 2) {
            await this.updateOrderStatus(orderId, types_1.OrderStatus.BOTH_ESCROWED);
        }
    }
    async getEscrowsForOrder(orderId) {
        return this.escrows.get(orderId) || [];
    }
    async updateEscrowStatus(orderId, chain, status) {
        const escrows = this.escrows.get(orderId) || [];
        const escrow = escrows.find(e => e.chain === chain);
        if (escrow) {
            escrow.status = status;
            this.escrows.set(orderId, escrows);
            logger_1.default.info(`Escrow status updated for order ${orderId} on ${chain}: ${status}`);
        }
    }
    // Secret operations
    async storeSecret(orderId, secretReveal) {
        const orderSecrets = this.secrets.get(orderId) || [];
        orderSecrets.push(secretReveal);
        this.secrets.set(orderId, orderSecrets);
        logger_1.default.info(`Secret stored for order ${orderId} from ${secretReveal.chain}`);
        // Update order status
        await this.updateOrderStatus(orderId, types_1.OrderStatus.SECRET_REVEALED);
    }
    async getSecret(orderId) {
        const secrets = this.secrets.get(orderId) || [];
        return secrets.length > 0 ? secrets[0].secret : null;
    }
    async isSecretRevealed(orderId) {
        const secrets = this.secrets.get(orderId) || [];
        return secrets.length > 0;
    }
    async getSecretHistory(orderId) {
        return this.secrets.get(orderId) || [];
    }
    // Utility methods
    async getAllOrders() {
        return Array.from(this.orders.values());
    }
    async getOrderCount() {
        return this.orders.size;
    }
    async getStats() {
        const stats = {
            totalOrders: this.orders.size,
            ordersByStatus: {},
            totalEscrows: Array.from(this.escrows.values()).reduce((sum, escrows) => sum + escrows.length, 0),
            totalSecrets: Array.from(this.secrets.values()).reduce((sum, secrets) => sum + secrets.length, 0),
        };
        // Count orders by status
        for (const [status, orderIds] of this.ordersByStatus.entries()) {
            stats.ordersByStatus[status] = orderIds.size;
        }
        return stats;
    }
    // Cleanup methods
    async cleanupExpiredOrders() {
        const now = Date.now() / 1000;
        const expiredOrders = [];
        for (const [orderId, order] of this.orders.entries()) {
            if (order.timelock < now && order.status !== types_1.OrderStatus.COMPLETED && order.status !== types_1.OrderStatus.EXPIRED) {
                expiredOrders.push(orderId);
            }
        }
        for (const orderId of expiredOrders) {
            await this.updateOrderStatus(orderId, types_1.OrderStatus.EXPIRED);
            logger_1.default.info(`Order ${orderId} marked as expired`);
        }
    }
    async clearAll() {
        this.orders.clear();
        this.escrows.clear();
        this.secrets.clear();
        // Clear status maps
        for (const statusSet of this.ordersByStatus.values()) {
            statusSet.clear();
        }
        logger_1.default.info('All storage cleared');
    }
}
exports.InMemoryStorage = InMemoryStorage;
//# sourceMappingURL=InMemoryStorage.js.map