"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderBook = void 0;
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
const crypto_1 = __importDefault(require("crypto"));
class OrderBook {
    orders = new Map();
    logger = new logger_1.Logger("OrderBook");
    constructor() {
        this.logger.info("OrderBook initialized");
    }
    // Create a new order
    async createOrder(params) {
        this.logger.info("Creating new order", { params });
        try {
            // Generate order hash
            const orderHash = this.generateOrderHash(params);
            // Check if order already exists
            if (this.orders.has(orderHash)) {
                throw new Error("Order already exists");
            }
            const now = Math.floor(Date.now() / 1000);
            const auctionDuration = config_1.config.auction.defaultDuration;
            const order = {
                orderHash,
                maker: params.maker,
                receiver: params.receiver,
                makerAsset: params.makerAsset,
                takerAsset: params.takerAsset,
                makingAmount: params.makingAmount,
                takingAmount: params.takingAmount,
                srcChainId: params.srcChainId,
                dstChainId: params.dstChainId,
                timelock: params.timelock || now + 3600, // 1 hour default
                secretHashes: params.secretHashes || [],
                status: "pending",
                createdAt: now,
                auctionStartTime: now,
                auctionEndTime: now + auctionDuration,
                reservePrice: this.calculateReservePrice(params.makingAmount, params.takingAmount),
            };
            // Store order
            this.orders.set(orderHash, order);
            // Start auction
            setTimeout(() => {
                this.startAuction(orderHash);
            }, 1000); // Start auction after 1 second
            this.logger.info("Order created successfully", {
                orderHash,
                maker: params.maker,
                auctionEndTime: order.auctionEndTime,
            });
            return order;
        }
        catch (error) {
            this.logger.error("Failed to create order", error);
            throw error;
        }
    }
    // Start auction for an order
    startAuction(orderHash) {
        const order = this.orders.get(orderHash);
        if (!order) {
            this.logger.warn("Cannot start auction: order not found", { orderHash });
            return;
        }
        if (order.status !== "pending") {
            this.logger.warn("Cannot start auction: order not in pending status", {
                orderHash,
                status: order.status,
            });
            return;
        }
        order.status = "auction_active";
        this.orders.set(orderHash, order);
        this.logger.info("Auction started", {
            orderHash,
            duration: config_1.config.auction.defaultDuration,
        });
    }
    // Get order by hash
    getOrder(orderHash) {
        return this.orders.get(orderHash);
    }
    // Get active orders with optional filters
    getActiveOrders(filters) {
        let orders = Array.from(this.orders.values());
        if (filters) {
            if (filters.maker) {
                orders = orders.filter((order) => order.maker.toLowerCase() === filters.maker.toLowerCase());
            }
            if (filters.srcChain) {
                orders = orders.filter((order) => order.srcChainId.toString() === filters.srcChain.toString());
            }
            if (filters.dstChain) {
                orders = orders.filter((order) => order.dstChainId.toString() === filters.dstChain.toString());
            }
            if (filters.status) {
                orders = orders.filter((order) => order.status === filters.status);
            }
        }
        // Sort by creation time (newest first)
        return orders.sort((a, b) => b.createdAt - a.createdAt);
    }
    // Update order status
    updateOrderStatus(orderHash, status, metadata) {
        const order = this.orders.get(orderHash);
        if (!order) {
            this.logger.warn("Cannot update order: not found", { orderHash });
            return false;
        }
        const oldStatus = order.status;
        order.status = status;
        if (metadata) {
            order.metadata = { ...order.metadata, ...metadata };
        }
        this.orders.set(orderHash, order);
        this.logger.info("Order status updated", {
            orderHash,
            oldStatus,
            newStatus: status,
            metadata,
        });
        return true;
    }
    // Generate order hash
    generateOrderHash(params) {
        const data = [
            params.maker,
            params.receiver,
            params.makerAsset,
            params.takerAsset,
            params.makingAmount,
            params.takingAmount,
            params.srcChainId.toString(),
            params.dstChainId.toString(),
            Date.now().toString(),
        ].join("|");
        return "0x" + crypto_1.default.createHash("sha256").update(data).digest("hex");
    }
    // Calculate reserve price (minimum acceptable price)
    calculateReservePrice(makingAmount, takingAmount) {
        // Reserve price is 95% of the original rate to account for slippage
        const rate = parseFloat(takingAmount) / parseFloat(makingAmount);
        const reserveRate = rate * 0.95;
        return (parseFloat(makingAmount) * reserveRate).toString();
    }
    // Get order book statistics
    getStats() {
        const orders = Array.from(this.orders.values());
        const stats = {
            total: orders.length,
            active: orders.filter((o) => ["pending", "auction_active", "htlc_created"].includes(o.status)).length,
            completed: orders.filter((o) => o.status === "filled").length,
            cancelled: orders.filter((o) => o.status === "cancelled").length,
            expired: orders.filter((o) => o.status === "expired").length,
            totalVolume: this.calculateTotalVolume(orders),
        };
        return stats;
    }
    // Calculate total volume
    calculateTotalVolume(orders) {
        const completedOrders = orders.filter((o) => o.status === "filled");
        const totalVolume = completedOrders.reduce((sum, order) => {
            return sum + parseFloat(order.makingAmount);
        }, 0);
        return totalVolume.toString();
    }
    // Clean up expired orders
    cleanupExpiredOrders() {
        const now = Math.floor(Date.now() / 1000);
        let cleanedCount = 0;
        for (const [orderHash, order] of this.orders.entries()) {
            // Mark expired auctions
            if (order.status === "auction_active" && now > order.auctionEndTime) {
                order.status = "expired";
                this.orders.set(orderHash, order);
                cleanedCount++;
            }
            // Remove very old completed/cancelled orders (older than 24 hours)
            const dayAgo = now - 86400;
            if (["filled", "cancelled", "expired"].includes(order.status) &&
                order.createdAt < dayAgo) {
                this.orders.delete(orderHash);
                cleanedCount++;
            }
        }
        if (cleanedCount > 0) {
            this.logger.info("Cleaned up expired orders", { count: cleanedCount });
        }
    }
    // Get orders by maker
    getOrdersByMaker(maker) {
        return this.getActiveOrders({ maker });
    }
    // Get orders by status
    getOrdersByStatus(status) {
        return this.getActiveOrders({ status });
    }
    // Check if order exists
    hasOrder(orderHash) {
        return this.orders.has(orderHash);
    }
    // Get total number of orders
    getTotalOrders() {
        return this.orders.size;
    }
    // Start periodic cleanup
    startPeriodicCleanup() {
        // Clean up every 10 minutes
        setInterval(() => {
            this.cleanupExpiredOrders();
        }, 600000);
        this.logger.info("Started periodic order cleanup");
    }
}
exports.OrderBook = OrderBook;
//# sourceMappingURL=OrderBook.js.map