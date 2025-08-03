"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservationTracker = void 0;
// contracts/fusion-resolver/src/core/ReservationTracker.ts
const liquidity_1 = require("../types/liquidity");
const logger_1 = require("../utils/logger");
class ReservationTracker {
    assetManager;
    logger = new logger_1.Logger("ReservationTracker");
    reservations = new Map(); // orderId -> reservations
    assetReservations = new Map(); // asset -> total reserved amount
    cleanupInterval = null;
    reservationTimeoutMs;
    constructor(assetManager, reservationTimeoutSeconds = liquidity_1.DEFAULT_RESERVATION_TIMEOUT) {
        this.assetManager = assetManager;
        this.reservationTimeoutMs = reservationTimeoutSeconds * 1000;
        this.startCleanupInterval();
        this.logger.info("ReservationTracker initialized", {
            reservationTimeoutSeconds,
        });
    }
    // Reservation management
    reserve(orderId, asset, amount) {
        try {
            // Validate inputs
            if (!orderId || orderId.trim() === "") {
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.RESERVATION_FAILED, "Order ID is required", { orderId, asset, amount });
            }
            if (!this.assetManager.isValidAsset(asset)) {
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.ASSET_NOT_SUPPORTED, `Asset not supported: ${asset}`, { orderId, asset, amount });
            }
            if (!this.assetManager.isValidAmount(asset, amount)) {
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.INVALID_AMOUNT, `Invalid amount: ${amount}`, { orderId, asset, amount });
            }
            // Check if order already has reservations
            const existingReservations = this.reservations.get(orderId) || [];
            const existingReservation = existingReservations.find((r) => r.asset === asset);
            if (existingReservation) {
                this.logger.warn("Order already has reservation for this asset", {
                    orderId,
                    asset: this.assetManager.getAssetSymbol(asset),
                    existingAmount: this.assetManager.convertToDecimal(asset, existingReservation.amount),
                    newAmount: this.assetManager.convertToDecimal(asset, amount),
                });
                return false;
            }
            // Create reservation
            const now = Date.now();
            const reservation = {
                orderId,
                asset,
                amount,
                timestamp: now,
                expiresAt: now + this.reservationTimeoutMs,
            };
            // Add to order reservations
            const orderReservations = this.reservations.get(orderId) || [];
            orderReservations.push(reservation);
            this.reservations.set(orderId, orderReservations);
            // Update asset total reservations
            const currentReserved = this.assetReservations.get(asset) || "0";
            const newReserved = this.assetManager.addAmounts(asset, currentReserved, amount);
            this.assetReservations.set(asset, newReserved);
            this.logger.info("Liquidity reserved successfully", {
                orderId,
                asset: this.assetManager.getAssetSymbol(asset),
                amount: this.assetManager.convertToDecimal(asset, amount),
                totalReserved: this.assetManager.convertToDecimal(asset, newReserved),
                expiresAt: new Date(reservation.expiresAt).toISOString(),
            });
            return true;
        }
        catch (error) {
            this.logger.error("Failed to reserve liquidity", {
                orderId,
                asset: this.assetManager.getAssetSymbol(asset),
                amount,
                error: error instanceof Error ? error.message : "Unknown error",
            });
            if (error instanceof liquidity_1.LiquidityException) {
                throw error;
            }
            throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.RESERVATION_FAILED, `Failed to reserve liquidity: ${error instanceof Error ? error.message : "Unknown error"}`, { orderId, asset, amount, error });
        }
    }
    release(orderId) {
        try {
            const orderReservations = this.reservations.get(orderId);
            if (!orderReservations || orderReservations.length === 0) {
                this.logger.debug("No reservations found for order", { orderId });
                return;
            }
            // Release each reservation
            for (const reservation of orderReservations) {
                this.releaseReservation(reservation);
            }
            // Remove order from reservations map
            this.reservations.delete(orderId);
            this.logger.info("All reservations released for order", {
                orderId,
                reservationsReleased: orderReservations.length,
            });
        }
        catch (error) {
            this.logger.error("Failed to release reservations for order", {
                orderId,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    releaseByAsset(asset, amount) {
        try {
            if (!this.assetManager.isValidAsset(asset)) {
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.ASSET_NOT_SUPPORTED, `Asset not supported: ${asset}`, { asset, amount });
            }
            if (!this.assetManager.isValidAmount(asset, amount)) {
                throw new liquidity_1.LiquidityException(liquidity_1.LiquidityError.INVALID_AMOUNT, `Invalid amount: ${amount}`, { asset, amount });
            }
            let remainingToRelease = amount;
            const reservationsToRemove = [];
            // Find reservations for this asset
            for (const [orderId, orderReservations] of this.reservations.entries()) {
                for (const reservation of orderReservations) {
                    if (reservation.asset === asset) {
                        const compareResult = this.assetManager.compareAmounts(asset, remainingToRelease, reservation.amount);
                        if (compareResult >= 0) {
                            // Can release this entire reservation
                            remainingToRelease = this.assetManager.subtractAmounts(asset, remainingToRelease, reservation.amount);
                            reservationsToRemove.push({ orderId, reservation });
                            if (remainingToRelease === "0") {
                                break;
                            }
                        }
                        else {
                            // Partial release - reduce this reservation
                            const newAmount = this.assetManager.subtractAmounts(asset, reservation.amount, remainingToRelease);
                            reservation.amount = newAmount;
                            remainingToRelease = "0";
                            break;
                        }
                    }
                }
                if (remainingToRelease === "0") {
                    break;
                }
            }
            // Remove fully released reservations
            for (const { orderId, reservation } of reservationsToRemove) {
                const orderReservations = this.reservations.get(orderId) || [];
                const index = orderReservations.indexOf(reservation);
                if (index > -1) {
                    orderReservations.splice(index, 1);
                    if (orderReservations.length === 0) {
                        this.reservations.delete(orderId);
                    }
                    else {
                        this.reservations.set(orderId, orderReservations);
                    }
                }
            }
            // Update asset total reservations
            const releasedAmount = this.assetManager.subtractAmounts(asset, amount, remainingToRelease);
            const currentReserved = this.assetReservations.get(asset) || "0";
            const newReserved = this.assetManager.subtractAmounts(asset, currentReserved, releasedAmount);
            this.assetReservations.set(asset, newReserved);
            this.logger.info("Liquidity released by asset", {
                asset: this.assetManager.getAssetSymbol(asset),
                requestedAmount: this.assetManager.convertToDecimal(asset, amount),
                releasedAmount: this.assetManager.convertToDecimal(asset, releasedAmount),
                remainingReserved: this.assetManager.convertToDecimal(asset, newReserved),
            });
        }
        catch (error) {
            this.logger.error("Failed to release liquidity by asset", {
                asset: this.assetManager.getAssetSymbol(asset),
                amount,
                error: error instanceof Error ? error.message : "Unknown error",
            });
        }
    }
    // Queries
    getReservedAmount(asset) {
        return this.assetReservations.get(asset) || "0";
    }
    getReservationsByOrder(orderId) {
        return this.reservations.get(orderId) || [];
    }
    getAllReservations() {
        return new Map(this.reservations);
    }
    // Cleanup
    cleanupExpiredReservations() {
        const now = Date.now();
        let cleanedCount = 0;
        const ordersToRemove = [];
        for (const [orderId, orderReservations] of this.reservations.entries()) {
            const validReservations = [];
            for (const reservation of orderReservations) {
                if (now <= reservation.expiresAt) {
                    validReservations.push(reservation);
                }
                else {
                    // Release expired reservation
                    this.releaseReservation(reservation);
                    cleanedCount++;
                    this.logger.info("Expired reservation cleaned up", {
                        orderId,
                        asset: this.assetManager.getAssetSymbol(reservation.asset),
                        amount: this.assetManager.convertToDecimal(reservation.asset, reservation.amount),
                        expiredAt: new Date(reservation.expiresAt).toISOString(),
                    });
                }
            }
            if (validReservations.length === 0) {
                ordersToRemove.push(orderId);
            }
            else if (validReservations.length !== orderReservations.length) {
                this.reservations.set(orderId, validReservations);
            }
        }
        // Remove orders with no valid reservations
        ordersToRemove.forEach((orderId) => this.reservations.delete(orderId));
        if (cleanedCount > 0) {
            this.logger.info("Expired reservations cleanup completed", {
                cleanedCount,
                ordersRemoved: ordersToRemove.length,
            });
        }
    }
    // Private helper methods
    releaseReservation(reservation) {
        const currentReserved = this.assetReservations.get(reservation.asset) || "0";
        try {
            const newReserved = this.assetManager.subtractAmounts(reservation.asset, currentReserved, reservation.amount);
            this.assetReservations.set(reservation.asset, newReserved);
        }
        catch (error) {
            // If subtraction fails (e.g., would result in negative), set to 0
            this.logger.warn("Error releasing reservation, setting reserved amount to 0", {
                asset: this.assetManager.getAssetSymbol(reservation.asset),
                currentReserved: this.assetManager.convertToDecimal(reservation.asset, currentReserved),
                reservationAmount: this.assetManager.convertToDecimal(reservation.asset, reservation.amount),
                error: error instanceof Error ? error.message : "Unknown error",
            });
            this.assetReservations.set(reservation.asset, "0");
        }
    }
    startCleanupInterval() {
        // Run cleanup every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanupExpiredReservations();
        }, 60000);
        this.logger.debug("Cleanup interval started");
    }
    // Utility methods
    getReservationStats() {
        let totalReservations = 0;
        const assetCounts = new Map();
        for (const orderReservations of this.reservations.values()) {
            totalReservations += orderReservations.length;
            for (const reservation of orderReservations) {
                const count = assetCounts.get(reservation.asset) || 0;
                assetCounts.set(reservation.asset, count + 1);
            }
        }
        const assetBreakdown = Array.from(this.assetReservations.entries()).map(([asset, reservedAmount]) => ({
            asset,
            symbol: this.assetManager.getAssetSymbol(asset),
            reservedAmount: this.assetManager.convertToDecimal(asset, reservedAmount),
            reservationCount: assetCounts.get(asset) || 0,
        }));
        return {
            totalOrders: this.reservations.size,
            totalReservations,
            assetBreakdown,
        };
    }
    getExpiredReservations() {
        const now = Date.now();
        const expired = [];
        for (const orderReservations of this.reservations.values()) {
            for (const reservation of orderReservations) {
                if (now > reservation.expiresAt) {
                    expired.push(reservation);
                }
            }
        }
        return expired;
    }
    // Check if an order has any reservations
    hasReservations(orderId) {
        const reservations = this.reservations.get(orderId);
        return reservations !== undefined && reservations.length > 0;
    }
    // Get total reserved amount across all assets (for monitoring)
    getTotalReservedValue() {
        return Array.from(this.assetReservations.entries()).map(([asset, amount]) => ({
            asset,
            symbol: this.assetManager.getAssetSymbol(asset),
            amount: this.assetManager.convertToDecimal(asset, amount),
        }));
    }
    // Extend reservation timeout for an order
    extendReservation(orderId, additionalTimeMs) {
        const orderReservations = this.reservations.get(orderId);
        if (!orderReservations || orderReservations.length === 0) {
            return false;
        }
        for (const reservation of orderReservations) {
            reservation.expiresAt += additionalTimeMs;
        }
        this.logger.info("Reservation extended", {
            orderId,
            additionalTimeMs,
            reservationCount: orderReservations.length,
        });
        return true;
    }
    // Cleanup and shutdown
    shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        // Release all reservations
        const allOrders = Array.from(this.reservations.keys());
        for (const orderId of allOrders) {
            this.release(orderId);
        }
        this.logger.info("ReservationTracker shutdown completed");
    }
}
exports.ReservationTracker = ReservationTracker;
//# sourceMappingURL=ReservationTracker.js.map