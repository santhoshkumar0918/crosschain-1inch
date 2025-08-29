import { AssetManager as IAssetManager, AssetConfig } from "../types/liquidity";
export declare class AssetManager implements IAssetManager {
    private logger;
    private assets;
    constructor();
    private initializeDefaultAssets;
    registerAsset(assetConfig: AssetConfig): void;
    getAssetConfig(asset: string): AssetConfig | null;
    getSupportedAssets(): string[];
    convertToDecimal(asset: string, rawAmount: string): string;
    convertFromDecimal(asset: string, decimalAmount: string): string;
    isValidAsset(asset: string): boolean;
    isValidAmount(asset: string, amount: string): boolean;
    getAssetSymbol(asset: string): string;
    getAssetDecimals(asset: string): number;
    getAssetNetwork(asset: string): "ethereum" | "stellar" | null;
    isNativeAsset(asset: string): boolean;
    getMinimumThreshold(asset: string): string;
    getWarningThreshold(asset: string): string;
    setMinimumThreshold(asset: string, threshold: string): void;
    setWarningThreshold(asset: string, threshold: string): void;
    private validateAssetConfig;
    private isValidDecimalAmount;
    getAllAssetConfigs(): Map<string, AssetConfig>;
    getAssetsByNetwork(network: "ethereum" | "stellar"): AssetConfig[];
    compareAmounts(asset: string, amount1: string, amount2: string): number;
    addAmounts(asset: string, amount1: string, amount2: string): string;
    subtractAmounts(asset: string, amount1: string, amount2: string): string;
}
//# sourceMappingURL=AssetManager.d.ts.map