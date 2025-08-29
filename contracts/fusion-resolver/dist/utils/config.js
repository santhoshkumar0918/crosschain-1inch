"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
// contracts/fusion-resolver/src/utils/config.ts
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables
dotenv_1.default.config();
exports.config = {
    nodeEnv: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "3001", 10),
    ethereum: {
        chainId: parseInt(process.env.ETH_CHAIN_ID || "11155111", 10), // Sepolia
        rpcUrl: process.env.ETHEREUM_RPC_URL || "https://sepolia.infura.io/v3/your-key",
        htlcAddress: process.env.ETHEREUM_HTLC_ADDRESS ||
            "0x0000000000000000000000000000000000000000",
    },
    stellar: {
        networkPassphrase: process.env.STELLAR_NETWORK_PASSPHRASE ||
            "Test SDF Network ; September 2015",
        rpcUrl: process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org",
        htlcContractId: process.env.STELLAR_HTLC_CONTRACT_ID ||
            "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGK6W2R",
    },
    resolver: {
        address: process.env.RESOLVER_ADDRESS ||
            "0x0000000000000000000000000000000000000000",
        privateKey: process.env.RESOLVER_PRIVATE_KEY ||
            "0x0000000000000000000000000000000000000000000000000000000000000000",
        stellarAddress: process.env.RESOLVER_STELLAR_ADDRESS ||
            "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
        stellarSecret: process.env.RESOLVER_STELLAR_SECRET ||
            "SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    },
    auction: {
        defaultDuration: parseInt(process.env.DEFAULT_AUCTION_DURATION || "300", 10), // 5 minutes
        maxSlippage: parseFloat(process.env.MAX_SLIPPAGE || "0.05"), // 5%
    },
    supportedChains: ["ethereum-sepolia", "stellar-testnet"],
    supportedTokens: ["ETH", "XLM", "USDC"],
};
//# sourceMappingURL=config.js.map