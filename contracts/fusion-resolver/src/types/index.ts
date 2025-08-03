// contracts/fusion-resolver/src/types/index.ts
export interface FusionOrder {
  orderHash: string;
  salt: string;
  maker: string;
  receiver: string;
  makerAsset: string;
  takerAsset: string;
  makingAmount: string;
  takingAmount: string;
  srcChainId: number | string;
  dstChainId: number | string;
  secretHashes: string[];
  auctionStartTime: number;
  auctionEndTime: number;
  timelock: number;
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
  currentPrice?: string;
  reservePrice?: string;
  htlcPair?: HTLCPair;
}

export type OrderStatus = 
  | 'pending'
  | 'active' 
  | 'auction_active'
  | 'htlc_created'
  | 'partially_filled'
  | 'filled'
  | 'expired' 
  | 'cancelled';

export interface HTLCPair {
  ethereumContractId: string;
  stellarContractId: string;
  secret: string;
  hashlock: string;
  timelock: number;
  status: 'pending' | 'both_created' | 'secret_revealed' | 'completed' | 'refunded';
}

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

export interface AuctionBid {
  bidder: string;
  price: string;
  timestamp: number;
  htlcAddress?: string;
}

export interface ResolverConfig {
  minProfitMargin: number;
  maxSlippage: number;
  auctionDuration: number;
  supportedChains: (number | string)[];
  supportedTokens: Record<string, string[]>;
}
