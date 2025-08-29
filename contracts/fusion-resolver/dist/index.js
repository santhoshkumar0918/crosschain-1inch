"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FusionResolver = void 0;
// contracts/fusion-resolver/src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const config_1 = require("./utils/config");
const logger_1 = require("./utils/logger");
const OrderBook_1 = require("./core/OrderBook");
const DutchAuction_1 = require("./core/DutchAuction");
const HTLCManager_1 = require("./core/HTLCManager");
const QuoteCalculator_1 = require("./core/QuoteCalculator");
const AssetManager_1 = require("./core/AssetManager");
const BalanceTracker_1 = require("./core/BalanceTracker");
const ReservationTracker_1 = require("./core/ReservationTracker");
const LiquidityManager_1 = require("./core/LiquidityManager");
const route_1 = require("./api/route");
class FusionResolver {
    app;
    logger;
    orderBook;
    dutchAuction;
    htlcManager;
    quoteCalculator;
    assetManager;
    balanceTracker;
    reservationTracker;
    liquidityManager;
    constructor() {
        this.logger = new logger_1.Logger("FusionResolver");
        this.app = (0, express_1.default)();
        // Initialize liquidity management components
        this.assetManager = new AssetManager_1.AssetManager();
        this.balanceTracker = new BalanceTracker_1.BalanceTracker(this.assetManager);
        this.reservationTracker = new ReservationTracker_1.ReservationTracker(this.assetManager);
        this.liquidityManager = new LiquidityManager_1.LiquidityManager(this.assetManager, this.balanceTracker, this.reservationTracker);
        // Initialize core components
        this.orderBook = new OrderBook_1.OrderBook();
        this.htlcManager = new HTLCManager_1.HTLCManager();
        this.quoteCalculator = new QuoteCalculator_1.QuoteCalculator();
        this.dutchAuction = new DutchAuction_1.DutchAuction(this.orderBook, this.htlcManager, this.liquidityManager);
    }
    async initialize() {
        try {
            this.logger.info("Initializing Fusion+ Resolver...");
            // Setup middleware
            this.setupMiddleware();
            // Setup routes
            this.setupRoutes();
            // Start liquidity monitoring
            this.liquidityManager.startMonitoring();
            // Start auction monitoring
            await this.dutchAuction.startAuctionMonitoring();
            this.logger.info("Fusion+ Resolver initialized successfully");
        }
        catch (error) {
            this.logger.error("Failed to initialize Fusion+ Resolver", error);
            throw error;
        }
    }
    setupMiddleware() {
        // Security middleware
        this.app.use((0, helmet_1.default)());
        // CORS
        this.app.use((0, cors_1.default)({
            origin: process.env.NODE_ENV === "production"
                ? ["https://your-domain.com"]
                : ["http://localhost:3000", "http://localhost:3001"],
            credentials: true,
        }));
        // Body parsing
        this.app.use(express_1.default.json({ limit: "10mb" }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Logging
        this.app.use((0, morgan_1.default)("combined"));
        // Request logging
        this.app.use((req, res, next) => {
            this.logger.info(`${req.method} ${req.path}`, {
                ip: req.ip,
                userAgent: req.get("User-Agent"),
            });
            next();
        });
    }
    setupRoutes() {
        // API routes
        this.app.use("/api/fusion-plus", (0, route_1.createFusionRoutes)(this.orderBook, this.dutchAuction, this.htlcManager, this.quoteCalculator));
        // Root health check
        this.app.get("/", (req, res) => {
            res.json({
                service: "1inch Fusion+ to Stellar Resolver",
                status: "running",
                version: "1.0.0",
                description: "Cross-chain atomic swap resolver for Ethereum ⇌ Stellar",
                endpoints: {
                    health: "/api/fusion-plus/health",
                    quote: "POST /api/fusion-plus/quote",
                    submit: "POST /api/fusion-plus/submit",
                    orders: "GET /api/fusion-plus/orders",
                    stats: "GET /api/fusion-plus/stats",
                },
                chains: ["ethereum-sepolia", "stellar-testnet"],
                timestamp: new Date().toISOString(),
            });
        });
        // 404 handler
        this.app.use("*", (req, res) => {
            res.status(404).json({
                success: false,
                error: "Endpoint not found",
                availableEndpoints: [
                    "GET /",
                    "GET /api/fusion-plus/health",
                    "POST /api/fusion-plus/quote",
                    "POST /api/fusion-plus/submit",
                    "GET /api/fusion-plus/orders",
                    "GET /api/fusion-plus/stats",
                ],
            });
        });
        // Error handling
        this.app.use((error, req, res, next) => {
            this.logger.error("Unhandled API error", error);
            res.status(500).json({
                success: false,
                error: "Internal server error",
                message: config_1.config.nodeEnv === "development"
                    ? error.message
                    : "Something went wrong",
            });
        });
    }
    async start() {
        try {
            await this.initialize();
            const server = this.app.listen(config_1.config.port, () => {
                this.logger.info(`🚀 Fusion+ Resolver running on port ${config_1.config.port}`);
                this.logger.info(`📊 Health check: http://localhost:${config_1.config.port}/api/fusion-plus/health`);
                this.logger.info(`💱 Submit orders: http://localhost:${config_1.config.port}/api/fusion-plus/submit`);
                this.logger.info(`📋 View orders: http://localhost:${config_1.config.port}/api/fusion-plus/orders`);
                this.logger.info(`📈 Statistics: http://localhost:${config_1.config.port}/api/fusion-plus/stats`);
                this.logger.info("🌉 Ready to facilitate Ethereum ⇌ Stellar atomic swaps!");
            });
            // Graceful shutdown
            process.on("SIGTERM", () => this.shutdown(server));
            process.on("SIGINT", () => this.shutdown(server));
        }
        catch (error) {
            this.logger.error("Failed to start Fusion+ Resolver", error);
            process.exit(1);
        }
    }
    shutdown(server) {
        this.logger.info("Shutting down Fusion+ Resolver...");
        // Stop liquidity monitoring and cleanup
        this.liquidityManager.shutdown();
        server.close(() => {
            this.logger.info("Fusion+ Resolver stopped");
            process.exit(0);
        });
    }
}
exports.FusionResolver = FusionResolver;
// Start the resolver if this file is run directly
if (require.main === module) {
    const resolver = new FusionResolver();
    resolver.start().catch((error) => {
        console.error("💥 Fatal error starting Fusion+ Resolver:", error);
        process.exit(1);
    });
}
exports.default = FusionResolver;
//# sourceMappingURL=index.js.map