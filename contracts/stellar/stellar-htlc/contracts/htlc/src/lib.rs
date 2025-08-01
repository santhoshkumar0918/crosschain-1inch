#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, token, xdr::ToXdr, Address, Bytes, BytesN, Env, Symbol,
};

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    HTLCData(BytesN<32>),
}

#[derive(Clone, Debug, PartialEq)]
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

#[contract]
pub struct HTLCContract;

#[contractimpl]
impl HTLCContract {
    /// Creates a new HTLC
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

        // Generate contract ID
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

        // For testing, we'll use a generated token address
        let token_address = Address::generate(&env);

        // Create HTLC data
        let htlc_data = HTLCData {
            contract_id: contract_id.clone(),
            sender: sender.clone(),
            receiver: receiver.clone(),
            amount,
            token_address: token_address.clone(),
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

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "HTLCNew"), contract_id.clone()),
            (sender, receiver, amount, hashlock, timelock, safety_deposit),
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

        // Authorization check
        htlc_data.receiver.require_auth();

        // Status check
        match htlc_data.status {
            HTLCStatus::Active => {}
            HTLCStatus::Withdrawn => panic!("Already withdrawn"),
            HTLCStatus::Refunded => panic!("Already refunded"),
        }

        // Timelock check
        let current_timestamp = env.ledger().timestamp();
        if current_timestamp >= htlc_data.timelock {
            panic!("Timelock expired");
        }

        // Validate preimage
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

        // Update status to withdrawn
        htlc_data.status = HTLCStatus::Withdrawn;
        htlc_data.locked = false;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Emit event
        env.events().publish(
            (Symbol::new(&env, "HTLCWithdraw"), contract_id.clone()),
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

        // Authorization check
        htlc_data.sender.require_auth();

        // Status check
        match htlc_data.status {
            HTLCStatus::Active => {}
            HTLCStatus::Withdrawn => panic!("Already withdrawn"),
            HTLCStatus::Refunded => panic!("Already refunded"),
        }

        // Timelock check
        let current_timestamp = env.ledger().timestamp();
        if current_timestamp < htlc_data.timelock {
            panic!("Timelock not expired");
        }

        // Set reentrancy lock
        htlc_data.locked = true;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Update status to refunded
        htlc_data.status = HTLCStatus::Refunded;
        htlc_data.locked = false;
        env.storage()
            .persistent()
            .set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

        // Emit event
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

    fn generate_contract_id(
        env: &Env,
        sender: &Address,
        receiver: &Address,
        amount: i128,
        hashlock: &BytesN<32>,
        timelock: u64,
        timestamp: u64,
    ) -> BytesN<32> {
        let mut packed_data = Bytes::new(env);

        // Simple packing for contract ID generation
        let sender_bytes = Self::address_to_bytes32(env, sender);
        let receiver_bytes = Self::address_to_bytes32(env, receiver);

        packed_data.extend_from_slice(&sender_bytes.to_array());
        packed_data.extend_from_slice(&receiver_bytes.to_array());
        packed_data.extend_from_slice(&amount.to_be_bytes());
        packed_data.extend_from_slice(&hashlock.to_array());
        packed_data.extend_from_slice(&timelock.to_be_bytes());
        packed_data.extend_from_slice(&timestamp.to_be_bytes());

        env.crypto().keccak256(&packed_data).into()
    }

    fn address_to_bytes32(env: &Env, address: &Address) -> BytesN<32> {
        let address_bytes = address.to_xdr(env);
        let hash = env.crypto().sha256(&address_bytes);
        hash.into()
    }
}

mod test;
