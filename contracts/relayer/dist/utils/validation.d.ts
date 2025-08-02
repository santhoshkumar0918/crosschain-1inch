import { HTLCOrder } from '../types';
export declare class ValidationUtils {
    static validateOrder(order: Partial<HTLCOrder>): void;
    static isValidAddress(address: string, chain: 'ethereum' | 'stellar'): boolean;
    static validateSecret(secret: string, hashlock: string): void;
}
//# sourceMappingURL=validation.d.ts.map