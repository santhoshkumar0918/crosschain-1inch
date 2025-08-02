const http = require('http');
const WebSocket = require('ws');

console.log('🧪 Testing HTLC Relayer API...\n');

// Test REST API
async function testRestAPI() {
  console.log('📡 Testing REST API endpoints...');
  
  try {
    // Test health endpoint
    const healthResponse = await makeRequest('GET', '/api/health');
    console.log('✅ Health check:', healthResponse.status);
    
    // Test status endpoint
    const statusResponse = await makeRequest('GET', '/api/status');
    console.log('✅ Status check:', statusResponse.relayerRunning ? 'Running' : 'Stopped');
    
    // Test creating an order (this will fail without proper config, but tests the endpoint)
    const orderData = {
      maker: '0x1234567890123456789012345678901234567890',
      makerAmount: '1000000000000000000',
      makerAsset: '0x0000000000000000000000000000000000000000',
      makerChain: 'ethereum',
      takerAmount: '100000000',
      takerAsset: 'XLM',
      takerChain: 'stellar',
      hashlock: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12',
      timelock: Math.floor(Date.now() / 1000) + 3600,
      signature: '0x...'
    };
    
    try {
      const orderResponse = await makeRequest('POST', '/api/orders', orderData);
      console.log('✅ Order creation test passed');
    } catch (error) {
      console.log('⚠️  Order creation test (expected to fail without proper config)');
    }
    
    // Test getting orders
    const ordersResponse = await makeRequest('GET', '/api/orders');
    console.log('✅ Get orders:', ordersResponse.count || 0, 'orders');
    
    // Test stats
    const statsResponse = await makeRequest('GET', '/api/stats');
    console.log('✅ Stats:', statsResponse.stats?.total || 0, 'total orders');
    
  } catch (error) {
    console.error('❌ REST API test failed:', error.message);
  }
}

// Test WebSocket
function testWebSocket() {
  console.log('\n📡 Testing WebSocket connection...');
  
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Subscribe to events
    ws.send(JSON.stringify({
      type: 'subscribe',
      subscriptions: ['all']
    }));
    
    // Send ping
    setTimeout(() => {
      ws.send(JSON.stringify({ type: 'ping' }));
    }, 1000);
    
    // Close after 3 seconds
    setTimeout(() => {
      ws.close();
    }, 3000);
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data);
    console.log('📨 WebSocket message:', message.type);
  });
  
  ws.on('close', () => {
    console.log('✅ WebSocket connection closed');
    console.log('\n🎉 API tests completed!');
  });
  
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
}

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(response);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response.error || 'Unknown error'}`));
          }
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// Run tests
async function runTests() {
  // Wait a bit for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  await testRestAPI();
  testWebSocket();
}

runTests().catch(console.error);