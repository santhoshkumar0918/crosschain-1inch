declare class FusionResolver {
    private app;
    private logger;
    private orderBook;
    private dutchAuction;
    private htlcManager;
    private quoteCalculator;
    private assetManager;
    private balanceTracker;
    private reservationTracker;
    private liquidityManager;
    constructor();
    initialize(): Promise<void>;
    private setupMiddleware;
    private setupRoutes;
    start(): Promise<void>;
    private shutdown;
}
export { FusionResolver };
export default FusionResolver;
//# sourceMappingURL=index.d.ts.map