const StellarSdk = require('@stellar/stellar-sdk');

async function fundAccount() {
  const publicKey = 'GA7VFIHH7SALSSF255L4J5TUT4G5AEDMI5BVM342MYHU4OJFNIV6BOQ5';
  
  try {
    console.log('Funding Stellar account:', publicKey);
    
    // Fund the account using friendbot
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    
    if (response.ok) {
      console.log('✅ Account funded successfully!');
      
      // Check the account balance
      const server = new StellarSdk.Horizon.Server('https://horizon-testnet.stellar.org');
      const account = await server.loadAccount(publicKey);
      
      console.log('Account balances:');
      account.balances.forEach(balance => {
        console.log(`  ${balance.asset_type === 'native' ? 'XLM' : balance.asset_code}: ${balance.balance}`);
      });
    } else {
      console.error('❌ Failed to fund account:', await response.text());
    }
  } catch (error) {
    console.error('❌ Error funding account:', error.message);
  }
}

fundAccount();