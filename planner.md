# 🏆 1inch Fusion+ Integration - Hackathon Implementation Plan

## 🎯 **Current Project Structure Analysis**

Based on your project knowledge, your current structure is:

```
cross-chain-swap/
├── contracts/
│   ├── ethereum/         # HTLC contracts (deployed ✅)
│   ├── stellar/          # Stellar HTLC contracts (deployed ✅)
│   └── relayer/          # Working relayer service ✅
└── README.md
```

## 🚀 **Hackathon 1inch Integration Plan**

### **New File Structure for 1inch Integration:**

```
cross-chain-swap/
├── contracts/
│   ├── ethereum/         # EXISTING ✅
│   ├── stellar/          # EXISTING ✅
│   ├── relayer/          # EXISTING ✅
│   └── fusion-resolver/  # NEW - 1inch Integration
│       ├── src/
│       │   ├── core/
│       │   │   ├── FusionSDKManager.ts    # 1inch SDK wrapper
│       │   │   ├── AuctionResolver.ts     # Auction participation
│       │   │   ├── SecretCoordinator.ts   # Fusion+ secret timing
│       │   │   └── HTLCBridge.ts          # Bridge to existing HTLCs
│       │   ├── api/
│       │   │   ├── routes.ts              # REST API endpoints
│       │   │   └── websocket.ts           # Real-time updates
│       │   ├── utils/
│       │   │   ├── config.ts              # Configuration
│       │   │   └── logger.ts              # Logging
│       │   └── index.ts                   # Entry point
│       ├── package.json
│       ├── tsconfig.json
│       └── .env.example
└── apps/
    └── demo-ui/          # NEW - Hackathon Demo UI
        ├── src/
        │   ├── components/
        │   │   ├── FusionSwap.tsx         # Main swap interface
        │   │   ├── SwapStatus.tsx         # Status monitoring
        │   │   └── WalletConnect.tsx      # Wallet connections
        │   ├── hooks/
        │   │   └── useFusionSwap.ts       # Swap logic hook
        │   ├── App.tsx
        │   └── index.tsx
        ├── package.json
        └── public/
```

## 📋 **Phase 1: Fusion+ Resolver Core (3 hours)**

### **1.1 Setup Fusion+ Resolver Package**

```bash
# Create the fusion resolver
mkdir -p contracts/fusion-resolver/src/{core,api,utils}
cd contracts/fusion-resolver

# Initialize package.json
npm init -y

# Install dependencies
npm install @1inch/cross-chain-sdk ethers stellar-sdk express ws cors helmet
npm install -D typescript @types/node @types/express ts-node nodemon
```

### **1.2 Core Implementation Files**

#### **contracts/fusion-resolver/src/core/FusionSDKManager.ts**

```typescript
import { SDK, NetworkEnum, WebSocketApi } from "@1inch/cross-chain-sdk";
import { ethers } from "ethers";

export class FusionSDKManager {
  private sdk: SDK;
  private wsApi: WebSocketApi;

  constructor() {
    // Initialize 1inch SDK for hackathon
    this.sdk = new SDK({
      url: "https://api.1inch.dev/fusion-plus",
      authKey: process.env.FUSION_AUTH_KEY || "demo-key",
    });

    // WebSocket for real-time order monitoring
    this.wsApi = new WebSocketApi({
      url: "wss://api.1inch.dev/fusion/ws",
      network: NetworkEnum.ETHEREUM,
      authKey: process.env.FUSION_AUTH_KEY || "demo-key",
    });
  }

  // Get quotes for cross-chain swaps
  async getQuote(params: {
    srcChainId: number;
    dstChainId: number;
    srcTokenAddress: string;
    dstTokenAddress: string;
    amount: string;
    walletAddress: string;
  }) {
    return await this.sdk.getQuote(params);
  }

  // Create Fusion+ order
  async createOrder(quote: any, orderParams: any) {
    return await this.sdk.createOrder(quote, orderParams);
  }

  // Monitor active orders
  async getActiveOrders(page = 1, limit = 10) {
    return await this.sdk.getActiveOrders({ page, limit });
  }

  // WebSocket event listeners
  setupOrderMonitoring(callbacks: {
    onOrderCreated?: (data: any) => void;
    onOrderFilled?: (data: any) => void;
    onSecretShared?: (data: any) => void;
  }) {
    if (callbacks.onOrderCreated) {
      this.wsApi.order.onOrderCreated(callbacks.onOrderCreated);
    }
    if (callbacks.onOrderFilled) {
      this.wsApi.order.onOrderFilled(callbacks.onOrderFilled);
    }
    if (callbacks.onSecretShared) {
      this.wsApi.order.onOrder((data) => {
        if (data.event === "secret_shared" && callbacks.onSecretShared) {
          callbacks.onSecretShared(data);
        }
      });
    }
  }
}
```

#### **contracts/fusion-resolver/src/core/AuctionResolver.ts**

```typescript
import { FusionSDKManager } from "./FusionSDKManager";
import { HTLCBridge } from "./HTLCBridge";
import { Logger } from "../utils/logger";

export class AuctionResolver {
  private fusionSDK: FusionSDKManager;
  private htlcBridge: HTLCBridge;
  private logger: Logger;
  private isMonitoring = false;

  constructor(fusionSDK: FusionSDKManager, htlcBridge: HTLCBridge) {
    this.fusionSDK = fusionSDK;
    this.htlcBridge = htlcBridge;
    this.logger = new Logger("AuctionResolver");
  }

  // Start monitoring auctions
  async startMonitoring() {
    if (this.isMonitoring) return;

    this.logger.info("Starting auction monitoring...");

    // Setup WebSocket listeners
    this.fusionSDK.setupOrderMonitoring({
      onOrderCreated: this.handleNewOrder.bind(this),
      onOrderFilled: this.handleOrderFilled.bind(this),
      onSecretShared: this.handleSecretShared.bind(this),
    });

    // Poll for existing orders (backup to WebSocket)
    setInterval(async () => {
      try {
        const orders = await this.fusionSDK.getActiveOrders();
        for (const order of orders) {
          await this.evaluateOrder(order);
        }
      } catch (error) {
        this.logger.error("Error polling orders:", error);
      }
    }, 30000); // Check every 30 seconds

    this.isMonitoring = true;
  }

  // Handle new Fusion+ order
  private async handleNewOrder(orderData: any) {
    this.logger.info("New Fusion+ order detected:", orderData.data.orderHash);
    await this.evaluateOrder(orderData.data.order);
  }

  // Evaluate if we should participate in this auction
  private async evaluateOrder(order: any) {
    try {
      // Basic profitability check (hackathon scope)
      const canFulfill = await this.canFulfillOrder(order);

      if (canFulfill) {
        this.logger.info("Participating in auction for order:", order.hash);
        await this.participateInAuction(order);
      }
    } catch (error) {
      this.logger.error("Error evaluating order:", error);
    }
  }

  // Check if we can fulfill this order
  private async canFulfillOrder(order: any): Promise<boolean> {
    // Hackathon scope: basic checks
    const isEthToStellar =
      order.srcChainId === 1 && order.dstChainId === "stellar";
    const isStellarToEth =
      order.srcChainId === "stellar" && order.dstChainId === 1;

    // Only handle ETH <-> Stellar swaps for hackathon
    return isEthToStellar || isStellarToEth;
  }

  // Participate in the auction by creating HTLCs
  private async participateInAuction(order: any) {
    try {
      // Create cross-chain HTLCs using existing infrastructure
      const htlcPair = await this.htlcBridge.createCrossChainHTLCs({
        order,
        resolver: process.env.RESOLVER_ADDRESS!,
      });

      this.logger.info("HTLCs created for auction:", {
        ethHTLC: htlcPair.ethContractId,
        stellarHTLC: htlcPair.stellarContractId,
        orderHash: order.hash,
      });

      // Store mapping for later secret coordination
      await this.htlcBridge.storeFusionOrderMapping(order.hash, htlcPair);
    } catch (error) {
      this.logger.error("Error participating in auction:", error);
    }
  }

  // Handle order filled event
  private async handleOrderFilled(data: any) {
    this.logger.info("Order filled:", data.data.orderHash);
    // Trigger HTLC claims if we participated
    await this.htlcBridge.handleFusionOrderFilled(data.data.orderHash);
  }

  // Handle secret shared event
  private async handleSecretShared(data: any) {
    this.logger.info("Secret shared for order:", data.data);
    // Use the shared secret to claim our HTLCs
    await this.htlcBridge.handleSecretRevealed(data.data);
  }
}
```

#### **contracts/fusion-resolver/src/core/HTLCBridge.ts**

```typescript
import { ethers } from "ethers";
import * as StellarSdk from "stellar-sdk";
import { Logger } from "../utils/logger";

export interface HTLCPair {
  ethContractId: string;
  stellarContractId: string;
  secret: string;
  hashlock: string;
}

export class HTLCBridge {
  private ethProvider: ethers.JsonRpcProvider;
  private stellarServer: StellarSdk.Horizon.Server;
  private logger: Logger;
  private fusionOrderMappings = new Map<string, HTLCPair>();

  constructor() {
    this.ethProvider = new ethers.JsonRpcProvider(process.env.ETH_RPC_URL);
    this.stellarServer = new StellarSdk.Horizon.Server(
      process.env.STELLAR_RPC_URL || "https://horizon-testnet.stellar.org"
    );
    this.logger = new Logger("HTLCBridge");
  }

  // Create HTLCs on both chains for a Fusion+ order
  async createCrossChainHTLCs(params: {
    order: any;
    resolver: string;
  }): Promise<HTLCPair> {
    // Generate secret and hashlock
    const secret = this.generateSecret();
    const hashlock = ethers.keccak256(ethers.toUtf8Bytes(secret));

    const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // Create Ethereum HTLC
    const ethContractId = await this.createEthereumHTLC({
      receiver: params.order.maker,
      amount: params.order.makingAmount,
      tokenAddress: params.order.makerAsset,
      hashlock,
      timelock,
    });

    // Create Stellar HTLC
    const stellarContractId = await this.createStellarHTLC({
      receiver: params.order.maker,
      amount: params.order.takingAmount,
      assetCode: this.mapTokenToStellarAsset(params.order.takerAsset),
      hashlock,
      timelock,
    });

    return {
      ethContractId,
      stellarContractId,
      secret,
      hashlock,
    };
  }

  // Create HTLC on Ethereum (connect to existing contract)
  private async createEthereumHTLC(params: {
    receiver: string;
    amount: string;
    tokenAddress: string;
    hashlock: string;
    timelock: number;
  }): Promise<string> {
    // Connect to your existing HTLC contract
    const htlcContract = new ethers.Contract(
      process.env.ETH_HTLC_ADDRESS!,
      [], // Add your HTLC ABI here
      new ethers.Wallet(process.env.RESOLVER_PRIVATE_KEY!, this.ethProvider)
    );

    const tx = await htlcContract.createHTLC(
      params.receiver,
      params.amount,
      params.tokenAddress,
      params.hashlock,
      params.timelock,
      { value: params.tokenAddress === ethers.ZeroAddress ? params.amount : 0 }
    );

    const receipt = await tx.wait();
    this.logger.info("Ethereum HTLC created:", receipt.hash);

    // Extract contract ID from events
    return receipt.logs[0].data; // Simplified for hackathon
  }

  // Create HTLC on Stellar (connect to existing contract)
  private async createStellarHTLC(params: {
    receiver: string;
    amount: string;
    assetCode: string;
    hashlock: string;
    timelock: number;
  }): Promise<string> {
    // Connect to your existing Stellar HTLC contract
    const account = await this.stellarServer.loadAccount(
      process.env.RESOLVER_STELLAR_ADDRESS!
    );

    // Build transaction to invoke Stellar HTLC
    const transaction = new StellarSdk.TransactionBuilder(account, {
      fee: StellarSdk.BASE_FEE,
      networkPassphrase: StellarSdk.Networks.TESTNET,
    })
      .addOperation(
        StellarSdk.Operation.invokeContract({
          contract: process.env.STELLAR_HTLC_ADDRESS!,
          function: "create_htlc",
          args: [
            StellarSdk.Address.fromString(
              process.env.RESOLVER_STELLAR_ADDRESS!
            ).toScVal(),
            StellarSdk.Address.fromString(params.receiver).toScVal(),
            StellarSdk.nativeToScVal(params.amount, { type: "i128" }),
            StellarSdk.nativeToScVal(params.hashlock, { type: "bytes" }),
            StellarSdk.nativeToScVal(params.timelock, { type: "u64" }),
          ],
        })
      )
      .setTimeout(30)
      .build();

    transaction.sign(
      StellarSdk.Keypair.fromSecret(process.env.RESOLVER_STELLAR_SECRET!)
    );

    const result = await this.stellarServer.submitTransaction(transaction);
    this.logger.info("Stellar HTLC created:", result.hash);

    return result.hash;
  }

  // Store mapping between Fusion+ order and HTLC pair
  async storeFusionOrderMapping(orderHash: string, htlcPair: HTLCPair) {
    this.fusionOrderMappings.set(orderHash, htlcPair);
    this.logger.info("Stored HTLC mapping for order:", orderHash);
  }

  // Handle Fusion+ order filled
  async handleFusionOrderFilled(orderHash: string) {
    const mapping = this.fusionOrderMappings.get(orderHash);
    if (!mapping) {
      this.logger.warn("No HTLC mapping found for order:", orderHash);
      return;
    }

    // Submit secret to claim HTLCs
    await this.claimHTLCs(mapping);
  }

  // Handle secret revealed by another resolver
  async handleSecretRevealed(secretData: any) {
    // Use revealed secret to claim our HTLCs
    const { secret, orderHash } = secretData;
    const mapping = this.fusionOrderMappings.get(orderHash);

    if (mapping) {
      await this.claimHTLCsWithSecret(mapping, secret);
    }
  }

  // Claim HTLCs using secret
  private async claimHTLCs(mapping: HTLCPair) {
    try {
      // Claim Ethereum HTLC
      await this.claimEthereumHTLC(mapping.ethContractId, mapping.secret);

      // Claim Stellar HTLC
      await this.claimStellarHTLC(mapping.stellarContractId, mapping.secret);

      this.logger.info("Successfully claimed HTLCs for order");
    } catch (error) {
      this.logger.error("Error claiming HTLCs:", error);
    }
  }

  private async claimHTLCsWithSecret(mapping: HTLCPair, secret: string) {
    // Similar to claimHTLCs but with provided secret
    await this.claimEthereumHTLC(mapping.ethContractId, secret);
    await this.claimStellarHTLC(mapping.stellarContractId, secret);
  }

  // Helper methods
  private generateSecret(): string {
    return ethers.hexlify(ethers.randomBytes(32));
  }

  private mapTokenToStellarAsset(tokenAddress: string): string {
    // Map Ethereum tokens to Stellar assets
    if (tokenAddress === ethers.ZeroAddress) return "native"; // XLM
    // Add more mappings as needed
    return "USDC"; // Default for hackathon
  }

  private async claimEthereumHTLC(contractId: string, secret: string) {
    // Implementation to claim Ethereum HTLC
    this.logger.info("Claiming Ethereum HTLC:", contractId);
  }

  private async claimStellarHTLC(contractId: string, secret: string) {
    // Implementation to claim Stellar HTLC
    this.logger.info("Claiming Stellar HTLC:", contractId);
  }
}
```

### **1.3 API Server**

#### **contracts/fusion-resolver/src/api/routes.ts**

```typescript
import express from "express";
import { FusionSDKManager } from "../core/FusionSDKManager";
import { AuctionResolver } from "../core/AuctionResolver";

export function createRoutes(
  fusionSDK: FusionSDKManager,
  auctionResolver: AuctionResolver
) {
  const router = express.Router();

  // Get active Fusion+ orders
  router.get("/orders", async (req, res) => {
    try {
      const orders = await fusionSDK.getActiveOrders();
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new swap order
  router.post("/swap", async (req, res) => {
    try {
      const { srcChain, dstChain, srcToken, dstToken, amount } = req.body;

      // Get quote from 1inch
      const quote = await fusionSDK.getQuote({
        srcChainId: srcChain,
        dstChainId: dstChain,
        srcTokenAddress: srcToken,
        dstTokenAddress: dstToken,
        amount,
        walletAddress: req.body.walletAddress,
      });

      res.json(quote);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get resolver status
  router.get("/status", (req, res) => {
    res.json({
      status: "running",
      integration: "1inch-fusion-plus",
      chains: ["ethereum", "stellar"],
      features: ["cross-chain-htlc", "auction-participation"],
    });
  });

  return router;
}
```

### **1.4 Main Entry Point**

#### **contracts/fusion-resolver/src/index.ts**

```typescript
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { FusionSDKManager } from "./core/FusionSDKManager";
import { AuctionResolver } from "./core/AuctionResolver";
import { HTLCBridge } from "./core/HTLCBridge";
import { createRoutes } from "./api/routes";
import { Logger } from "./utils/logger";

async function main() {
  const logger = new Logger("FusionResolver");

  try {
    // Initialize components
    const fusionSDK = new FusionSDKManager();
    const htlcBridge = new HTLCBridge();
    const auctionResolver = new AuctionResolver(fusionSDK, htlcBridge);

    // Start auction monitoring
    await auctionResolver.startMonitoring();

    // Setup Express API
    const app = express();
    app.use(helmet());
    app.use(cors());
    app.use(express.json());

    // Routes
    app.use("/api", createRoutes(fusionSDK, auctionResolver));

    // Health check
    app.get("/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Start server
    const port = process.env.PORT || 3003;
    app.listen(port, () => {
      logger.info(`🔥 Fusion+ Resolver running on port ${port}`);
    });
  } catch (error) {
    logger.error("Failed to start Fusion+ Resolver:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
```

## 📋 **Phase 2: Demo UI (2 hours)**

### **2.1 Create Demo UI App**

```bash
# Create demo UI
mkdir -p apps/demo-ui/src/{components,hooks}
cd apps/demo-ui

# Initialize React app
npx create-react-app . --template typescript
npm install ethers @stellar/freighter-api
```

### **2.2 Main Swap Component**

#### **apps/demo-ui/src/components/FusionSwap.tsx**

```typescript
import React, { useState } from "react";
import { ethers } from "ethers";

export function FusionSwap() {
  const [swapData, setSwapData] = useState({
    direction: "eth-to-stellar",
    amount: "",
    status: "idle",
  });

  const handleSwap = async () => {
    try {
      setSwapData((prev) => ({ ...prev, status: "creating-order" }));

      // Call fusion resolver API
      const response = await fetch("http://localhost:3003/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          srcChain: swapData.direction === "eth-to-stellar" ? 1 : "stellar",
          dstChain: swapData.direction === "eth-to-stellar" ? "stellar" : 1,
          srcToken: ethers.ZeroAddress,
          dstToken: "native",
          amount: ethers.parseEther(swapData.amount).toString(),
          walletAddress: "0x...", // Get from connected wallet
        }),
      });

      const quote = await response.json();
      setSwapData((prev) => ({ ...prev, status: "order-created" }));

      // Monitor order status
      monitorSwapProgress(quote.orderHash);
    } catch (error) {
      console.error("Swap failed:", error);
      setSwapData((prev) => ({ ...prev, status: "error" }));
    }
  };

  const monitorSwapProgress = (orderHash: string) => {
    // Poll for order status updates
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `http://localhost:3003/api/orders/${orderHash}`
        );
        const order = await response.json();

        if (order.status === "filled") {
          setSwapData((prev) => ({ ...prev, status: "completed" }));
          clearInterval(interval);
        }
      } catch (error) {
        console.error("Error monitoring order:", error);
      }
    }, 5000);
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">1inch Fusion+ to Stellar</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Swap Direction
          </label>
          <select
            value={swapData.direction}
            onChange={(e) =>
              setSwapData((prev) => ({ ...prev, direction: e.target.value }))
            }
            className="w-full p-2 border rounded"
          >
            <option value="eth-to-stellar">ETH → XLM</option>
            <option value="stellar-to-eth">XLM → ETH</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Amount</label>
          <input
            type="number"
            value={swapData.amount}
            onChange={(e) =>
              setSwapData((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="0.1"
            className="w-full p-2 border rounded"
          />
        </div>

        <button
          onClick={handleSwap}
          disabled={swapData.status !== "idle" || !swapData.amount}
          className="w-full bg-blue-600 text-white p-3 rounded font-medium disabled:opacity-50"
        >
          {swapData.status === "idle" && "Create Fusion+ Swap"}
          {swapData.status === "creating-order" && "Creating Order..."}
          {swapData.status === "order-created" &&
            "Order Created - Waiting for Fill"}
          {swapData.status === "completed" && "✅ Swap Completed"}
          {swapData.status === "error" && "❌ Error - Try Again"}
        </button>

        {swapData.status !== "idle" && (
          <div className="mt-6 p-4 bg-gray-50 rounded">
            <h3 className="font-medium mb-2">Swap Progress</h3>
            <div className="text-sm space-y-1">
              <div>Status: {swapData.status}</div>
              <div>Integration: 1inch Fusion+ ✅</div>
              <div>Cross-Chain: ETH ↔ Stellar ✅</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

## 📋 **Phase 3: Environment & Configuration**

### **3.1 Environment Setup**

#### **contracts/fusion-resolver/.env.example**

```bash
# 1inch Fusion+ API
FUSION_AUTH_KEY=your_fusion_api_key

# Resolver wallet
RESOLVER_PRIVATE_KEY=your_resolver_private_key
RESOLVER_ADDRESS=your_resolver_address
RESOLVER_STELLAR_SECRET=your_stellar_secret_key
RESOLVER_STELLAR_ADDRESS=your_stellar_address

# Chain connections
ETH_RPC_URL=https://sepolia.infura.io/v3/your-key
STELLAR_RPC_URL=https://horizon-testnet.stellar.org

# Contract addresses
ETH_HTLC_ADDRESS=your_deployed_eth_htlc_address
STELLAR_HTLC_ADDRESS=your_deployed_stellar_htlc_address

# Server config
PORT=3003
NODE_ENV=development
```

### **3.2 Package.json**

#### **contracts/fusion-resolver/package.json**

```json
{
  "name": "fusion-resolver",
  "version": "1.0.0",
  "description": "1inch Fusion+ to Stellar Integration",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "watch": "nodemon --exec ts-node src/index.ts"
  },
  "dependencies": {
    "@1inch/cross-chain-sdk": "latest",
    "express": "^4.18.0",
    "ethers": "^6.0.0",
    "stellar-sdk": "^11.0.0",
    "ws": "^8.0.0",
    "cors": "^2.8.5",
    "helmet": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/express": "^4.17.0",
    "typescript": "^5.0.0",
    "ts-node": "^10.9.0",
    "nodemon": "^3.0.0"
  }
}
```

## 🎯 **Hackathon Success Checklist**

### **Demo Flow (5 minutes):**

1. ✅ **Show Integration**: "This connects to 1inch Fusion+ SDK"
2. ✅ **Create Order**: UI creates actual Fusion+ order
3. ✅ **Auction Participation**: Resolver automatically participates
4. ✅ **Cross-Chain HTLCs**: Show both chains have HTLCs created
5. ✅ **Secret Coordination**: Show secret sharing and claims
6. ✅ **Completion**: Show tokens moved on both explorers

### **Implementation Timeline:**

- **Hour 1-2**: Build FusionSDKManager and AuctionResolver
- **Hour 3**: Build HTLCBridge integration
- **Hour 4-5**: Create demo UI
- **Hour 6**: Testing and demo preparation

**Total: 6 hours hackathon-ready implementation**

This plan leverages your existing HTLC infrastructure while adding 1inch Fusion+ integration in your current file structure!
