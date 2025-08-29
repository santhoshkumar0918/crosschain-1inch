export declare class Logger {
    private logger;
    private context;
    constructor(context?: string);
    info(message: string, meta?: any): void;
    error(message: string, error?: any): void;
    warn(message: string, meta?: any): void;
    debug(message: string, meta?: any): void;
    verbose(message: string, meta?: any): void;
}
//# sourceMappingURL=logger.d.ts.map