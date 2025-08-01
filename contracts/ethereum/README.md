# Ethereum HTLC Contract

Production-ready Ethereum HTLC (Hash Time-Locked Contract) for cross-chain atomic swaps with Stellar blockchain, following 1inch Fusion+ pattern.

## Features

- **Hash Time-Locked Contracts (HTLC)**: Secure atomic swaps using hashlock and timelock mechanisms
- **Cross-Chain Compatible**: Designed to work with Stellar blockchain HTLC contracts
- **Safety Deposits**: Additional security layer following 1inch Fusion+ pattern
- **ETH and ERC20 Support**: Works with native ETH and any ERC20 token
- **Gas Optimized**: Uses custom errors and optimized storage patterns
- **Reentrancy Protection**: Built-in security against reentrancy attacks

## Contract Architecture

### Core Functions

1. **createHTLC**: Creates a new HTLC with specified parameters
2. **withdraw**: Allows receiver to claim funds by revealing the secret
3. **refund**: Allows sender to reclaim funds after timelock expiry
4. **getHTLC**: Returns complete HTLC data
5. **contractExists**: Checks if an HTLC exists
6. **getStatus**: Returns current HTLC status

### HTLC Lifecycle

```
1. Sender creates HTLC with hashlock and timelock
2. Funds are locked in the contract
3. Receiver can withdraw by revealing the preimage (before timelock)
4. Sender can refund after timelock expiry (if not withdrawn)
```

## Setup and Installation

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- MetaMask wallet
- Sepolia testnet ETH

### Installation

```bash
cd contracts/ethereum
npm install
```

### Environment Configuration

1. Copy the environment template:
```bash
cp .env.example .env
```

2. Fill in your configuration:
```env
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_PROJECT_ID
PRIVATE_KEY=your_private_key_without_0x_prefix
ETHERSCAN_API_KEY=your_etherscan_api_key
```

## MetaMask Setup for Sepolia

### 1. Add Sepolia Network to MetaMask

1. Open MetaMask and click on the network dropdown
2. Click "Add Network" or "Custom RPC"
3. Enter the following details:

```
Network Name: Sepolia Test Network
New RPC URL: https://sepolia.infura.io/v3/YOUR_INFURA_KEY
Chain ID: 11155111
Currency Symbol: ETH
Block Explorer URL: https://sepolia.etherscan.io
```

### 2. Get Sepolia Test ETH

Visit one of these faucets to get test ETH:
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Alchemy Sepolia Faucet](https://sepoliafaucet.com/)
- [Infura Sepolia Faucet](https://www.infura.io/faucet/sepolia)

### 3. Export Private Key

1. In MetaMask, click on the account menu (three dots)
2. Select "Account Details"
3. Click "Export Private Key"
4. Enter your password and copy the private key
5. Add it to your `.env` file (without the 0x prefix)

## Compilation and Testing

### Compile Contracts

```bash
npm run compile
```

### Run Tests

```bash
npm test
```

### Run Tests with Gas Report

```bash
REPORT_GAS=true npm test
```

## Deployment to Sepolia

### 1. Deploy Contract

```bash
npm run deploy:sepolia
```

This will:
- Deploy the HTLC contract to Sepolia
- Display the contract address
- Wait for block confirmations
- Show deployment details

### 2. Verify Contract (Optional)

After deployment, verify the contract on Etherscan:

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### 3. Interact with Contract

Update the contract address in `scripts/interact.ts` and run:

```bash
npx hardhat run scripts/interact.ts --network sepolia
```

## Usage Examples

### Creating an HTLC

```typescript
const secret = "0x1234..."; // 32-byte secret
const hashlock = ethers.keccak256(ethers.solidityPacked(["bytes32"], [secret]));
const amount = ethers.parseEther("1.0"); // 1 ETH
const safetyDeposit = ethers.parseEther("0.1"); // 0.1 ETH
const timelock = Math.floor(Date.now() / 1000) + 3600; // 1 hour

const tx = await htlc.createHTLC(
  receiverAddress,
  amount,
  ethers.ZeroAddress, // ETH (use token address for ERC20)
  hashlock,
  timelock,
  safetyDeposit,
  { value: amount + safetyDeposit }
);
```

### Withdrawing Funds

```typescript
await htlc.connect(receiver).withdraw(contractId, secret);
```

### Refunding After Expiry

```typescript
await htlc.connect(sender).refund(contractId);
```

## Cross-Chain Integration

This contract is designed to work with the Stellar HTLC contract for atomic swaps:

1. **Same Contract ID Generation**: Both contracts use compatible ID generation
2. **Same Hashlock**: Both contracts use SHA256 for hashlock validation
3. **Coordinated Timelocks**: Ethereum timelock should be shorter than Stellar
4. **Event Compatibility**: Events follow 1inch Fusion+ pattern for relayer integration

## Security Features

- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
- **Input Validation**: Comprehensive parameter validation
- **Custom Errors**: Gas-efficient error handling
- **Safety Deposits**: Additional security layer
- **Timelock Enforcement**: Strict timelock validation

## Gas Optimization

- Custom errors instead of require strings
- Optimized storage layout
- Efficient event emission
- Minimal external calls

## Testing

The test suite covers:
- HTLC creation with ETH and ERC20 tokens
- Successful withdrawals with correct preimage
- Failed withdrawals with wrong preimage or unauthorized access
- Refunds after timelock expiry
- Edge cases and error conditions
- Gas usage optimization

## Troubleshooting

### Common Issues

1. **Insufficient Balance**: Ensure you have enough ETH for gas + amount + safety deposit
2. **Invalid Timelock**: Timelock must be in the future
3. **Wrong Network**: Ensure MetaMask is connected to Sepolia
4. **Gas Estimation Failed**: Try increasing gas limit manually

### Debug Commands

```bash
# Check contract balance
npx hardhat console --network sepolia
> const htlc = await ethers.getContractAt("HTLC", "CONTRACT_ADDRESS")
> await htlc.getContractBalance(ethers.ZeroAddress)

# Check HTLC data
> await htlc.getHTLC("CONTRACT_ID")
```

## Contract Addresses

After deployment, your contract addresses will be:

- **Sepolia Testnet**: `<YOUR_DEPLOYED_ADDRESS>`
- **Block Explorer**: `https://sepolia.etherscan.io/address/<YOUR_DEPLOYED_ADDRESS>`

## License

MIT License - see LICENSE file for details.
