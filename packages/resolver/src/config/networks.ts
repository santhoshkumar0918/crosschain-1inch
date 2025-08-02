import { config } from 'dotenv';
config();

export interface NetworkConfig {
  name: string;
  rpcUrl: string;
  chainId?: number;
  htlcAddress?: string;
  contractId?: string;
  networkPassphrase?: string;
}

export const ETHEREUM_CONFIG: NetworkConfig = {
  name: 'ethereum-sepolia',
  rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://sepolia.infura.io/v3/your-key',
  chainId: 11155111, // Sepolia
  htlcAddress: process.env.ETHEREUM_HTLC_ADDRESS || '0x3a7daFbf66d7F7ea5DE65059E1DB5C848255A6c9'
};

export const STELLAR_CONFIG: NetworkConfig = {
  name: 'stellar-testnet',
  rpcUrl: process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443',
  contractId: process.env.STELLAR_HTLC_CONTRACT_ID || 'your-stellar-contract-id',
  networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015'
};

export const RESOLVER_CONFIG = {
  port: parseInt(process.env.RESOLVER_PORT || '3001'),
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultTimelockDuration: parseInt(process.env.DEFAULT_TIMELOCK_DURATION || '3600'),
  safetyDepositPercentage: parseInt(process.env.SAFETY_DEPOSIT_PERCENTAGE || '10'),
  minConfirmationBlocks: parseInt(process.env.MIN_CONFIRMATION_BLOCKS || '2')
};

export const RELAYER_CONFIG = {
  port: parseInt(process.env.RELAYER_PORT || '3002'),
  pollingInterval: 5000, // 5 seconds
  eventLookbackBlocks: 100
};