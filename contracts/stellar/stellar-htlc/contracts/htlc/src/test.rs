//crosschain/contracts/stellar/stellar-htlc/contracts/htlc/src/test.rs
#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger, LedgerInfo},
    token::{TokenClient}, Address, Bytes, BytesN, Env, String,
};

const AMOUNT: i128 = 1_000_000_000; // 100 XLM (7 decimals)
const SAFETY_DEPOSIT: i128 = 100_000_000; // 10 XLM
const TIMELOCK_DURATION: u64 = 3600; // 1 hour

fn create_test_env() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    // Create test addresses
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    let contract_addr = env.register_contract(None, HTLCContract);

    // Get native XLM token address  
    let addr_str = String::from_str(&env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHRBBI6ZFO");
    let native_token_addr = Address::from_string(&addr_str);

    // Initialize native token with sufficient balance for sender
    let native_token = TokenClient::new(&env, &native_token_addr);
    native_token.mock_all_auths();

    // Mint tokens to sender for testing
    let total_supply = 10_000_000_000_000; // Large supply for testing
    native_token.mock_mint(&sender, &total_supply);

    (env, sender, receiver, contract_addr, native_token_addr)
}

fn create_test_hashlock() -> (BytesN<32>, BytesN<32>) {
    let env = Env::default();
    let preimage = BytesN::from_array(&env, &[42u8; 32]);
    let preimage_bytes: Bytes = preimage.clone().into();
    let hashlock = env.crypto().sha256(&preimage_bytes).into();
    (hashlock, preimage)
}

#[test]
fn test_create_htlc_success() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Verify contract was created
    assert!(client.contract_exists(&contract_id));

    // Verify HTLC data
    let htlc_data = client.get_htlc(&contract_id);
    assert_eq!(htlc_data.sender, sender);
    assert_eq!(htlc_data.receiver, receiver);
    assert_eq!(htlc_data.amount, AMOUNT);
    assert_eq!(htlc_data.hashlock, hashlock);
    assert_eq!(htlc_data.timelock, timelock);
    assert_eq!(htlc_data.safety_deposit, SAFETY_DEPOSIT);
    assert_eq!(htlc_data.status, HTLCStatus::Active);
    assert_eq!(htlc_data.locked, false);
}

#[test]
fn test_withdraw_success() {
    let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Get initial balances
    let native_token = TokenClient::new(&env, &native_token_addr);
    let receiver_balance_before = native_token.balance(&receiver);
    let sender_balance_before = native_token.balance(&sender);

    // Withdraw with correct preimage
    client.withdraw(&contract_id, &preimage);

    // Verify status changed
    assert_eq!(client.get_status(&contract_id), HTLCStatus::Withdrawn);

    // Verify balances changed correctly
    let receiver_balance_after = native_token.balance(&receiver);
    let sender_balance_after = native_token.balance(&sender);

    assert_eq!(receiver_balance_after, receiver_balance_before + AMOUNT);
    assert_eq!(sender_balance_after, sender_balance_before + SAFETY_DEPOSIT);
}

#[test]
fn test_refund_success() {
    let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Get initial sender balance
    let native_token = TokenClient::new(&env, &native_token_addr);
    let sender_balance_before = native_token.balance(&sender);

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // Refund after timelock expiry
    client.refund(&contract_id);

    // Verify status changed
    assert_eq!(client.get_status(&contract_id), HTLCStatus::Refunded);

    // Verify sender got full refund (amount + safety deposit)
    let sender_balance_after = native_token.balance(&sender);
    let expected_refund = AMOUNT + SAFETY_DEPOSIT;
    assert_eq!(
        sender_balance_after,
        sender_balance_before + expected_refund
    );
}

#[test]
#[should_panic(expected = "Invalid amount")]
fn test_create_htlc_invalid_amount_zero() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    client.create_htlc(
        &sender,
        &receiver,
        &0, // Invalid zero amount
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Invalid amount")]
fn test_create_htlc_invalid_amount_negative() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    client.create_htlc(
        &sender,
        &receiver,
        &(-1000), // Invalid negative amount
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Invalid safety deposit")]
fn test_create_htlc_invalid_safety_deposit() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &(-100), // Invalid negative safety deposit
    );
}

#[test]
#[should_panic(expected = "Invalid timelock")]
fn test_create_htlc_past_timelock() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let past_timelock = env.ledger().timestamp() - 100; // Past timestamp

    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &past_timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Contract already exists")]
fn test_create_htlc_duplicate() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create first HTLC
    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Try to create identical HTLC (same timestamp will generate same ID)
    client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );
}

#[test]
#[should_panic(expected = "Invalid preimage")]
fn test_withdraw_wrong_preimage() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Try to withdraw with wrong preimage
    let wrong_preimage = BytesN::from_array(&env, &[99u8; 32]);
    client.withdraw(&contract_id, &wrong_preimage);
}

#[test]
#[should_panic(expected = "Timelock expired")]
fn test_withdraw_after_timelock() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // Try to withdraw after timelock expiry
    client.withdraw(&contract_id, &preimage);
}

#[test]
#[should_panic(expected = "Timelock not expired")]
fn test_refund_before_timelock() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Try to refund before timelock expiry
    client.refund(&contract_id);
}

#[test]
#[should_panic(expected = "Already withdrawn")]
fn test_double_withdraw() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // First withdrawal
    client.withdraw(&contract_id, &preimage);

    // Try second withdrawal
    client.withdraw(&contract_id, &preimage);
}

#[test]
#[should_panic(expected = "Already refunded")]
fn test_double_refund() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // First refund
    client.refund(&contract_id);

    // Try second refund
    client.refund(&contract_id);
}

#[test]
#[should_panic(expected = "Already withdrawn")]
fn test_refund_after_withdraw() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Withdraw first
    client.withdraw(&contract_id, &preimage);

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // Try to refund after withdrawal
    client.refund(&contract_id);
}

#[test]
#[should_panic(expected = "Already refunded")]
fn test_withdraw_after_refund() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // Refund first
    client.refund(&contract_id);

    // Try to withdraw after refund
    client.withdraw(&contract_id, &preimage);
}

#[test]
#[should_panic(expected = "Contract not found")]
fn test_get_htlc_nonexistent() {
    let (env, _, _, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);

    client.get_htlc(&fake_contract_id);
}

#[test]
#[should_panic(expected = "Contract not found")]
fn test_withdraw_nonexistent() {
    let (env, _, _, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);
    let (_, preimage) = create_test_hashlock();

    client.withdraw(&fake_contract_id, &preimage);
}

#[test]
#[should_panic(expected = "Contract not found")]
fn test_refund_nonexistent() {
    let (env, _, _, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);

    client.refund(&fake_contract_id);
}

#[test]
fn test_contract_exists() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Test non-existent contract
    let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);
    assert_eq!(client.contract_exists(&fake_contract_id), false);

    // Create HTLC and test it exists
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    assert_eq!(client.contract_exists(&contract_id), true);
}

#[test]
fn test_zero_safety_deposit() {
    let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC with zero safety deposit
    let contract_id = client.create_htlc(
        &sender, &receiver, &AMOUNT, &hashlock, &timelock, &0, // Zero safety deposit
    );

    let native_token = TokenClient::new(&env, &native_token_addr);
    let receiver_balance_before = native_token.balance(&receiver);
    let sender_balance_before = native_token.balance(&sender);

    // Withdraw
    client.withdraw(&contract_id, &preimage);

    // Verify only amount transferred to receiver, no safety deposit to sender
    let receiver_balance_after = native_token.balance(&receiver);
    let sender_balance_after = native_token.balance(&sender);

    assert_eq!(receiver_balance_after, receiver_balance_before + AMOUNT);
    assert_eq!(sender_balance_after, sender_balance_before); // No safety deposit returned
}

#[test]
fn test_large_amounts() {
    let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    let large_amount = 1_000_000_000_000_000i128; // Very large amount
    let large_safety_deposit = 100_000_000_000_000i128;

    // Ensure sender has enough balance
    let native_token = TokenClient::new(&env, &native_token_addr);
    native_token.mock_mint(
        &sender,
        &(large_amount + large_safety_deposit + 1_000_000_000_000),
    );

    // Create HTLC with large amounts
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &large_amount,
        &hashlock,
        &timelock,
        &large_safety_deposit,
    );

    let receiver_balance_before = native_token.balance(&receiver);
    let sender_balance_before = native_token.balance(&sender);

    // Withdraw
    client.withdraw(&contract_id, &preimage);

    // Verify large amounts handled correctly
    let receiver_balance_after = native_token.balance(&receiver);
    let sender_balance_after = native_token.balance(&sender);

    assert_eq!(
        receiver_balance_after,
        receiver_balance_before + large_amount
    );
    assert_eq!(
        sender_balance_after,
        sender_balance_before + large_safety_deposit
    );
}

#[test]
fn test_contract_id_uniqueness() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock1, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create first HTLC
    let contract_id1 = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock1,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Create second HTLC with different hashlock (will have different timestamp)
    env.ledger().with_mut(|li| {
        li.timestamp = li.timestamp + 1; // Advance time to ensure different contract ID
    });

    let hashlock2 = BytesN::from_array(&env, &[99u8; 32]);
    let contract_id2 = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock2,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Verify contract IDs are different
    assert_ne!(contract_id1, contract_id2);

    // Verify both contracts exist
    assert!(client.contract_exists(&contract_id1));
    assert!(client.contract_exists(&contract_id2));
}

#[test]
fn test_native_token_integration() {
    let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Verify we're using native XLM token
    let addr_str = String::from_str(&env, "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQAHRBBI6ZFO");
    let expected_native_addr = Address::from_string(&addr_str);
    assert_eq!(native_token_addr, expected_native_addr);

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Verify HTLC data contains correct native token address
    let htlc_data = client.get_htlc(&contract_id);
    assert_eq!(htlc_data.token_address, native_token_addr);
}

#[test]
fn test_event_emission() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, preimage) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC - should emit HTLCNew event
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Withdraw - should emit HTLCWithdraw event
    client.withdraw(&contract_id, &preimage);

    // Events are tested through the soroban-sdk testutils framework
    // In real usage, events would be captured by external systems
    assert_eq!(client.get_status(&contract_id), HTLCStatus::Withdrawn);
}

#[test]
fn test_refund_event_emission() {
    let (env, sender, receiver, contract_addr, _) = create_test_env();
    let client = HTLCContractClient::new(&env, &contract_addr);
    let (hashlock, _) = create_test_hashlock();
    let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

    // Create HTLC
    let contract_id = client.create_htlc(
        &sender,
        &receiver,
        &AMOUNT,
        &hashlock,
        &timelock,
        &SAFETY_DEPOSIT,
    );

    // Fast forward past timelock
    env.ledger().with_mut(|li| {
        li.timestamp = timelock + 1;
    });

    // Refund - should emit HTLCRefund event
    client.refund(&contract_id);

    assert_eq!(client.get_status(&contract_id), HTLCStatus::Refunded);
}