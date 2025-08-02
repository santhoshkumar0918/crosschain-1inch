export interface HTLCOrder {
  id: string;
  maker: string;
  makerAmount: bigint;
  makerAsset: string;
  makerChain: 'ethereum' | 'stellar';
  takerAmount: bigint;
  takerAsset: string;
  takerChain: 'ethereum' | 'stellar';
  hashlock: string;
  timelock: number;
  signature: string;
  nonce: bigint;
  createdAt: Date;
  status: OrderStatus;
}

export enum OrderStatus {
  PENDING = 'pending',
  ESCROW_CREATED = 'escrow_created',
  BOTH_ESCROWED = 'both_escrowed',
  SECRET_REVEALED = 'secret_revealed',
  COMPLETED = 'completed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface EscrowState {
  orderId: string;
  chain: 'ethereum' | 'stellar';
  contractAddress: string;
  amount: bigint;
  asset: string;
  hashlock: string;
  timelock: number;
  creator: string;
  beneficiary: string;
  txHash: string;
  blockNumber: number;
  status: 'created' | 'claimed' | 'refunded';
}

export interface SecretReveal {
  orderId: string;
  secret: string;
  hashlock: string;
  chain: 'ethereum' | 'stellar';
  txHash: string;
  revealer: string;
  timestamp: Date;
}

export interface ChainConfig {
  ethereum: {
    rpcUrl: string;
    privateKey: string;
    contractAddress: string;
    networkId: number;
  };
  stellar: {
    networkUrl: string;
    secretKey: string;
    contractId: string;
    networkPassphrase: string;
  };
}

export interface RelayerConfig {
  env: string;
  port: number;
  chains: ChainConfig;
  security: {
    jwtSecret: string;
    apiRateLimit: number;
  };
  monitoring: {
    logLevel: string;
    metricsEnabled: boolean;
  };
}