export declare class CryptoUtils {
    static generateSecret(): {
        secret: string;
        hashlock: string;
    };
    static hashSecret(secret: string): string;
    static isValidSecret(secret: string): boolean;
    static isValidHashlock(hashlock: string): boolean;
    static generateOrderId(): string;
    static verifyHashlock(secret: string, hashlock: string): boolean;
}
//# sourceMappingURL=crypto.d.ts.map