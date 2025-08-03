# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a cross-chain atomic swap solution enabling trustless swaps between Ethereum and Stellar, designed for the 1inch Fusion+ protocol. It uses Hash Time Locked Contracts (HTLC) for secure, bidirectional token swaps without central custody.

## Development Commands

### Root Project (Next.js Frontend)
```bash
npm run dev          # Start Next.js development server
npm run build        # Build the frontend application
npm start            # Start production server
```

### Relayer Service (contracts/relayer/)
```bash
npm run setup        # Initial setup for relayer
npm run build        # Compile TypeScript to JavaScript
npm run start        # Start relayer in production
npm run dev          # Start relayer in development mode
npm run test         # Run Jest tests
npm run test-api     # Test API endpoints
npm run fund-stellar # Fund Stellar account for testing
npm run lint         # Run ESLint on TypeScript files
```

### Fusion Resolver (contracts/fusion-resolver/)
```bash
npm run build        # Compile TypeScript
npm run start        # Start resolver in production
npm run dev          # Start resolver in development
npm run watch        # Start with nodemon auto-reload
npm run test         # Run Jest tests
npm run clean        # Remove dist directory
```

### Ethereum Contracts (contracts/ethereum/)
```bash
npm run compile      # Compile Solidity contracts with Hardhat
npm run test         # Run Hardhat tests
npm run deploy:sepolia    # Deploy to Sepolia testnet
npm run verify:sepolia    # Verify contract on Sepolia
```

### Stellar Contracts (contracts/stellar/stellar-htlc/)
```bash
cargo build          # Build Rust contract
cargo test           # Run contract tests
make deploy          # Deploy to Stellar testnet (if Makefile exists)
```

## Architecture

### Core Components
- **Frontend (Root)**: Next.js app with wallet integration (MetaMask, Freighter)
- **Relayer**: Node.js service monitoring both chains and propagating secrets
- **Fusion Resolver**: Liquidity provider implementing 1inch Fusion+ compatibility
- **Ethereum HTLC**: Solidity contract for ETH/ERC-20 token locking
- **Stellar HTLC**: Rust/Soroban contract for XLM/Stellar asset locking

### Key Technologies
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS, Radix UI
- **Blockchain**: Ethereum (Hardhat, ethers.js), Stellar (Soroban, stellar-sdk)
- **Backend**: Express.js, Winston logging, WebSockets
- **Testing**: Jest, Hardhat test suite

### Cross-Chain Flow
1. User initiates swap via frontend
2. Order sent to resolvers (instant or Dutch auction)
3. HTLC contracts lock tokens on both chains with same secret hash
4. Secret revealed when claiming, enabling counterparty to claim on other chain
5. Timelock allows refunds if swap fails

## Important Files and Patterns

### Contract Events
Both HTLC contracts emit structured events for relayer monitoring:
- `NEW_HTLC`: When contracts are created
- `CLAIM`: When secrets are revealed and tokens claimed
- `REFUND`: When timelock expires and funds are refunded

### Environment Configuration
- Root `.env.local` for frontend configuration
- Each service has its own environment setup
- Stellar and Ethereum testnet configurations required

### Security Considerations
- All contracts use proper authorization checks
- Hashlock enforcement (32-byte SHA-256)
- Timelock protection against infinite locks
- Replay attack prevention
- Event logging for audit trails

### Testing Strategy
- Unit tests for all contract functions
- Integration tests for cross-chain flows
- API endpoint testing for relayer
- Happy path and edge case coverage

## Common Development Patterns

### Error Handling
- Contracts use custom errors for gas efficiency
- Services use Winston for structured logging
- Frontend uses proper error boundaries

### State Management
- HTLC contracts use status enums
- Frontend uses React state and context
- Relayer maintains in-memory state with persistence

### Integration Points
- 1inch SDK integration in resolver
- Wallet connectors (wagmi, @stellar/freighter-api)
- Cross-chain event synchronization

## Deployment Notes

### Testnet Deployment
- Ethereum: Sepolia testnet
- Stellar: Futurenet/Testnet
- Requires funded accounts for gas/fees

### Environment Variables
- Ethereum RPC endpoints and private keys
- Stellar Horizon server URLs and keypairs
- API keys for various services