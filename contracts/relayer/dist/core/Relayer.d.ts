import { EthereumClient } from '../chains/ethereum/EthereumClient';
import { StellarClient } from '../chains/stellar/StellarClient';
import { HTLCOrder } from '../types';
export declare class Relayer {
    private eventMonitor;
    private orderManager;
    private secretManager;
    private storage;
    private ethereumClient;
    private stellarClient;
    private isRunning;
    private cronJobs;
    constructor(ethereumClient: EthereumClient, stellarClient: StellarClient);
    start(): Promise<void>;
    stop(): Promise<void>;
    private setupEventHandlers;
    private handleEscrowCreated;
    private handleSecretRevealed;
    private propagateSecret;
    private handleEscrowClaimed;
    private handleEscrowRefunded;
    private handleError;
    private startPeriodicTasks;
    private stopPeriodicTasks;
    private checkExpiredOrders;
    private initiateRefund;
    private performHealthCheck;
    private performCleanup;
    private notifyClients;
    createOrder(orderData: Partial<HTLCOrder>): Promise<HTLCOrder>;
    getOrder(orderId: string): Promise<HTLCOrder | null>;
    getActiveOrders(): Promise<HTLCOrder[]>;
    getOrderStats(): Promise<any>;
    getRelayerStatus(): Promise<{
        isRunning: boolean;
        monitoring: any;
        stats: any;
    }>;
    isRelayerRunning(): boolean;
}
//# sourceMappingURL=Relayer.d.ts.map