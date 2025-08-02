#!/usr/bin/env node

import { config } from 'dotenv';
import { WebSocketServer } from 'ws';
import { EthereumAdapter } from '../../resolver/src/adapters/EthereumAdapter';
import { StellarAdapter } from '../../resolver/src/adapters/StellarAdapter';
import { RELAYER_CONFIG } from '../../resolver/src/config/networks.js';

// Load environment variables
config();

class CrossChainRelayer {
  private wsServer: WebSocketServer;
  private ethereumAdapter: EthereumAdapter;
  private stellarAdapter: StellarAdapter;
  private eventLog: any[] = [];

  constructor() {
    this.wsServer = new WebSocketServer({ port: RELAYER_CONFIG.port });
    this.ethereumAdapter = new EthereumAdapter();
    this.stellarAdapter = new StellarAdapter();
  }

  async start(): Promise<void> {
    console.log('🔄 Starting CrossChain Event Relayer...');
    console.log('👀 Monitoring both Ethereum and Stellar chains for HTLC events');
    
    this.setupWebSocket();
    await this.startEventMonitoring();
    
    console.log(`✅ Event Relayer is running on port ${RELAYER_CONFIG.port}`);
    console.log('📡 Broadcasting events to connected clients via WebSocket');
  }

  private setupWebSocket(): void {
    this.wsServer.on('connection', (ws) => {
      console.log('👋 New relayer client connected');
      
      // Send welcome message with recent events
      ws.send(JSON.stringify({
        type: 'welcome',
        message: 'Connected to CrossChain Event Relayer',
        recentEvents: this.eventLog.slice(-10), // Last 10 events
        timestamp: new Date().toISOString()
      }));
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          switch (message.type) {
            case 'getEvents':
              ws.send(JSON.stringify({
                type: 'events',
                events: this.eventLog,
                total: this.eventLog.length
              }));
              break;
            case 'getStats':
              ws.send(JSON.stringify({
                type: 'stats',
                stats: this.getEventStats()
              }));
              break;
          }
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('👋 Relayer client disconnected');
      });
    });
  }

  private async startEventMonitoring(): Promise<void> {
    console.log('🔍 Starting Ethereum event monitoring...');
    
    // Monitor Ethereum events
    await this.ethereumAdapter.startEventMonitoring((event) => {
      const logEvent = {
        ...event,
        chain: 'ethereum',
        timestamp: new Date().toISOString()
      };
      
      this.eventLog.push(logEvent);
      console.log(`📥 Ethereum event: ${event.type} - ${event.contractId}`);
      
      // Broadcast to all connected clients
      this.broadcast({
        type: 'newEvent',
        event: logEvent
      });
      
      // Handle secret revelation
      if (event.type === 'HTLCWithdraw' && event.data.preimage) {
        this.handleSecretReveal(event.data.preimage, event.contractId);
      }
    });

    console.log('🌟 Starting Stellar event monitoring...');
    
    // Monitor Stellar events
    await this.stellarAdapter.startEventMonitoring((event) => {
      const logEvent = {
        ...event,
        chain: 'stellar',
        timestamp: new Date().toISOString()
      };
      
      this.eventLog.push(logEvent);
      console.log(`📥 Stellar event: ${event.type} - ${event.contractId}`);
      
      // Broadcast to all connected clients
      this.broadcast({
        type: 'newEvent',
        event: logEvent
      });
      
      // Handle secret revelation
      if (event.type === 'HTLCWithdraw' && event.data.preimage) {
        this.handleSecretReveal(event.data.preimage, event.contractId);
      }
    });
  }

  private handleSecretReveal(preimage: string, contractId: string): void {
    console.log(`🔓 Secret revealed! Preimage: ${preimage} for contract: ${contractId}`);
    
    // Broadcast secret revelation to all clients
    this.broadcast({
      type: 'secretRevealed',
      preimage,
      contractId,
      timestamp: new Date().toISOString()
    });
    
    // In a production system, this would trigger automatic
    // claiming on the other chain using the revealed secret
  }

  private broadcast(message: any): void {
    this.wsServer.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }

  private getEventStats(): any {
    const stats = {
      total: this.eventLog.length,
      byChain: { ethereum: 0, stellar: 0 },
      byType: { HTLCNew: 0, HTLCWithdraw: 0, HTLCRefund: 0 },
      secretsRevealed: 0,
      lastHour: 0
    };
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    this.eventLog.forEach(event => {
      stats.byChain[event.chain as keyof typeof stats.byChain]++;
      stats.byType[event.type as keyof typeof stats.byType]++;
      
      if (event.type === 'HTLCWithdraw') {
        stats.secretsRevealed++;
      }
      
      if (new Date(event.timestamp).getTime() > oneHourAgo) {
        stats.lastHour++;
      }
    });
    
    return stats;
  }

  // Cleanup old events to prevent memory issues
  private startEventCleanup(): void {
    setInterval(() => {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const initialLength = this.eventLog.length;
      
      this.eventLog = this.eventLog.filter(event => 
        new Date(event.timestamp).getTime() > oneWeekAgo
      );
      
      const cleaned = initialLength - this.eventLog.length;
      if (cleaned > 0) {
        console.log(`🧹 Cleaned up ${cleaned} old events`);
      }
    }, 60 * 60 * 1000); // Run every hour
  }
}

async function main() {
  console.log('🔄 CrossChain Event Relayer');
  console.log('📡 Real-time monitoring of HTLC events on ETH ↔ Stellar');
  console.log('');

  // Validate environment variables
  const requiredEnvVars = [
    'ETHEREUM_RPC_URL',
    'ETHEREUM_PRIVATE_KEY',
    'ETHEREUM_HTLC_ADDRESS',
    'STELLAR_RPC_URL', 
    'STELLAR_PRIVATE_KEY',
    'STELLAR_HTLC_CONTRACT_ID'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    process.exit(1);
  }

  try {
    const relayer = new CrossChainRelayer();
    await relayer.start();
    
    console.log('');
    console.log('✅ Event Relayer is ready!');
    console.log('');
    console.log('🔌 WebSocket endpoint for real-time events:');
    console.log(`   ws://localhost:${RELAYER_CONFIG.port}`);
    console.log('');
    console.log('📋 WebSocket message types:');
    console.log('   - Send: {"type": "getEvents"} to get all events');
    console.log('   - Send: {"type": "getStats"} to get statistics');
    console.log('   - Receive: "newEvent" for real-time events');
    console.log('   - Receive: "secretRevealed" for secret revelations');
    console.log('');

  } catch (error) {
    console.error('❌ Failed to start Event Relayer:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Shutting down Event Relayer...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('👋 Shutting down Event Relayer...');
  process.exit(0);
});

// Start the relayer
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});