const { Keypair } = require('stellar-sdk');

function manualFundInstructions() {
  try {
    // Load the secret key from environment
    require('dotenv').config();
    const secretKey = process.env.STELLAR_SECRET_KEY;
    
    if (!secretKey) {
      console.error('❌ STELLAR_SECRET_KEY not found in .env file');
      process.exit(1);
    }

    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    
    console.log('🌟 Manual Stellar Account Funding Instructions');
    console.log('='.repeat(50));
    console.log('📍 Your Public Key:', publicKey);
    console.log('');
    console.log('🔗 Option 1: Use Stellar Laboratory (Recommended)');
    console.log('   1. Visit: https://laboratory.stellar.org/#account-creator');
    console.log('   2. Paste your public key:', publicKey);
    console.log('   3. Click "Create Account"');
    console.log('');
    console.log('🔗 Option 2: Use Friendbot Direct');
    console.log('   1. Visit: https://friendbot.stellar.org');
    console.log('   2. Enter your public key:', publicKey);
    console.log('   3. Click "Fund Account"');
    console.log('');
    console.log('🔗 Option 3: Direct URL');
    console.log(`   Open: https://friendbot.stellar.org?addr=${publicKey}`);
    console.log('');
    console.log('✅ After funding, your relayer will work without the 404 errors!');
    console.log('💡 You can test with: npm run test-api');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

if (require.main === module) {
  manualFundInstructions();
}

module.exports = { manualFundInstructions };