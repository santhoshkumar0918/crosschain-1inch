"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Relayer = void 0;
const EventMonitor_1 = require("./EventMonitor");
const OrderManager_1 = require("./OrderManager");
const SecretManager_1 = require("./SecretManager");
const InMemoryStorage_1 = require("../storage/InMemoryStorage");
const types_1 = require("../types");
const logger_1 = __importDefault(require("../utils/logger"));
const node_cron_1 = __importDefault(require("node-cron"));
class Relayer {
    constructor(ethereumClient, stellarClient) {
        this.isRunning = false;
        this.cronJobs = [];
        this.ethereumClient = ethereumClient;
        this.stellarClient = stellarClient;
        // Initialize storage
        this.storage = new InMemoryStorage_1.InMemoryStorage();
        // Initialize managers
        this.orderManager = new OrderManager_1.OrderManager(this.storage);
        this.secretManager = new SecretManager_1.SecretManager(this.storage);
        // Initialize event monitor
        this.eventMonitor = new EventMonitor_1.EventMonitor(ethereumClient, stellarClient);
        this.setupEventHandlers();
    }
    async start() {
        if (this.isRunning)
            return;
        logger_1.default.info('🚀 Starting Cross-Chain HTLC Relayer...');
        try {
            // Connect to both chains
            await Promise.all([
                this.ethereumClient.connect(),
                this.stellarClient.connect()
            ]);
            // Start monitoring events
            await this.eventMonitor.startMonitoring();
            // Start periodic tasks
            this.startPeriodicTasks();
            this.isRunning = true;
            logger_1.default.info('✅ Cross-Chain HTLC Relayer started successfully');
        }
        catch (error) {
            logger_1.default.error('❌ Failed to start relayer:', error);
            throw error;
        }
    }
    async stop() {
        if (!this.isRunning)
            return;
        logger_1.default.info('⏹️ Stopping Cross-Chain HTLC Relayer...');
        // Stop periodic tasks
        this.stopPeriodicTasks();
        // Stop monitoring events
        this.eventMonitor.stopMonitoring();
        // Disconnect from chains
        await Promise.all([
            this.ethereumClient.disconnect(),
            this.stellarClient.disconnect()
        ]);
        this.isRunning = false;
        logger_1.default.info('✅ Cross-Chain HTLC Relayer stopped');
    }
    setupEventHandlers() {
        this.eventMonitor.on('escrowCreated', this.handleEscrowCreated.bind(this));
        this.eventMonitor.on('secretRevealed', this.handleSecretRevealed.bind(this));
        this.eventMonitor.on('escrowClaimed', this.handleEscrowClaimed.bind(this));
        this.eventMonitor.on('escrowRefunded', this.handleEscrowRefunded.bind(this));
        this.eventMonitor.on('error', this.handleError.bind(this));
    }
    async handleEscrowCreated(event) {
        try {
            logger_1.default.info(`📦 Processing escrow creation on ${event.chain}: ${event.orderId}`);
            // Add escrow to order
            await this.orderManager.addEscrow(event.orderId, event);
            // Notify connected clients about escrow creation
            this.notifyClients('escrowCreated', event);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to handle escrow creation:`, error);
        }
    }
    async handleSecretRevealed(event) {
        try {
            logger_1.default.info(`🔐 Processing secret revelation on ${event.chain}: ${event.orderId}`);
            // Store the secret
            await this.secretManager.storeSecret(event.orderId, event.secret, event.chain, event.txHash, event.revealer);
            // Propagate secret to the other chain
            await this.propagateSecret(event);
            // Notify connected clients
            this.notifyClients('secretRevealed', event);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to handle secret revelation:`, error);
        }
    }
    async propagateSecret(event) {
        try {
            const otherChain = event.chain === 'ethereum' ? 'stellar' : 'ethereum';
            const client = otherChain === 'ethereum' ? this.ethereumClient : this.stellarClient;
            logger_1.default.info(`🔄 Propagating secret from ${event.chain} to ${otherChain}`);
            // Find the corresponding escrow on the other chain
            const escrows = await this.orderManager.getEscrowsForOrder(event.orderId);
            const otherEscrow = escrows.find(e => e.chain === otherChain);
            if (otherEscrow) {
                // Claim the escrow with the revealed secret
                const txHash = await client.claimEscrow(otherEscrow.contractAddress, event.secret);
                logger_1.default.info(`✅ Secret propagated to ${otherChain}, tx: ${txHash}`);
                // Update escrow status
                await this.orderManager.updateEscrowStatus(event.orderId, otherChain, 'claimed');
            }
            else {
                logger_1.default.warn(`⚠️ No escrow found on ${otherChain} for order ${event.orderId}`);
            }
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to propagate secret:`, error);
        }
    }
    async handleEscrowClaimed(event) {
        try {
            logger_1.default.info(`✅ Processing escrow claim on ${event.chain}: ${event.orderId}`);
            // Update escrow status
            await this.orderManager.updateEscrowStatus(event.orderId, event.chain, 'claimed');
            // Check if swap is complete
            const isComplete = await this.orderManager.isSwapComplete(event.orderId);
            if (isComplete) {
                await this.orderManager.updateOrderStatus(event.orderId, types_1.OrderStatus.COMPLETED);
                logger_1.default.info(`🎉 Swap ${event.orderId} completed successfully!`);
                // Notify clients about completion
                this.notifyClients('swapCompleted', { orderId: event.orderId });
            }
            // Notify connected clients
            this.notifyClients('escrowClaimed', event);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to handle escrow claim:`, error);
        }
    }
    async handleEscrowRefunded(event) {
        try {
            logger_1.default.info(`🔄 Processing escrow refund on ${event.chain}: ${event.orderId}`);
            // Update escrow status
            await this.orderManager.updateEscrowStatus(event.orderId, event.chain, 'refunded');
            // Mark order as expired
            await this.orderManager.updateOrderStatus(event.orderId, types_1.OrderStatus.EXPIRED);
            // Notify connected clients
            this.notifyClients('escrowRefunded', event);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to handle escrow refund:`, error);
        }
    }
    handleError(event) {
        logger_1.default.error(`❌ Chain error on ${event.chain}:`, event.error);
        // Notify connected clients about the error
        this.notifyClients('chainError', event);
    }
    startPeriodicTasks() {
        // Check for expired orders every minute
        const expiredOrdersJob = node_cron_1.default.schedule('* * * * *', async () => {
            await this.checkExpiredOrders();
        }, { scheduled: false });
        // Health check every 30 seconds
        const healthCheckJob = node_cron_1.default.schedule('*/30 * * * * *', async () => {
            await this.performHealthCheck();
        }, { scheduled: false });
        // Cleanup task every hour
        const cleanupJob = node_cron_1.default.schedule('0 * * * *', async () => {
            await this.performCleanup();
        }, { scheduled: false });
        // Start all jobs
        expiredOrdersJob.start();
        healthCheckJob.start();
        cleanupJob.start();
        this.cronJobs = [expiredOrdersJob, healthCheckJob, cleanupJob];
        logger_1.default.info('⏰ Periodic tasks started');
    }
    stopPeriodicTasks() {
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs = [];
        logger_1.default.info('⏰ Periodic tasks stopped');
    }
    async checkExpiredOrders() {
        try {
            const expiredOrders = await this.orderManager.getExpiredOrders();
            for (const order of expiredOrders) {
                logger_1.default.info(`⏰ Order ${order.id} expired, initiating refund process`);
                await this.initiateRefund(order);
            }
        }
        catch (error) {
            logger_1.default.error('❌ Error checking expired orders:', error);
        }
    }
    async initiateRefund(order) {
        try {
            const escrows = await this.orderManager.getEscrowsForOrder(order.id);
            for (const escrow of escrows) {
                if (escrow.status === 'created') {
                    try {
                        const client = escrow.chain === 'ethereum' ? this.ethereumClient : this.stellarClient;
                        const txHash = await client.refundEscrow(escrow.contractAddress);
                        logger_1.default.info(`💰 Refund initiated for ${escrow.chain}, tx: ${txHash}`);
                    }
                    catch (error) {
                        logger_1.default.error(`❌ Refund failed for ${escrow.chain}:`, error);
                    }
                }
            }
            // Mark order as expired
            await this.orderManager.markOrderAsExpired(order.id);
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to initiate refund for order ${order.id}:`, error);
        }
    }
    async performHealthCheck() {
        try {
            const status = this.eventMonitor.getMonitoringStatus();
            if (!status.ethereumConnected || !status.stellarConnected) {
                logger_1.default.warn('⚠️ Chain connection issues detected');
            }
            if (!status.ethereumMonitoring || !status.stellarMonitoring) {
                logger_1.default.warn('⚠️ Chain monitoring issues detected');
            }
        }
        catch (error) {
            logger_1.default.error('❌ Health check failed:', error);
        }
    }
    async performCleanup() {
        try {
            // Cleanup expired orders
            await this.orderManager.cleanupExpiredOrders();
            // Clear secret cache
            this.secretManager.clearCache();
            logger_1.default.info('🧹 Cleanup completed');
        }
        catch (error) {
            logger_1.default.error('❌ Cleanup failed:', error);
        }
    }
    notifyClients(event, data) {
        // This would notify connected WebSocket clients
        // Implementation depends on the API server
        logger_1.default.debug(`📡 Notifying clients: ${event}`, data);
    }
    // Public API methods
    async createOrder(orderData) {
        return await this.orderManager.createOrder(orderData);
    }
    async getOrder(orderId) {
        return await this.orderManager.getOrder(orderId);
    }
    async getActiveOrders() {
        return await this.orderManager.getActiveOrders();
    }
    async getOrderStats() {
        return await this.orderManager.getOrderStats();
    }
    async getRelayerStatus() {
        return {
            isRunning: this.isRunning,
            monitoring: this.eventMonitor.getMonitoringStatus(),
            stats: await this.orderManager.getOrderStats(),
        };
    }
    isRelayerRunning() {
        return this.isRunning;
    }
}
exports.Relayer = Relayer;
//# sourceMappingURL=Relayer.js.map