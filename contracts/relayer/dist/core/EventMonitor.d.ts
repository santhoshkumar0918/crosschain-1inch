import { EventEmitter } from 'events';
import { EthereumClient } from '../chains/ethereum/EthereumClient';
import { StellarClient } from '../chains/stellar/StellarClient';
export declare class EventMonitor extends EventEmitter {
    private ethereumClient;
    private stellarClient;
    private isMonitoring;
    constructor(ethereumClient: EthereumClient, stellarClient: StellarClient);
    startMonitoring(): Promise<void>;
    private setupEthereumEventHandlers;
    private setupStellarEventHandlers;
    stopMonitoring(): void;
    isEventMonitoring(): boolean;
    getMonitoringStatus(): {
        isMonitoring: boolean;
        ethereumConnected: boolean;
        stellarConnected: boolean;
        ethereumMonitoring: boolean;
        stellarMonitoring: boolean;
    };
}
//# sourceMappingURL=EventMonitor.d.ts.map