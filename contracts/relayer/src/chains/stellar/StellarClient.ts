import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Operation,
  Asset,
  Networks
} from 'stellar-sdk';
import { ChainClient } from '../base/ChainClient';
import { HTLCOrder, EscrowState } from '../../types';
import logger from '../../utils/logger';

export class StellarClient extends ChainClient {
  private server: Horizon.Server;
  private keypair: Keypair;
  private contractId: string;
  private networkPassphrase: string;
  private lastProcessedLedger: number = 0;

  constructor(networkUrl: string, secretKey: string, contractId: string, networkPassphrase: string) {
    super();
    this.server = new Horizon.Server(networkUrl);
    this.keypair = Keypair.fromSecret(secretKey);
    this.contractId = contractId;
    this.networkPassphrase = networkPassphrase;
  }

  async connect(): Promise<void> {
    try {
      // Try to load the account
      await this.server.loadAccount(this.keypair.publicKey());
      this.isConnected = true;
      logger.info(`✓ Connected to Stellar network - Account found: ${this.keypair.publicKey()}`);
    } catch (error: any) {
      // If account doesn't exist, we can still connect but warn the user
      if (error.name === 'NotFoundError' || error.response?.status === 404) {
        this.isConnected = true;
        logger.warn(`⚠️ Stellar account not found: ${this.keypair.publicKey()}`);
        logger.warn(`⚠️ Account needs to be created/funded before use`);
        logger.info(`✓ Connected to Stellar network (account not funded)`);
      } else {
        this.isConnected = false;
        throw new Error(`Failed to connect to Stellar: ${error}`);
      }
    }
  }

  async disconnect(): Promise<void> {
    this.stopMonitoring();
    this.isConnected = false;
    logger.info('✓ Disconnected from Stellar');
  }

  async createEscrow(order: HTLCOrder): Promise<string> {
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      // Simplified Stellar HTLC creation - placeholder implementation
      // In a real implementation, you would use Soroban smart contracts
      const transaction = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(Operation.payment({
          destination: order.maker,
          asset: Asset.native(),
          amount: (Number(order.makerAmount) / 10000000).toString() // Convert stroops to XLM
        }))
        .setTimeout(30)
        .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);

      logger.info(`✓ Stellar escrow created: ${result.hash}`);
      return result.hash;
    } catch (error) {
      logger.error(`❌ Failed to create Stellar escrow: ${error}`);
      throw error;
    }
  }

  async claimEscrow(htlcId: string, secret: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      // Simplified claim operation - placeholder implementation
      const transaction = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(Operation.manageData({
          name: `claim_${htlcId}`,
          value: Buffer.from(secret, 'hex')
        }))
        .setTimeout(30)
        .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);

      logger.info(`✓ Stellar escrow claimed: ${result.hash}`);
      return result.hash;
    } catch (error) {
      logger.error(`❌ Failed to claim Stellar escrow: ${error}`);
      throw error;
    }
  }

  async refundEscrow(htlcId: string): Promise<string> {
    try {
      const account = await this.server.loadAccount(this.keypair.publicKey());

      // Simplified refund operation - placeholder implementation
      const transaction = new TransactionBuilder(account, {
        fee: '10000',
        networkPassphrase: this.networkPassphrase
      })
        .addOperation(Operation.manageData({
          name: `refund_${htlcId}`,
          value: Buffer.from('refunded', 'utf8')
        }))
        .setTimeout(30)
        .build();

      transaction.sign(this.keypair);
      const result = await this.server.submitTransaction(transaction);

      logger.info(`✓ Stellar escrow refunded: ${result.hash}`);
      return result.hash;
    } catch (error) {
      logger.error(`❌ Failed to refund Stellar escrow: ${error}`);
      throw error;
    }
  }

  async getEscrowState(htlcId: string): Promise<EscrowState> {
    try {
      // Query the contract state - this is simplified
      // You'll need to implement based on your actual Stellar contract
      // For now, return a placeholder state
      // const contractData = await this.server.getContractData(this.contractId, htlcId);

      // Parse the contract data to extract HTLC state
      // This is a placeholder implementation
      return {
        orderId: htlcId,
        chain: 'stellar',
        contractAddress: this.contractId,
        amount: BigInt(0), // Parse from contract data
        asset: 'XLM', // Parse from contract data
        hashlock: '', // Parse from contract data
        timelock: 0, // Parse from contract data
        creator: '', // Parse from contract data
        beneficiary: '', // Parse from contract data
        txHash: '',
        blockNumber: 0,
        status: 'created'
      };
    } catch (error) {
      logger.error(`❌ Failed to get Stellar escrow state: ${error}`);
      throw error;
    }
  }

  async validateOrder(order: HTLCOrder): Promise<boolean> {
    try {
      // Basic validation for Stellar orders
      if (order.makerChain !== 'stellar') return false;

      // Validate Stellar address format
      if (!/^G[A-Z2-7]{55}$/.test(order.maker)) return false;

      return true;
    } catch (error) {
      logger.error(`❌ Stellar order validation failed: ${error}`);
      return false;
    }
  }

  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    this.isMonitoring = true;

    try {
      // Get current ledger
      const ledgerResponse = await this.server.ledgers().order('desc').limit(1).call();
      this.lastProcessedLedger = parseInt(ledgerResponse.records[0].sequence.toString());
      logger.info(`📡 Starting Stellar monitoring from ledger ${this.lastProcessedLedger}`);
    } catch (error) {
      // If we can't get ledger info, start from 0 and continue
      this.lastProcessedLedger = 0;
      logger.warn(`⚠️ Could not get current ledger, starting monitoring anyway: ${error}`);
      logger.info(`📡 Starting Stellar monitoring from ledger 0`);
    }

    // Start monitoring contract events
    this.monitorContractEvents();
  }

  private monitorContractEvents(): void {
    // Monitor operations for this account
    const operationStream = this.server
      .operations()
      .forAccount(this.keypair.publicKey())
      .cursor('now')
      .stream({
        onmessage: (operation: any) => {
          this.processContractOperation(operation);
        },
        onerror: (error: any) => {
          logger.error('❌ Stellar stream error:', error);
          // Implement reconnection logic
          setTimeout(() => {
            if (this.isMonitoring) {
              this.monitorContractEvents();
            }
          }, 5000);
        }
      });

    // Monitor ledger closes for missed events
    const ledgerStream = this.server
      .ledgers()
      .cursor('now')
      .stream({
        onmessage: (ledger: any) => {
          this.processLedger(ledger);
        },
        onerror: (error: any) => {
          logger.error('❌ Stellar ledger stream error:', error);
        }
      });
  }

  private async processContractOperation(operation: any): Promise<void> {
    try {
      if (operation.type === 'manage_data') {
        const dataName = operation.name;

        if (dataName.startsWith('claim_')) {
          await this.processHTLCClaim(operation);
        } else if (dataName.startsWith('refund_')) {
          await this.processHTLCRefund(operation);
        }
      } else if (operation.type === 'payment') {
        await this.processHTLCCreation(operation);
      }
    } catch (error) {
      logger.error('❌ Error processing Stellar operation:', error);
    }
  }

  private async processHTLCCreation(operation: any): Promise<void> {
    const params = this.extractOperationParams(operation);

    this.emit('escrowCreated', {
      orderId: params.orderId || operation.id,
      chain: 'stellar',
      contractAddress: this.contractId,
      creator: operation.source_account,
      beneficiary: params.beneficiary || '',
      amount: BigInt(params.amount || 0),
      asset: params.asset || 'XLM',
      hashlock: params.hashlock || '',
      timelock: params.timelock || 0,
      txHash: operation.transaction_hash,
      blockNumber: operation.ledger,
      status: 'created',
    });
  }

  private async processHTLCClaim(operation: any): Promise<void> {
    const params = this.extractOperationParams(operation);

    // Emit secret revealed event
    this.emit('secretRevealed', {
      orderId: params.orderId || operation.id,
      chain: 'stellar',
      secret: params.secret || '',
      hashlock: params.hashlock || '',
      txHash: operation.transaction_hash,
      revealer: operation.source_account,
      timestamp: new Date(operation.created_at),
    });

    // Emit escrow claimed event
    this.emit('escrowClaimed', {
      orderId: params.orderId || operation.id,
      chain: 'stellar',
      claimer: operation.source_account,
      txHash: operation.transaction_hash,
      blockNumber: operation.ledger,
    });
  }

  private async processHTLCRefund(operation: any): Promise<void> {
    const params = this.extractOperationParams(operation);

    this.emit('escrowRefunded', {
      orderId: params.orderId || operation.id,
      chain: 'stellar',
      refunder: operation.source_account,
      txHash: operation.transaction_hash,
      blockNumber: operation.ledger,
    });
  }

  private processLedger(ledger: any): void {
    const ledgerSequence = parseInt(ledger.sequence);

    // Check for missed ledgers
    if (ledgerSequence > this.lastProcessedLedger + 1) {
      this.processMissedLedgers(this.lastProcessedLedger + 1, ledgerSequence - 1);
    }

    this.lastProcessedLedger = ledgerSequence;
  }

  private async processMissedLedgers(fromLedger: number, toLedger: number): Promise<void> {
    logger.info(`📊 Processing missed Stellar ledgers ${fromLedger}-${toLedger}`);

    try {
      const operations = await this.server
        .operations()
        .forAccount(this.keypair.publicKey())
        .includeFailed(false)
        .limit(200)
        .call();

      for (const operation of operations.records) {
        const ledgerSeq = parseInt((operation as any).ledger || '0');
        if (ledgerSeq >= fromLedger && ledgerSeq <= toLedger) {
          await this.processContractOperation(operation);
        }
      }
    } catch (error) {
      logger.error('❌ Error processing missed Stellar ledgers:', error);
    }
  }

  private decodeFunctionName(operation: any): string {
    // Implement Stellar contract function name decoding
    // This would parse the XDR data to extract the function name
    try {
      return operation.function || 'unknown';
    } catch (error) {
      logger.error('❌ Error decoding function name:', error);
      return 'unknown';
    }
  }

  private extractOperationParams(operation: any): any {
    // Implement parameter extraction from Stellar operation
    // This would parse the XDR data to extract function parameters
    try {
      return operation.parameters || {};
    } catch (error) {
      logger.error('❌ Error extracting operation params:', error);
      return {};
    }
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    logger.info('⏹️ Stopped Stellar monitoring');
  }
}