"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayerAPI = void 0;
const express_1 = __importDefault(require("express"));
const ws_1 = require("ws");
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const logger_1 = __importDefault(require("../utils/logger"));
class RelayerAPI {
    constructor(relayer) {
        this.wss = null;
        this.connectedClients = new Set();
        this.app = (0, express_1.default)();
        this.relayer = relayer;
        this.setupMiddleware();
        this.setupRoutes();
    }
    setupMiddleware() {
        this.app.use((0, helmet_1.default)());
        this.app.use((0, cors_1.default)());
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging
        this.app.use((req, res, next) => {
            logger_1.default.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }
    setupRoutes() {
        // Health check
        this.app.get('/api/health', (req, res) => {
            res.json({
                success: true,
                status: 'healthy',
                timestamp: new Date().toISOString(),
                relayerRunning: this.relayer.isRelayerRunning()
            });
        });
        // Get relayer status
        this.app.get('/api/status', async (req, res) => {
            try {
                const status = await this.relayer.getRelayerStatus();
                res.json({ success: true, status });
            }
            catch (error) {
                logger_1.default.error('❌ Failed to get relayer status:', error);
                res.status(500).json({ success: false, error: 'Failed to get status' });
            }
        });
        // Create new order
        this.app.post('/api/orders', async (req, res) => {
            try {
                const orderData = req.body;
                const order = await this.relayer.createOrder(orderData);
                // Broadcast to WebSocket clients
                this.broadcastToClients('orderCreated', order);
                res.json({ success: true, order });
            }
            catch (error) {
                logger_1.default.error('❌ Failed to create order:', error);
                res.status(400).json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Failed to create order'
                });
            }
        });
        // Get order by ID
        this.app.get('/api/orders/:id', async (req, res) => {
            try {
                const order = await this.relayer.getOrder(req.params.id);
                if (!order) {
                    return res.status(404).json({ success: false, error: 'Order not found' });
                }
                res.json({ success: true, order });
            }
            catch (error) {
                logger_1.default.error('❌ Failed to get order:', error);
                res.status(500).json({ success: false, error: 'Failed to get order' });
            }
        });
        // Get active orders (for resolvers)
        this.app.get('/api/orders', async (req, res) => {
            try {
                const orders = await this.relayer.getActiveOrders();
                res.json({ success: true, orders, count: orders.length });
            }
            catch (error) {
                logger_1.default.error('❌ Failed to get orders:', error);
                res.status(500).json({ success: false, error: 'Failed to get orders' });
            }
        });
        // Get order statistics
        this.app.get('/api/stats', async (req, res) => {
            try {
                const stats = await this.relayer.getOrderStats();
                res.json({ success: true, stats });
            }
            catch (error) {
                logger_1.default.error('❌ Failed to get stats:', error);
                res.status(500).json({ success: false, error: 'Failed to get stats' });
            }
        });
        // Error handling middleware
        this.app.use((error, req, res, next) => {
            logger_1.default.error('❌ API Error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found'
            });
        });
    }
    async start(port = 3000) {
        return new Promise((resolve, reject) => {
            try {
                const server = this.app.listen(port, () => {
                    logger_1.default.info(`🌐 Relayer API listening on port ${port}`);
                    resolve();
                });
                // Setup WebSocket server for real-time updates
                this.wss = new ws_1.WebSocketServer({ server });
                this.setupWebSocket();
                server.on('error', (error) => {
                    logger_1.default.error('❌ Server error:', error);
                    reject(error);
                });
            }
            catch (error) {
                reject(error);
            }
        });
    }
    setupWebSocket() {
        if (!this.wss)
            return;
        this.wss.on('connection', (ws, req) => {
            const clientId = `${req.socket.remoteAddress}:${req.socket.remotePort}`;
            logger_1.default.info(`📡 New WebSocket connection: ${clientId}`);
            this.connectedClients.add(ws);
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                message: 'Connected to HTLC Relayer',
                timestamp: new Date().toISOString()
            }));
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message.toString());
                    this.handleWebSocketMessage(ws, data);
                }
                catch (error) {
                    logger_1.default.error('❌ Invalid WebSocket message:', error);
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Invalid message format'
                    }));
                }
            });
            ws.on('close', () => {
                logger_1.default.info(`📡 WebSocket connection closed: ${clientId}`);
                this.connectedClients.delete(ws);
            });
            ws.on('error', (error) => {
                logger_1.default.error(`❌ WebSocket error for ${clientId}:`, error);
                this.connectedClients.delete(ws);
            });
        });
        logger_1.default.info('📡 WebSocket server initialized');
    }
    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'subscribe':
                // Subscribe to specific events
                ws.subscriptions = data.subscriptions || ['all'];
                ws.send(JSON.stringify({
                    type: 'subscribed',
                    subscriptions: ws.subscriptions
                }));
                break;
            case 'unsubscribe':
                // Unsubscribe from events
                ws.subscriptions = [];
                ws.send(JSON.stringify({
                    type: 'unsubscribed'
                }));
                break;
            case 'ping':
                ws.send(JSON.stringify({
                    type: 'pong',
                    timestamp: new Date().toISOString()
                }));
                break;
            case 'getStatus':
                // Send current relayer status
                this.relayer.getRelayerStatus().then(status => {
                    ws.send(JSON.stringify({
                        type: 'status',
                        data: status
                    }));
                }).catch(error => {
                    ws.send(JSON.stringify({
                        type: 'error',
                        error: 'Failed to get status'
                    }));
                });
                break;
            default:
                ws.send(JSON.stringify({
                    type: 'error',
                    error: 'Unknown message type'
                }));
        }
    }
    broadcastToClients(event, data) {
        if (!this.wss)
            return;
        const message = JSON.stringify({
            type: 'event',
            event,
            data,
            timestamp: new Date().toISOString()
        });
        this.connectedClients.forEach((ws) => {
            if (ws.readyState === ws.OPEN) {
                // Check if client is subscribed to this event
                if (!ws.subscriptions ||
                    ws.subscriptions.includes('all') ||
                    ws.subscriptions.includes(event)) {
                    ws.send(message);
                }
            }
            else {
                // Remove closed connections
                this.connectedClients.delete(ws);
            }
        });
        logger_1.default.debug(`📡 Broadcasted ${event} to ${this.connectedClients.size} clients`);
    }
    getConnectedClientsCount() {
        return this.connectedClients.size;
    }
    async stop() {
        return new Promise((resolve) => {
            if (this.wss) {
                this.wss.close(() => {
                    logger_1.default.info('📡 WebSocket server closed');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
exports.RelayerAPI = RelayerAPI;
//# sourceMappingURL=server.js.map