#![cfg(test)]

use super::*;
use soroban_sdk::{testutils::Ledger, Address, BytesN, Env};

// Constants used in most tests
const AMOUNT: i128 = 1_000_000_000; // 100 XLM (7 decimals)
const SAFETY_DEPOSIT: i128 = 100_000_000; // 10 XLM
const TIMELOCK_SECS: u64 = 3_600; // 1 hour

//------------------------------------------------------------------
//  Helpers
//------------------------------------------------------------------
fn new_env() -> Env {
    let e = Env::default();
    e.mock_all_auths(); // disable signature checks
    e
}

fn setup() -> (Env, Address, Address, HTLCContractClient<'static>) {
    // ← ADD LIFETIME
    let env = new_env();
    let sender = Address::generate(&env);
    let recv = Address::generate(&env);
    let id = env.register(HTLCContract, ()); // ← FIX DEPRECATED METHOD
    let client = HTLCContractClient::new(&env, &id);
    (env, sender, recv, client)
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
    let (env, s, r, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let id = client.create_htlc(&s, &r, &AMOUNT, &hashlock, &timelock, &SAFETY_DEPOSIT);
    let h = client.get_htlc(&id);

    assert_eq!(h.sender, s);
    assert_eq!(h.receiver, r);
    assert_eq!(h.amount, AMOUNT);
    assert_eq!(h.status, HTLCStatus::Active);
}

#[test]
fn withdraw_success() {
    let (env, s, r, client) = setup();
    let (hashlock, pre) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let id = client.create_htlc(&s, &r, &AMOUNT, &hashlock, &timelock, &SAFETY_DEPOSIT);
    client.withdraw(&id, &pre);
    assert_eq!(client.get_status(&id), HTLCStatus::Withdrawn);
}

#[test]
fn refund_success() {
    let (env, s, r, client) = setup();
    let (hashlock, _) = hashlock_pair(&env);
    let timelock = env.ledger().timestamp() + TIMELOCK_SECS;

    let id = client.create_htlc(&s, &r, &AMOUNT, &hashlock, &timelock, &SAFETY_DEPOSIT);

    env.ledger().with_mut(|l| l.timestamp = timelock + 1); // fast-forward
    client.refund(&id);
    assert_eq!(client.get_status(&id), HTLCStatus::Refunded);
}

//------------------------------------------------------------------
//  Input-validation tests
//------------------------------------------------------------------
#[test]
#[should_panic(expected = "Invalid amount")]
fn create_amount_zero() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    client.create_htlc(&s, &r, &0, &h, &t, &SAFETY_DEPOSIT);
}

#[test]
#[should_panic(expected = "Invalid safety deposit")]
fn create_negative_safety() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    client.create_htlc(&s, &r, &AMOUNT, &h, &t, &-1);
}

#[test]
#[should_panic(expected = "Invalid timelock")]
fn create_past_timelock() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let past = env.ledger().timestamp().saturating_sub(5);
    client.create_htlc(&s, &r, &AMOUNT, &h, &past, &SAFETY_DEPOSIT);
}

//------------------------------------------------------------------
//  Error-handling / edge cases
//------------------------------------------------------------------
#[test]
#[should_panic(expected = "Contract already exists")]
fn duplicate_contract() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;

    client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);
    // second call with SAME timestamp → same contract id
    client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);
}

#[test]
#[should_panic(expected = "Invalid preimage")]
fn wrong_preimage() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);

    let bad_pre = BytesN::from_array(&env, &[1u8; 32]);
    client.withdraw(&id, &bad_pre);
}

#[test]
#[should_panic(expected = "Timelock expired")]
fn withdraw_after_timelock() {
    let (env, s, r, client) = setup();
    let (h, pre) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);

    env.ledger().with_mut(|l| l.timestamp = t + 1);
    client.withdraw(&id, &pre);
}

#[test]
#[should_panic(expected = "Timelock not expired")]
fn refund_before_timelock() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);
    client.refund(&id); // too early
}

#[test]
#[should_panic(expected = "Already withdrawn")]
fn double_withdraw() {
    let (env, s, r, client) = setup();
    let (h, pre) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);
    client.withdraw(&id, &pre);
    client.withdraw(&id, &pre); // second call should panic
}

#[test]
#[should_panic(expected = "Already refunded")]
fn double_refund() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);
    env.ledger().with_mut(|l| l.timestamp = t + 1);
    client.refund(&id);
    client.refund(&id); // second call should panic
}

#[test]
#[should_panic(expected = "Contract not found")]
fn get_nonexistent() {
    let (env, _, _, client) = setup();
    let fake = BytesN::from_array(&env, &[7u8; 32]);
    client.get_htlc(&fake);
}

//------------------------------------------------------------------
//  Utility / uniqueness checks
//------------------------------------------------------------------
#[test]
fn contract_id_unique() {
    let (env, s, r, client) = setup();
    let (h1, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;

    let id1 = client.create_htlc(&s, &r, &AMOUNT, &h1, &t, &SAFETY_DEPOSIT);

    env.ledger().with_mut(|l| l.timestamp += 1); // bump timestamp
    let (h2, _) = hashlock_pair(&env);
    let id2 = client.create_htlc(&s, &r, &AMOUNT, &h2, &(t + 1), &SAFETY_DEPOSIT);

    assert_ne!(id1, id2);
}

#[test]
fn contract_exists_flag() {
    let (env, s, r, client) = setup();
    let (h, _) = hashlock_pair(&env);
    let t = env.ledger().timestamp() + TIMELOCK_SECS;
    let id = client.create_htlc(&s, &r, &AMOUNT, &h, &t, &SAFETY_DEPOSIT);

    assert!(client.contract_exists(&id));

    let fake = BytesN::from_array(&env, &[0u8; 32]);
    assert!(!client.contract_exists(&fake));
}
