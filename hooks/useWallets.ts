// hooks/useWallets.ts
"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  isConnected,
  requestAccess,
  getNetworkDetails,
  getAddress,
} from "@stellar/freighter-api";

export interface WalletState {
  ethereum: {
    connected: boolean;
    address: string | null;
    provider: ethers.BrowserProvider | null;
    chainId: number | null;
    network: string | null;
    balance?: string;
  };
  stellar: {
    connected: boolean;
    address: string | null;
    network: string | null;
    balance?: string;
  };
}

export function useWallets() {
  const [wallets, setWallets] = useState<WalletState>({
    ethereum: {
      connected: false,
      address: null,
      provider: null,
      chainId: null,
      network: null,
    },
    stellar: {
      connected: false,
      address: null,
      network: null,
    },
  });

  // Connect Ethereum (MetaMask)
  const connectEthereum = async () => {
    try {
      if (!window.ethereum) {
        throw new Error(
          "MetaMask is not installed. Please install MetaMask and try again."
        );
      }

      const provider = new ethers.BrowserProvider(window.ethereum);

      // Request account access
      try {
        await provider.send("eth_requestAccounts", []);
      } catch (error: any) {
        if (error.code === 4001) {
          throw new Error(
            "Connection rejected by user. Please approve the connection request."
          );
        }
        throw new Error("Failed to connect to MetaMask. Please try again.");
      }

      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      const network = await provider.getNetwork();
      const chainId = Number(network.chainId);

      // Switch to Sepolia if not already
      if (chainId !== 11155111) {
        try {
          await window.ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xaa36a7" }], // Sepolia
          });

          // Refresh network info after switch
          const newNetwork = await provider.getNetwork();
          const newChainId = Number(newNetwork.chainId);

          if (newChainId !== 11155111) {
            throw new Error("Failed to switch to Sepolia network");
          }
        } catch (switchError: any) {
          // Add Sepolia if not exists
          if (switchError.code === 4902) {
            try {
              await window.ethereum.request({
                method: "wallet_addEthereumChain",
                params: [
                  {
                    chainId: "0xaa36a7",
                    chainName: "Sepolia Testnet",
                    nativeCurrency: {
                      name: "ETH",
                      symbol: "ETH",
                      decimals: 18,
                    },
                    rpcUrls: [
                      "https://sepolia.infura.io/v3/b62376a5884742bdae66f24565bc5a94",
                    ],
                    blockExplorerUrls: ["https://sepolia.etherscan.io/"],
                  },
                ],
              });
            } catch (addError: any) {
              throw new Error(
                "Failed to add Sepolia network. Please add it manually in MetaMask."
              );
            }
          } else if (switchError.code === 4001) {
            throw new Error(
              "Network switch rejected by user. Please switch to Sepolia testnet manually."
            );
          } else {
            throw new Error(
              "Failed to switch to Sepolia network. Please switch manually in MetaMask."
            );
          }
        }
      }

      // Get balance
      let balance = "0";
      try {
        const balanceWei = await provider.getBalance(address);
        balance = ethers.formatEther(balanceWei);
      } catch (error) {
        console.warn("Failed to fetch balance:", error);
      }

      setWallets((prev) => ({
        ...prev,
        ethereum: {
          connected: true,
          address,
          provider,
          chainId: 11155111,
          network: "Sepolia Testnet",
          balance,
        },
      }));

      return { success: true, address, balance };
    } catch (error: any) {
      console.error("Ethereum connection failed:", error);

      // Reset ethereum state on error
      setWallets((prev) => ({
        ...prev,
        ethereum: {
          connected: false,
          address: null,
          provider: null,
          chainId: null,
          network: null,
          balance: undefined,
        },
      }));

      return { success: false, error: error.message };
    }
  };

  // Connect Stellar (Freighter)
  const connectStellar = async () => {
    try {
      console.log("🚀 Starting Freighter connection...");

      // Check if Freighter is available
      try {
        const connected = await isConnected();
        console.log("📡 Freighter isConnected result:", connected);
      } catch (error) {
        console.error("❌ Freighter not available:", error);
        throw new Error(
          "Freighter wallet is not installed or not available. Please install Freighter extension and refresh the page."
        );
      }

      // Request access (this should open Freighter popup)
      console.log("🔑 Requesting Freighter access...");
      try {
        await requestAccess();
        console.log("✅ Freighter access granted");
      } catch (error: any) {
        console.error("❌ requestAccess error:", error);
        if (error.message?.includes("User declined access")) {
          throw new Error(
            "Connection rejected by user. Please approve the connection request."
          );
        }
        throw new Error(
          "Failed to get permission from Freighter. Please try again."
        );
      }

      // Get address
      console.log("🔐 Getting address from Freighter...");
      let publicKey: string;
      try {
        const result = await getAddress();
        publicKey = result.address;
        console.log("🎯 Got address:", publicKey ? "✓" : "✗");
        if (!publicKey) {
          throw new Error("No address returned from Freighter");
        }
      } catch (error: any) {
        console.error("❌ getAddress error:", error);

        // More specific error messages based on the error
        if (error.message?.includes("User declined")) {
          throw new Error(
            "Connection rejected by user. Please approve the connection request."
          );
        } else if (error.message?.includes("locked")) {
          throw new Error(
            "Freighter wallet is locked. Please unlock your wallet and try again."
          );
        } else {
          throw new Error(
            "Failed to connect to Freighter. Please ensure Freighter is installed, unlocked, and try again."
          );
        }
      }

      // Get network details
      let networkDetails: any;
      try {
        networkDetails = await getNetworkDetails();
      } catch (error) {
        console.warn("Failed to get network details, assuming testnet");
        networkDetails = { network: "TESTNET" };
      }

      // Validate network
      if (networkDetails.network !== "TESTNET") {
        throw new Error(
          "Please switch to Stellar Testnet in Freighter wallet settings."
        );
      }

      // Get balance
      let balance = "0";
      try {
        const response = await fetch(
          `https://horizon-testnet.stellar.org/accounts/${publicKey}`
        );
        if (response.ok) {
          const accountData = await response.json();
          const nativeBalance = accountData.balances?.find(
            (b: any) => b.asset_type === "native"
          );
          balance = nativeBalance
            ? parseFloat(nativeBalance.balance).toFixed(2)
            : "0";
        }
      } catch (error) {
        console.warn("Failed to fetch Stellar balance:", error);
      }

      setWallets((prev) => ({
        ...prev,
        stellar: {
          connected: true,
          address: publicKey,
          network: "Stellar Testnet",
          balance,
        },
      }));

      return { success: true, address: publicKey, balance };
    } catch (error: any) {
      console.error("Stellar connection failed:", error);

      // Reset stellar state on error
      setWallets((prev) => ({
        ...prev,
        stellar: {
          connected: false,
          address: null,
          network: null,
          balance: undefined,
        },
      }));

      return { success: false, error: error.message };
    }
  };

  // Disconnect wallets
  const disconnectEthereum = () => {
    setWallets((prev) => ({
      ...prev,
      ethereum: {
        connected: false,
        address: null,
        provider: null,
        chainId: null,
        network: null,
      },
    }));
  };

  const disconnectStellar = () => {
    setWallets((prev) => ({
      ...prev,
      stellar: {
        connected: false,
        address: null,
        network: null,
      },
    }));
  };

  // Auto-reconnect on page load
  useEffect(() => {
    const autoConnect = async () => {
      // Check MetaMask
      if (window.ethereum) {
        try {
          const provider = new ethers.BrowserProvider(window.ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            await connectEthereum();
          }
        } catch (error) {
          console.log("MetaMask auto-connect failed");
        }
      }

      // Check Freighter
      try {
        const isFreighterConnected = await isConnected();
        if (isFreighterConnected) {
          await connectStellar();
        }
      } catch (error) {
        console.log("Freighter auto-connect failed");
      }
    };

    autoConnect();
  }, []);

  return {
    wallets,
    connectEthereum,
    connectStellar,
    disconnectEthereum,
    disconnectStellar,
  };
}
