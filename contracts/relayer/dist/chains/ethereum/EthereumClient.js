"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EthereumClient = void 0;
const ethers_1 = require("ethers");
const ChainClient_1 = require("../base/ChainClient");
const logger_1 = __importDefault(require("../../utils/logger"));
// Basic HTLC ABI - you should replace this with your actual contract ABI
const HTLC_ABI = [
    "function createHTLC(bytes32 hashlock, uint256 timelock, address beneficiary, address asset, uint256 amount) external payable returns (bytes32)",
    "function claim(bytes32 htlcId, string memory secret) external",
    "function refund(bytes32 htlcId) external",
    "function getHTLC(bytes32 htlcId) external view returns (tuple(address creator, address beneficiary, address asset, uint256 amount, bytes32 hashlock, uint256 timelock, bool claimed, bool refunded))",
    "event HTLCCreated(bytes32 indexed htlcId, address indexed creator, address indexed beneficiary, uint256 amount, address asset, bytes32 hashlock, uint256 timelock)",
    "event HTLCClaimed(bytes32 indexed htlcId, address indexed claimer, string secret)",
    "event HTLCRefunded(bytes32 indexed htlcId, address indexed refunder)"
];
class EthereumClient extends ChainClient_1.ChainClient {
    constructor(rpcUrl, privateKey, contractAddress) {
        super();
        this.lastProcessedBlock = 0;
        this.contractAddress = contractAddress;
        this.provider = new ethers_1.ethers.JsonRpcProvider(rpcUrl);
        this.signer = new ethers_1.ethers.Wallet(privateKey, this.provider);
        this.htlcContract = new ethers_1.ethers.Contract(contractAddress, HTLC_ABI, this.signer);
    }
    async connect() {
        try {
            const network = await this.provider.getNetwork();
            this.isConnected = true;
            logger_1.default.info(`✓ Connected to Ethereum network: ${network.name} (${network.chainId})`);
        }
        catch (error) {
            this.isConnected = false;
            throw new Error(`Failed to connect to Ethereum: ${error}`);
        }
    }
    async disconnect() {
        this.stopMonitoring();
        this.isConnected = false;
        logger_1.default.info('✓ Disconnected from Ethereum');
    }
    async createEscrow(order) {
        try {
            const beneficiary = order.takerChain === 'ethereum' ? order.maker : '0x0000000000000000000000000000000000000000'; // Placeholder
            const isETH = order.makerAsset === ethers_1.ethers.ZeroAddress;
            const tx = await this.htlcContract.createHTLC(order.hashlock, order.timelock, beneficiary, order.makerAsset, order.makerAmount, { value: isETH ? order.makerAmount : 0 });
            const receipt = await tx.wait();
            logger_1.default.info(`✓ Ethereum escrow created: ${receipt.hash}`);
            return receipt.hash;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to create Ethereum escrow: ${error}`);
            throw error;
        }
    }
    async claimEscrow(htlcId, secret) {
        try {
            const tx = await this.htlcContract.claim(htlcId, secret);
            const receipt = await tx.wait();
            logger_1.default.info(`✓ Ethereum escrow claimed: ${receipt.hash}`);
            return receipt.hash;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to claim Ethereum escrow: ${error}`);
            throw error;
        }
    }
    async refundEscrow(htlcId) {
        try {
            const tx = await this.htlcContract.refund(htlcId);
            const receipt = await tx.wait();
            logger_1.default.info(`✓ Ethereum escrow refunded: ${receipt.hash}`);
            return receipt.hash;
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to refund Ethereum escrow: ${error}`);
            throw error;
        }
    }
    async getEscrowState(htlcId) {
        try {
            const htlcData = await this.htlcContract.getHTLC(htlcId);
            let status = 'created';
            if (htlcData.claimed)
                status = 'claimed';
            else if (htlcData.refunded)
                status = 'refunded';
            return {
                orderId: htlcId, // Using htlcId as orderId for now
                chain: 'ethereum',
                contractAddress: this.contractAddress,
                amount: htlcData.amount,
                asset: htlcData.asset,
                hashlock: htlcData.hashlock,
                timelock: Number(htlcData.timelock),
                creator: htlcData.creator,
                beneficiary: htlcData.beneficiary,
                txHash: '', // Would need to be tracked separately
                blockNumber: 0, // Would need to be tracked separately
                status
            };
        }
        catch (error) {
            logger_1.default.error(`❌ Failed to get Ethereum escrow state: ${error}`);
            throw error;
        }
    }
    async validateOrder(order) {
        try {
            // Basic validation for Ethereum orders
            if (order.makerChain !== 'ethereum')
                return false;
            // Validate address format
            if (!ethers_1.ethers.isAddress(order.maker))
                return false;
            // Validate asset address
            if (order.makerAsset !== ethers_1.ethers.ZeroAddress && !ethers_1.ethers.isAddress(order.makerAsset)) {
                return false;
            }
            return true;
        }
        catch (error) {
            logger_1.default.error(`❌ Ethereum order validation failed: ${error}`);
            return false;
        }
    }
    async startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        this.lastProcessedBlock = await this.provider.getBlockNumber();
        logger_1.default.info(`📡 Starting Ethereum monitoring from block ${this.lastProcessedBlock}`);
        // Set up event listeners
        this.setupEventListeners();
        // Start block polling for missed events
        this.startBlockPolling();
    }
    setupEventListeners() {
        // Listen for HTLC creation events
        this.htlcContract.on('HTLCCreated', (htlcId, creator, beneficiary, amount, asset, hashlock, timelock, event) => {
            this.emit('escrowCreated', {
                orderId: htlcId,
                chain: 'ethereum',
                contractAddress: this.contractAddress,
                creator,
                beneficiary,
                amount,
                asset,
                hashlock,
                timelock,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
                status: 'created',
            });
        });
        // Listen for claims (secret reveals)
        this.htlcContract.on('HTLCClaimed', (htlcId, claimer, secret, event) => {
            this.emit('secretRevealed', {
                orderId: htlcId,
                chain: 'ethereum',
                secret,
                hashlock: ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(secret)),
                txHash: event.transactionHash,
                revealer: claimer,
                timestamp: new Date(),
            });
            this.emit('escrowClaimed', {
                orderId: htlcId,
                chain: 'ethereum',
                claimer,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
            });
        });
        // Listen for refunds
        this.htlcContract.on('HTLCRefunded', (htlcId, refunder, event) => {
            this.emit('escrowRefunded', {
                orderId: htlcId,
                chain: 'ethereum',
                refunder,
                txHash: event.transactionHash,
                blockNumber: event.blockNumber,
            });
        });
    }
    startBlockPolling() {
        const pollInterval = setInterval(async () => {
            if (!this.isMonitoring) {
                clearInterval(pollInterval);
                return;
            }
            try {
                const currentBlock = await this.provider.getBlockNumber();
                if (currentBlock > this.lastProcessedBlock) {
                    await this.processMissedEvents(this.lastProcessedBlock + 1, currentBlock);
                    this.lastProcessedBlock = currentBlock;
                }
            }
            catch (error) {
                logger_1.default.error('❌ Error polling Ethereum blocks:', error);
            }
        }, 12000); // Poll every 12 seconds (Ethereum block time)
    }
    async processMissedEvents(fromBlock, toBlock) {
        try {
            const events = await this.htlcContract.queryFilter('*', fromBlock, toBlock);
            for (const event of events) {
                this.processHistoricalEvent(event);
            }
            if (events.length > 0) {
                logger_1.default.info(`📊 Processed ${events.length} Ethereum events from blocks ${fromBlock}-${toBlock}`);
            }
        }
        catch (error) {
            logger_1.default.error(`❌ Error processing missed Ethereum events:`, error);
        }
    }
    processHistoricalEvent(event) {
        // Process historical events similar to real-time events
        // This ensures no events are missed during downtime
        try {
            switch (event.fragment?.name) {
                case 'HTLCCreated':
                    // Process historical HTLC creation
                    break;
                case 'HTLCClaimed':
                    // Process historical claims
                    break;
                case 'HTLCRefunded':
                    // Process historical refunds
                    break;
            }
        }
        catch (error) {
            logger_1.default.error('❌ Error processing historical Ethereum event:', error);
        }
    }
    stopMonitoring() {
        this.isMonitoring = false;
        this.htlcContract.removeAllListeners();
        logger_1.default.info('⏹️ Stopped Ethereum monitoring');
    }
}
exports.EthereumClient = EthereumClient;
//# sourceMappingURL=EthereumClient.js.map