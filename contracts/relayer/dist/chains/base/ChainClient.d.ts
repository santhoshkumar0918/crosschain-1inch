import { EventEmitter } from 'events';
import { HTLCOrder, EscrowState } from '../../types';
export declare abstract class ChainClient extends EventEmitter {
    protected isConnected: boolean;
    protected isMonitoring: boolean;
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract createEscrow(order: HTLCOrder): Promise<string>;
    abstract claimEscrow(escrowAddress: string, secret: string): Promise<string>;
    abstract refundEscrow(escrowAddress: string): Promise<string>;
    abstract getEscrowState(address: string): Promise<EscrowState>;
    abstract validateOrder(order: HTLCOrder): Promise<boolean>;
    abstract startMonitoring(): Promise<void>;
    abstract stopMonitoring(): void;
    isClientConnected(): boolean;
    isClientMonitoring(): boolean;
}
//# sourceMappingURL=ChainClient.d.ts.map