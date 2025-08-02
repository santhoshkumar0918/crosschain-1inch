import { EventEmitter } from 'events';
import { EthereumClient } from '../chains/ethereum/EthereumClient';
import { StellarClient } from '../chains/stellar/StellarClient';
import logger from '../utils/logger';

export class EventMonitor extends EventEmitter {
  private ethereumClient: EthereumClient;
  private stellarClient: StellarClient;
  private isMonitoring: boolean = false;

  constructor(ethereumClient: EthereumClient, stellarClient: StellarClient) {
    super();
    this.ethereumClient = ethereumClient;
    this.stellarClient = stellarClient;
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    logger.info('📡 Starting cross-chain event monitoring...');

    // Setup event handlers for both chains
    this.setupEthereumEventHandlers();
    this.setupStellarEventHandlers();

    // Start monitoring both chains concurrently
    await Promise.all([
      this.ethereumClient.startMonitoring(),
      this.stellarClient.startMonitoring()
    ]);

    logger.info('✅ Cross-chain event monitoring started');
  }

  private setupEthereumEventHandlers(): void {
    this.ethereumClient.on('escrowCreated', (event) => {
      logger.info(`🏦 Ethereum escrow created: ${event.orderId}`);
      this.emit('escrowCreated', { chain: 'ethereum', ...event });
    });

    this.ethereumClient.on('secretRevealed', (event) => {
      logger.info(`🔐 Secret revealed on Ethereum: ${event.orderId}`);
      this.emit('secretRevealed', { chain: 'ethereum', ...event });
    });

    this.ethereumClient.on('escrowClaimed', (event) => {
      logger.info(`✅ Ethereum escrow claimed: ${event.orderId}`);
      this.emit('escrowClaimed', { chain: 'ethereum', ...event });
    });

    this.ethereumClient.on('escrowRefunded', (event) => {
      logger.info(`🔄 Ethereum escrow refunded: ${event.orderId}`);
      this.emit('escrowRefunded', { chain: 'ethereum', ...event });
    });

    this.ethereumClient.on('error', (error) => {
      logger.error('❌ Ethereum client error:', error);
      this.emit('error', { chain: 'ethereum', error });
    });
  }

  private setupStellarEventHandlers(): void {
    this.stellarClient.on('escrowCreated', (event) => {
      logger.info(`🏦 Stellar escrow created: ${event.orderId}`);
      this.emit('escrowCreated', { chain: 'stellar', ...event });
    });

    this.stellarClient.on('secretRevealed', (event) => {
      logger.info(`🔐 Secret revealed on Stellar: ${event.orderId}`);
      this.emit('secretRevealed', { chain: 'stellar', ...event });
    });

    this.stellarClient.on('escrowClaimed', (event) => {
      logger.info(`✅ Stellar escrow claimed: ${event.orderId}`);
      this.emit('escrowClaimed', { chain: 'stellar', ...event });
    });

    this.stellarClient.on('escrowRefunded', (event) => {
      logger.info(`🔄 Stellar escrow refunded: ${event.orderId}`);
      this.emit('escrowRefunded', { chain: 'stellar', ...event });
    });

    this.stellarClient.on('error', (error) => {
      logger.error('❌ Stellar client error:', error);
      this.emit('error', { chain: 'stellar', error });
    });
  }

  stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    
    // Stop monitoring both chains
    this.ethereumClient.stopMonitoring();
    this.stellarClient.stopMonitoring();

    // Remove all event listeners
    this.ethereumClient.removeAllListeners();
    this.stellarClient.removeAllListeners();

    logger.info('⏹️ Cross-chain event monitoring stopped');
  }

  isEventMonitoring(): boolean {
    return this.isMonitoring;
  }

  getMonitoringStatus(): {
    isMonitoring: boolean;
    ethereumConnected: boolean;
    stellarConnected: boolean;
    ethereumMonitoring: boolean;
    stellarMonitoring: boolean;
  } {
    return {
      isMonitoring: this.isMonitoring,
      ethereumConnected: this.ethereumClient.isClientConnected(),
      stellarConnected: this.stellarClient.isClientConnected(),
      ethereumMonitoring: this.ethereumClient.isClientMonitoring(),
      stellarMonitoring: this.stellarClient.isClientMonitoring(),
    };
  }
}