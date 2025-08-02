#!/usr/bin/env node

import { config } from 'dotenv';
import { APIServer } from './api/service';

// Load environment variables
config();

async function main() {
  console.log('🚀 Starting CrossChain Resolver...');
  console.log('🔗 ETH ↔ Stellar Atomic Swap Resolver');
  console.log('💡 Using escrow pattern (no 1inch API key required)');
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
    console.error('');
    console.error('💡 Please check your .env file and ensure all required variables are set.');
    process.exit(1);
  }

  try {
    // Create and start the API server
    const server = new APIServer();
    await server.start();
    
    console.log('');
    console.log('✅ CrossChain Resolver is ready!');
    console.log('');
    console.log('🎯 Test endpoints:');
    console.log(`   curl http://localhost:${process.env.RESOLVER_PORT || 3001}/health`);
    console.log(`   curl http://localhost:${process.env.RESOLVER_PORT || 3001}/info`);
    console.log('');
    console.log('📋 Example swap request:');
    console.log(`   curl -X POST http://localhost:${process.env.RESOLVER_PORT || 3001}/api/swap \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{ ');
    console.log('       "srcChain": "ethereum", ');
    console.log('       "dstChain": "stellar", ');
    console.log('       "srcToken": "ETH", ');
    console.log('       "dstToken": "XLM", ');
    console.log('       "amount": "0.1", ');
    console.log('       "receiver": "YOUR_STELLAR_ADDRESS" ');
    console.log('     }\'');
    console.log('');
    console.log('🔌 WebSocket endpoint for real-time updates:');
    console.log(`   ws://localhost:${(parseInt(process.env.RESOLVER_PORT || '3001') + 1)}`);
    console.log('');
    
  } catch (error) {
    console.error('❌ Failed to start CrossChain Resolver:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Shutting down CrossChain Resolver...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('');
  console.log('👋 Shutting down CrossChain Resolver...');
  process.exit(0);
});

// Start the resolver
main().catch((error) => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
});