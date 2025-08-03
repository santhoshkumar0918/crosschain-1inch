// components/FusionSwap.tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowUpDown,
  Loader2,
  CheckCircle,
  Clock,
  ExternalLink,
} from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { toast } from "sonner";

interface Order {
  orderHash: string;
  status: string;
  currentPrice?: string;
  auctionEndTime: number;
  srcChain: string;
  dstChain: string;
  makingAmount: string;
  takingAmount: string;
}

export function FusionSwap() {
  const { wallets } = useWallets();
  const [swapDirection, setSwapDirection] = useState<
    "eth-to-stellar" | "stellar-to-eth"
  >("eth-to-stellar");
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<Order | null>(null);
  const [quote, setQuote] = useState<any>(null);

  // Get quote from your resolver
  const getQuote = async () => {
    if (!amount) return;

    try {
      const response = await fetch(
        "http://localhost:3003/api/fusion-plus/quote",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            srcChain: swapDirection === "eth-to-stellar" ? 11155111 : "stellar",
            dstChain: swapDirection === "eth-to-stellar" ? "stellar" : 11155111,
            srcToken:
              swapDirection === "eth-to-stellar"
                ? "0x3a7daFbf66d7F7ea5DE65059E1DB5C848255A6c9"
                : "CD6GOS4VLJK7Z7LPIVPDUOXEBXWRXAP7P2MMMLAQDT3ZYXHOIKF2MITE",
            dstToken:
              swapDirection === "eth-to-stellar"
                ? "CD6GOS4VLJK7Z7LPIVPDUOXEBXWRXAP7P2MMMLAQDT3ZYXHOIKF2MITE"
                : "0x3a7daFbf66d7F7ea5DE65059E1DB5C848255A6c9",
            amount:
              swapDirection === "eth-to-stellar"
                ? (parseFloat(amount) * 1e18).toString()
                : (parseFloat(amount) * 1e6).toString(),
            walletAddress:
              swapDirection === "eth-to-stellar"
                ? wallets.ethereum.address
                : wallets.stellar.address,
          }),
        }
      );

      const result = await response.json();
      if (result.success) {
        setQuote(result.quote);
      }
    } catch (error) {
      console.error("Quote failed:", error);
      toast.error("Failed to get quote");
    }
  };

  // Create swap order
  const createSwap = async () => {
    if (!wallets.ethereum.connected || !wallets.stellar.connected) {
      toast.error("Please connect both wallets first");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        "http://localhost:3003/api/fusion-plus/submit",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            maker:
              swapDirection === "eth-to-stellar"
                ? wallets.ethereum.address
                : wallets.stellar.address,
            receiver:
              swapDirection === "eth-to-stellar"
                ? wallets.stellar.address
                : wallets.ethereum.address,
            makerAsset:
              swapDirection === "eth-to-stellar"
                ? "0x3a7daFbf66d7F7ea5DE65059E1DB5C848255A6c9"
                : "CD6GOS4VLJK7Z7LPIVPDUOXEBXWRXAP7P2MMMLAQDT3ZYXHOIKF2MITE",
            takerAsset:
              swapDirection === "eth-to-stellar"
                ? "CD6GOS4VLJK7Z7LPIVPDUOXEBXWRXAP7P2MMMLAQDT3ZYXHOIKF2MITE"
                : "0x3a7daFbf66d7F7ea5DE65059E1DB5C848255A6c9",
            makingAmount:
              swapDirection === "eth-to-stellar"
                ? (parseFloat(amount) * 1e18).toString()
                : (parseFloat(amount) * 1e6).toString(),
            takingAmount: quote?.dstAmount || "0",
            srcChainId:
              swapDirection === "eth-to-stellar" ? 11155111 : "stellar",
            dstChainId:
              swapDirection === "eth-to-stellar" ? "stellar" : 11155111,
          }),
        }
      );

      const result = await response.json();

      if (result.success) {
        setCurrentOrder(result.order);
        toast.success("Cross-chain swap order created!");

        // Start monitoring the order
        monitorOrder(result.orderHash);
      } else {
        throw new Error(result.error || "Failed to create order");
      }
    } catch (error: any) {
      console.error("Swap creation failed:", error);
      toast.error(error.message || "Failed to create swap");
    } finally {
      setIsLoading(false);
    }
  };

  // Monitor order progress
  const monitorOrder = (orderHash: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(
          `http://localhost:3003/api/fusion-plus/orders/${orderHash}`
        );
        const result = await response.json();

        if (result.success && result.order) {
          setCurrentOrder(result.order);

          if (
            result.order.status === "filled" ||
            result.order.status === "expired"
          ) {
            clearInterval(interval);
            if (result.order.status === "filled") {
              toast.success("🎉 Atomic swap completed successfully!");
            }
          }
        }
      } catch (error) {
        console.error("Order monitoring failed:", error);
      }
    }, 5000); // Check every 5 seconds

    // Clear interval after 10 minutes
    setTimeout(() => clearInterval(interval), 600000);
  };

  // Auto-get quote when amount changes
  useEffect(() => {
    const timer = setTimeout(() => {
      if (amount && parseFloat(amount) > 0) {
        getQuote();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, swapDirection]);

  const flipDirection = () => {
    setSwapDirection((prev) =>
      prev === "eth-to-stellar" ? "stellar-to-eth" : "eth-to-stellar"
    );
    setAmount("");
    setQuote(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "auction_active":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "htlc_created":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "filled":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "expired":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const calculateTimeRemaining = (endTime: number) => {
    const remaining = endTime - Math.floor(Date.now() / 1000);
    return Math.max(0, remaining);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
          Fusion+ Cross-Chain Swap
        </h1>
        <p className="text-muted-foreground">
          Atomic swaps between Ethereum and Stellar using 1inch Fusion+
          architecture
        </p>
      </div>

      <Tabs defaultValue="swap" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="swap">Create Swap</TabsTrigger>
          <TabsTrigger value="monitor">Monitor Order</TabsTrigger>
        </TabsList>

        <TabsContent value="swap" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Chain Atomic Swap</CardTitle>
              <CardDescription>
                Swap tokens atomically between Ethereum Sepolia and Stellar
                Testnet
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Swap Direction */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <Label className="text-sm font-medium">From</Label>
                    <p className="text-lg font-semibold">
                      {swapDirection === "eth-to-stellar"
                        ? "Ethereum (ETH)"
                        : "Stellar (XLM)"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {swapDirection === "eth-to-stellar"
                        ? "Sepolia Testnet"
                        : "Stellar Testnet"}
                    </p>
                  </div>

                  <Button variant="outline" size="icon" onClick={flipDirection}>
                    <ArrowUpDown className="h-4 w-4" />
                  </Button>

                  <div className="space-y-1 text-right">
                    <Label className="text-sm font-medium">To</Label>
                    <p className="text-lg font-semibold">
                      {swapDirection === "eth-to-stellar"
                        ? "Stellar (XLM)"
                        : "Ethereum (ETH)"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {swapDirection === "eth-to-stellar"
                        ? "Stellar Testnet"
                        : "Sepolia Testnet"}
                    </p>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    placeholder={`Enter ${
                      swapDirection === "eth-to-stellar" ? "ETH" : "XLM"
                    } amount`}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="text-lg h-12"
                  />
                </div>

                {/* Quote Display */}
                {quote && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        You'll receive
                      </span>
                      <span className="font-medium">
                        {parseFloat(quote.dstAmount) /
                          (swapDirection === "eth-to-stellar"
                            ? 1e6
                            : 1e18)}{" "}
                        {swapDirection === "eth-to-stellar" ? "XLM" : "ETH"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Exchange rate
                      </span>
                      <span className="text-sm">
                        {parseFloat(quote.price).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Auction duration
                      </span>
                      <span className="text-sm">{quote.auctionDuration}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">
                        Estimated time
                      </span>
                      <span className="text-sm">
                        {Math.floor(quote.estimatedTime / 60)} minutes
                      </span>
                    </div>
                  </div>
                )}

                {/* Wallet Status Check */}
                {(!wallets.ethereum.connected ||
                  !wallets.stellar.connected) && (
                  <Alert>
                    <AlertDescription>
                      Please connect both Ethereum and Stellar wallets to
                      proceed with the swap.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Create Swap Button */}
                <Button
                  onClick={createSwap}
                  disabled={
                    !amount ||
                    parseFloat(amount) <= 0 ||
                    !wallets.ethereum.connected ||
                    !wallets.stellar.connected ||
                    isLoading
                  }
                  className="w-full h-12 text-lg"
                  size="lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating Swap...
                    </>
                  ) : (
                    "Create Atomic Swap"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="monitor" className="space-y-6">
          {currentOrder ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Order Status
                  <Badge className={getStatusColor(currentOrder.status)}>
                    {currentOrder.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Order Hash: {currentOrder.orderHash}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Progress Indicator */}
                {currentOrder.status === "auction_active" && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Dutch Auction Progress</span>
                      <span>
                        {formatTime(
                          calculateTimeRemaining(currentOrder.auctionEndTime)
                        )}
                      </span>
                    </div>
                    <Progress
                      value={
                        ((300 -
                          calculateTimeRemaining(currentOrder.auctionEndTime)) /
                          300) *
                        100
                      }
                      className="h-2"
                    />
                  </div>
                )}

                {/* Order Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Making Amount
                    </Label>
                    <p className="font-medium">
                      {parseFloat(currentOrder.makingAmount) / 1e18} ETH
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Taking Amount
                    </Label>
                    <p className="font-medium">
                      {parseFloat(currentOrder.takingAmount) / 1e6} XLM
                    </p>
                  </div>
                </div>

                {currentOrder.currentPrice && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="text-xs text-muted-foreground">
                      Current Auction Price
                    </Label>
                    <p className="font-medium">
                      {parseFloat(currentOrder.currentPrice).toFixed(2)}
                    </p>
                  </div>
                )}

                {/* Status Messages */}
                {currentOrder.status === "filled" && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800 dark:text-green-200">
                      🎉 Atomic swap completed successfully! Your tokens have
                      been transferred.
                    </AlertDescription>
                  </Alert>
                )}

                {currentOrder.status === "auction_active" && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Dutch auction is live. The price decreases over time to
                      find the best rate.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Explorer Links */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://sepolia.etherscan.io/tx/${currentOrder.orderHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Ethereum Explorer
                    </a>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${currentOrder.orderHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Stellar Explorer
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  No active orders. Create a swap to monitor its progress.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
