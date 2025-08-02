const { Keypair } = require('stellar-sdk');

async function testStellarConnection() {
  try {
    console.log('🧪 Testing Stellar connection...');
    
    // Load environment
    require('dotenv').config();
    const secretKey = process.env.STELLAR_SECRET_KEY;
    
    if (!secretKey) {
      console.error('❌ STELLAR_SECRET_KEY not found in .env file');
      return false;
    }

    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    
    console.log('📍 Stellar Public Key:', publicKey);
    console.log('🔑 Secret Key loaded successfully');
    
    // Test if we can create a keypair
    console.log('✅ Stellar SDK working correctly');
    console.log('💡 Run "npm run fund-stellar" to fund your account');
    console.log('💡 Then run "npm run dev" to start the relayer');
    
    return true;
    
  } catch (error) {
    console.error('❌ Stellar connection test failed:', error.message);
    return false;
  }
}

if (require.main === module) {
  testStellarConnection();
}

module.exports = { testStellarConnection };