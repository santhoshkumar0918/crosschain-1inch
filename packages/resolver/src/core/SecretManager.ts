import { randomBytes, createHash } from 'crypto';
import { SecretData } from '../../../shared/types.js';

export class SecretManager {
  private secrets: Map<string, SecretData> = new Map();

  /**
   * Generate a new secret and its SHA-256 hash
   */
  generateSecret(orderId: string): SecretData {
    const preimage = '0x' + randomBytes(32).toString('hex');
    const hashlock = this.hashSecret(preimage);
    
    const secretData: SecretData = {
      preimage,
      hashlock,
      orderId
    };
    
    this.secrets.set(hashlock, secretData);
    console.log(`🔑 Generated secret for order ${orderId}: ${hashlock}`);
    
    return secretData;
  }

  /**
   * Create SHA-256 hash of a preimage
   */
  hashSecret(preimage: string): string {
    const buffer = Buffer.from(preimage.slice(2), 'hex');
    const hash = createHash('sha256').update(buffer).digest();
    return '0x' + hash.toString('hex');
  }

  /**
   * Verify that a preimage matches a hashlock
   */
  verifySecret(preimage: string, expectedHashlock: string): boolean {
    const computedHashlock = this.hashSecret(preimage);
    return computedHashlock === expectedHashlock;
  }

  /**
   * Get secret data by hashlock
   */
  getSecret(hashlock: string): SecretData | undefined {
    return this.secrets.get(hashlock);
  }

  /**
   * Get secret data by order ID
   */
  getSecretByOrderId(orderId: string): SecretData | undefined {
    for (const secret of this.secrets.values()) {
      if (secret.orderId === orderId) {
        return secret;
      }
    }
    return undefined;
  }

  /**
   * Mark a secret as revealed
   */
  revealSecret(hashlock: string): SecretData | undefined {
    const secret = this.secrets.get(hashlock);
    if (secret) {
      secret.revealedAt = Date.now();
      console.log(`🔓 Secret revealed for order ${secret.orderId}: ${hashlock}`);
    }
    return secret;
  }

  /**
   * Get all secrets for an order (for partial fills if needed)
   */
  getAllSecretsForOrder(orderId: string): SecretData[] {
    return Array.from(this.secrets.values()).filter(secret => secret.orderId === orderId);
  }

  /**
   * Clear secrets for a completed or failed order
   */
  clearSecretsForOrder(orderId: string): void {
    const secretsToDelete: string[] = [];
    
    for (const [hashlock, secret] of this.secrets.entries()) {
      if (secret.orderId === orderId) {
        secretsToDelete.push(hashlock);
      }
    }
    
    secretsToDelete.forEach(hashlock => {
      this.secrets.delete(hashlock);
    });
    
    console.log(`🗑️ Cleared ${secretsToDelete.length} secrets for order ${orderId}`);
  }

  /**
   * Generate multiple secrets for partial fills (1inch pattern)
   */
  generateSecretsForPartialFills(orderId: string, fillCount: number): SecretData[] {
    const secrets: SecretData[] = [];
    
    for (let i = 0; i < fillCount; i++) {
      const secret = this.generateSecret(`${orderId}-${i}`);
      secrets.push(secret);
    }
    
    console.log(`🔑 Generated ${fillCount} secrets for partial fills of order ${orderId}`);
    return secrets;
  }

  /**
   * Get statistics about stored secrets
   */
  getSecretStats(): { 
    total: number; 
    revealed: number; 
    pending: number; 
    oldestPending: number | null;
  } {
    const now = Date.now();
    let revealed = 0;
    let oldestPending: number | null = null;
    
    for (const secret of this.secrets.values()) {
      if (secret.revealedAt) {
        revealed++;
      } else {
        const age = now - (secret.revealedAt || now);
        if (oldestPending === null || age > oldestPending) {
          oldestPending = age;
        }
      }
    }
    
    return {
      total: this.secrets.size,
      revealed,
      pending: this.secrets.size - revealed,
      oldestPending
    };
  }

  /**
   * Clean up old revealed secrets (housekeeping)
   */
  cleanupOldSecrets(maxAgeMs: number = 24 * 60 * 60 * 1000): number { // 24 hours default
    const now = Date.now();
    const secretsToDelete: string[] = [];
    
    for (const [hashlock, secret] of this.secrets.entries()) {
      if (secret.revealedAt && (now - secret.revealedAt) > maxAgeMs) {
        secretsToDelete.push(hashlock);
      }
    }
    
    secretsToDelete.forEach(hashlock => {
      this.secrets.delete(hashlock);
    });
    
    console.log(`🧹 Cleaned up ${secretsToDelete.length} old secrets`);
    return secretsToDelete.length;
  }
}