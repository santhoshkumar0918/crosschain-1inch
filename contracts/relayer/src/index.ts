import { Relayer } from './core/Relayer';
import { EthereumClient } from './chains/ethereum/EthereumClient';
import { StellarClient } from './chains/stellar/StellarClient';
import { RelayerAPI } from './api/server';
import { config } from './config/environment';
import logger from './utils/logger';

async function main() {
  try {
    logger.info('🚀 Initializing Cross-Chain HTLC Relayer...');

    // Initialize chain clients
    const ethereumClient = new EthereumClient(
      config.chains.ethereum.rpcUrl,
      config.chains.ethereum.privateKey,
      config.chains.ethereum.contractAddress
    );

    const stellarClient = new StellarClient(
      config.chains.stellar.networkUrl,
      config.chains.stellar.secretKey,
      config.chains.stellar.contractId,
      config.chains.stellar.networkPassphrase
    );

    // Initialize relayer
    const relayer = new Relayer(ethereumClient, stellarClient);

    // Initialize API server
    const api = new RelayerAPI(relayer);

    // Start relayer
    await relayer.start();

    // Start API server
    await api.start(config.port);

    logger.info('🎉 Cross-Chain HTLC Relayer is running!');
    logger.info(`📊 API Server: http://localhost:${config.port}`);
    logger.info(`📡 WebSocket: ws://localhost:${config.port}`);
    logger.info(`📈 Health Check: http://localhost:${config.port}/api/health`);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`\n👋 Received ${signal}, shutting down gracefully...`);
      
      try {
        // Stop API server
        await api.stop();
        
        // Stop relayer
        await relayer.stop();
        
        logger.info('✅ Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error during shutdown:', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('❌ Uncaught Exception:', error);
      shutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
      shutdown('unhandledRejection');
    });

  } catch (error) {
    logger.error('❌ Failed to start relayer:', error);
    process.exit(1);
  }
}

// Start the application
if (require.main === module) {
  main().catch((error) => {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { main };