"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventMonitor = void 0;
const events_1 = require("events");
const logger_1 = __importDefault(require("../utils/logger"));
class EventMonitor extends events_1.EventEmitter {
    constructor(ethereumClient, stellarClient) {
        super();
        this.isMonitoring = false;
        this.ethereumClient = ethereumClient;
        this.stellarClient = stellarClient;
    }
    async startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        logger_1.default.info('📡 Starting cross-chain event monitoring...');
        // Setup event handlers for both chains
        this.setupEthereumEventHandlers();
        this.setupStellarEventHandlers();
        // Start monitoring both chains concurrently
        await Promise.all([
            this.ethereumClient.startMonitoring(),
            this.stellarClient.startMonitoring()
        ]);
        logger_1.default.info('✅ Cross-chain event monitoring started');
    }
    setupEthereumEventHandlers() {
        this.ethereumClient.on('escrowCreated', (event) => {
            logger_1.default.info(`🏦 Ethereum escrow created: ${event.orderId}`);
            this.emit('escrowCreated', { chain: 'ethereum', ...event });
        });
        this.ethereumClient.on('secretRevealed', (event) => {
            logger_1.default.info(`🔐 Secret revealed on Ethereum: ${event.orderId}`);
            this.emit('secretRevealed', { chain: 'ethereum', ...event });
        });
        this.ethereumClient.on('escrowClaimed', (event) => {
            logger_1.default.info(`✅ Ethereum escrow claimed: ${event.orderId}`);
            this.emit('escrowClaimed', { chain: 'ethereum', ...event });
        });
        this.ethereumClient.on('escrowRefunded', (event) => {
            logger_1.default.info(`🔄 Ethereum escrow refunded: ${event.orderId}`);
            this.emit('escrowRefunded', { chain: 'ethereum', ...event });
        });
        this.ethereumClient.on('error', (error) => {
            logger_1.default.error('❌ Ethereum client error:', error);
            this.emit('error', { chain: 'ethereum', error });
        });
    }
    setupStellarEventHandlers() {
        this.stellarClient.on('escrowCreated', (event) => {
            logger_1.default.info(`🏦 Stellar escrow created: ${event.orderId}`);
            this.emit('escrowCreated', { chain: 'stellar', ...event });
        });
        this.stellarClient.on('secretRevealed', (event) => {
            logger_1.default.info(`🔐 Secret revealed on Stellar: ${event.orderId}`);
            this.emit('secretRevealed', { chain: 'stellar', ...event });
        });
        this.stellarClient.on('escrowClaimed', (event) => {
            logger_1.default.info(`✅ Stellar escrow claimed: ${event.orderId}`);
            this.emit('escrowClaimed', { chain: 'stellar', ...event });
        });
        this.stellarClient.on('escrowRefunded', (event) => {
            logger_1.default.info(`🔄 Stellar escrow refunded: ${event.orderId}`);
            this.emit('escrowRefunded', { chain: 'stellar', ...event });
        });
        this.stellarClient.on('error', (error) => {
            logger_1.default.error('❌ Stellar client error:', error);
            this.emit('error', { chain: 'stellar', error });
        });
    }
    stopMonitoring() {
        if (!this.isMonitoring)
            return;
        this.isMonitoring = false;
        // Stop monitoring both chains
        this.ethereumClient.stopMonitoring();
        this.stellarClient.stopMonitoring();
        // Remove all event listeners
        this.ethereumClient.removeAllListeners();
        this.stellarClient.removeAllListeners();
        logger_1.default.info('⏹️ Cross-chain event monitoring stopped');
    }
    isEventMonitoring() {
        return this.isMonitoring;
    }
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            ethereumConnected: this.ethereumClient.isClientConnected(),
            stellarConnected: this.stellarClient.isClientConnected(),
            ethereumMonitoring: this.ethereumClient.isClientMonitoring(),
            stellarMonitoring: this.stellarClient.isClientMonitoring(),
        };
    }
}
exports.EventMonitor = EventMonitor;
//# sourceMappingURL=EventMonitor.js.map