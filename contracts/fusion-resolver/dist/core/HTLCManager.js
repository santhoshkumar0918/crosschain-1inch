"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTLCManager = void 0;
// contracts/fusion-resolver/src/core/HTLCManager.ts
const ethers_1 = require("ethers");
const stellar_sdk_1 = require("@stellar/stellar-sdk");
const crypto = __importStar(require("crypto"));
const logger_1 = require("../utils/logger");
const config_1 = require("../utils/config");
class HTLCManager {
    ethProvider;
    ethWallet;
    ethHTLCContract;
    stellarServer;
    stellarKeypair;
    logger = new logger_1.Logger("HTLCManager");
    htlcMappings = new Map();
    // Updated HTLC ABI to match the deployed contract
    HTLC_ABI = [
        "function createHTLC(address receiver, uint256 amount, address tokenAddress, bytes32 hashlock, uint256 timelock, uint256 safetyDeposit, bool allowPartialFills, uint256 minFillAmount) external payable returns (bytes32)",
        "function withdraw(bytes32 contractId, bytes32 preimage, uint256 withdrawAmount) external",
        "function refund(bytes32 contractId) external",
        "function getHTLC(bytes32 contractId) external view returns (tuple(bytes32,address,address,uint256,uint256,uint256,address,bytes32,uint256,uint256,uint256,uint256,uint8,bool,uint256))",
        "event HTLCNew(bytes32 indexed contractId, address indexed sender, address indexed receiver, uint256 amount, address tokenAddress, bytes32 hashlock, uint256 timelock, uint256 safetyDeposit, bool allowPartialFills, uint256 minFillAmount)",
        "event HTLCWithdraw(bytes32 indexed contractId, bytes32 preimage, uint256 withdrawAmount, bool isPartial)",
        "event HTLCRefund(bytes32 indexed contractId, uint256 refundAmount, bool isPartial)",
    ];
    constructor() {
        // Initialize Ethereum connection
        this.ethProvider = new ethers_1.ethers.JsonRpcProvider(config_1.config.ethereum.rpcUrl);
        this.ethWallet = new ethers_1.ethers.Wallet(config_1.config.resolver.privateKey, this.ethProvider);
        this.ethHTLCContract = new ethers_1.ethers.Contract(config_1.config.ethereum.htlcAddress, this.HTLC_ABI, this.ethWallet);
        // Initialize Stellar connection
        this.stellarServer = new stellar_sdk_1.Horizon.Server("https://horizon-testnet.stellar.org");
        this.stellarKeypair = stellar_sdk_1.Keypair.fromSecret(config_1.config.resolver.stellarSecret);
        this.logger.info("HTLC Manager initialized", {
            ethContract: config_1.config.ethereum.htlcAddress,
            stellarContract: config_1.config.stellar.htlcContractId,
            resolverAddress: config_1.config.resolver.address,
            stellarAddress: config_1.config.resolver.stellarAddress,
        });
    }
    // Create cross-chain HTLC pair for auction participation
    async createCrossChainHTLCs(params) {
        this.logger.info("Creating cross-chain HTLC pair", {
            orderHash: params.order.orderHash,
        });
        try {
            // Generate secret and hashlock
            const secret = this.generateSecret();
            const hashlock = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(secret));
            const timelock = params.order.timelock;
            let ethereumContractId;
            let stellarContractId;
            // Determine swap direction and create HTLCs
            if (params.order.srcChainId === config_1.config.ethereum.chainId) {
                // ETH → Stellar swap: User sends ETH, resolver provides XLM
                ethereumContractId = await this.createEthereumHTLC({
                    sender: params.resolver,
                    receiver: params.order.maker,
                    amount: params.order.makingAmount, // ETH amount
                    tokenAddress: ethers_1.ethers.ZeroAddress, // Native ETH
                    hashlock,
                    timelock,
                });
                stellarContractId = await this.createStellarHTLC({
                    sender: config_1.config.resolver.stellarAddress, // Use resolver's Stellar address
                    receiver: params.order.maker,
                    amount: params.order.takingAmount, // XLM amount
                    assetCode: "native", // XLM
                    hashlock,
                    timelock,
                    secret, // Pass the secret to generate proper Stellar hashlock
                });
            }
            else {
                // Stellar → ETH swap: User sends XLM, resolver provides ETH
                stellarContractId = await this.createStellarHTLC({
                    sender: config_1.config.resolver.stellarAddress, // Use resolver's Stellar address
                    receiver: params.order.maker,
                    amount: params.order.makingAmount, // XLM amount
                    assetCode: "native",
                    hashlock,
                    timelock,
                    secret, // Pass the secret to generate proper Stellar hashlock
                });
                ethereumContractId = await this.createEthereumHTLC({
                    sender: params.resolver,
                    receiver: params.order.maker,
                    amount: params.order.takingAmount, // ETH amount
                    tokenAddress: ethers_1.ethers.ZeroAddress, // Native ETH
                    hashlock,
                    timelock,
                });
            }
            const htlcPair = {
                ethereumContractId,
                stellarContractId,
                secret,
                hashlock,
                timelock,
                status: "both_created",
            };
            // Store mapping for later reference
            this.htlcMappings.set(params.order.orderHash, htlcPair);
            this.logger.info("Cross-chain HTLC pair created successfully", {
                orderHash: params.order.orderHash,
                ethereumContractId,
                stellarContractId,
            });
            return htlcPair;
        }
        catch (error) {
            this.logger.error("Failed to create cross-chain HTLC pair", error);
            throw error;
        }
    }
    // Create HTLC on Ethereum
    async createEthereumHTLC(params) {
        this.logger.info("Creating Ethereum HTLC", params);
        try {
            // Calculate safety deposit (10% of amount)
            const safetyDeposit = (BigInt(params.amount) * BigInt(10)) / BigInt(100);
            // Prepare transaction with correct parameters for the deployed contract
            const tx = await this.ethHTLCContract.createHTLC(params.receiver, // receiver (not sender first!)
            params.amount, params.tokenAddress, params.hashlock, params.timelock, safetyDeposit.toString(), false, // allowPartialFills
            "0", // minFillAmount
            {
                value: params.tokenAddress === ethers_1.ethers.ZeroAddress
                    ? BigInt(params.amount) + safetyDeposit
                    : safetyDeposit,
                gasLimit: 500000,
            });
            const receipt = await tx.wait();
            if (!receipt) {
                throw new Error("Transaction receipt is null");
            }
            // Extract contract ID from events
            const htlcNewEvent = receipt.logs.find((log) => {
                try {
                    const parsed = this.ethHTLCContract.interface.parseLog({
                        topics: log.topics,
                        data: log.data,
                    });
                    return parsed?.name === "HTLCNew";
                }
                catch {
                    return false;
                }
            });
            if (!htlcNewEvent) {
                throw new Error("HTLCNew event not found in transaction logs");
            }
            const parsedEvent = this.ethHTLCContract.interface.parseLog({
                topics: htlcNewEvent.topics,
                data: htlcNewEvent.data,
            });
            const contractId = parsedEvent?.args?.contractId;
            if (!contractId) {
                throw new Error("Contract ID not found in HTLCNew event");
            }
            this.logger.info("Ethereum HTLC created successfully", {
                contractId,
                txHash: receipt.hash,
                gasUsed: receipt.gasUsed?.toString(),
            });
            return contractId;
        }
        catch (error) {
            this.logger.error("Failed to create Ethereum HTLC", error);
            throw error;
        }
    }
    // Create HTLC on Stellar
    async createStellarHTLC(params) {
        this.logger.info("Creating Stellar HTLC", params);
        try {
            // Check if resolver account exists, if not create/fund it
            let account;
            try {
                account = await this.stellarServer.loadAccount(this.stellarKeypair.publicKey());
                this.logger.info("Stellar resolver account found", {
                    address: this.stellarKeypair.publicKey(),
                    balance: account.balances[0]?.balance,
                });
            }
            catch (error) {
                this.logger.warn("Stellar resolver account not found, this might be the issue", {
                    address: this.stellarKeypair.publicKey(),
                    error: error instanceof Error ? error.message : "Unknown error",
                });
                // For now, throw a more descriptive error
                throw new Error(`Stellar resolver account not found: ${this.stellarKeypair.publicKey()}. Please fund this account on Stellar testnet.`);
            }
            // Calculate safety deposit (10% of amount)
            const safetyDeposit = (BigInt(params.amount) * BigInt(10)) / BigInt(100);
            // Convert parameters to Stellar ScVal format
            this.logger.info("Creating Stellar HTLC with parameters", {
                sender: params.sender,
                receiver: params.receiver,
                amount: params.amount,
                contractId: config_1.config.stellar.htlcContractId
            });
            // Use the resolver's Stellar address as sender (who provides liquidity)
            const resolverStellarAddr = config_1.config.resolver.stellarAddress;
            const senderAddr = stellar_sdk_1.Address.account(stellar_sdk_1.StrKey.decodeEd25519PublicKey(resolverStellarAddr));
            // For receiver, we need to handle the case where it might be a user's Stellar address
            let receiverAddr;
            try {
                // Try to decode the receiver as a Stellar account address
                receiverAddr = stellar_sdk_1.Address.account(stellar_sdk_1.StrKey.decodeEd25519PublicKey(params.receiver));
                this.logger.info("Successfully decoded receiver as Stellar account", { receiver: params.receiver });
            }
            catch (error) {
                this.logger.warn("Receiver is not a valid Stellar account address, using resolver address", {
                    receiver: params.receiver,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
                // Fallback to resolver's address for testing
                receiverAddr = stellar_sdk_1.Address.account(stellar_sdk_1.StrKey.decodeEd25519PublicKey(resolverStellarAddr));
            }
            const amountScVal = (0, stellar_sdk_1.nativeToScVal)(BigInt(params.amount), {
                type: "i128",
            });
            // For native XLM, we need to use the native token contract address
            // Get the proper SAC address for native XLM on testnet
            const nativeTokenAddress = stellar_sdk_1.Asset.native().contractId(stellar_sdk_1.Networks.TESTNET);
            const tokenAddr = stellar_sdk_1.Address.fromString(nativeTokenAddress);
            this.logger.info("Native token address", { nativeTokenAddress });
            // Convert ETH-style hashlock (keccak256) to Stellar-style hashlock (sha256)
            const stellarHashlock = this.convertToStellarHashlock(params.secret);
            const hashlockScVal = (0, stellar_sdk_1.nativeToScVal)(Buffer.from(stellarHashlock.slice(2), "hex"), { type: "bytes" });
            const timelockScVal = (0, stellar_sdk_1.nativeToScVal)(params.timelock, { type: "u64" });
            const safetyDepositScVal = (0, stellar_sdk_1.nativeToScVal)(BigInt(safetyDeposit.toString()), {
                type: "i128",
            });
            // Build transaction
            const contract = new stellar_sdk_1.Contract(config_1.config.stellar.htlcContractId);
            const transaction = new stellar_sdk_1.TransactionBuilder(account, {
                fee: "1000000", // 0.1 XLM
                networkPassphrase: config_1.config.stellar.networkPassphrase,
            })
                .addOperation(contract.call("create_htlc", senderAddr.toScVal(), receiverAddr.toScVal(), amountScVal, tokenAddr.toScVal(), hashlockScVal, timelockScVal, safetyDepositScVal))
                .setTimeout(300)
                .build();
            transaction.sign(this.stellarKeypair);
            const result = await this.stellarServer.submitTransaction(transaction);
            if (result.successful) {
                this.logger.info("Stellar HTLC created successfully", {
                    txHash: result.hash,
                });
                return result.hash; // Use transaction hash as contract ID
            }
            else {
                throw new Error(`Stellar transaction failed: ${result.result_xdr}`);
            }
        }
        catch (error) {
            this.logger.error("Failed to create Stellar HTLC", error);
            throw error;
        }
    }
    // Monitor HTLC completion and handle secret revelation
    async monitorHTLCCompletion(orderHash) {
        const htlcPair = this.htlcMappings.get(orderHash);
        if (!htlcPair) {
            this.logger.warn("No HTLC pair found for order", { orderHash });
            return;
        }
        this.logger.info("Starting HTLC completion monitoring", { orderHash });
        // Monitor Ethereum HTLC for withdrawal
        this.ethHTLCContract.on("HTLCWithdraw", async (contractId, preimage, event) => {
            if (contractId === htlcPair.ethereumContractId) {
                this.logger.info("Ethereum HTLC withdrawn, revealing secret", {
                    contractId,
                    preimage,
                });
                await this.handleSecretRevealed(orderHash, preimage);
            }
        });
        // Set up timeout for refund
        setTimeout(async () => {
            await this.handleHTLCTimeout(orderHash);
        }, (htlcPair.timelock - Math.floor(Date.now() / 1000)) * 1000);
    }
    // Handle secret revelation
    async handleSecretRevealed(orderHash, preimage) {
        const htlcPair = this.htlcMappings.get(orderHash);
        if (!htlcPair)
            return;
        try {
            htlcPair.status = "secret_revealed";
            // Use the revealed secret to complete the swap on the other chain
            if (htlcPair.stellarContractId) {
                await this.withdrawStellarHTLC(htlcPair.stellarContractId, preimage);
            }
            htlcPair.status = "completed";
            this.logger.info("HTLC pair completed successfully", { orderHash });
        }
        catch (error) {
            this.logger.error("Failed to handle secret revelation", error);
        }
    }
    // Withdraw from Stellar HTLC
    async withdrawStellarHTLC(contractId, preimage) {
        this.logger.info("Withdrawing from Stellar HTLC", { contractId });
        try {
            const account = await this.stellarServer.loadAccount(this.stellarKeypair.publicKey());
            const contract = new stellar_sdk_1.Contract(config_1.config.stellar.htlcContractId);
            const contractIdScVal = (0, stellar_sdk_1.nativeToScVal)(Buffer.from(contractId.slice(2), "hex"), { type: "bytes" });
            const preimageScVal = (0, stellar_sdk_1.nativeToScVal)(Buffer.from(preimage.slice(2), "hex"), { type: "bytes" });
            const transaction = new stellar_sdk_1.TransactionBuilder(account, {
                fee: "1000000",
                networkPassphrase: config_1.config.stellar.networkPassphrase,
            })
                .addOperation(contract.call("withdraw", contractIdScVal, preimageScVal))
                .setTimeout(300)
                .build();
            transaction.sign(this.stellarKeypair);
            const result = await this.stellarServer.submitTransaction(transaction);
            if (result.successful) {
                this.logger.info("Stellar HTLC withdrawal successful", {
                    contractId,
                    txHash: result.hash,
                });
            }
            else {
                throw new Error(`Stellar withdrawal failed: ${result.result_xdr}`);
            }
        }
        catch (error) {
            this.logger.error("Failed to withdraw from Stellar HTLC", error);
            throw error;
        }
    }
    // Handle HTLC timeout and refund
    async handleHTLCTimeout(orderHash) {
        const htlcPair = this.htlcMappings.get(orderHash);
        if (!htlcPair || htlcPair.status === "completed")
            return;
        this.logger.info("HTLC timeout reached, initiating refunds", { orderHash });
        try {
            // Refund both HTLCs
            await Promise.allSettled([
                this.refundEthereumHTLC(htlcPair.ethereumContractId),
                this.refundStellarHTLC(htlcPair.stellarContractId),
            ]);
            htlcPair.status = "refunded";
            this.logger.info("HTLC pair refunded due to timeout", { orderHash });
        }
        catch (error) {
            this.logger.error("Failed to handle HTLC timeout", error);
        }
    }
    // Refund Ethereum HTLC
    async refundEthereumHTLC(contractId) {
        try {
            const tx = await this.ethHTLCContract.refund(contractId, {
                gasLimit: 200000,
            });
            await tx.wait();
            this.logger.info("Ethereum HTLC refunded", { contractId });
        }
        catch (error) {
            this.logger.error("Failed to refund Ethereum HTLC", error);
        }
    }
    // Refund Stellar HTLC
    async refundStellarHTLC(contractId) {
        try {
            const account = await this.stellarServer.loadAccount(this.stellarKeypair.publicKey());
            const contract = new stellar_sdk_1.Contract(config_1.config.stellar.htlcContractId);
            const contractIdScVal = (0, stellar_sdk_1.nativeToScVal)(Buffer.from(contractId.slice(2), "hex"), { type: "bytes" });
            const transaction = new stellar_sdk_1.TransactionBuilder(account, {
                fee: "1000000",
                networkPassphrase: config_1.config.stellar.networkPassphrase,
            })
                .addOperation(contract.call("refund", contractIdScVal))
                .setTimeout(300)
                .build();
            transaction.sign(this.stellarKeypair);
            const result = await this.stellarServer.submitTransaction(transaction);
            if (result.successful) {
                this.logger.info("Stellar HTLC refunded", { contractId });
            }
        }
        catch (error) {
            this.logger.error("Failed to refund Stellar HTLC", error);
        }
    }
    // Get Ethereum balance
    async getEthereumBalance() {
        try {
            const balance = await this.ethProvider.getBalance(config_1.config.resolver.address);
            return parseFloat(ethers_1.ethers.formatEther(balance));
        }
        catch (error) {
            this.logger.error("Failed to get Ethereum balance", error);
            return 0;
        }
    }
    // Get Stellar balance
    async getStellarBalance() {
        try {
            // Use Horizon testnet for account balance queries
            const horizonServer = new stellar_sdk_1.Horizon.Server("https://horizon-testnet.stellar.org");
            const account = await horizonServer.loadAccount(config_1.config.resolver.stellarAddress);
            const nativeBalance = account.balances.find((b) => b.asset_type === "native");
            return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
        }
        catch (error) {
            this.logger.error("Failed to get Stellar balance", error);
            return 0;
        }
    }
    // Generate random secret
    generateSecret() {
        return "0x" + crypto.randomBytes(32).toString("hex");
    }
    // Convert secret to Stellar-compatible SHA-256 hashlock
    convertToStellarHashlock(secret) {
        const secretBuffer = Buffer.from(secret.slice(2), "hex");
        const hash = crypto.createHash("sha256").update(secretBuffer).digest();
        return "0x" + hash.toString("hex");
    }
    // Get HTLC pair for order
    getHTLCPair(orderHash) {
        return this.htlcMappings.get(orderHash);
    }
    // Get all active HTLC pairs
    getActiveHTLCPairs() {
        return new Map(this.htlcMappings);
    }
}
exports.HTLCManager = HTLCManager;
//# sourceMappingURL=HTLCManager.js.map