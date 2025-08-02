import * as StellarSdk from '@stellar/stellar-sdk';
import { STELLAR_CONFIG } from '../config/networks.js';
import { HTLCData, HTLCStatus, StellarHTLCEvent } from '../../../shared/types.js';

export class StellarAdapter {
  private server: StellarSdk.SorobanRpc.Server;
  private keypair: StellarSdk.Keypair;
  private contract: StellarSdk.Contract;

  constructor() {
    this.server = new StellarSdk.SorobanRpc.Server(STELLAR_CONFIG.rpcUrl);
    this.keypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_PRIVATE_KEY!);
    this.contract = new StellarSdk.Contract(STELLAR_CONFIG.contractId!);
  }

  async createHTLC(
    receiver: string,
    amount: string,
    hashlock: string,
    timelock: number,
    safetyDeposit: string
  ): Promise<string> {
    try {
      console.log(`🌟 Creating Stellar HTLC: ${amount} XLM to ${receiver}`);

      // Convert amount to stroops (1 XLM = 10^7 stroops)
      const amountInStroops = (parseFloat(amount) * 10_000_000).toString();
      const safetyDepositInStroops = (parseFloat(safetyDeposit) * 10_000_000).toString();

      // Build transaction
      const account = await this.server.getAccount(this.keypair.publicKey());
      
      const operation = this.contract.call(
        'create_htlc',
        StellarSdk.Address.fromString(this.keypair.publicKey()),  // sender
        StellarSdk.Address.fromString(receiver),                  // receiver
        StellarSdk.nativeToScVal(amountInStroops, { type: 'i128' }), // amount
        StellarSdk.nativeToScVal(Buffer.from(hashlock.slice(2), 'hex'), { type: 'bytes' }), // hashlock
        StellarSdk.nativeToScVal(timelock, { type: 'u64' }),     // timelock
        StellarSdk.nativeToScVal(safetyDepositInStroops, { type: 'i128' }) // safetyDeposit
      );

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_CONFIG.networkPassphrase!
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      // Sign and submit
      transaction.sign(this.keypair);
      
      const result = await this.server.sendTransaction(transaction);
      
      if (result.status === 'FAILED') {
        throw new Error(`Transaction failed: ${result.errorResult}`);
      }

      // Wait for transaction and extract contract ID from result
      const getTransactionResponse = await this.server.getTransaction(result.hash);
      
      if (getTransactionResponse.status !== StellarSdk.SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
        throw new Error('Transaction was not successful');
      }

      // Extract contract ID from return value
      const contractId = StellarSdk.scValToNative(getTransactionResponse.returnValue!);
      const contractIdHex = '0x' + Buffer.from(contractId).toString('hex');
      
      console.log(`✅ Stellar HTLC created: ${contractIdHex}`);
      return contractIdHex;
    } catch (error) {
      console.error('❌ Failed to create Stellar HTLC:', error);
      throw error;
    }
  }

  async withdraw(contractId: string, preimage: string): Promise<string> {
    try {
      console.log(`🔓 Withdrawing from Stellar HTLC: ${contractId}`);

      const account = await this.server.getAccount(this.keypair.publicKey());
      
      const operation = this.contract.call(
        'withdraw',
        StellarSdk.nativeToScVal(Buffer.from(contractId.slice(2), 'hex'), { type: 'bytes' }),
        StellarSdk.nativeToScVal(Buffer.from(preimage.slice(2), 'hex'), { type: 'bytes' })
      );

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_CONFIG.networkPassphrase!
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      transaction.sign(this.keypair);
      
      const result = await this.server.sendTransaction(transaction);
      
      if (result.status === 'FAILED') {
        throw new Error(`Withdraw transaction failed: ${result.errorResult}`);
      }

      console.log(`✅ Stellar HTLC withdrawn: ${result.hash}`);
      return result.hash;
    } catch (error) {
      console.error('❌ Failed to withdraw from Stellar HTLC:', error);
      throw error;
    }
  }

  async refund(contractId: string): Promise<string> {
    try {
      console.log(`🔄 Refunding Stellar HTLC: ${contractId}`);

      const account = await this.server.getAccount(this.keypair.publicKey());
      
      const operation = this.contract.call(
        'refund',
        StellarSdk.nativeToScVal(Buffer.from(contractId.slice(2), 'hex'), { type: 'bytes' })
      );

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_CONFIG.networkPassphrase!
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      transaction.sign(this.keypair);
      
      const result = await this.server.sendTransaction(transaction);
      
      if (result.status === 'FAILED') {
        throw new Error(`Refund transaction failed: ${result.errorResult}`);
      }

      console.log(`✅ Stellar HTLC refunded: ${result.hash}`);
      return result.hash;
    } catch (error) {
      console.error('❌ Failed to refund Stellar HTLC:', error);
      throw error;
    }
  }

  async getHTLC(contractId: string): Promise<HTLCData> {
    try {
      const account = await this.server.getAccount(this.keypair.publicKey());
      
      const operation = this.contract.call(
        'get_htlc',
        StellarSdk.nativeToScVal(Buffer.from(contractId.slice(2), 'hex'), { type: 'bytes' })
      );

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_CONFIG.networkPassphrase!
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      const result = await this.server.simulateTransaction(transaction);
      
      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
        const htlcData = StellarSdk.scValToNative(result.result!.retval);
        
        return {
          contractId: '0x' + Buffer.from(htlcData.contract_id).toString('hex'),
          sender: htlcData.sender,
          receiver: htlcData.receiver,
          amount: htlcData.amount.toString(),
          tokenAddress: htlcData.token_address,
          hashlock: '0x' + Buffer.from(htlcData.hashlock).toString('hex'),
          timelock: Number(htlcData.timelock),
          timestamp: Number(htlcData.timestamp),
          safetyDeposit: htlcData.safety_deposit.toString(),
          status: this.mapStatus(htlcData.status),
          locked: htlcData.locked
        };
      } else {
        throw new Error('Failed to simulate get_htlc transaction');
      }
    } catch (error) {
      console.error('❌ Failed to get Stellar HTLC data:', error);
      throw error;
    }
  }

  async contractExists(contractId: string): Promise<boolean> {
    try {
      const account = await this.server.getAccount(this.keypair.publicKey());
      
      const operation = this.contract.call(
        'contract_exists',
        StellarSdk.nativeToScVal(Buffer.from(contractId.slice(2), 'hex'), { type: 'bytes' })
      );

      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: STELLAR_CONFIG.networkPassphrase!
      })
        .addOperation(operation)
        .setTimeout(300)
        .build();

      const result = await this.server.simulateTransaction(transaction);
      
      if (StellarSdk.SorobanRpc.Api.isSimulationSuccess(result)) {
        return StellarSdk.scValToNative(result.result!.retval);
      }
      
      return false;
    } catch (error) {
      console.error('❌ Failed to check Stellar contract existence:', error);
      return false;
    }
  }

  // Event monitoring via polling (Stellar doesn't have real-time events like Ethereum)
  async startEventMonitoring(callback: (event: StellarHTLCEvent) => void): Promise<void> {
    console.log('👀 Starting Stellar event monitoring...');
    
    let lastLedger = 0;
    
    const pollEvents = async () => {
      try {
        // Get recent events from Stellar
        const events = await this.server.getEvents({
          contractIds: [STELLAR_CONFIG.contractId!],
          topics: [['HTLCNew', 'HTLCWithdraw', 'HTLCRefund']],
          startLedger: lastLedger || undefined,
          limit: 100
        });

        for (const event of events.events) {
          const eventType = event.topic[0] as 'HTLCNew' | 'HTLCWithdraw' | 'HTLCRefund';
          
          callback({
            type: eventType,
            contractId: event.contractId,
            ledger: event.ledger,
            transactionHash: event.txHash,
            data: event.value
          });
          
          lastLedger = Math.max(lastLedger, event.ledger);
        }
      } catch (error) {
        console.error('❌ Error polling Stellar events:', error);
      }
      
      // Poll every 5 seconds
      setTimeout(pollEvents, 5000);
    };
    
    pollEvents();
  }

  private mapStatus(status: any): HTLCStatus {
    if (typeof status === 'string') {
      switch (status) {
        case 'Active': return HTLCStatus.Active;
        case 'Withdrawn': return HTLCStatus.Withdrawn;
        case 'Refunded': return HTLCStatus.Refunded;
        default: return HTLCStatus.Active;
      }
    }
    return HTLCStatus.Active;
  }

  async getBalance(): Promise<string> {
    const account = await this.server.getAccount(this.keypair.publicKey());
    const balance = account.balances.find(b => b.asset_type === 'native');
    return balance ? balance.balance : '0';
  }

  getAddress(): string {
    return this.keypair.publicKey();
  }
}