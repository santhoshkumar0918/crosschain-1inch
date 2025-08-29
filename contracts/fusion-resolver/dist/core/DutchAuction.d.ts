import { FusionOrder } from "../types";
import { OrderBook } from "./OrderBook";
import { HTLCManager } from "./HTLCManager";
import { LiquidityManager } from "./LiquidityManager";
export declare class DutchAuction {
    private orderBook;
    private htlcManager;
    private liquidityManager;
    private logger;
    private activeBids;
    private priceUpdateIntervals;
    constructor(orderBook: OrderBook, htlcManager: HTLCManager, liquidityManager: LiquidityManager);
    startAuctionMonitoring(): Promise<void>;
    private processActiveAuctions;
    private processAuction;
    private shouldParticipateInAuction;
    private participateInAuction;
    getCurrentAuctionPrice(order: FusionOrder): Promise<string>;
    private updateAuctionPrices;
    private expireAuction;
    private selectWinningBid;
    private handleOurWinningBid;
    private addBid;
    private isSupportedPair;
    private checkLiquidity;
    getAuctionStats(): {
        activeAuctions: number;
        totalBids: number;
        winRate: number;
        avgPrice: string;
    };
}
//# sourceMappingURL=DutchAuction.d.ts.map