// contracts/fusion-resolver/src/index.ts
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { config } from "./utils/config";
import { Logger } from "./utils/logger";
import { OrderBook } from "./core/OrderBook";
import { DutchAuction } from "./core/DutchAuction";
import { HTLCManager } from "./core/HTLCManager";
import { QuoteCalculator } from "./core/QuoteCalculator";
import { AssetManager } from "./core/AssetManager";
import { BalanceTracker } from "./core/BalanceTracker";
import { ReservationTracker } from "./core/ReservationTracker";
import { LiquidityManager } from "./core/LiquidityManager";
import { createFusionRoutes } from "./api/route";

class FusionResolver {
  private app: express.Application;
  private logger: Logger;
  private orderBook: OrderBook;
  private dutchAuction: DutchAuction;
  private htlcManager: HTLCManager;
  private quoteCalculator: QuoteCalculator;
  private assetManager: AssetManager;
  private balanceTracker: BalanceTracker;
  private reservationTracker: ReservationTracker;
  private liquidityManager: LiquidityManager;

  constructor() {
    this.logger = new Logger("FusionResolver");
    this.app = express();

    // Initialize liquidity management components
    this.assetManager = new AssetManager();
    this.balanceTracker = new BalanceTracker(this.assetManager);
    this.reservationTracker = new ReservationTracker(this.assetManager);
    this.liquidityManager = new LiquidityManager(
      this.assetManager,
      this.balanceTracker,
      this.reservationTracker
    );

    // Initialize core components
    this.orderBook = new OrderBook();
    this.htlcManager = new HTLCManager();
    this.quoteCalculator = new QuoteCalculator();
    this.dutchAuction = new DutchAuction(
      this.orderBook,
      this.htlcManager,
      this.liquidityManager
    );
  }

  async initialize(): Promise<void> {
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
    } catch (error) {
      this.logger.error("Failed to initialize Fusion+ Resolver", error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());

    // CORS
    this.app.use(
      cors({
        origin:
          process.env.NODE_ENV === "production"
            ? ["https://your-domain.com"]
            : ["http://localhost:3000", "http://localhost:3001"],
        credentials: true,
      })
    );

    // Body parsing
    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true }));

    // Logging
    this.app.use(morgan("combined"));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("User-Agent"),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // API routes
    this.app.use(
      "/api/fusion-plus",
      createFusionRoutes(
        this.orderBook,
        this.dutchAuction,
        this.htlcManager,
        this.quoteCalculator
      )
    );

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
    this.app.use(
      (
        error: Error,
        req: express.Request,
        res: express.Response,
        next: express.NextFunction
      ) => {
        this.logger.error("Unhandled API error", error);
        res.status(500).json({
          success: false,
          error: "Internal server error",
          message:
            config.nodeEnv === "development"
              ? error.message
              : "Something went wrong",
        });
      }
    );
  }

  async start(): Promise<void> {
    try {
      await this.initialize();

      const server = this.app.listen(config.port, () => {
        this.logger.info(`🚀 Fusion+ Resolver running on port ${config.port}`);
        this.logger.info(
          `📊 Health check: http://localhost:${config.port}/api/fusion-plus/health`
        );
        this.logger.info(
          `💱 Submit orders: http://localhost:${config.port}/api/fusion-plus/submit`
        );
        this.logger.info(
          `📋 View orders: http://localhost:${config.port}/api/fusion-plus/orders`
        );
        this.logger.info(
          `📈 Statistics: http://localhost:${config.port}/api/fusion-plus/stats`
        );
        this.logger.info(
          "🌉 Ready to facilitate Ethereum ⇌ Stellar atomic swaps!"
        );
      });

      // Graceful shutdown
      process.on("SIGTERM", () => this.shutdown(server));
      process.on("SIGINT", () => this.shutdown(server));
    } catch (error) {
      this.logger.error("Failed to start Fusion+ Resolver", error);
      process.exit(1);
    }
  }

  private shutdown(server: any): void {
    this.logger.info("Shutting down Fusion+ Resolver...");

    // Stop liquidity monitoring and cleanup
    this.liquidityManager.shutdown();

    server.close(() => {
      this.logger.info("Fusion+ Resolver stopped");
      process.exit(0);
    });
  }
}

// Start the resolver if this file is run directly
if (require.main === module) {
  const resolver = new FusionResolver();
  resolver.start().catch((error) => {
    console.error("💥 Fatal error starting Fusion+ Resolver:", error);
    process.exit(1);
  });
}

export { FusionResolver };
export default FusionResolver;
