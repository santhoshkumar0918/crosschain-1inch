import { ChainClient } from '../base/ChainClient';
import { HTLCOrder, EscrowState } from '../../types';
export declare class EthereumClient extends ChainClient {
    private provider;
    private signer;
    private htlcContract;
    private contractAddress;
    private lastProcessedBlock;
    constructor(rpcUrl: string, privateKey: string, contractAddress: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    createEscrow(order: HTLCOrder): Promise<string>;
    claimEscrow(htlcId: string, secret: string): Promise<string>;
    refundEscrow(htlcId: string): Promise<string>;
    getEscrowState(htlcId: string): Promise<EscrowState>;
    validateOrder(order: HTLCOrder): Promise<boolean>;
    startMonitoring(): Promise<void>;
    private setupEventListeners;
    private startBlockPolling;
    private processMissedEvents;
    private processHistoricalEvent;
    stopMonitoring(): void;
}
//# sourceMappingURL=EthereumClient.d.ts.map