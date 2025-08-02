import dotenv from 'dotenv';
import Joi from 'joi';
import { RelayerConfig } from '../types';

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  
  // Ethereum
  ETHEREUM_RPC_URL: Joi.string().uri().required(),
  ETHEREUM_PRIVATE_KEY: Joi.string().pattern(/^(0x)?[a-fA-F0-9]{64}$/).required(),
  ETHEREUM_CONTRACT_ADDRESS: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  ETHEREUM_NETWORK_ID: Joi.number().default(1337),
  
  // Stellar
  STELLAR_NETWORK_URL: Joi.string().uri().required(),
  STELLAR_SECRET_KEY: Joi.string().length(56).required(),
  STELLAR_CONTRACT_ID: Joi.string().required(),
  STELLAR_NETWORK_PASSPHRASE: Joi.string().required(),
  
  // Security
  JWT_SECRET: Joi.string().min(32).required(),
  API_RATE_LIMIT: Joi.number().default(100),
  
  // Monitoring
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  METRICS_ENABLED: Joi.boolean().default(true),
}).unknown();

const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

export const config: RelayerConfig = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  
  chains: {
    ethereum: {
      rpcUrl: envVars.ETHEREUM_RPC_URL,
      privateKey: envVars.ETHEREUM_PRIVATE_KEY.startsWith('0x') ? envVars.ETHEREUM_PRIVATE_KEY : `0x${envVars.ETHEREUM_PRIVATE_KEY}`,
      contractAddress: envVars.ETHEREUM_CONTRACT_ADDRESS,
      networkId: envVars.ETHEREUM_NETWORK_ID,
    },
    
    stellar: {
      networkUrl: envVars.STELLAR_NETWORK_URL,
      secretKey: envVars.STELLAR_SECRET_KEY,
      contractId: envVars.STELLAR_CONTRACT_ID,
      networkPassphrase: envVars.STELLAR_NETWORK_PASSPHRASE,
    },
  },
  
  security: {
    jwtSecret: envVars.JWT_SECRET,
    apiRateLimit: envVars.API_RATE_LIMIT,
  },
  
  monitoring: {
    logLevel: envVars.LOG_LEVEL,
    metricsEnabled: envVars.METRICS_ENABLED,
  },
};

export const loadConfig = () => config;