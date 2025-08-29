"use strict";
// contracts/fusion-resolver/src/types/liquidity.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORK_NATIVE_ASSETS = exports.ASSET_DECIMALS = exports.DEFAULT_CRITICAL_LIQUIDITY_THRESHOLD = exports.DEFAULT_LOW_LIQUIDITY_THRESHOLD = exports.DEFAULT_MONITORING_INTERVAL = exports.DEFAULT_RESERVATION_TIMEOUT = exports.DEFAULT_CACHE_TTL = exports.LiquidityException = exports.LiquidityError = void 0;
// Error types
var LiquidityError;
(function (LiquidityError) {
    LiquidityError["INSUFFICIENT_BALANCE"] = "INSUFFICIENT_BALANCE";
    LiquidityError["ASSET_NOT_SUPPORTED"] = "ASSET_NOT_SUPPORTED";
    LiquidityError["RESERVATION_FAILED"] = "RESERVATION_FAILED";
    LiquidityError["BALANCE_FETCH_FAILED"] = "BALANCE_FETCH_FAILED";
    LiquidityError["INVALID_AMOUNT"] = "INVALID_AMOUNT";
    LiquidityError["NETWORK_ERROR"] = "NETWORK_ERROR";
    LiquidityError["RESERVATION_EXPIRED"] = "RESERVATION_EXPIRED";
    LiquidityError["CONFIGURATION_ERROR"] = "CONFIGURATION_ERROR";
})(LiquidityError || (exports.LiquidityError = LiquidityError = {}));
class LiquidityException extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = "LiquidityException";
    }
}
exports.LiquidityException = LiquidityException;
// Constants
exports.DEFAULT_CACHE_TTL = 30; // seconds
exports.DEFAULT_RESERVATION_TIMEOUT = 300; // seconds
exports.DEFAULT_MONITORING_INTERVAL = 10; // seconds
exports.DEFAULT_LOW_LIQUIDITY_THRESHOLD = 0.2; // 20%
exports.DEFAULT_CRITICAL_LIQUIDITY_THRESHOLD = 0.05; // 5%
// Asset decimals constants
exports.ASSET_DECIMALS = {
    ETH: 18,
    XLM: 7,
    USDC: 6,
    USDT: 6,
};
// Network-specific constants
exports.NETWORK_NATIVE_ASSETS = {
    ethereum: "ETH",
    stellar: "XLM",
};
//# sourceMappingURL=liquidity.js.map