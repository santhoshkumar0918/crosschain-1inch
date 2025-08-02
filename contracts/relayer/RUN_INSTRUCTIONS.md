# 🚀 How to Run the Cross-Chain HTLC Relayer

## Prerequisites

Before running the relayer, ensure you have:

- ✅ Node.js 18+ installed
- ✅ npm or yarn package manager
- ✅ Access to Ethereum RPC endpoint (local or remote)
- ✅ Access to Stellar Horizon endpoint
- ✅ Deployed HTLC contracts on both chains
- ✅ Private keys for both chains

## Step-by-Step Setup

### 1. Navigate to Relayer Directory

```bash
wsl
cd contracts/relayer
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Setup Script

```bash
npm run setup
```

This will:
- Create necessary directories (`logs`, `dist`)
- Copy `.env.example` to `.env`

### 4. Configure Environment

Edit the `.env` file with your actual configuration:

```bash
# Use your preferred editor
nano .env
# or
code .env
```

**Required Configuration:**

```env
# Environment
NODE_ENV=development
PORT=3000

# Ethereum Configuration (UPDATE THESE!)
ETHEREUM_RPC_URL=http://localhost:8545
ETHEREUM_PRIVATE_KEY=your_actual_ethereum_private_key_64_chars
ETHEREUM_CONTRACT_ADDRESS=0xYourActualHTLCContractAddress
ETHEREUM_NETWORK_ID=1337

# Stellar Configuration (UPDATE THESE!)
STELLAR_NETWORK_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
STELLAR_CONTRACT_ID=CXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Security (UPDATE THIS!)
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters_long
API_RATE_LIMIT=100

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

### 5. Build the Project

```bash
npm run build
```

### 6. Start the Relayer

**Production Mode:**
```bash
npm start
```

**Development Mode (with hot reload):**
```bash
npm run dev
```

## 🎯 Testing the Relayer

### Option 1: Quick API Test

In a new terminal window:

```bash
wsl
cd contracts/relayer
npm run test-api
```

This will test all API endpoints and WebSocket connections.

### Option 2: Manual Testing

**Health Check:**
```bash
curl http://localhost:3000/api/health
```

**Get Status:**
```bash
curl http://localhost:3000/api/status
```

**Get Active Orders:**
```bash
curl http://localhost:3000/api/orders
```

**WebSocket Test:**
```bash
# Install wscat if you don't have it
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:3000

# Send subscription message
{"type":"subscribe","subscriptions":["all"]}

# Send ping
{"type":"ping"}
```

## 📊 Expected Output

When the relayer starts successfully, you should see:

```
🚀 Initializing Cross-Chain HTLC Relayer...
✓ Connected to Ethereum network: localhost (1337)
✓ Connected to Stellar network
📡 Starting Ethereum monitoring from block 12345
📡 Starting Stellar monitoring from ledger 67890
📡 Starting cross-chain event monitoring...
✅ Cross-chain event monitoring started
⏰ Periodic tasks started
🌐 Relayer API listening on port 3000
📡 WebSocket server initialized
🎉 Cross-Chain HTLC Relayer is running!
📊 API Server: http://localhost:3000
📡 WebSocket: ws://localhost:3000
📈 Health Check: http://localhost:3000/api/health
```

## 🔧 Configuration Examples

### Local Development Setup

```env
# For local Hardhat/Ganache
ETHEREUM_RPC_URL=http://localhost:8545
ETHEREUM_NETWORK_ID=1337

# For Stellar testnet
STELLAR_NETWORK_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

### Testnet Setup

```env
# Ethereum Sepolia testnet
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
ETHEREUM_NETWORK_ID=11155111

# Stellar testnet
STELLAR_NETWORK_URL=https://horizon-testnet.stellar.org
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015
```

## 🐛 Troubleshooting

### Common Issues

**1. "Config validation error"**
- Check that all required environment variables are set
- Ensure private keys are the correct length (64 chars for Ethereum, 56 for Stellar)
- Verify contract addresses are valid

**2. "Failed to connect to Ethereum/Stellar"**
- Check RPC URLs are accessible
- Verify network connectivity
- Ensure private keys have sufficient balance for gas

**3. "Port already in use"**
- Change the PORT in .env file
- Or kill the process using the port: `lsof -ti:3000 | xargs kill -9`

**4. "Module not found" errors**
- Run `npm install` again
- Delete `node_modules` and `package-lock.json`, then `npm install`

### Debug Mode

For more detailed logging, set:

```env
LOG_LEVEL=debug
```

### Checking Logs

Logs are written to:
- Console output (in development)
- `logs/combined.log` (all logs)
- `logs/error.log` (errors only)

```bash
# Watch logs in real-time
tail -f logs/combined.log
```

## 🔄 Stopping the Relayer

**Graceful Shutdown:**
- Press `Ctrl+C` in the terminal
- The relayer will shut down gracefully, closing connections and cleaning up

**Force Stop:**
```bash
# Find the process
ps aux | grep node

# Kill it
kill -9 <process_id>
```

## 📈 Monitoring

### API Endpoints for Monitoring

- `GET /api/health` - Basic health check
- `GET /api/status` - Detailed relayer status
- `GET /api/stats` - Order statistics

### WebSocket Events

Connect to `ws://localhost:3000` to receive real-time events:

- `orderCreated` - New order created
- `escrowCreated` - Escrow created on chain
- `secretRevealed` - Secret revealed
- `swapCompleted` - Atomic swap completed
- `chainError` - Chain connection issues

## 🚀 Production Deployment

For production deployment:

1. **Set NODE_ENV=production**
2. **Use secure private key management**
3. **Set up proper logging**
4. **Configure reverse proxy (nginx)**
5. **Set up monitoring and alerts**
6. **Use process manager (PM2)**

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name htlc-relayer

# Monitor
pm2 monit
```

## 🎉 Success!

If everything is working correctly, you should be able to:

1. ✅ See the relayer start without errors
2. ✅ Access the health check endpoint
3. ✅ Connect via WebSocket
4. ✅ Create and monitor orders
5. ✅ See real-time events from both chains

The relayer is now ready to facilitate cross-chain atomic swaps between Ethereum and Stellar!

---

**Need Help?**
- Check the logs for detailed error messages
- Verify your contract deployments are working
- Ensure your RPC endpoints are accessible
- Test with small amounts first