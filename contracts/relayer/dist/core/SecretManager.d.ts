import { SecretReveal } from '../types';
import { InMemoryStorage } from '../storage/InMemoryStorage';
export declare class SecretManager {
    private storage;
    private secretCache;
    constructor(storage: InMemoryStorage);
    storeSecret(orderId: string, secret: string, chain: 'ethereum' | 'stellar', txHash: string, revealer: string): Promise<void>;
    getSecret(orderId: string): Promise<string | null>;
    isSecretRevealed(orderId: string): Promise<boolean>;
    generateSecret(): {
        secret: string;
        hashlock: string;
    };
    hashSecret(secret: string): string;
    verifySecret(secret: string, hashlock: string): boolean;
    getRevealHistory(orderId: string): Promise<SecretReveal[]>;
    clearCache(): void;
    getSecretStats(): Promise<{
        totalSecrets: number;
        cacheSize: number;
    }>;
}
//# sourceMappingURL=SecretManager.d.ts.map