## Full Guided README Explanation for the Entire Project

Below is a detailed, onboarding-focused README style explanation that you can include at the root of your repo. It outlines the architecture, components, flows, and special notes for hackathon judges, contributors, and users.

# ETH ↔ Stellar Atomic Swap via 1inch Fusion+

## Overview

This project is a **cross-chain, trustless atomic swap solution** enabling seamless swaps between Ethereum and Stellar, designed for the 1inch Fusion+ protocol/hackathon.  
It enables users to swap ETH/ERC-20 tokens ↔ XLM/Soroban assets without central custody, preserving key DEX features:

- **Hashlock & Timelock escrow (HTLC)**
- **Bidirectional swapping (ETH→Stellar and Stellar→ETH)**
- **Onchain (testnet or mainnet) execution and validation**
- **Extendable for Dutch-auction, partial fill, and UI**

## Architecture

### Components

| Layer      | Component                 | Description                                      |
| ---------- | ------------------------- | ------------------------------------------------ |
| Blockchain | ETH HTLC (Solidity)       | Locks tokens on Ethereum with hashlock/timelock  |
|            | Soroban HTLC (Rust)       | Locks XLM or token on Stellar with hashlock/time |
| Off-Chain  | Relayer (Node/TypeScript) | Watches both chains, relays events/secrets       |
|            | Resolver                  | Provides liquidity, participates in auctions     |
| Front-end  | Next.js + TypeScript App  | User interaction (swap order, status, wallet)    |

### Cross-Chain Flow (Step-by-Step)

1. **Swap Initialization:**  
   User requests a swap (ETH→XLM or XLM→ETH) via frontend.
2. **Order Broadcast:**  
   Order is sent to resolvers—can be instant-match or Dutch auction (1inch Fusion+ style).
3. **HTLC Creation:**
   - Resolver (liquidity provider) locks tokens in a new HTLC on both ETH and Stellar, using the same secret hash.
   - Events (`NEW_HTLC`) are emitted on both chains for relayer to monitor.
4. **Claim/Secret Reveal:**
   - Once both chains are locked, secret is revealed (typically by the original party claiming their output).
   - Relayer propagates the secret to the other chain so the counterparty can claim their tokens.
   - Events (`CLAIM`) signal swap completion.
5. **Refund:**
   - If something goes wrong (e.g. not claimed in time), timelock allows refund. Sender can reclaim via `REFUND` function after expiry.

## Requirements and Hackathon Alignment

- **Hashlock and Timelock Preservation:**  
  Both Solidity and Soroban contracts enforce strict secret/timestamp checks with event logs for auditing and relayer sync.
- **Bidirectional Swaps:**  
  Workflow and contracts are symmetrical (ETH→Stellar and Stellar→ETH).
- **Onchain Demo:**  
  Tester scripts and UI instructions guide live token transfer on Sepolia and Stellar testnets.
- **Full Event-Driven Architecture:**  
  All actions can be confirmed on-chain and viewed via testnet blockchain explorers.
- **Relayer-First Design:**  
  Contracts emit detailed events and use deterministic IDs, making off-chain monitoring and auction resolving simple.
- **Security/Audit Ready:**  
  Best practices on both chains (auth checks, status enums, replay protection, minimal code surface, events for every state transition).

**Stretch Goals:**

- UI for swap creation/tracking (Next.js app)
- Partial fill support (not core, but possible via contract extension)

## Project Structure

```
cross-chain-swap/
├─ contracts/
│  ├─ ethereum/
│  │   └─ EthHTLC.sol    # Solidity contract, audited/tested
│  └─ stellar/
│      └─ stellar-htlc/  # Soroban (Rust) HTLC, event-rich & tested
├─ packages/
│  ├─ relayer/           # Observes both chains, bridges secrets
│  └─ resolver/          # Market making/liquidity for Dutch auctions
├─ apps/
│  └─ web/               # Next.js (TS) front-end for demos
├─ shared/
│  └─ types/             # TypeScript types and utils
├─ .env.local, README.md, etc
```

## How to Use

1. **Deploy ETH HTLC (Solidity) on Sepolia.**
2. **Deploy Soroban HTLC on Stellar testnet.**
3. **Start the relayer service (Node.js), link both contract addresses/IDs.**
4. **Run/test UI for end-to-end atomic swaps:**
   - Connect ETH (MetaMask) and Stellar (Freighter) wallets
   - Create demo swap requests and watch on-chain status

## Security, Testing, and Best Practices

- All core flows (claim/refund, wrong secret, replay) are covered in contract tests.
- Custom errors/enums for gas, clarity, and replay protection.
- Full event logs for demo, audit, and off-chain sync.
- Swap IDs based on contract + key parameters for uniqueness.

## Integration Notes

- 1inch SDK and Fusion+ auction flow can be integrated directly in the resolver for advanced liquidity matching.
- Partial fill and ERC-20/custom token support are extendable (see advanced contract variants).
- UI and relayer can easily be upgraded as requirements grow or partners join.

## Further Reading

- [1inch Fusion+ Docs & API](https://docs.1inch.dev/fusion/)
- [Stellar Soroban Contract Guide](https://soroban.stellar.org/docs/learn/)
- [ETHGlobal Hackathon Track](https://ethglobal.com/events/)
- [Cross-Chain Security Patterns](https://chainsecurity.com/research/)

Stellar Soroban HTLC Contract Requirements & Prompt
Functional/Design Requirements

1. Hashlock & Timelock Enforcement

   Lock XLM or any supported Soroban asset for a recipient using a 32-byte SHA-256 hashlock and a timelock (unix timestamp)

   Only the recipient can claim by revealing the preimage (secret) before expiry

   Only the sender can refund after expiry, if funds are unclaimed

2. Bidirectional Swaps

   Everything must work both Stellar→Ethereum and Ethereum→Stellar, mirroring the ETH-side HTLC

3. Event Emissions for Relayer

   Emit clear events: NEW_HTLC, CLAIM, REFUND, including contract ID and involved addresses for off-chain relayer/resolver to track and synchronize secrets

4. Robust State Machine

   Prevent double claims/refunds; include a status enum and halt all operations if the state isn't correct

5. Security Best Practices

   Require auth for sender/receiver

   Panic on invalid conditions (e.g., wrong secret, re-claim, refund before expiry)

   Enforce preimage length (32 bytes), check hash match, check timestamps

6. Modularity/Flexibility

   Support both native XLM and Soroban asset contracts (simple extension)

   Clean, commented code for quick audit and modification

   Stateless, with contract state stored by unique escrow/swap ID

7. Testing

   Include a Rust test module for: happy claim, refund, wrong secret, replay attacks

8. On-chain Execution

   Contract must be deployable/testable on Stellar testnet, seamless for final demo

Stretch Goals (Optional)
UI Integration

    Clear contract methods for web relayer/frontend to interact

Partial Fills

    Design contract to optionally support partial claim/refund (not required)

Integration/UX Notes

    1inch Fusion Compatibility: Contract should be "resolver-friendly" (resolvers can watch events, claim/refund as needed)

    Secret Propagation: Seamless secret propagation and refunds via off-chain relayer

    EVM Parity: Bridge hashlock/timelock semantics 1:1 with EVM side—users get the same guarantees
