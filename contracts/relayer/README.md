# Cross-Chain HTLC Relayer

A production-ready relayer service for facilitating atomic swaps between Ethereum and Stellar networks using Hash Time Locked Contracts (HTLCs). This implementation uses **in-memory storage** without database dependencies.

## Features

- 🔄 **Cross-Chain Atomic Swaps**: Ethereum ↔ Stellar
- 📡 **Real-time Event Monitoring**: Tracks both chains simultaneously
- 🔐 **Secret Management**: Handles hashlock/preimage coordination
- 🏦 **Escrow Management**: Manages HTLC lifecycle
- 🌐 **REST API**: Complete API for order management
- 📡 **WebSocket Support**: Real-time updates for clients
- ⏰ **Automated Recovery**: Handles timeouts and refunds
- 🧠 **In-Memory Storage**: No database required
- 🔒 **Security First**: Built-in validation and error handling

## Architecture

```
┌─────────────────┐    ┌─────────────────┐
│   Ethereum      │    │    Stellar      │
│   Network       │    │    Network      │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          │                      │
    ┌─────▼──────────────────────▼─────┐
    │        HTLC Relayer              │
    │  ┌─────────────────────────────┐ │
    │  │     Event Monitor           │ │
    │  └─────────────────────────────┘ │
    │  ┌─────────────────────────────┐ │
    │  │     Order Manager           │ │
    │  └─────────────────────────────┘ │
    │  ┌─────────────────────────────┐ │
    │  │     Secret Manager          │ │
    │  └─────────────────────────────┘ │
    │  ┌─────────────────────────────┐ │
    │  │     In-Memory Storage       │ │
    │  └─────────────────────────────┘ │
    └──────────────┬───────────────────┘
                   │
    ┌──────────────▼───────────────────┐
    │         REST API                 │
    │      WebSocket Server            │
    └──────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Access to Ethereum RPC endpoint
- Access to Stellar Horizon endpoint
- Deployed HTLC contracts on both chains

### Installation

1. **Clone and setup**:
```bash
cd contracts/relayer
npm install
node scripts/setup.js
```

2. **Configure environment**:
```bash
# Edit .env file with your configuration
cp .env.example .env
# Update the values in .env
```

3. **Build and run**:
```bash
npm run build
npm start
```

Or for development:
```bash
npm run dev
```

## Configuration

Edit the `.env` file with your settings:

```env
# Environment
NODE_ENV=development
PORT=3000

# Ethereum Configuration
ETHEREUM_RPC_URL=http://localhost:8545
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key_here
ETHEREUM_CONTRACT_ADDRESS=your_htlc_contract_address_here
ETHEREUM_NETWORK_ID=1337

# Stellar Configuration
STELLAR_NETWORK_URL=https://horizon-testnet.stellar.org
STELLAR_SECRET_KEY=your_stellar_secret_key_here
STELLAR_CONTRACT_ID=your_stellar_contract_id_here
STELLAR_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

# Security
JWT_SECRET=your_jwt_secret_here_minimum_32_characters
API_RATE_LIMIT=100

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
```

## API Endpoints

### REST API

- `GET /api/health` - Health check
- `GET /api/status` - Relayer status
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get active orders
- `GET /api/orders/:id` - Get specific order
- `GET /api/stats` - Get statistics

### WebSocket Events

Connect to `ws://localhost:3000` for real-time updates:

```javascript
const ws = new WebSocket('ws://localhost:3000');

// Subscribe to events
ws.send(JSON.stringify({
  type: 'subscribe',
  subscriptions: ['orderCreated', 'escrowCreated', 'secretRevealed', 'swapCompleted']
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

## Usage Examples

### Creating an Order

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "maker": "0x1234567890123456789012345678901234567890",
    "makerAmount": "1000000000000000000",
    "makerAsset": "0x0000000000000000000000000000000000000000",
    "makerChain": "ethereum",
    "takerAmount": "100000000",
    "takerAsset": "XLM",
    "takerChain": "stellar",
    "hashlock": "0x1234567890abcdef...",
    "timelock": 1640995200,
    "signature": "0x..."
  }'
```

### Getting Order Status

```bash
curl http://localhost:3000/api/orders/order_1234567890_abcd
```

### WebSocket Client Example

```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3000');

ws.on('open', () => {
  console.log('Connected to relayer');
  
  // Subscribe to all events
  ws.send(JSON.stringify({
    type: 'subscribe',
    subscriptions: ['all']
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Event:', message);
});
```

## How It Works

### 1. Order Creation
- User creates an order specifying swap parameters
- Relayer validates and stores the order
- Order is broadcast to potential resolvers

### 2. Escrow Creation
- Maker creates escrow on source chain
- Relayer detects escrow creation event
- Taker creates corresponding escrow on destination chain

### 3. Secret Revelation
- Either party reveals the secret to claim funds
- Relayer detects secret revelation
- Secret is immediately propagated to other chain

### 4. Atomic Completion
- Both escrows are claimed using the same secret
- Swap completes atomically
- Funds are exchanged successfully

### 5. Timeout Handling
- If timelock expires, refunds are automatically initiated
- Relayer monitors and facilitates recovery

## Monitoring

The relayer provides comprehensive monitoring:

- **Health Checks**: `/api/health` endpoint
- **Status Monitoring**: Real-time chain connection status
- **Event Logging**: Detailed logs of all operations
- **Statistics**: Order counts, success rates, etc.
- **WebSocket Updates**: Real-time event streaming

## Security Features

- Input validation on all endpoints
- Signature verification for orders
- Timelock enforcement
- Automatic refund handling
- Rate limiting
- CORS protection
- Helmet security headers

## Development

### Project Structure

```
src/
├── chains/           # Chain-specific clients
│   ├── base/         # Abstract base classes
│   ├── ethereum/     # Ethereum client
│   └── stellar/      # Stellar client
├── core/             # Core relayer logic
│   ├── Relayer.ts    # Main relayer orchestrator
│   ├── OrderManager.ts
│   ├── SecretManager.ts
│   └── EventMonitor.ts
├── storage/          # In-memory storage
├── api/              # REST API and WebSocket
├── utils/            # Utilities
├── config/           # Configuration
└── types/            # TypeScript types
```

### Running Tests

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

This starts the relayer with hot reloading for development.

## Deployment

### Production Build

```bash
npm run build
npm start
```

### Environment Variables

Ensure all required environment variables are set in production:

- Database connections (if using persistent storage)
- Chain RPC endpoints
- Private keys (use secure key management)
- Network configurations

## Troubleshooting

### Common Issues

1. **Connection Errors**
   - Check RPC endpoints are accessible
   - Verify network configurations
   - Ensure private keys are valid

2. **Contract Errors**
   - Verify contract addresses are correct
   - Check contract ABI matches deployed contracts
   - Ensure sufficient gas/fees

3. **Event Monitoring**
   - Check block synchronization
   - Verify event signatures match contracts
   - Monitor for network connectivity issues

### Logs

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
- Check the logs for error details
- Review the API documentation
- Open an issue on GitHub

---

**Note**: This relayer uses in-memory storage and is suitable for development and testing. For production use with high availability requirements, consider implementing persistent storage backends.