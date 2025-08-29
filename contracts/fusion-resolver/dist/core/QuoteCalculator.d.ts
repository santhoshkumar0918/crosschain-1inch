import { QuoteRequest, QuoteResponse } from "../types";
export declare class QuoteCalculator {
    private logger;
    private mockPrices;
    calculateQuote(request: QuoteRequest): Promise<QuoteResponse>;
    private calculateOutputAmount;
    private applySlippage;
    private calculatePriceImpact;
    private estimateGasCosts;
    private buildSwapRoute;
    private estimateSwapTime;
    private getAssetSymbol;
    getRealTimePrice(fromAsset: string, toAsset: string): Promise<number>;
    updateMockPrice(asset: string, price: number): void;
    getSupportedPairs(): Array<{
        from: string;
        to: string;
        rate: number;
    }>;
}
//# sourceMappingURL=QuoteCalculator.d.ts.map