import crypto from 'crypto';

export class CryptoUtils {
  static generateSecret(): { secret: string; hashlock: string } {
    const secret = crypto.randomBytes(32).toString('hex');
    const hashlock = this.hashSecret(secret);
    return { secret: `0x${secret}`, hashlock: `0x${hashlock}` };
  }

  static hashSecret(secret: string): string {
    const cleanSecret = secret.replace('0x', '');
    return crypto.createHash('sha256')
      .update(Buffer.from(cleanSecret, 'hex'))
      .digest('hex');
  }

  static isValidSecret(secret: string): boolean {
    const hexPattern = /^(0x)?[0-9a-fA-F]{64}$/;
    return hexPattern.test(secret);
  }

  static isValidHashlock(hashlock: string): boolean {
    const hexPattern = /^(0x)?[0-9a-fA-F]{64}$/;
    return hexPattern.test(hashlock);
  }

  static generateOrderId(): string {
    return `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  static verifyHashlock(secret: string, hashlock: string): boolean {
    const computedHash = this.hashSecret(secret);
    const cleanHashlock = hashlock.replace('0x', '');
    return computedHash === cleanHashlock;
  }
}