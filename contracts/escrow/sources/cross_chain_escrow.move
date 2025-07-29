/*
/// Module: escrow
module escrow::escrow;
*/

// For Move coding conventions, see
// https://docs.sui.io/concepts/sui-move-concepts/conventions

// contracts/sui/escrow-contract/sources/cross_chain_escrow.move
module cross_chain_escrow::escrow {
    use sui::object::{Self, UID, ID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use std::vector;
    use std::string::{Self, String};

    // Error codes
    const E_INVALID_ESCROW: u64 = 1;
    const E_UNAUTHORIZED: u64 = 2;
    const E_ESCROW_EXPIRED: u64 = 3;
    const E_INSUFFICIENT_AMOUNT: u64 = 4;

    // Escrow state
    struct CrossChainEscrow has key, store {
        id: UID,
        sender: address,
        recipient: address,
        amount: u64,
        source_chain: String,
        dest_chain: String,
        source_tx_hash: String,
        status: u8, // 0: Pending, 1: Completed, 2: Cancelled
        timeout: u64,
        relayer_fee: u64,
    }

    // Global escrow registry
    struct EscrowRegistry has key {
        id: UID,
        escrows: vector<ID>,
        total_locked: u64,
        admin: address,
    }

    // Events
    struct EscrowCreated has copy, drop {
        escrow_id: ID,
        sender: address,
        recipient: address,
        amount: u64,
        source_chain: String,
        dest_chain: String,
        source_tx_hash: String,
    }

    struct EscrowCompleted has copy, drop {
        escrow_id: ID,
        recipient: address,
        amount: u64,
    }

    struct EscrowCancelled has copy, drop {
        escrow_id: ID,
        sender: address,
        amount: u64,
    }

    // Initialize the escrow registry
    fun init(ctx: &mut TxContext) {
        let registry = EscrowRegistry {
            id: object::new(ctx),
            escrows: vector::empty<ID>(),
            total_locked: 0,
            admin: tx_context::sender(ctx),
        };
        transfer::share_object(registry);
    }

    // Create a new cross-chain escrow
    public entry fun create_escrow(
        registry: &mut EscrowRegistry,
        payment: Coin<SUI>,
        recipient: address,
        source_chain: vector<u8>,
        dest_chain: vector<u8>,
        source_tx_hash: vector<u8>,
        timeout: u64,
        relayer_fee: u64,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        assert!(amount > relayer_fee, E_INSUFFICIENT_AMOUNT);

        let escrow = CrossChainEscrow {
            id: object::new(ctx),
            sender: tx_context::sender(ctx),
            recipient,
            amount,
            source_chain: string::utf8(source_chain),
            dest_chain: string::utf8(dest_chain),
            source_tx_hash: string::utf8(source_tx_hash),
            status: 0, // Pending
            timeout,
            relayer_fee,
        };

        let escrow_id = object::id(&escrow);
        vector::push_back(&mut registry.escrows, escrow_id);
        registry.total_locked = registry.total_locked + amount;

        event::emit(EscrowCreated {
            escrow_id,
            sender: escrow.sender,
            recipient,
            amount,
            source_chain: escrow.source_chain,
            dest_chain: escrow.dest_chain,
            source_tx_hash: escrow.source_tx_hash,
        });

        // Store the payment
        transfer::public_transfer(payment, @cross_chain_escrow);
        transfer::share_object(escrow);
    }

    // Complete escrow (called by relayer)
    public entry fun complete_escrow(
        registry: &mut EscrowRegistry,
        escrow: &mut CrossChainEscrow,
        dest_tx_hash: vector<u8>,
        ctx: &mut TxContext
    ) {
        assert!(escrow.status == 0, E_INVALID_ESCROW);
        
        escrow.status = 1; // Completed
        registry.total_locked = registry.total_locked - escrow.amount;

        event::emit(EscrowCompleted {
            escrow_id: object::id(escrow),
            recipient: escrow.recipient,
            amount: escrow.amount,
        });
        
        // In a real implementation, you'd handle the coin transfer here
        // This is simplified for demonstration
    }

    // Cancel escrow (timeout or admin action)
    public entry fun cancel_escrow(
        registry: &mut EscrowRegistry,
        escrow: &mut CrossChainEscrow,
        ctx: &mut TxContext
    ) {
        let sender = tx_context::sender(ctx);
        assert!(
            sender == escrow.sender || sender == registry.admin,
            E_UNAUTHORIZED
        );
        assert!(escrow.status == 0, E_INVALID_ESCROW);

        escrow.status = 2; // Cancelled
        registry.total_locked = registry.total_locked - escrow.amount;

        event::emit(EscrowCancelled {
            escrow_id: object::id(escrow),
            sender: escrow.sender,
            amount: escrow.amount,
        });
    }

    // Getter functions
    public fun get_escrow_status(escrow: &CrossChainEscrow): u8 {
        escrow.status
    }

    public fun get_escrow_amount(escrow: &CrossChainEscrow): u64 {
        escrow.amount
    }
}


