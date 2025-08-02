// Shared types for cross-chain atomic swaps
export interface CrossChainOrder {
  id: string;
  srcChain: 'ethereum' | 'stellar';
  dstChain: 'ethereum' | 'stellar';
  srcToken: string;
  dstToken: string;
  amount: string;
  maker: string;
  receiver: string;
  hashlock: string;
  timelock: number;
  safetyDeposit: string;
  status: OrderStatus;
  createdAt: number;
}

export enum OrderStatus {
  Created = 'created',
  EscrowsDeployed = 'escrows_deployed',
  SecretRevealed = 'secret_revealed',
  Completed = 'completed',
  Refunded = 'refunded',
  Failed = 'failed'
}

export interface HTLCData {
  contractId: string;
  sender: string;
  receiver: string;
  amount: string;
  tokenAddress: string;
  hashlock: string;
  timelock: number;
  timestamp: number;
  safetyDeposit: string;
  status: HTLCStatus;
  locked: boolean;
}

export enum HTLCStatus {
  Active = 'active',
  Withdrawn = 'withdrawn',
  Refunded = 'refunded'
}

export interface EthereumHTLCEvent {
  type: 'HTLCNew' | 'HTLCWithdraw' | 'HTLCRefund';
  contractId: string;
  blockNumber: number;
  transactionHash: string;
  data: any;
}

export interface StellarHTLCEvent {
  type: 'HTLCNew' | 'HTLCWithdraw' | 'HTLCRefund';
  contractId: string;
  ledger: number;
  transactionHash: string;
  data: any;
}

export interface SwapParams {
  srcChain: 'ethereum' | 'stellar';
  dstChain: 'ethereum' | 'stellar';
  srcToken: string;
  dstToken: string;
  amount: string;
  receiver: string;
  timelock: number;
  safetyDeposit: string;
}

export interface SecretData {
  preimage: string;
  hashlock: string;
  orderId: string;
  revealedAt?: number;
}