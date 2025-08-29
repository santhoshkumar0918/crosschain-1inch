// contracts/fusion-resolver/src/core/HTLCManager.ts
import { ethers, Log } from "ethers";
import {
  Horizon,
  Keypair,
  TransactionBuilder,
  Networks,
  Contract,
  Address,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { FusionOrder, HTLCPair } from "../types";
import { Logger } from "../utils/logger";
import { config } from "../utils/config";

export class HTLCManager {
  private ethProvider: ethers.JsonRpcProvider;
  private ethWallet: ethers.Wallet;
  private ethHTLCContract: ethers.Contract;

  private stellarServer: Horizon.Server;
  private stellarKeypair: Keypair;

  private logger = new Logger("HTLCManager");
  private htlcMappings = new Map<string, HTLCPair>();

  // Updated HTLC ABI to match the deployed contract
  private readonly HTLC_ABI = [
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
    this.ethProvider = new ethers.JsonRpcProvider(config.ethereum.rpcUrl);
    this.ethWallet = new ethers.Wallet(
      config.resolver.privateKey,
      this.ethProvider
    );
    this.ethHTLCContract = new ethers.Contract(
      config.ethereum.htlcAddress,
      this.HTLC_ABI,
      this.ethWallet
    );

    // Initialize Stellar connection
    this.stellarServer = new Horizon.Server(
      "https://horizon-testnet.stellar.org"
    );
    this.stellarKeypair = Keypair.fromSecret(config.resolver.stellarSecret);

    this.logger.info("HTLC Manager initialized", {
      ethContract: config.ethereum.htlcAddress,
      stellarContract: config.stellar.htlcContractId,
      resolverAddress: config.resolver.address,
      stellarAddress: config.resolver.stellarAddress,
    });
  }

  // Create cross-chain HTLC pair for auction participation
  async createCrossChainHTLCs(params: {
    order: FusionOrder;
    resolver: string;
  }): Promise<HTLCPair> {
    this.logger.info("Creating cross-chain HTLC pair", {
      orderHash: params.order.orderHash,
    });

    try {
      // Generate secret and hashlock
      const secret = this.generateSecret();
      const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));

      const timelock = params.order.timelock;
      let ethereumContractId: string;
      let stellarContractId: string;

      // Determine swap direction and create HTLCs
      if (params.order.srcChainId === config.ethereum.chainId) {
        // ETH → Stellar swap: User sends ETH, resolver provides XLM
        ethereumContractId = await this.createEthereumHTLC({
          sender: params.resolver,
          receiver: params.order.maker,
          amount: params.order.makingAmount, // ETH amount
          tokenAddress: ethers.ZeroAddress, // Native ETH
          hashlock,
          timelock,
        });

        stellarContractId = await this.createStellarHTLC({
          sender: params.resolver,
          receiver: params.order.maker,
          amount: params.order.takingAmount, // XLM amount
          assetCode: "native", // XLM
          hashlock,
          timelock,
        });
      } else {
        // Stellar → ETH swap: User sends XLM, resolver provides ETH
        stellarContractId = await this.createStellarHTLC({
          sender: params.resolver,
          receiver: params.order.maker,
          amount: params.order.makingAmount, // XLM amount
          assetCode: "native",
          hashlock,
          timelock,
        });

        ethereumContractId = await this.createEthereumHTLC({
          sender: params.resolver,
          receiver: params.order.maker,
          amount: params.order.takingAmount, // ETH amount
          tokenAddress: ethers.ZeroAddress, // Native ETH
          hashlock,
          timelock,
        });
      }

      const htlcPair: HTLCPair = {
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
    } catch (error) {
      this.logger.error("Failed to create cross-chain HTLC pair", error);
      throw error;
    }
  }

  // Create HTLC on Ethereum
  private async createEthereumHTLC(params: {
    sender: string;
    receiver: string;
    amount: string;
    tokenAddress: string;
    hashlock: string;
    timelock: number;
  }): Promise<string> {
    this.logger.info("Creating Ethereum HTLC", params);

    try {
      // Calculate safety deposit (10% of amount)
      const safetyDeposit = (BigInt(params.amount) * BigInt(10)) / BigInt(100);

      // Prepare transaction with correct parameters for the deployed contract
      const tx = await this.ethHTLCContract.createHTLC(
        params.receiver, // receiver (not sender first!)
        params.amount,
        params.tokenAddress,
        params.hashlock,
        params.timelock,
        safetyDeposit.toString(),
        false, // allowPartialFills
        "0", // minFillAmount
        {
          value:
            params.tokenAddress === ethers.ZeroAddress
              ? BigInt(params.amount) + safetyDeposit
              : safetyDeposit,
          gasLimit: 500000,
        }
      );

      const receipt = await tx.wait();

      if (!receipt) {
        throw new Error("Transaction receipt is null");
      }

      // Extract contract ID from events
      const htlcNewEvent = receipt.logs.find((log: Log) => {
        try {
          const parsed = this.ethHTLCContract.interface.parseLog({
            topics: log.topics,
            data: log.data,
          });
          return parsed?.name === "HTLCNew";
        } catch {
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
    } catch (error) {
      this.logger.error("Failed to create Ethereum HTLC", error);
      throw error;
    }
  }

  // Create HTLC on Stellar
  private async createStellarHTLC(params: {
    sender: string;
    receiver: string;
    amount: string;
    assetCode: string;
    hashlock: string;
    timelock: number;
  }): Promise<string> {
    this.logger.info("Creating Stellar HTLC", params);

    try {
      // Check if resolver account exists, if not create/fund it
      let account;
      try {
        account = await this.stellarServer.loadAccount(
          this.stellarKeypair.publicKey()
        );
        this.logger.info("Stellar resolver account found", {
          address: this.stellarKeypair.publicKey(),
          balance: account.balances[0]?.balance,
        });
      } catch (error) {
        this.logger.warn(
          "Stellar resolver account not found, this might be the issue",
          {
            address: this.stellarKeypair.publicKey(),
            error: error instanceof Error ? error.message : "Unknown error",
          }
        );

        // For now, throw a more descriptive error
        throw new Error(
          `Stellar resolver account not found: ${this.stellarKeypair.publicKey()}. Please fund this account on Stellar testnet.`
        );
      }

      // Calculate safety deposit (10% of amount)
      const safetyDeposit = (BigInt(params.amount) * BigInt(10)) / BigInt(100);

      // Convert parameters to Stellar ScVal format
      const senderAddr = Address.fromString(params.sender);
      const receiverAddr = Address.fromString(params.receiver);
      const amountScVal = nativeToScVal(BigInt(params.amount), {
        type: "i128",
      });

      // For native XLM, we need to use the native token contract address
      // This should be the Stellar Asset Contract (SAC) address for native XLM
      const nativeTokenAddress =
        "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHHAGCN4B2"; // Native XLM SAC address
      const tokenAddr = Address.fromString(nativeTokenAddress);

      const hashlockScVal = nativeToScVal(
        Buffer.from(params.hashlock.slice(2), "hex"),
        { type: "bytes" }
      );
      const timelockScVal = nativeToScVal(params.timelock, { type: "u64" });
      const safetyDepositScVal = nativeToScVal(
        BigInt(safetyDeposit.toString()),
        {
          type: "i128",
        }
      );

      // Build transaction
      const contract = new Contract(config.stellar.htlcContractId);
      const transaction = new TransactionBuilder(account, {
        fee: "1000000", // 0.1 XLM
        networkPassphrase: config.stellar.networkPassphrase,
      })
        .addOperation(
          contract.call(
            "create_htlc",
            senderAddr.toScVal(),
            receiverAddr.toScVal(),
            amountScVal,
            tokenAddr.toScVal(),
            hashlockScVal,
            timelockScVal,
            safetyDepositScVal
          )
        )
        .setTimeout(300)
        .build();

      transaction.sign(this.stellarKeypair);

      const result = await this.stellarServer.submitTransaction(transaction);

      if (result.successful) {
        this.logger.info("Stellar HTLC created successfully", {
          txHash: result.hash,
        });
        return result.hash; // Use transaction hash as contract ID
      } else {
        throw new Error(`Stellar transaction failed: ${result.result_xdr}`);
      }
    } catch (error) {
      this.logger.error("Failed to create Stellar HTLC", error);
      throw error;
    }
  }

  // Monitor HTLC completion and handle secret revelation
  async monitorHTLCCompletion(orderHash: string): Promise<void> {
    const htlcPair = this.htlcMappings.get(orderHash);
    if (!htlcPair) {
      this.logger.warn("No HTLC pair found for order", { orderHash });
      return;
    }

    this.logger.info("Starting HTLC completion monitoring", { orderHash });

    // Monitor Ethereum HTLC for withdrawal
    this.ethHTLCContract.on(
      "HTLCWithdraw",
      async (contractId, preimage, event) => {
        if (contractId === htlcPair.ethereumContractId) {
          this.logger.info("Ethereum HTLC withdrawn, revealing secret", {
            contractId,
            preimage,
          });
          await this.handleSecretRevealed(orderHash, preimage);
        }
      }
    );

    // Set up timeout for refund
    setTimeout(async () => {
      await this.handleHTLCTimeout(orderHash);
    }, (htlcPair.timelock - Math.floor(Date.now() / 1000)) * 1000);
  }

  // Handle secret revelation
  private async handleSecretRevealed(
    orderHash: string,
    preimage: string
  ): Promise<void> {
    const htlcPair = this.htlcMappings.get(orderHash);
    if (!htlcPair) return;

    try {
      htlcPair.status = "secret_revealed";

      // Use the revealed secret to complete the swap on the other chain
      if (htlcPair.stellarContractId) {
        await this.withdrawStellarHTLC(htlcPair.stellarContractId, preimage);
      }

      htlcPair.status = "completed";
      this.logger.info("HTLC pair completed successfully", { orderHash });
    } catch (error) {
      this.logger.error("Failed to handle secret revelation", error);
    }
  }

  // Withdraw from Stellar HTLC
  private async withdrawStellarHTLC(
    contractId: string,
    preimage: string
  ): Promise<void> {
    this.logger.info("Withdrawing from Stellar HTLC", { contractId });

    try {
      const account = await this.stellarServer.loadAccount(
        this.stellarKeypair.publicKey()
      );

      const contract = new Contract(config.stellar.htlcContractId);
      const contractIdScVal = nativeToScVal(contractId, { type: "bytes" });
      const preimageScVal = nativeToScVal(preimage, { type: "bytes" });

      const transaction = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: config.stellar.networkPassphrase,
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
      } else {
        throw new Error(`Stellar withdrawal failed: ${result.result_xdr}`);
      }
    } catch (error) {
      this.logger.error("Failed to withdraw from Stellar HTLC", error);
      throw error;
    }
  }

  // Handle HTLC timeout and refund
  private async handleHTLCTimeout(orderHash: string): Promise<void> {
    const htlcPair = this.htlcMappings.get(orderHash);
    if (!htlcPair || htlcPair.status === "completed") return;

    this.logger.info("HTLC timeout reached, initiating refunds", { orderHash });

    try {
      // Refund both HTLCs
      await Promise.allSettled([
        this.refundEthereumHTLC(htlcPair.ethereumContractId),
        this.refundStellarHTLC(htlcPair.stellarContractId),
      ]);

      htlcPair.status = "refunded";
      this.logger.info("HTLC pair refunded due to timeout", { orderHash });
    } catch (error) {
      this.logger.error("Failed to handle HTLC timeout", error);
    }
  }

  // Refund Ethereum HTLC
  private async refundEthereumHTLC(contractId: string): Promise<void> {
    try {
      const tx = await this.ethHTLCContract.refund(contractId, {
        gasLimit: 200000,
      });
      await tx.wait();
      this.logger.info("Ethereum HTLC refunded", { contractId });
    } catch (error) {
      this.logger.error("Failed to refund Ethereum HTLC", error);
    }
  }

  // Refund Stellar HTLC
  private async refundStellarHTLC(contractId: string): Promise<void> {
    try {
      const account = await this.stellarServer.loadAccount(
        this.stellarKeypair.publicKey()
      );

      const contract = new Contract(config.stellar.htlcContractId);
      const contractIdScVal = nativeToScVal(contractId, { type: "bytes" });

      const transaction = new TransactionBuilder(account, {
        fee: "1000000",
        networkPassphrase: config.stellar.networkPassphrase,
      })
        .addOperation(contract.call("refund", contractIdScVal))
        .setTimeout(300)
        .build();

      transaction.sign(this.stellarKeypair);

      const result = await this.stellarServer.submitTransaction(transaction);

      if (result.successful) {
        this.logger.info("Stellar HTLC refunded", { contractId });
      }
    } catch (error) {
      this.logger.error("Failed to refund Stellar HTLC", error);
    }
  }

  // Get Ethereum balance
  async getEthereumBalance(): Promise<number> {
    try {
      const balance = await this.ethProvider.getBalance(
        config.resolver.address
      );
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      this.logger.error("Failed to get Ethereum balance", error);
      return 0;
    }
  }

  // Get Stellar balance
  async getStellarBalance(): Promise<number> {
    try {
      // Use Horizon testnet for account balance queries
      const horizonServer = new Horizon.Server(
        "https://horizon-testnet.stellar.org"
      );
      const account = await horizonServer.loadAccount(
        config.resolver.stellarAddress
      );
      const nativeBalance = account.balances.find(
        (b) => b.asset_type === "native"
      );
      return nativeBalance ? parseFloat(nativeBalance.balance) : 0;
    } catch (error) {
      this.logger.error("Failed to get Stellar balance", error);
      return 0;
    }
  }

  // Generate random secret
  private generateSecret(): string {
    return "0x" + require("crypto").randomBytes(32).toString("hex");
  }

  // Get HTLC pair for order
  getHTLCPair(orderHash: string): HTLCPair | undefined {
    return this.htlcMappings.get(orderHash);
  }

  // Get all active HTLC pairs
  getActiveHTLCPairs(): Map<string, HTLCPair> {
    return new Map(this.htlcMappings);
  }
}
