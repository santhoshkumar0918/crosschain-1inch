"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainClient = void 0;
const events_1 = require("events");
class ChainClient extends events_1.EventEmitter {
    constructor() {
        super(...arguments);
        this.isConnected = false;
        this.isMonitoring = false;
    }
    isClientConnected() {
        return this.isConnected;
    }
    isClientMonitoring() {
        return this.isMonitoring;
    }
}
exports.ChainClient = ChainClient;
//# sourceMappingURL=ChainClient.js.map