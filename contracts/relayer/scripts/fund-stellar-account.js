const { Keypair } = require('stellar-sdk');
const https = require('https');

async function fundStellarAccount() {
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
    
    console.log('🌟 Funding Stellar testnet account...');
    console.log('📍 Public Key:', publicKey);
    
    // Fund the account using Stellar testnet friendbot
    const url = `https://friendbot.stellar.org?addr=${publicKey}`;
    
    const response = await new Promise((resolve, reject) => {
      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            resolve({ ok: res.statusCode === 200, data: result, status: res.statusCode });
          } catch (e) {
            resolve({ ok: res.statusCode === 200, data: data, status: res.statusCode });
          }
        });
      }).on('error', reject);
    });
    
    if (response.ok) {
      console.log('✅ Account funded successfully!');
      if (response.data.hash) {
        console.log('💰 Transaction Hash:', response.data.hash);
      }
      console.log('🎉 Your Stellar account is now ready to use');
    } else {
      console.error('❌ Failed to fund account. Status:', response.status);
      console.log('💡 Manual funding options:');
      console.log('   1. Visit: https://laboratory.stellar.org/#account-creator');
      console.log('   2. Or use: https://friendbot.stellar.org');
      console.log('📍 Public Key to fund:', publicKey);
    }
    
  } catch (error) {
    console.error('❌ Error funding account:', error.message);
    console.log('💡 Manual funding options:');
    console.log('   1. Visit: https://laboratory.stellar.org/#account-creator');
    console.log('   2. Or use: https://friendbot.stellar.org');
  }
}

if (require.main === module) {
  fundStellarAccount();
}

module.exports = { fundStellarAccount };