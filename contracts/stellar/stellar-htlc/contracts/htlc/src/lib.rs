//crosschain/contracts/stellar/stellar-htlc/contracts/htlc/src/lib.rs
#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, xdr::ToXdr,
    Address, Bytes, BytesN, Env, String, Symbol, 
};
use soroban_sdk::token::TokenClient;

const NATIVE_TOKEN: Symbol = symbol_short!("NATIVE");

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    HTLCData(BytesN<32>), // Maps contract_id to HTLCData
}

#[derive(Clone)]
#[contracttype]
pub enum HTLCStatus {
    Active,
    Withdrawn,
    Refunded,
}

#[derive(Clone)]
#[contracttype]
pub struct HTLCData {
    pub contract_id: BytesN<32>,
    pub sender: Address,
    pub receiver: Address,
    pub amount: i128,
    pub token_address: Address,
    pub hashlock: BytesN<32>,
    pub timelock: u64,
    pub timestamp: u64,
    pub safety_deposit: i128,
    pub status: HTLCStatus,
    pub locked: bool,
}

#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[contracttype]
pub enum HTLCError {
    ContractAlreadyExists = 1,
    ContractNotFound = 2,
    InvalidPreimage = 3,
    TimelockNotExpired = 4,
    TimelockExpired = 5,
    Unauthorized = 6,
    InsufficientBalance = 7,
    ReentrancyDetected = 8,
    HashComputationFailed = 9,
    InvalidAmount = 10,
    InvalidTimelock = 11,
    ContractNotActive = 12,
    AlreadyWithdrawn = 13,
    AlreadyRefunded = 14,
}

#[contract]
pub struct HTLCContract;

#[contractimpl]
impl HTLCContract {
    /// Creates a new HTLC with XLM
    /// Following 1inch Fusion+ pattern with safety deposit
    pub fn create_htlc(
        env: Env,
        sender: Address,
        receiver: Address,
        amount: i128,
        hashlock: BytesN<32>,
        timelock: u64,
        safety_deposit: i128,
    ) -> BytesN<32> {
        // Authorization check
        sender.require_auth();

        // Input validation
        if amount <= 0 {
            panic!("Invalid amount");
        }

        if safety_deposit < 0 {
            panic!("Invalid safety deposit");
        }

        let current_timestamp = env.ledger().timestamp();
        if timelock <= current_timestamp {
            panic!("Invalid timelock");
        }

        // Generate Keccak-256 contract ID matching Ethereum pattern
        let contract_id = Self::generate_contract_id(
            &env,
            &sender,
            &receiver,
            amount,
            &hashlock,
            timelock,
            current_timestamp,
        );

        // Check if contract already exists
        if env
            .storage()
            .persistent()
            .has(&DataKey::HTLCData(contract_id.clone()))
        {
            panic!("Contract already exists");
        }

        // Total amount to lock (amount + safety deposit)
        let total_amount = amount + safety_deposit;

        // Check sender balance
        let sender_balance = Self::get_native_balance(&env, &sender);
        if sender_balance < total_amount {
            panic!("Insufficient balance");
        }

        // Get native XLM token address and transfer funds to contract
        let native_token_address = Self::get_native_token_address(&env);
        let contract_address = env.current_contract_address();
        let native_token = TokenClient::new(&env, &native_token_address);
        native_token.transfer(&sender, &contract_address, &total_amount);

        // Create HTLC data
        let htlc_data = HTLCData {
            contract_id: contract_id.clone(),
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount,
            token_address: native_token_address.clone(),
            hashlock: hashlock.clone(),
            timelock,
            timestamp: current_timestamp,
            safety_deposit,
            status: HTLCStatus::Active,
            locked: false,
        };

        // Store HTLC data
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Emit HTLCNew event - 1inch Fusion+ compatible
        env.events().publish(
            (
                Symbol::new(&env, "HTLCNew"),
                contract_id.clone(),
            ),
            (
                sender.clone(),
                receiver.clone(),
                amount,
                htlc_data.token_address.clone(),
                hashlock.clone(),
                timelock,
                safety_deposit,
            ),
        );

        contract_id
    }

    /// Withdraws funds by revealing the preimage
    pub fn withdraw(env: Env, contract_id: BytesN<32>, preimage: BytesN<32>) {
        let mut htlc_data = Self::get_htlc_data(&env, &contract_id);

        // Reentrancy protection
        if htlc_data.locked {
            panic!("Reentrancy detected");
        }

        // Authorization check - only receiver can withdraw
        htlc_data.receiver.require_auth();

        // Status check
        match htlc_data.status {
            HTLCStatus::Active => {}
            HTLCStatus::Withdrawn => panic!("Already withdrawn"),
            HTLCStatus::Refunded => panic!("Already refunded"),
        }

        // Timelock check - must withdraw before expiry
        let current_timestamp = env.ledger().timestamp();
        if current_timestamp >= htlc_data.timelock {
            panic!("Timelock expired");
        }

        // Validate preimage against hashlock
        let preimage_bytes: Bytes = preimage.clone().into();
        let computed_hash = env.crypto().sha256(&preimage_bytes);
        let computed_hash_bytes: BytesN<32> = computed_hash.into();
        if computed_hash_bytes != htlc_data.hashlock {
            panic!("Invalid preimage");
        }

        // Set reentrancy lock
        htlc_data.locked = true;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Transfer amount to receiver and safety deposit to sender
        let contract_address = env.current_contract_address();
        let native_token_address = Self::get_native_token_address(&env);
        let native_token = TokenClient::new(&env, &native_token_address);

        // Transfer main amount to receiver
        native_token.transfer(&contract_address, &htlc_data.receiver, &htlc_data.amount);

        // Transfer safety deposit back to sender
        if htlc_data.safety_deposit > 0 {
            native_token.transfer(
                &contract_address,
                &htlc_data.sender,
                &htlc_data.safety_deposit,
            );
        }

        // Update status to withdrawn
        htlc_data.status = HTLCStatus::Withdrawn;
        htlc_data.locked = false;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Emit HTLCWithdraw event - 1inch Fusion+ compatible
        env.events().publish(
            (
                Symbol::new(&env, "HTLCWithdraw"),
                contract_id.clone(),
            ),
            preimage,
        );
    }

    /// Refunds funds after timelock expiry
    pub fn refund(env: Env, contract_id: BytesN<32>) {
        let mut htlc_data = Self::get_htlc_data(&env, &contract_id);

        // Reentrancy protection
        if htlc_data.locked {
            panic!("Reentrancy detected");
        }

        // Authorization check - only sender can refund
        htlc_data.sender.require_auth();

        // Status check
        match htlc_data.status {
            HTLCStatus::Active => {}
            HTLCStatus::Withdrawn => panic!("Already withdrawn"),
            HTLCStatus::Refunded => panic!("Already refunded"),
        }

        // Timelock check - can only refund after expiry
        let current_timestamp = env.ledger().timestamp();
        if current_timestamp < htlc_data.timelock {
            panic!("Timelock not expired");
        }

        // Set reentrancy lock
        htlc_data.locked = true;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Transfer full amount (amount + safety deposit) back to sender
        let contract_address = env.current_contract_address();
        let native_token_address = Self::get_native_token_address(&env);
        let total_refund = htlc_data.amount + htlc_data.safety_deposit;

        TokenClient::new(&env, &native_token_address).transfer(
            &contract_address,
            &htlc_data.sender,
            &total_refund,
        );

        // Update status to refunded
        htlc_data.status = HTLCStatus::Refunded;
        htlc_data.locked = false;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Emit HTLCRefund event - 1inch Fusion+ compatible
        env.events().publish(
            (Symbol::new(&env, "HTLCRefund"), contract_id.clone()),
            contract_id.clone(),
        );
    }

    /// Gets HTLC data by contract ID
    pub fn get_htlc(env: Env, contract_id: BytesN<32>) -> HTLCData {
        Self::get_htlc_data(&env, &contract_id)
    }

    /// Checks if contract exists
    pub fn contract_exists(env: Env, contract_id: BytesN<32>) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::HTLCData(contract_id))
    }

    /// Gets contract status
    pub fn get_status(env: Env, contract_id: BytesN<32>) -> HTLCStatus {
        let htlc_data = Self::get_htlc_data(&env, &contract_id);
        htlc_data.status
    }

    // Private helper functions

    fn get_htlc_data(env: &Env, contract_id: &BytesN<32>) -> HTLCData {
        env.storage()
            .persistent()
            .get(&DataKey::HTLCData(contract_id.clone()))
            .unwrap_or_else(|| panic!("Contract not found"))
    }

    fn get_native_balance(env: &Env, address: &Address) -> i128 {
        let native_token_address = Self::get_native_token_address(env);
        TokenClient::new(env, &native_token_address).balance(address)
    }

    /// Gets the proper native XLM Stellar Asset Contract address
    fn get_native_token_address(env: &Env) -> Address {
        // For testing purposes, create a consistent address
        // In production, this would be the actual Stellar Asset Contract address for native XLM
        let addr_str = String::from_str(env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHRBBI6ZFO");
        Address::from_string(&addr_str)
    }

    /// Generates Keccak-256 contract ID matching Ethereum HTLC pattern
    /// keccak256(abi.encodePacked(sender, receiver, amount, hashlock, timelock, timestamp))
    fn generate_contract_id(
        env: &Env,
        sender: &Address,
        receiver: &Address,
        amount: i128,
        hashlock: &BytesN<32>,
        timelock: u64,
        timestamp: u64,
    ) -> BytesN<32> {
        // More efficient packing without XDR for better cross-chain compatibility
        let mut packed_data = Bytes::new(env);

        // Convert addresses to bytes - use consistent 32-byte representation
        let sender_bytes = Self::address_to_bytes32(env, sender);
        let receiver_bytes = Self::address_to_bytes32(env, receiver);

        // Pack data in the same order as Ethereum ABI encoding
        packed_data.extend_from_slice(&sender_bytes.to_array());
        packed_data.extend_from_slice(&receiver_bytes.to_array());
        packed_data.extend_from_slice(&amount.to_be_bytes());
        packed_data.extend_from_slice(&hashlock.to_array());
        packed_data.extend_from_slice(&timelock.to_be_bytes());
        packed_data.extend_from_slice(&timestamp.to_be_bytes());

        // Generate Keccak-256 hash
        env.crypto().keccak256(&packed_data).into()
    }

    /// Converts Stellar address to consistent 32-byte representation for cross-chain compatibility
    fn address_to_bytes32(env: &Env, address: &Address) -> BytesN<32> {
        // Create consistent 32-byte representation from address
        let address_bytes = address.to_xdr(env);
        let hash = env.crypto().sha256(&address_bytes);
        hash.into()
    }
}

mod test;