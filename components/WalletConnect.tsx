// components/WalletConnect.tsx
"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Wallet, ExternalLink, Copy, Check } from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { useState } from "react";
import { toast } from "sonner";

export function WalletConnect() {
  const {
    wallets,
    connectEthereum,
    connectStellar,
    disconnectEthereum,
    disconnectStellar,
  } = useWallets();
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const copyAddress = async (address: string, wallet: string) => {
    await navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success(`${wallet} address copied!`);

    setTimeout(() => setCopiedAddress(null), 2000);
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold tracking-tighter">
          Connect Your Wallets
        </h2>
        <p className="text-muted-foreground">
          Connect both Ethereum and Stellar wallets for cross-chain atomic swaps
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Ethereum Wallet */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />

          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                Ethereum
              </CardTitle>
              <Badge
                variant={wallets.ethereum.connected ? "success" : "secondary"}
              >
                {wallets.ethereum.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <CardDescription>
              Connect MetaMask for Ethereum Sepolia testnet operations
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {wallets.ethereum.connected ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Address
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyAddress(wallets.ethereum.address!, "Ethereum")
                      }
                      className="h-auto p-1"
                    >
                      {copiedAddress === wallets.ethereum.address ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-sm">
                    {truncateAddress(wallets.ethereum.address!)}
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">
                    Network
                  </span>
                  <p className="text-sm mt-1">{wallets.ethereum.network}</p>
                </div>

                {wallets.ethereum.balance && (
                  <div className="p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">
                      Balance
                    </span>
                    <p className="text-sm mt-1 font-mono">
                      {parseFloat(wallets.ethereum.balance).toFixed(4)} ETH
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectEthereum}
                    className="flex-1"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://sepolia.etherscan.io/address/${wallets.ethereum.address}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={connectEthereum} className="w-full" size="lg">
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect MetaMask
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Make sure you have MetaMask installed and are on Sepolia
                  testnet
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stellar Wallet */}
        <Card className="relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-pink-500" />

          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Wallet className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                Stellar
              </CardTitle>
              <Badge
                variant={wallets.stellar.connected ? "success" : "secondary"}
              >
                {wallets.stellar.connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
            <CardDescription>
              Connect Freighter for Stellar testnet operations
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {wallets.stellar.connected ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Address
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        copyAddress(wallets.stellar.address!, "Stellar")
                      }
                      className="h-auto p-1"
                    >
                      {copiedAddress === wallets.stellar.address ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="font-mono text-sm">
                    {truncateAddress(wallets.stellar.address!)}
                  </p>
                </div>

                <div className="p-3 bg-muted rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground">
                    Network
                  </span>
                  <p className="text-sm mt-1">{wallets.stellar.network}</p>
                </div>

                {wallets.stellar.balance && (
                  <div className="p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium text-muted-foreground">
                      Balance
                    </span>
                    <p className="text-sm mt-1 font-mono">
                      {parseFloat(wallets.stellar.balance).toFixed(2)} XLM
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={disconnectStellar}
                    className="flex-1"
                  >
                    Disconnect
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.open(
                        `https://stellar.expert/explorer/testnet/account/${wallets.stellar.address}`,
                        "_blank"
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Button onClick={connectStellar} className="w-full" size="lg">
                  <Wallet className="h-4 w-4 mr-2" />
                  Connect Freighter
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Make sure you have Freighter installed and are on testnet
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connection Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4">
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                wallets.ethereum.connected
                  ? "bg-green-100 dark:bg-green-900"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  wallets.ethereum.connected ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium">Ethereum</span>
            </div>

            <Separator orientation="vertical" className="h-6" />

            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                wallets.stellar.connected
                  ? "bg-green-100 dark:bg-green-900"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              <div
                className={`h-2 w-2 rounded-full ${
                  wallets.stellar.connected ? "bg-green-500" : "bg-gray-400"
                }`}
              />
              <span className="text-sm font-medium">Stellar</span>
            </div>
          </div>

          {wallets.ethereum.connected && wallets.stellar.connected && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 text-center">
                ✨ Ready for cross-chain atomic swaps!
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
