const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Cross-Chain HTLC Relayer in development mode...');

// Set environment variables
process.env.NODE_ENV = 'development';

// Start the development server
const devProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env }
});

devProcess.on('error', (error) => {
  console.error('❌ Failed to start development server:', error.message);
  process.exit(1);
});

devProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(`❌ Development server exited with code ${code}`);
    process.exit(code);
  }
});

// Handle shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down development server...');
  devProcess.kill('SIGINT');
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down development server...');
  devProcess.kill('SIGTERM');
});