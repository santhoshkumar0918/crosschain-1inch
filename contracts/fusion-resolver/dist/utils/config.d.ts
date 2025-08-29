export interface Config {
    nodeEnv: string;
    port: number;
    ethereum: {
        chainId: number;
        rpcUrl: string;
        htlcAddress: string;
    };
    stellar: {
        networkPassphrase: string;
        rpcUrl: string;
        htlcContractId: string;
    };
    resolver: {
        address: string;
        privateKey: string;
        stellarAddress: string;
        stellarSecret: string;
    };
    auction: {
        defaultDuration: number;
        maxSlippage: number;
    };
    supportedChains: string[];
    supportedTokens: string[];
}
export declare const config: Config;
//# sourceMappingURL=config.d.ts.map