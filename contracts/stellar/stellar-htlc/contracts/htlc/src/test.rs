#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, Address, BytesN, Env,
};

// Constants used in most tests
const AMOUNT: i128 = 1_000_000_000; // 100 XLM (7 decimals)
const SAFETY_DEPOSIT: i128 = 100_000_000; // 10 XLM
const TIMELOCK_SECS: u64 = 3_600; // 1 hour

fn new_env() -> Env {
    let e = Env::default();
    e.mock_all_auths(); // disable signature checks
    e
}

fn setup() -> (Env, Address, Address, Address, HTLCContractClient<'static>) {
    let env = new_env();
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);

    // Create a mock token contract
    let token_address = env.register_stellar_asset_contract(sender.clone());

    // Register HTLC contract
    let htlc_contract_id = env.register_contract(None, HTLCContract);
    let client = HTLCContractClient::new(&env, &htlc_contract_id);

    // Mint tokens to sender for testing
    let token_client = token::Client::new(&env, &token_address);
    token_client.mint(&sender, &(AMOUNT + SAFETY_DEPOSIT));

    (env, sender, receiver, token_address, client)
}

fn hashlock_pair(env: &Env) -> (BytesN<32>, BytesN<32>) {
    let preimage = BytesN::from_array(env, &[42u8; 32]);
    let hashlock: BytesN<32> = env.crypto().sha256(&preimage.clone().into()).into();
    (hashlock, preimage)
}

//------------------------------------------------------------------
//  Happy-path tests
//------------------------------------------------------------------
#[test]
fn create_htlc_success() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    let htlc_data = client.get_htlc(&contract_id);

    assert_eq!(htlc_data.sender, sender);
    assert_eq!(htlc_data.receiver, receiver);
    assert_eq!(htlc_data.amount, AMOUNT);
    assert_eq!(htlc_data.token_address, token_address);
    assert_eq!(htlc_data.status, HTLCStatus::Active);
    assert_eq!(htlc_data.safety_deposit, SAFETY_DEPOSIT);
}

#[test]
fn withdraw_success() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, preimage) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    client.withdraw(&contract_id, &preimage);
    assert_eq!(client.get_status(&contract_id), HTLCStatus::Withdrawn);
}

#[test]
fn refund_success() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Fast-forward past timelock
    env.ledger().with_mut(|l| l.timestamp = timelock + 1);
    client.refund(&contract_id);
    assert_eq!(client.get_status(&contract_id), HTLCStatus::Refunded);
}

//------------------------------------------------------------------
//  Input-validation tests
//------------------------------------------------------------------
#[test]
#[should_panic(expected = "Invalid amount")]
fn create_amount_zero() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    client.create_htlc(
        &sender,
        &receiver,
        &0,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Invalid safety deposit")]
fn create_negative_safety() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &-1,
    );
}

#[test]
#[should_panic(expected = "Invalid timelock")]
fn create_past_timelock() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let past_timelock = env.ledger().timestamp().saturating_sub(5);

    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &past_timelock,
        &SAFETY_DEPOSIT,
    );
}

//------------------------------------------------------------------
//  Error-handling / edge cases
//------------------------------------------------------------------
#[test]
#[should_panic(expected = "Contract already exists")]
fn duplicate_contract() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Second call with SAME parameters → same contract id
    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Invalid preimage")]
fn wrong_preimage() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    let bad_preimage = BytesN::from_array(&env, &[1u8; 32]);
    client.withdraw(&contract_id, &bad_preimage);
}

#[test]
#[should_panic(expected = "Timelock expired")]
fn withdraw_after_timelock() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, preimage) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    env.ledger().with_mut(|l| l.timestamp = timelock + 1);
    client.withdraw(&contract_id, &preimage);
}

#[test]
#[should_panic(expected = "Timelock not expired")]
fn refund_before_timelock() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    client.refund(&contract_id); // too early
}

#[test]
#[should_panic(expected = "Already withdrawn")]
fn double_withdraw() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, preimage) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    client.withdraw(&contract_id, &preimage);
    client.withdraw(&contract_id, &preimage); // second call should panic
}

#[test]
#[should_panic(expected = "Already refunded")]
fn double_refund() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    env.ledger().with_mut(|l| l.timestamp = timelock + 1);
    client.refund(&contract_id);
    client.refund(&contract_id); // second call should panic
}

#[test]
#[should_panic(expected = "Contract not found")]
fn get_nonexistent() {
    let (_, _, _, _, client) = setup();
    let fake_id = BytesN::from_array(&client.env, &[7u8; 32]);
    client.get_htlc(&fake_id);
}

//------------------------------------------------------------------
//  Utility / uniqueness checks
//------------------------------------------------------------------
#[test]
fn contract_id_unique() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock1, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id1 = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock1,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Bump timestamp to ensure different contract ID
    env.ledger().with_mut(|l| l.timestamp += 1);
    let (hashlock2, _) = hashlock_pair(&env);
    let contract_id2 = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock2,
        &(timelock + 1),
        &SAFETY_DEPOSIT,
    );

    assert_ne!(contract_id1, contract_id2);
}

#[test]
fn contract_exists_flag() {
    let (env, sender, receiver, token_address, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &token_address,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    assert!(client.contract_exists(&contract_id));

    let fake_id = BytesN::from_array(&env, &[0u8; 32]);
    assert!(!client.contract_exists(&fake_id));
}
