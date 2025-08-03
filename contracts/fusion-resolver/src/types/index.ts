// contracts/fusion-resolver/src/types/index.ts

export interface FusionOrder {
  orderHash: string;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  srcChainId: number | string;
  dstChainId: number | string;
  timelock: number;
  secretHashes?: string[];
  status: OrderStatus;
  createdAt: number;
  auctionStartTime: number;
  auctionEndTime: number;
  reservePrice?: string;
  currentPrice?: string;
  metadata?: Record<string, any>;
}

export type OrderStatus =
  | "pending"
  | "auction_active"
  | "htlc_created"
  | "filled"
  | "cancelled"
  | "expired"
  | "refunded";

export interface AuctionBid {
  bidder: string;
  price: string;
  timestamp: number;
  htlcAddress: string;
}

export interface HTLCPair {
  ethereumContractId: string;
  stellarContractId: string;
  secret: string;
  hashlock: string;
  timelock: number;
  status: HTLCStatus;
}

export type HTLCStatus =
  | "both_created"
  | "secret_revealed"
  | "completed"
  | "refunded";

export interface QuoteRequest {
  srcChain: number | string;
  dstChain: number | string;
  srcToken: string;
  dstToken: string;
  amount: string;
  walletAddress: string;
  slippage?: number;
}

export interface QuoteResponse {
  srcAmount: string;
  dstAmount: string;
  price: string;
  priceImpact: string;
  gasEstimate: string;
  auctionDuration: number;
  estimatedTime: number;
  route: SwapRoute[];
}

export interface SwapRoute {
  chain: string;
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  amountOut: string;
}

export interface OrderFilters {
  maker?: string;
  srcChain?: string | number;
  dstChain?: string | number;
  status?: OrderStatus;
}

export interface OrderStats {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
  expired: number;
  totalVolume: string;
}

export interface CreateOrderParams {
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  srcChainId: number | string;
  dstChainId: number | string;
  timelock?: number;
  secretHashes?: string[];
}
