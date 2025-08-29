// app/page.tsx
"use client";

import { WalletConnect } from "@/components/WalletConnect";
import { FusionSwap } from "@/components/FusionSwap";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-5xl font-bold tracking-tighter bg-gradient-to-r from-blue-600 via-purple-600 to-blue-600 bg-clip-text text-transparent">
            Cross-Chain Fusion+
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The first 1inch Fusion+ extension to Stellar. Enabling atomic swaps
            between Ethereum and Stellar networks.
          </p>
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span>Ethereum Sepolia</span>
            </div>
            <span>⇌</span>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span>Stellar Testnet</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="wallets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="wallets">Wallets</TabsTrigger>
            <TabsTrigger value="swap">Swap</TabsTrigger>
          </TabsList>

          <div className="mt-8">
            <TabsContent value="wallets">
              <WalletConnect />
            </TabsContent>

            <TabsContent value="swap">
              <FusionSwap />
            </TabsContent>
          </div>
        </Tabs>

        {/* Features Section */}
        <div className="mt-16 grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-semibold">Atomic Swaps</h3>
              <p className="text-sm text-muted-foreground">
                Trustless cross-chain swaps with mathematical guarantees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">🏆</span>
              </div>
              <h3 className="font-semibold">Dutch Auctions</h3>
              <p className="text-sm text-muted-foreground">
                Competitive pricing through time-based auction mechanism
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center space-y-2">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="font-semibold">HTLC Security</h3>
              <p className="text-sm text-muted-foreground">
                Hash Time Locked Contracts ensure secure escrow operations
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
