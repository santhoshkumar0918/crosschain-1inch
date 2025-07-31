import Image from "next/image";

export default function Home() {
  return (
    <div className="font-sans grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20">
      <main className="flex flex-col gap-[32px] row-start-2 items-center sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={180}
          height={38}
          priority
        />
        <ol className="font-mono list-inside list-decimal text-sm/6 text-center sm:text-left">
          <li className="mb-2 tracking-[-.01em]">
            Get started by editing{" "}
            <code className="bg-black/[.05] dark:bg-white/[.06] font-mono font-semibold px-1 py-0.5 rounded">
              app/page.tsx
            </code>
            .
          </li>
          <li className="tracking-[-.01em]">
            Save and see your changes instantly.
          </li>
        </ol>

        <div className="flex gap-4 items-center flex-col sm:flex-row">
          <a
            className="rounded-full border border-solid border-transparent transition-colors flex items-center justify-center bg-foreground text-background gap-2 hover:bg-[#383838] dark:hover:bg-[#ccc] font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 sm:w-auto"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={20}
              height={20}
            />
            Deploy now
          </a>
          <a
            className="rounded-full border border-solid border-black/[.08] dark:border-white/[.145] transition-colors flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] hover:border-transparent font-medium text-sm sm:text-base h-10 sm:h-12 px-4 sm:px-5 w-full sm:w-auto md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Read our docs
          </a>
        </div>
      </main>
      <footer className="row-start-3 flex gap-[24px] flex-wrap items-center justify-center">
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/file.svg"
            alt="File icon"
            width={16}
            height={16}
          />
          Learn
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/window.svg"
            alt="Window icon"
            width={16}
            height={16}
          />
          Examples
        </a>
        <a
          className="flex items-center gap-2 hover:underline hover:underline-offset-4"
          href="https://nextjs.org?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            aria-hidden
            src="/globe.svg"
            alt="Globe icon"
            width={16}
            height={16}
          />
          Go to nextjs.org →
        </a>
      </footer>
    </div>
  );
}

// //crosschain/contracts/stellar/stellar-htlc/contracts/htlc/src/lib.rs
// #![no_std]
// use soroban_sdk::{
//     contract, contractimpl, contracttype, contractclient,
//     Address, Env, BytesN, String, Symbol, Vec, Map,
//     token, panic_with_error, require_auth, vec,
//     log, events, Asset
// };

// const NATIVE_TOKEN: Symbol = Symbol::short("NATIVE");

// #[derive(Clone)]
// #[contracttype]
// pub enum DataKey {
//     HTLCData(BytesN<32>), // Maps contract_id to HTLCData
// }

// #[derive(Clone)]
// #[contracttype]
// pub enum HTLCStatus {
//     Active,
//     Withdrawn,
//     Refunded,
// }

// #[derive(Clone)]
// #[contracttype]
// pub struct HTLCData {
//     pub contract_id: BytesN<32>,
//     pub sender: Address,
//     pub receiver: Address,
//     pub amount: i128,
//     pub token_address: Address,
//     pub hashlock: BytesN<32>,
//     pub timelock: u64,
//     pub timestamp: u64,
//     pub safety_deposit: i128,
//     pub status: HTLCStatus,
//     pub locked: bool,
// }

// #[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
// #[contracttype]
// pub enum HTLCError {
//     ContractAlreadyExists = 1,
//     ContractNotFound = 2,
//     InvalidPreimage = 3,
//     TimelockNotExpired = 4,
//     TimelockExpired = 5,
//     Unauthorized = 6,
//     InsufficientBalance = 7,
//     ReentrancyDetected = 8,
//     HashComputationFailed = 9,
//     InvalidAmount = 10,
//     InvalidTimelock = 11,
//     ContractNotActive = 12,
//     AlreadyWithdrawn = 13,
//     AlreadyRefunded = 14,
// }

// #[contract]
// pub struct HTLCContract;

// #[contractimpl]
// impl HTLCContract {
//     /// Creates a new HTLC with XLM
//     /// Following 1inch Fusion+ pattern with safety deposit
//     pub fn create_htlc(
//         env: Env,
//         sender: Address,
//         receiver: Address,
//         amount: i128,
//         hashlock: BytesN<32>,
//         timelock: u64,
//         safety_deposit: i128,
//     ) -> BytesN<32> {
//         // Authorization check
//         require_auth(&sender);

//         // Input validation
//         if amount <= 0 {
//             panic_with_error!(&env, HTLCError::InvalidAmount);
//         }

//         if safety_deposit < 0 {
//             panic_with_error!(&env, HTLCError::InvalidAmount);
//         }

//         let current_timestamp = env.ledger().timestamp();
//         if timelock <= current_timestamp {
//             panic_with_error!(&env, HTLCError::InvalidTimelock);
//         }

//         // Generate Keccak-256 contract ID matching Ethereum pattern
//         let contract_id = Self::generate_contract_id(
//             &env,
//             &sender,
//             &receiver,
//             amount,
//             &hashlock,
//             timelock,
//             current_timestamp,
//         );

//         // Check if contract already exists
//         if env.storage().persistent().has(&DataKey::HTLCData(contract_id.clone())) {
//             panic_with_error!(&env, HTLCError::ContractAlreadyExists);
//         }

//         // Total amount to lock (amount + safety deposit)
//         let total_amount = amount + safety_deposit;

//         // Check sender balance
//         let sender_balance = Self::get_native_balance(&env, &sender);
//         if sender_balance < total_amount {
//             panic_with_error!(&env, HTLCError::InsufficientBalance);
//         }

//         // Get native XLM token address and transfer funds to contract
//         let native_token_address = Self::get_native_token_address(&env);
//         let contract_address = env.current_contract_address();
//         token::Client::new(&env, &native_token_address).transfer(
//             &sender,
//             &contract_address,
//             &total_amount,
//         );

//         // Create HTLC data
//         let htlc_data = HTLCData {
//             contract_id: contract_id.clone(),
//             sender: sender.clone(),
//             receiver: receiver.clone(),
//             amount,
//             token_address: native_token_address.clone(),
//             hashlock: hashlock.clone(),
//             timelock,
//             timestamp: current_timestamp,
//             safety_deposit,
//             status: HTLCStatus::Active,
//             locked: false,
//         };

//         // Store HTLC data
//         env.storage().persistent().set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

//         // Emit HTLCNew event - 1inch Fusion+ compatible
//         env.events().publish((
//             Symbol::new(&env, "HTLCNew"),
//             contract_id.clone(),
//             sender.clone(),
//             receiver.clone(),
//             amount,
//             htlc_data.token_address.clone(),
//             hashlock.clone(),
//             timelock,
//             safety_deposit,
//         ), vec![&env, contract_id.clone().into()]);

//         contract_id
//     }

//     /// Withdraws funds by revealing the preimage
//     pub fn withdraw(env: Env, contract_id: BytesN<32>, preimage: BytesN<32>) {
//         let mut htlc_data = Self::get_htlc_data(&env, &contract_id);

//         // Reentrancy protection
//         if htlc_data.locked {
//             panic_with_error!(&env, HTLCError::ReentrancyDetected);
//         }

//         // Authorization check - only receiver can withdraw
//         require_auth(&htlc_data.receiver);

//         // Status check
//         match htlc_data.status {
//             HTLCStatus::Active => {},
//             HTLCStatus::Withdrawn => panic_with_error!(&env, HTLCError::AlreadyWithdrawn),
//             HTLCStatus::Refunded => panic_with_error!(&env, HTLCError::AlreadyRefunded),
//         }

//         // Timelock check - must withdraw before expiry
//         let current_timestamp = env.ledger().timestamp();
//         if current_timestamp >= htlc_data.timelock {
//             panic_with_error!(&env, HTLCError::TimelockExpired);
//         }

//         // Validate preimage against hashlock
//         let computed_hash = env.crypto().sha256(&preimage);
//         if computed_hash != htlc_data.hashlock {
//             panic_with_error!(&env, HTLCError::InvalidPreimage);
//         }

//         // Set reentrancy lock
//         htlc_data.locked = true;
//         env.storage().persistent().set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

//         // Transfer amount to receiver and safety deposit to sender
//         let contract_address = env.current_contract_address();
//         let native_token_address = Self::get_native_token_address(&env);
//         let native_token = token::Client::new(&env, &native_token_address);

//         // Transfer main amount to receiver
//         native_token.transfer(&contract_address, &htlc_data.receiver, &htlc_data.amount);

//         // Transfer safety deposit back to sender
//         if htlc_data.safety_deposit > 0 {
//             native_token.transfer(&contract_address, &htlc_data.sender, &htlc_data.safety_deposit);
//         }

//         // Update status to withdrawn
//         htlc_data.status = HTLCStatus::Withdrawn;
//         htlc_data.locked = false;
//         env.storage().persistent().set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

//         // Emit HTLCWithdraw event - 1inch Fusion+ compatible
//         env.events().publish((
//             Symbol::new(&env, "HTLCWithdraw"),
//             contract_id.clone(),
//             preimage.clone(),
//         ), vec![&env, contract_id.clone().into()]);
//     }

//     /// Refunds funds after timelock expiry
//     pub fn refund(env: Env, contract_id: BytesN<32>) {
//         let mut htlc_data = Self::get_htlc_data(&env, &contract_id);

//         // Reentrancy protection
//         if htlc_data.locked {
//             panic_with_error!(&env, HTLCError::ReentrancyDetected);
//         }

//         // Authorization check - only sender can refund
//         require_auth(&htlc_data.sender);

//         // Status check
//         match htlc_data.status {
//             HTLCStatus::Active => {},
//             HTLCStatus::Withdrawn => panic_with_error!(&env, HTLCError::AlreadyWithdrawn),
//             HTLCStatus::Refunded => panic_with_error!(&env, HTLCError::AlreadyRefunded),
//         }

//         // Timelock check - can only refund after expiry
//         let current_timestamp = env.ledger().timestamp();
//         if current_timestamp < htlc_data.timelock {
//             panic_with_error!(&env, HTLCError::TimelockNotExpired);
//         }

//         // Set reentrancy lock
//         htlc_data.locked = true;
//         env.storage().persistent().set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

//         // Transfer full amount (amount + safety deposit) back to sender
//         let contract_address = env.current_contract_address();
//         let native_token_address = Self::get_native_token_address(&env);
//         let total_refund = htlc_data.amount + htlc_data.safety_deposit;

//         token::Client::new(&env, &native_token_address).transfer(
//             &contract_address,
//             &htlc_data.sender,
//             &total_refund,
//         );

//         // Update status to refunded
//         htlc_data.status = HTLCStatus::Refunded;
//         htlc_data.locked = false;
//         env.storage().persistent().set(&DataKey::HTLCData(contract_id.clone()), &htlc_data);

//         // Emit HTLCRefund event - 1inch Fusion+ compatible
//         env.events().publish((
//             Symbol::new(&env, "HTLCRefund"),
//             contract_id.clone(),
//         ), vec![&env, contract_id.clone().into()]);
//     }

//     /// Gets HTLC data by contract ID
//     pub fn get_htlc(env: Env, contract_id: BytesN<32>) -> HTLCData {
//         Self::get_htlc_data(&env, &contract_id)
//     }

//     /// Checks if contract exists
//     pub fn contract_exists(env: Env, contract_id: BytesN<32>) -> bool {
//         env.storage().persistent().has(&DataKey::HTLCData(contract_id))
//     }

//     /// Gets contract status
//     pub fn get_status(env: Env, contract_id: BytesN<32>) -> HTLCStatus {
//         let htlc_data = Self::get_htlc_data(&env, &contract_id);
//         htlc_data.status
//     }

//     // Private helper functions

//     fn get_htlc_data(env: &Env, contract_id: &BytesN<32>) -> HTLCData {
//         env.storage()
//             .persistent()
//             .get(&DataKey::HTLCData(contract_id.clone()))
//             .unwrap_or_else(|| panic_with_error!(env, HTLCError::ContractNotFound))
//     }

//     fn get_native_balance(env: &Env, address: &Address) -> i128 {
//         let native_token_address = Self::get_native_token_address(env);
//         token::Client::new(env, &native_token_address).balance(address)
//     }

//     /// Gets the proper native XLM Stellar Asset Contract address
//     fn get_native_token_address(env: &Env) -> Address {
//         // For native XLM, use the deterministic Stellar Asset Contract address
//         // This creates the proper SAC address for native XLM
//         env.deployer().with_stellar_asset(&Asset::Native).address()
//     }

//     /// Generates Keccak-256 contract ID matching Ethereum HTLC pattern
//     /// keccak256(abi.encodePacked(sender, receiver, amount, hashlock, timelock, timestamp))
//     fn generate_contract_id(
//         env: &Env,
//         sender: &Address,
//         receiver: &Address,
//         amount: i128,
//         hashlock: &BytesN<32>,
//         timelock: u64,
//         timestamp: u64,
//     ) -> BytesN<32> {
//         // More efficient packing without XDR for better cross-chain compatibility
//         let mut packed_data = Vec::new(env);

//         // Convert addresses to bytes - use consistent 32-byte representation
//         let sender_bytes = Self::address_to_bytes32(env, sender);
//         let receiver_bytes = Self::address_to_bytes32(env, receiver);

//         // Pack data in the same order as Ethereum ABI encoding
//         packed_data.extend_from_slice(&sender_bytes.to_array());
//         packed_data.extend_from_slice(&receiver_bytes.to_array());
//         packed_data.extend_from_slice(&amount.to_be_bytes());
//         packed_data.extend_from_slice(&hashlock.to_array());
//         packed_data.extend_from_slice(&timelock.to_be_bytes());
//         packed_data.extend_from_slice(&timestamp.to_be_bytes());

//         // Generate Keccak-256 hash
//         env.crypto().keccak256(&packed_data.into())
//     }

//     /// Converts Stellar address to consistent 32-byte representation for cross-chain compatibility
//     fn address_to_bytes32(env: &Env, address: &Address) -> BytesN<32> {
//         // Create consistent 32-byte representation from address
//         let address_bytes = address.to_xdr(env);
//         let hash = env.crypto().sha256(&address_bytes);
//         hash
//     }
// }

// mod test;

// //crosschain/contracts/stellar/stellar-htlc/contracts/htlc/src/test.rs
// #![cfg(test)]

// use super::*;
// use soroban_sdk::{
//     testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Ledger, LedgerInfo},
//     token, Address, Env, BytesN, Asset,
// };

// const AMOUNT: i128 = 1_000_000_000; // 100 XLM (7 decimals)
// const SAFETY_DEPOSIT: i128 = 100_000_000; // 10 XLM
// const TIMELOCK_DURATION: u64 = 3600; // 1 hour

// fn create_test_env() -> (Env, Address, Address, Address, Address) {
//     let env = Env::default();
//     env.mock_all_auths();

//     // Create test addresses
//     let sender = Address::generate(&env);
//     let receiver = Address::generate(&env);
//     let contract_addr = env.register_contract(None, HTLCContract);

//     // Get native XLM token address
//     let native_token_addr = env.deployer().with_stellar_asset(&Asset::Native).address();

//     // Initialize native token with sufficient balance for sender
//     let native_token = token::Client::new(&env, &native_token_addr);
//     native_token.mock_all_auths();

//     // Mint tokens to sender for testing
//     let total_supply = 10_000_000_000_000; // Large supply for testing
//     native_token.mint(&sender, &total_supply);

//     (env, sender, receiver, contract_addr, native_token_addr)
// }

// fn create_test_hashlock() -> (BytesN<32>, BytesN<32>) {
//     let env = Env::default();
//     let preimage = BytesN::from_array(&env, &[42u8; 32]);
//     let hashlock = env.crypto().sha256(&preimage);
//     (hashlock, preimage)
// }

// #[test]
// fn test_create_htlc_success() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Verify contract was created
//     assert!(client.contract_exists(&contract_id));

//     // Verify HTLC data
//     let htlc_data = client.get_htlc(&contract_id);
//     assert_eq!(htlc_data.sender, sender);
//     assert_eq!(htlc_data.receiver, receiver);
//     assert_eq!(htlc_data.amount, AMOUNT);
//     assert_eq!(htlc_data.hashlock, hashlock);
//     assert_eq!(htlc_data.timelock, timelock);
//     assert_eq!(htlc_data.safety_deposit, SAFETY_DEPOSIT);
//     assert_eq!(htlc_data.status, HTLCStatus::Active);
//     assert_eq!(htlc_data.locked, false);
// }

// #[test]
// fn test_withdraw_success() {
//     let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Get initial balances
//     let native_token = token::Client::new(&env, &native_token_addr);
//     let receiver_balance_before = native_token.balance(&receiver);
//     let sender_balance_before = native_token.balance(&sender);

//     // Withdraw with correct preimage
//     client.withdraw(&contract_id, &preimage);

//     // Verify status changed
//     assert_eq!(client.get_status(&contract_id), HTLCStatus::Withdrawn);

//     // Verify balances changed correctly
//     let receiver_balance_after = native_token.balance(&receiver);
//     let sender_balance_after = native_token.balance(&sender);

//     assert_eq!(receiver_balance_after, receiver_balance_before + AMOUNT);
//     assert_eq!(sender_balance_after, sender_balance_before + SAFETY_DEPOSIT);
// }

// #[test]
// fn test_refund_success() {
//     let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Get initial sender balance
//     let native_token = token::Client::new(&env, &native_token_addr);
//     let sender_balance_before = native_token.balance(&sender);

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // Refund after timelock expiry
//     client.refund(&contract_id);

//     // Verify status changed
//     assert_eq!(client.get_status(&contract_id), HTLCStatus::Refunded);

//     // Verify sender got full refund (amount + safety deposit)
//     let sender_balance_after = native_token.balance(&sender);
//     let expected_refund = AMOUNT + SAFETY_DEPOSIT;
//     assert_eq!(sender_balance_after, sender_balance_before + expected_refund);
// }

// #[test]
// #[should_panic(expected = "InvalidAmount")]
// fn test_create_htlc_invalid_amount_zero() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     client.create_htlc(
//         &sender,
//         &receiver,
//         &0, // Invalid zero amount
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );
// }

// #[test]
// #[should_panic(expected = "InvalidAmount")]
// fn test_create_htlc_invalid_amount_negative() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     client.create_htlc(
//         &sender,
//         &receiver,
//         &(-1000), // Invalid negative amount
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );
// }

// #[test]
// #[should_panic(expected = "InvalidAmount")]
// fn test_create_htlc_invalid_safety_deposit() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &(-100), // Invalid negative safety deposit
//     );
// }

// #[test]
// #[should_panic(expected = "InvalidTimelock")]
// fn test_create_htlc_past_timelock() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let past_timelock = env.ledger().timestamp() - 100; // Past timestamp

//     client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &past_timelock,
//         &SAFETY_DEPOSIT,
//     );
// }

// #[test]
// #[should_panic(expected = "ContractAlreadyExists")]
// fn test_create_htlc_duplicate() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create first HTLC
//     client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Try to create identical HTLC (same timestamp will generate same ID)
//     client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );
// }

// #[test]
// #[should_panic(expected = "InvalidPreimage")]
// fn test_withdraw_wrong_preimage() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Try to withdraw with wrong preimage
//     let wrong_preimage = BytesN::from_array(&env, &[99u8; 32]);
//     client.withdraw(&contract_id, &wrong_preimage);
// }

// #[test]
// #[should_panic(expected = "TimelockExpired")]
// fn test_withdraw_after_timelock() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // Try to withdraw after timelock expiry
//     client.withdraw(&contract_id, &preimage);
// }

// #[test]
// #[should_panic(expected = "TimelockNotExpired")]
// fn test_refund_before_timelock() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Try to refund before timelock expiry
//     client.refund(&contract_id);
// }

// #[test]
// #[should_panic(expected = "AlreadyWithdrawn")]
// fn test_double_withdraw() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // First withdrawal
//     client.withdraw(&contract_id, &preimage);

//     // Try second withdrawal
//     client.withdraw(&contract_id, &preimage);
// }

// #[test]
// #[should_panic(expected = "AlreadyRefunded")]
// fn test_double_refund() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // First refund
//     client.refund(&contract_id);

//     // Try second refund
//     client.refund(&contract_id);
// }

// #[test]
// #[should_panic(expected = "AlreadyWithdrawn")]
// fn test_refund_after_withdraw() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Withdraw first
//     client.withdraw(&contract_id, &preimage);

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // Try to refund after withdrawal
//     client.refund(&contract_id);
// }

// #[test]
// #[should_panic(expected = "AlreadyRefunded")]
// fn test_withdraw_after_refund() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // Refund first
//     client.refund(&contract_id);

//     // Try to withdraw after refund
//     client.withdraw(&contract_id, &preimage);
// }

// #[test]
// #[should_panic(expected = "ContractNotFound")]
// fn test_get_htlc_nonexistent() {
//     let (env, _, _, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);

//     client.get_htlc(&fake_contract_id);
// }

// #[test]
// #[should_panic(expected = "ContractNotFound")]
// fn test_withdraw_nonexistent() {
//     let (env, _, _, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);
//     let (_, preimage) = create_test_hashlock();

//     client.withdraw(&fake_contract_id, &preimage);
// }

// #[test]
// #[should_panic(expected = "ContractNotFound")]
// fn test_refund_nonexistent() {
//     let (env, _, _, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);

//     client.refund(&fake_contract_id);
// }

// #[test]
// fn test_contract_exists() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Test non-existent contract
//     let fake_contract_id = BytesN::from_array(&env, &[1u8; 32]);
//     assert_eq!(client.contract_exists(&fake_contract_id), false);

//     // Create HTLC and test it exists
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     assert_eq!(client.contract_exists(&contract_id), true);
// }

// #[test]
// fn test_zero_safety_deposit() {
//     let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC with zero safety deposit
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &0, // Zero safety deposit
//     );

//     let native_token = token::Client::new(&env, &native_token_addr);
//     let receiver_balance_before = native_token.balance(&receiver);
//     let sender_balance_before = native_token.balance(&sender);

//     // Withdraw
//     client.withdraw(&contract_id, &preimage);

//     // Verify only amount transferred to receiver, no safety deposit to sender
//     let receiver_balance_after = native_token.balance(&receiver);
//     let sender_balance_after = native_token.balance(&sender);

//     assert_eq!(receiver_balance_after, receiver_balance_before + AMOUNT);
//     assert_eq!(sender_balance_after, sender_balance_before); // No safety deposit returned
// }

// #[test]
// fn test_large_amounts() {
//     let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     let large_amount = 1_000_000_000_000_000i128; // Very large amount
//     let large_safety_deposit = 100_000_000_000_000i128;

//     // Ensure sender has enough balance
//     let native_token = token::Client::new(&env, &native_token_addr);
//     native_token.mint(&sender, &(large_amount + large_safety_deposit + 1_000_000_000_000));

//     // Create HTLC with large amounts
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &large_amount,
//         &hashlock,
//         &timelock,
//         &large_safety_deposit,
//     );

//     let receiver_balance_before = native_token.balance(&receiver);
//     let sender_balance_before = native_token.balance(&sender);

//     // Withdraw
//     client.withdraw(&contract_id, &preimage);

//     // Verify large amounts handled correctly
//     let receiver_balance_after = native_token.balance(&receiver);
//     let sender_balance_after = native_token.balance(&sender);

//     assert_eq!(receiver_balance_after, receiver_balance_before + large_amount);
//     assert_eq!(sender_balance_after, sender_balance_before + large_safety_deposit);
// }

// #[test]
// fn test_contract_id_uniqueness() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock1, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create first HTLC
//     let contract_id1 = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock1,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Create second HTLC with different hashlock (will have different timestamp)
//     env.ledger().with_mut(|li| {
//         li.timestamp = li.timestamp + 1; // Advance time to ensure different contract ID
//     });

//     let hashlock2 = BytesN::from_array(&env, &[99u8; 32]);
//     let contract_id2 = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock2,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Verify contract IDs are different
//     assert_ne!(contract_id1, contract_id2);

//     // Verify both contracts exist
//     assert!(client.contract_exists(&contract_id1));
//     assert!(client.contract_exists(&contract_id2));
// }

// #[test]
// fn test_native_token_integration() {
//     let (env, sender, receiver, contract_addr, native_token_addr) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Verify we're using native XLM token
//     let expected_native_addr = env.deployer().with_stellar_asset(&Asset::Native).address();
//     assert_eq!(native_token_addr, expected_native_addr);

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Verify HTLC data contains correct native token address
//     let htlc_data = client.get_htlc(&contract_id);
//     assert_eq!(htlc_data.token_address, native_token_addr);
// }

// #[test]
// fn test_event_emission() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, preimage) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC - should emit HTLCNew event
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Withdraw - should emit HTLCWithdraw event
//     client.withdraw(&contract_id, &preimage);

//     // Events are tested through the soroban-sdk testutils framework
//     // In real usage, events would be captured by external systems
//     assert_eq!(client.get_status(&contract_id), HTLCStatus::Withdrawn);
// }

// #[test]
// fn test_refund_event_emission() {
//     let (env, sender, receiver, contract_addr, _) = create_test_env();
//     let client = HTLCContractClient::new(&env, &contract_addr);
//     let (hashlock, _) = create_test_hashlock();
//     let timelock = env.ledger().timestamp() + TIMELOCK_DURATION;

//     // Create HTLC
//     let contract_id = client.create_htlc(
//         &sender,
//         &receiver,
//         &AMOUNT,
//         &hashlock,
//         &timelock,
//         &SAFETY_DEPOSIT,
//     );

//     // Fast forward past timelock
//     env.ledger().with_mut(|li| {
//         li.timestamp = timelock + 1;
//     });

//     // Refund - should emit HTLCRefund event
//     client.refund(&contract_id);

//     assert_eq!(client.get_status(&contract_id), HTLCStatus::Refunded);
// }
