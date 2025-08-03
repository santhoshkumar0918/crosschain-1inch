import { FusionOrder, HTLCPair } from "../types";
export declare class HTLCManager {
    private ethProvider;
    private ethWallet;
    private ethHTLCContract;
    private stellarServer;
    private stellarKeypair;
    private logger;
    private htlcMappings;
    private readonly HTLC_ABI;
    constructor();
    createCrossChainHTLCs(params: {
        order: FusionOrder;
        resolver: string;
    }): Promise<HTLCPair>;
    private createEthereumHTLC;
    private createStellarHTLC;
    monitorHTLCCompletion(orderHash: string): Promise<void>;
    private handleSecretRevealed;
    private withdrawStellarHTLC;
    private handleHTLCTimeout;
    private refundEthereumHTLC;
    private refundStellarHTLC;
    getEthereumBalance(): Promise<number>;
    getStellarBalance(): Promise<number>;
    private generateSecret;
    getHTLCPair(orderHash: string): HTLCPair | undefined;
    getActiveHTLCPairs(): Map<string, HTLCPair>;
}
//# sourceMappingURL=HTLCManager.d.ts.map