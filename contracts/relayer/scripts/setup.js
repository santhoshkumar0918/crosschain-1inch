const fs = require('fs');
const path = require('path');

console.log('🔧 Setting up Cross-Chain HTLC Relayer...');

// Create necessary directories
const directories = [
  'logs',
  'dist'
];

directories.forEach(dir => {
  const dirPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dir}`);
  }
});

// Copy .env.example to .env if it doesn't exist
const envExamplePath = path.join(__dirname, '..', '.env.example');
const envPath = path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ Created .env file from .env.example');
  console.log('⚠️  Please edit .env file with your configuration');
} else if (fs.existsSync(envPath)) {
  console.log('✅ .env file already exists');
} else {
  console.log('❌ .env.example not found');
}

console.log('🎉 Setup completed!');
console.log('\nNext steps:');
console.log('1. Edit .env file with your configuration');
console.log('2. Run: npm install');
console.log('3. Run: npm run build');
console.log('4. Run: npm start');