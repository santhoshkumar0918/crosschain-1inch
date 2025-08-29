const StellarSdk = require('@stellar/stellar-sdk');

// Generate a new keypair
const keypair = StellarSdk.Keypair.random();

console.log('New Stellar Keypair Generated:');
console.log('Public Key (Address):', keypair.publicKey());
console.log('Secret Key:', keypair.secret());
console.log('');
console.log('Add these to your .env file:');
console.log(`RESOLVER_STELLAR_ADDRESS=${keypair.publicKey()}`);
console.log(`RESOLVER_STELLAR_SECRET=${keypair.secret()}`);
console.log('');
console.log('Fund this account at: https://laboratory.stellar.org/#account-creator?network=test');