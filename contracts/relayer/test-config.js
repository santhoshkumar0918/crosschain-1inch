const { execSync } = require('child_process');

try {
  console.log('🧪 Testing configuration...');
  
  // Test TypeScript compilation
  console.log('📝 Checking TypeScript compilation...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('✅ TypeScript compilation successful!');
  
  // Test configuration loading
  console.log('⚙️ Testing configuration loading...');
  const { spawn } = require('child_process');
  
  const testProcess = spawn('node', ['-e', `
    require('ts-node/register');
    const { config } = require('./src/config/environment');
    console.log('✅ Configuration loaded successfully!');
    console.log('📊 Port:', config.port);
    console.log('🔗 Ethereum RPC:', config.chains.ethereum.rpcUrl);
    console.log('⭐ Stellar Network:', config.chains.stellar.networkUrl);
    process.exit(0);
  `], { stdio: 'inherit' });
  
  testProcess.on('close', (code) => {
    if (code === 0) {
      console.log('🎉 All tests passed! You can now run npm run dev');
    } else {
      console.error('❌ Configuration test failed');
      process.exit(1);
    }
  });
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}