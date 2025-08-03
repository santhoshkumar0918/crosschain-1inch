// contracts/fusion-resolver/src/utils/config.ts
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3003'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Contracts
  ethereum: {
    rpcUrl: process.env.ETHEREUM_RPC_URL!,
    htlcAddress: process.env.ETHEREUM_HTLC_ADDRESS!,
    chainId: 11155111, // Sepolia
  },
  stellar: {
    rpcUrl: process.env.STELLAR_RPC_URL!,
    htlcContractId: process.env.STELLAR_HTLC_CONTRACT_ID!,
    networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE!,
  },

  // Resolver Wallet
  resolver: {
    privateKey: process.env.RESOLVER_PRIVATE_KEY!,
    stellarSecret: process.env.RESOLVER_STELLAR_SECRET!,
    address: process.env.RESOLVER_ADDRESS!,
    stellarAddress: process.env.RESOLVER_STELLAR_ADDRESS!,
  },

  // Integration
  relayer: {
    apiUrl: process.env.RELAYER_API_URL || 'http://localhost:3000',
  },

  // Security
  jwt: {
    secret: process.env.JWT_SECRET!,
  },
  apiKey: process.env.API_KEY,

  // Auction Settings
  auction: {
    defaultDuration: parseInt(process.env.DEFAULT_AUCTION_DURATION || '300'),
    minProfitMargin: parseFloat(process.env.MIN_PROFIT_MARGIN || '0.01'),
    maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || '0.05'),
  },

  // Supported chains and tokens
  supportedChains: [11155111, 'stellar'],
  supportedTokens: {
    ethereum: ['ETH', 'USDC', 'USDT'],
    stellar: ['XLM', 'USDC'],
  },
} as const;

// Validation
const requiredEnvVars = [
  'ETHEREUM_HTLC_ADDRESS',
  'STELLAR_HTLC_CONTRACT_ID',
  'ETHEREUM_RPC_URL',
  'RESOLVER_PRIVATE_KEY',
  'RESOLVER_STELLAR_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}
