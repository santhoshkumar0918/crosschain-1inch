import { ChainClient } from '../base/ChainClient';
import { HTLCOrder, EscrowState } from '../../types';
export declare class StellarClient extends ChainClient {
    private server;
    private keypair;
    private contractId;
    private networkPassphrase;
    private lastProcessedLedger;
    constructor(networkUrl: string, secretKey: string, contractId: string, networkPassphrase: string);
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    createEscrow(order: HTLCOrder): Promise<string>;
    claimEscrow(htlcId: string, secret: string): Promise<string>;
    refundEscrow(htlcId: string): Promise<string>;
    getEscrowState(htlcId: string): Promise<EscrowState>;
    validateOrder(order: HTLCOrder): Promise<boolean>;
    startMonitoring(): Promise<void>;
    private monitorContractEvents;
    private processContractOperation;
    private processHTLCCreation;
    private processHTLCClaim;
    private processHTLCRefund;
    private processLedger;
    private processMissedLedgers;
    private decodeFunctionName;
    private extractOperationParams;
    stopMonitoring(): void;
}
//# sourceMappingURL=StellarClient.d.ts.map