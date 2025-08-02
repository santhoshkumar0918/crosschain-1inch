import { ethers } from 'ethers';
import { ETHEREUM_CONFIG } from '../config/networks.js';
import { HTLCData, HTLCStatus, EthereumHTLCEvent } from '../../../shared/types.js";

// Your deployed Ethereum HTLC contract ABI (simplified for core functions)
const HTLC_ABI = [
  "function createHTLC(address receiver, uint256 amount, bytes32 hashlock, uint256 timelock, uint256 safetyDeposit) external payable returns (bytes32)",
  "function withdraw(bytes32 contractId, bytes32 preimage) external",
  "function refund(bytes32 contractId) external",
  "function getHTLC(bytes32 contractId) external view returns (tuple(bytes32 contractId, address sender, address receiver, uint256 amount, address tokenAddress, bytes32 hashlock, uint256 timelock, uint256 timestamp, uint256 safetyDeposit, uint8 status, bool locked))",
  "function contractExists(bytes32 contractId) external view returns (bool)",
  "event HTLCNew(bytes32 indexed contractId, address indexed sender, address indexed receiver, uint256 amount, address tokenAddress, bytes32 hashlock, uint256 timelock, uint256 safetyDeposit)",
  "event HTLCWithdraw(bytes32 indexed contractId, bytes32 preimage)",
  "event HTLCRefund(bytes32 indexed contractId)"
];

export class EthereumAdapter {
  private provider: ethers.JsonRpcProvider;
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;

  constructor() {
    this.provider = new ethers.JsonRpcProvider(ETHEREUM_CONFIG.rpcUrl);
    this.wallet = new ethers.Wallet(process.env.ETHEREUM_PRIVATE_KEY!, this.provider);
    this.contract = new ethers.Contract(ETHEREUM_CONFIG.htlcAddress!, HTLC_ABI, this.wallet);
  }

  async createHTLC(
    receiver: string,
    amount: string,
    hashlock: string,
    timelock: number,
    safetyDeposit: string
  ): Promise<string> {
    try {
      console.log(`🔗 Creating Ethereum HTLC: ${amount} ETH to ${receiver}`);
      
      const tx = await this.contract.createHTLC(
        receiver,
        amount,
        hashlock,
        timelock,
        safetyDeposit,
        { 
          value: ethers.parseEther((parseFloat(ethers.formatEther(amount)) + parseFloat(ethers.formatEther(safetyDeposit))).toString())
        }
      );
      
      const receipt = await tx.wait();
      
      // Extract contract ID from event logs
      const event = receipt.logs.find((log: any) => 
        log.topics[0] === ethers.id("HTLCNew(bytes32,address,address,uint256,address,bytes32,uint256,uint256)")
      );
      
      if (!event) throw new Error('HTLCNew event not found');
      
      const contractId = event.topics[1];
      console.log(`✅ Ethereum HTLC created: ${contractId}`);
      
      return contractId;
    } catch (error) {
      console.error('❌ Failed to create Ethereum HTLC:', error);
      throw error;
    }
  }

  async withdraw(contractId: string, preimage: string): Promise<string> {
    try {
      console.log(`🔓 Withdrawing from Ethereum HTLC: ${contractId}`);
      
      const tx = await this.contract.withdraw(contractId, preimage);
      const receipt = await tx.wait();
      
      console.log(`✅ Ethereum HTLC withdrawn: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      console.error('❌ Failed to withdraw from Ethereum HTLC:', error);
      throw error;
    }
  }

  async refund(contractId: string): Promise<string> {
    try {
      console.log(`🔄 Refunding Ethereum HTLC: ${contractId}`);
      
      const tx = await this.contract.refund(contractId);
      const receipt = await tx.wait();
      
      console.log(`✅ Ethereum HTLC refunded: ${receipt.hash}`);
      return receipt.hash;
    } catch (error) {
      console.error('❌ Failed to refund Ethereum HTLC:', error);
      throw error;
    }
  }

  async getHTLC(contractId: string): Promise<HTLCData> {
    try {
      const htlcData = await this.contract.getHTLC(contractId);
      
      return {
        contractId: htlcData.contractId,
        sender: htlcData.sender,
        receiver: htlcData.receiver,
        amount: htlcData.amount.toString(),
        tokenAddress: htlcData.tokenAddress,
        hashlock: htlcData.hashlock,
        timelock: Number(htlcData.timelock),
        timestamp: Number(htlcData.timestamp),
        safetyDeposit: htlcData.safetyDeposit.toString(),
        status: this.mapStatus(htlcData.status),
        locked: htlcData.locked
      };
    } catch (error) {
      console.error('❌ Failed to get Ethereum HTLC data:', error);
      throw error;
    }
  }

  async contractExists(contractId: string): Promise<boolean> {
    return await this.contract.contractExists(contractId);
  }

  // Event monitoring
  async startEventMonitoring(callback: (event: EthereumHTLCEvent) => void): Promise<void> {
    console.log('👀 Starting Ethereum event monitoring...');
    
    // Listen for HTLCNew events
    this.contract.on('HTLCNew', (contractId, sender, receiver, amount, tokenAddress, hashlock, timelock, safetyDeposit, event) => {
      callback({
        type: 'HTLCNew',
        contractId,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        data: { sender, receiver, amount: amount.toString(), tokenAddress, hashlock, timelock: Number(timelock), safetyDeposit: safetyDeposit.toString() }
      });
    });

    // Listen for HTLCWithdraw events
    this.contract.on('HTLCWithdraw', (contractId, preimage, event) => {
      callback({
        type: 'HTLCWithdraw',
        contractId,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        data: { preimage }
      });
    });

    // Listen for HTLCRefund events
    this.contract.on('HTLCRefund', (contractId, event) => {
      callback({
        type: 'HTLCRefund',
        contractId,
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        data: {}
      });
    });
  }

  private mapStatus(status: number): HTLCStatus {
    switch (status) {
      case 0: return HTLCStatus.Active;
      case 1: return HTLCStatus.Withdrawn;
      case 2: return HTLCStatus.Refunded;
      default: return HTLCStatus.Active;
    }
  }

  async getBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  getAddress(): string {
    return this.wallet.address;
  }
}