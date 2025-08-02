import { SecretReveal } from '../types';
import { InMemoryStorage } from '../storage/InMemoryStorage';
import { CryptoUtils } from '../utils/crypto';
import { ValidationUtils } from '../utils/validation';
import logger from '../utils/logger';

export class SecretManager {
  private storage: InMemoryStorage;
  private secretCache: Map<string, string> = new Map(); // orderId -> secret

  constructor(storage: InMemoryStorage) {
    this.storage = storage;
  }

  async storeSecret(
    orderId: string, 
    secret: string, 
    chain: 'ethereum' | 'stellar', 
    txHash: string, 
    revealer: string
  ): Promise<void> {
    try {
      // Get order to validate hashlock
      const order = await this.storage.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Validate secret against hashlock
      ValidationUtils.validateSecret(secret, order.hashlock);

      // Create secret reveal record
      const secretReveal: SecretReveal = {
        orderId,
        secret,
        hashlock: order.hashlock,
        chain,
        txHash,
        revealer,
        timestamp: new Date(),
      };

      // Store in storage
      await this.storage.storeSecret(orderId, secretReveal);
      
      // Cache for quick access
      this.secretCache.set(orderId, secret);

      logger.info(`🔐 Secret stored for order ${orderId} from ${chain}`);
    } catch (error) {
      logger.error(`❌ Failed to store secret for order ${orderId}:`, error);
      throw error;
    }
  }

  async getSecret(orderId: string): Promise<string | null> {
    // Check cache first
    if (this.secretCache.has(orderId)) {
      return this.secretCache.get(orderId)!;
    }

    // Query storage
    const secret = await this.storage.getSecret(orderId);
    if (secret) {
      this.secretCache.set(orderId, secret);
    }

    return secret;
  }

  async isSecretRevealed(orderId: string): Promise<boolean> {
    return await this.storage.isSecretRevealed(orderId);
  }

  generateSecret(): { secret: string; hashlock: string } {
    return CryptoUtils.generateSecret();
  }

  hashSecret(secret: string): string {
    return CryptoUtils.hashSecret(secret);
  }

  verifySecret(secret: string, hashlock: string): boolean {
    return CryptoUtils.verifyHashlock(secret, hashlock);
  }

  async getRevealHistory(orderId: string): Promise<SecretReveal[]> {
    return await this.storage.getSecretHistory(orderId);
  }

  clearCache(): void {
    this.secretCache.clear();
    logger.info('🧹 Secret cache cleared');
  }

  async getSecretStats(): Promise<{
    totalSecrets: number;
    cacheSize: number;
  }> {
    const stats = await this.storage.getStats();
    return {
      totalSecrets: stats.totalSecrets,
      cacheSize: this.secretCache.size,
    };
  }
}