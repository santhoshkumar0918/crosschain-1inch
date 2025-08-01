// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Updated imports for OpenZeppelin v5
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title HTLC - Hash Time-Locked Contract for Cross-Chain Atomic Swaps
 * @dev Production-ready Ethereum HTLC contract compatible with 1inch Fusion+ pattern
 * @dev Designed for cross-chain atomic swaps with Stellar blockchain
 */
contract HTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum HTLCStatus {
        Active,
        Withdrawn,
        Refunded
    }

    struct HTLCData {
        bytes32 contractId;
        address sender;
        address receiver;
        uint256 amount;
        address tokenAddress;
        bytes32 hashlock;
        uint256 timelock;
        uint256 timestamp;
        uint256 safetyDeposit;
        HTLCStatus status;
    }

    // Mapping from contract ID to HTLC data
    mapping(bytes32 => HTLCData) public htlcs;
    
    // Events - 1inch Fusion+ compatible
    event HTLCNew(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        address tokenAddress,
        bytes32 hashlock,
        uint256 timelock,
        uint256 safetyDeposit
    );
    
    event HTLCWithdraw(
        bytes32 indexed contractId,
        bytes32 preimage
    );
    
    event HTLCRefund(
        bytes32 indexed contractId
    );

    // Custom errors for gas efficiency
    error ContractAlreadyExists();
    error ContractNotFound();
    error InvalidPreimage();
    error TimelockNotExpired();
    error TimelockExpired();
    error Unauthorized();
    error InsufficientBalance();
    error InvalidAmount();
    error InvalidTimelock();
    error ContractNotActive();
    error AlreadyWithdrawn();
    error AlreadyRefunded();

    /**
     * @dev Creates a new HTLC with ETH or ERC20 tokens
     * @dev Following 1inch Fusion+ pattern with safety deposit
     * @param receiver Address that can withdraw funds with correct preimage
     * @param amount Amount of tokens/ETH to lock
     * @param tokenAddress Address of ERC20 token (address(0) for ETH)
     * @param hashlock SHA256 hash of the secret
     * @param timelock Unix timestamp when refund becomes available
     * @param safetyDeposit Additional deposit for security (in same token)
     * @return contractId Unique identifier for this HTLC
     */
    function createHTLC(
        address receiver,
        uint256 amount,
        address tokenAddress,
        bytes32 hashlock,
        uint256 timelock,
        uint256 safetyDeposit
    ) external payable nonReentrant returns (bytes32 contractId) {
        // Input validation
        if (amount == 0) revert InvalidAmount();
        if (timelock <= block.timestamp) revert InvalidTimelock();
        if (receiver == address(0)) revert Unauthorized();

        // Generate contract ID matching Stellar pattern
        contractId = generateContractId(
            msg.sender,
            receiver,
            amount,
            hashlock,
            timelock,
            block.timestamp
        );

        // Check if contract already exists
        if (htlcs[contractId].sender != address(0)) {
            revert ContractAlreadyExists();
        }

        uint256 totalAmount = amount + safetyDeposit;

        // Handle ETH vs ERC20 token transfers
        if (tokenAddress == address(0)) {
            // ETH transfer
            if (msg.value != totalAmount) revert InsufficientBalance();
        } else {
            // ERC20 token transfer
            if (msg.value != 0) revert InvalidAmount();
            IERC20 token = IERC20(tokenAddress);
            
            // Check allowance and balance
            if (token.allowance(msg.sender, address(this)) < totalAmount) {
                revert InsufficientBalance();
            }
            if (token.balanceOf(msg.sender) < totalAmount) {
                revert InsufficientBalance();
            }
            
            // Transfer tokens to contract
            token.safeTransferFrom(msg.sender, address(this), totalAmount);
        }

        // Create HTLC data
        htlcs[contractId] = HTLCData({
            contractId: contractId,
            sender: msg.sender,
            receiver: receiver,
            amount: amount,
            tokenAddress: tokenAddress,
            hashlock: hashlock,
            timelock: timelock,
            timestamp: block.timestamp,
            safetyDeposit: safetyDeposit,
            status: HTLCStatus.Active
        });

        // Emit HTLCNew event - 1inch Fusion+ compatible
        emit HTLCNew(
            contractId,
            msg.sender,
            receiver,
            amount,
            tokenAddress,
            hashlock,
            timelock,
            safetyDeposit
        );
    }

    /**
     * @dev Withdraws funds by revealing the preimage
     * @param contractId Unique identifier of the HTLC
     * @param preimage Secret that hashes to the hashlock
     */
    function withdraw(bytes32 contractId, bytes32 preimage) external nonReentrant {
        HTLCData storage htlc = htlcs[contractId];
        
        // Contract existence check
        if (htlc.sender == address(0)) revert ContractNotFound();
        
        // Authorization check - only receiver can withdraw
        if (msg.sender != htlc.receiver) revert Unauthorized();
        
        // Status check
        if (htlc.status == HTLCStatus.Withdrawn) revert AlreadyWithdrawn();
        if (htlc.status == HTLCStatus.Refunded) revert AlreadyRefunded();
        if (htlc.status != HTLCStatus.Active) revert ContractNotActive();
        
        // Timelock check - must withdraw before expiry
        if (block.timestamp >= htlc.timelock) revert TimelockExpired();
        
        // Validate preimage against hashlock
        if (sha256(abi.encodePacked(preimage)) != htlc.hashlock) {
            revert InvalidPreimage();
        }

        // Update status to withdrawn
        htlc.status = HTLCStatus.Withdrawn;

        // Transfer funds
        if (htlc.tokenAddress == address(0)) {
            // ETH transfers
            payable(htlc.receiver).transfer(htlc.amount);
            if (htlc.safetyDeposit > 0) {
                payable(htlc.sender).transfer(htlc.safetyDeposit);
            }
        } else {
            // ERC20 token transfers
            IERC20 token = IERC20(htlc.tokenAddress);
            token.safeTransfer(htlc.receiver, htlc.amount);
            if (htlc.safetyDeposit > 0) {
                token.safeTransfer(htlc.sender, htlc.safetyDeposit);
            }
        }

        // Emit HTLCWithdraw event - 1inch Fusion+ compatible
        emit HTLCWithdraw(contractId, preimage);
    }

    /**
     * @dev Refunds funds after timelock expiry
     * @param contractId Unique identifier of the HTLC
     */
    function refund(bytes32 contractId) external nonReentrant {
        HTLCData storage htlc = htlcs[contractId];
        
        // Contract existence check
        if (htlc.sender == address(0)) revert ContractNotFound();
        
        // Authorization check - only sender can refund
        if (msg.sender != htlc.sender) revert Unauthorized();
        
        // Status check
        if (htlc.status == HTLCStatus.Withdrawn) revert AlreadyWithdrawn();
        if (htlc.status == HTLCStatus.Refunded) revert AlreadyRefunded();
        if (htlc.status != HTLCStatus.Active) revert ContractNotActive();
        
        // Timelock check - can only refund after expiry
        if (block.timestamp < htlc.timelock) revert TimelockNotExpired();

        // Update status to refunded
        htlc.status = HTLCStatus.Refunded;

        uint256 totalRefund = htlc.amount + htlc.safetyDeposit;

        // Transfer full amount back to sender
        if (htlc.tokenAddress == address(0)) {
            // ETH transfer
            payable(htlc.sender).transfer(totalRefund);
        } else {
            // ERC20 token transfer
            IERC20(htlc.tokenAddress).safeTransfer(htlc.sender, totalRefund);
        }

        // Emit HTLCRefund event - 1inch Fusion+ compatible
        emit HTLCRefund(contractId);
    }

    /**
     * @dev Gets HTLC data by contract ID
     * @param contractId Unique identifier of the HTLC
     * @return HTLCData struct containing all HTLC information
     */
    function getHTLC(bytes32 contractId) external view returns (HTLCData memory) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc;
    }

    /**
     * @dev Checks if contract exists
     * @param contractId Unique identifier of the HTLC
     * @return bool indicating if contract exists
     */
    function contractExists(bytes32 contractId) external view returns (bool) {
        return htlcs[contractId].sender != address(0);
    }

    /**
     * @dev Gets contract status
     * @param contractId Unique identifier of the HTLC
     * @return HTLCStatus enum value
     */
    function getStatus(bytes32 contractId) external view returns (HTLCStatus) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc.status;
    }

    /**
     * @dev Generates contract ID matching Stellar HTLC pattern
     * @dev keccak256(abi.encodePacked(sender, receiver, amount, hashlock, timelock, timestamp))
     * @param sender Address creating the HTLC
     * @param receiver Address that can withdraw funds
     * @param amount Amount of tokens/ETH to lock
     * @param hashlock SHA256 hash of the secret
     * @param timelock Unix timestamp when refund becomes available
     * @param timestamp Block timestamp when HTLC was created
     * @return bytes32 Unique contract identifier
     */
    function generateContractId(
        address sender,
        address receiver,
        uint256 amount,
        bytes32 hashlock,
        uint256 timelock,
        uint256 timestamp
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(
            sender,
            receiver,
            amount,
            hashlock,
            timelock,
            timestamp
        ));
    }

    /**
     * @dev Emergency function to check contract balance
     * @param tokenAddress Token address (address(0) for ETH)
     * @return uint256 Contract balance
     */
    function getContractBalance(address tokenAddress) external view returns (uint256) {
        if (tokenAddress == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(tokenAddress).balanceOf(address(this));
        }
    }
}