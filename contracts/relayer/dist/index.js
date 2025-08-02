"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const Relayer_1 = require("./core/Relayer");
const EthereumClient_1 = require("./chains/ethereum/EthereumClient");
const StellarClient_1 = require("./chains/stellar/StellarClient");
const server_1 = require("./api/server");
const environment_1 = require("./config/environment");
const logger_1 = __importDefault(require("./utils/logger"));
async function main() {
    try {
        logger_1.default.info('🚀 Initializing Cross-Chain HTLC Relayer...');
        // Initialize chain clients
        const ethereumClient = new EthereumClient_1.EthereumClient(environment_1.config.chains.ethereum.rpcUrl, environment_1.config.chains.ethereum.privateKey, environment_1.config.chains.ethereum.contractAddress);
        const stellarClient = new StellarClient_1.StellarClient(environment_1.config.chains.stellar.networkUrl, environment_1.config.chains.stellar.secretKey, environment_1.config.chains.stellar.contractId, environment_1.config.chains.stellar.networkPassphrase);
        // Initialize relayer
        const relayer = new Relayer_1.Relayer(ethereumClient, stellarClient);
        // Initialize API server
        const api = new server_1.RelayerAPI(relayer);
        // Start relayer
        await relayer.start();
        // Start API server
        await api.start(environment_1.config.port);
        logger_1.default.info('🎉 Cross-Chain HTLC Relayer is running!');
        logger_1.default.info(`📊 API Server: http://localhost:${environment_1.config.port}`);
        logger_1.default.info(`📡 WebSocket: ws://localhost:${environment_1.config.port}`);
        logger_1.default.info(`📈 Health Check: http://localhost:${environment_1.config.port}/api/health`);
        // Graceful shutdown handlers
        const shutdown = async (signal) => {
            logger_1.default.info(`\n👋 Received ${signal}, shutting down gracefully...`);
            try {
                // Stop API server
                await api.stop();
                // Stop relayer
                await relayer.stop();
                logger_1.default.info('✅ Graceful shutdown completed');
                process.exit(0);
            }
            catch (error) {
                logger_1.default.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };
        // Handle shutdown signals
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        // Handle uncaught exceptions
        process.on('uncaughtException', (error) => {
            logger_1.default.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });
        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger_1.default.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            shutdown('unhandledRejection');
        });
    }
    catch (error) {
        logger_1.default.error('❌ Failed to start relayer:', error);
        process.exit(1);
    }
}
// Start the application
if (require.main === module) {
    main().catch((error) => {
        logger_1.default.error('❌ Fatal error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=index.js.map