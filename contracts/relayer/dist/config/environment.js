"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const joi_1 = __importDefault(require("joi"));
dotenv_1.default.config();
const envSchema = joi_1.default.object({
    NODE_ENV: joi_1.default.string().valid('development', 'production', 'test').default('development'),
    PORT: joi_1.default.number().default(3000),
    // Ethereum
    ETHEREUM_RPC_URL: joi_1.default.string().uri().required(),
    ETHEREUM_PRIVATE_KEY: joi_1.default.string().length(64).required(),
    ETHEREUM_CONTRACT_ADDRESS: joi_1.default.string().length(42).required(),
    ETHEREUM_NETWORK_ID: joi_1.default.number().default(1337),
    // Stellar
    STELLAR_NETWORK_URL: joi_1.default.string().uri().required(),
    STELLAR_SECRET_KEY: joi_1.default.string().length(56).required(),
    STELLAR_CONTRACT_ID: joi_1.default.string().required(),
    STELLAR_NETWORK_PASSPHRASE: joi_1.default.string().required(),
    // Security
    JWT_SECRET: joi_1.default.string().min(32).required(),
    API_RATE_LIMIT: joi_1.default.number().default(100),
    // Monitoring
    LOG_LEVEL: joi_1.default.string().valid('error', 'warn', 'info', 'debug').default('info'),
    METRICS_ENABLED: joi_1.default.boolean().default(true),
}).unknown();
const { error, value: envVars } = envSchema.validate(process.env);
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}
exports.config = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    chains: {
        ethereum: {
            rpcUrl: envVars.ETHEREUM_RPC_URL,
            privateKey: envVars.ETHEREUM_PRIVATE_KEY,
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
const loadConfig = () => exports.config;
exports.loadConfig = loadConfig;
//# sourceMappingURL=environment.js.map