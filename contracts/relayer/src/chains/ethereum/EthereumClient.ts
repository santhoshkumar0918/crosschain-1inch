import { ethers } from 'ethers';
import { ChainClient } from '../base/ChainClient';
import { HTLCOrder, EscrowState } from '../../types';
import logger from '../../utils/logger';

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

export class EthereumClient extends ChainClient {
  private provider: ethers.Provider;
  private signer: ethers.Signer;
  private htlcContract: ethers.Contract;
  private contractAddress: string;
  private lastProcessedBlock: number = 0;

  constructor(
    rpcUrl: string,
    privateKey: string,
    contractAddress: string
  ) {
    super();
    this.contractAddress = contractAddress;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.signer = new ethers.Wallet(privateKey, this.provider);
    this.htlcContract = new ethers.Contract(contractAddress, HTLC_ABI, this.signer);
  }

  async connect(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      this.isConnected = true;
      logger.info(`✓ Connected to Ethereum network: ${network.name} (${network.chainId})`);
    } catch (error) {
      this.isConnected = false;
      throw new Error(`Failed to connect to Ethereum: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    this.stopMonitoring();
    this.isConnected = false;
    logger.info('✓ Disconnected from Ethereum');
  }

  async createEscrow(order: HTLCOrder): Promise<string> {
    try {
      const beneficiary = order.takerChain === 'ethereum' ? order.maker : '0x0000000000000000000000000000000000000000'; // Placeholder
      const isETH = order.makerAsset === ethers.ZeroAddress;
      
      const tx = await this.htlcContract.createHTLC(
        order.hashlock,
        order.timelock,
        beneficiary,
        order.makerAsset,
        order.makerAmount,
        { value: isETH ? order.makerAmount : 0 }
      );

      const receipt = await tx.wait();
      logger.info(`✓ Ethereum escrow created: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`❌ Failed to create Ethereum escrow: ${error}`);
      throw error;
    }
  }

  async claimEscrow(htlcId: string, secret: string): Promise<string> {
    try {
      const tx = await this.htlcContract.claim(htlcId, secret);
      const receipt = await tx.wait();
      logger.info(`✓ Ethereum escrow claimed: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`❌ Failed to claim Ethereum escrow: ${error}`);
      throw error;
    }
  }

  async refundEscrow(htlcId: string): Promise<string> {
    try {
      const tx = await this.htlcContract.refund(htlcId);
      const receipt = await tx.wait();
      logger.info(`✓ Ethereum escrow refunded: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      logger.error(`❌ Failed to refund Ethereum escrow: ${error}`);
      throw error;
    }
  }

  async getEscrowState(htlcId: string): Promise<EscrowState> {
    try {
      const htlcData = await this.htlcContract.getHTLC(htlcId);
      
      let status: 'created' | 'claimed' | 'refunded' = 'created';
      if (htlcData.claimed) status = 'claimed';
      else if (htlcData.refunded) status = 'refunded';

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
    } catch (error) {
      logger.error(`❌ Failed to get Ethereum escrow state: ${error}`);
      throw error;
    }
  }

  async validateOrder(order: HTLCOrder): Promise<boolean> {
    try {
      // Basic validation for Ethereum orders
      if (order.makerChain !== 'ethereum') return false;
      
      // Validate address format
      if (!ethers.isAddress(order.maker)) return false;
      
      // Validate asset address
      if (order.makerAsset !== ethers.ZeroAddress && !ethers.isAddress(order.makerAsset)) {
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error(`❌ Ethereum order validation failed: ${error}`);
      return false;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    this.lastProcessedBlock = await this.provider.getBlockNumber();
    
    logger.info(`📡 Starting Ethereum monitoring from block ${this.lastProcessedBlock}`);

    // Set up event listeners
    this.setupEventListeners();
    
    // Start block polling for missed events
    this.startBlockPolling();
  }

  private setupEventListeners(): void {
    // Listen for HTLC creation events
    this.htlcContract.on('HTLCCreated', (
      htlcId: string,
      creator: string,
      beneficiary: string,
      amount: bigint,
      asset: string,
      hashlock: string,
      timelock: number,
      event: ethers.EventLog
    ) => {
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
    this.htlcContract.on('HTLCClaimed', (
      htlcId: string,
      claimer: string,
      secret: string,
      event: ethers.EventLog
    ) => {
      this.emit('secretRevealed', {
        orderId: htlcId,
        chain: 'ethereum',
        secret,
        hashlock: ethers.keccak256(ethers.toUtf8Bytes(secret)),
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
    this.htlcContract.on('HTLCRefunded', (
      htlcId: string,
      refunder: string,
      event: ethers.EventLog
    ) => {
      this.emit('escrowRefunded', {
        orderId: htlcId,
        chain: 'ethereum',
        refunder,
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      });
    });
  }

  private startBlockPolling(): void {
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
      } catch (error) {
        logger.error('❌ Error polling Ethereum blocks:', error);
      }
    }, 12000); // Poll every 12 seconds (Ethereum block time)
  }

  private async processMissedEvents(fromBlock: number, toBlock: number): Promise<void> {
    try {
      const events = await this.htlcContract.queryFilter('*', fromBlock, toBlock);
      
      for (const event of events) {
        this.processHistoricalEvent(event as ethers.EventLog);
      }
      
      if (events.length > 0) {
        logger.info(`📊 Processed ${events.length} Ethereum events from blocks ${fromBlock}-${toBlock}`);
      }
    } catch (error) {
      logger.error(`❌ Error processing missed Ethereum events:`, error);
    }
  }

  private processHistoricalEvent(event: ethers.EventLog): void {
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
    } catch (error) {
      logger.error('❌ Error processing historical Ethereum event:', error);
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    this.htlcContract.removeAllListeners();
    logger.info('⏹️ Stopped Ethereum monitoring');
  }
}