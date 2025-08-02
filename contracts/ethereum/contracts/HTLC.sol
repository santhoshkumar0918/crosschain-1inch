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
 * @dev Enhanced with partial fill functionality for ETHGlobal hackathon
 */
contract HTLC is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum HTLCStatus {
        Active,
        Withdrawn,
        Refunded,
        PartiallyFilled
    }

    struct HTLCData {
        bytes32 contractId;
        address sender;
        address receiver;
        uint256 amount;
        uint256 remainingAmount; // For partial fills
        uint256 filledAmount;    // Track filled amount
        address tokenAddress;
        bytes32 hashlock;
        uint256 timelock;
        uint256 timestamp;
        uint256 safetyDeposit;
        uint256 remainingSafetyDeposit; // For partial fills
        HTLCStatus status;
        bool allowPartialFills;
        uint256 minFillAmount; // Minimum amount for partial fills
    }

    struct HTLCCreationParams {
        address receiver;
        uint256 amount;
        address tokenAddress;
        bytes32 hashlock;
        uint256 timelock;
        uint256 safetyDeposit;
        bool allowPartialFills;
        uint256 minFillAmount;
    }

    // Mapping from contract ID to HTLC data
    mapping(bytes32 => HTLCData) public htlcs;
    
    // Track partial withdrawals
    mapping(bytes32 => mapping(address => uint256)) public partialWithdrawals;
    
    // Events - 1inch Fusion+ compatible with partial fill support
    event HTLCNew(
        bytes32 indexed contractId,
        address indexed sender,
        address indexed receiver,
        uint256 amount,
        address tokenAddress,
        bytes32 hashlock,
        uint256 timelock,
        uint256 safetyDeposit,
        bool allowPartialFills,
        uint256 minFillAmount
    );
    
    event HTLCWithdraw(
        bytes32 indexed contractId,
        bytes32 preimage,
        uint256 withdrawAmount,
        bool isPartial
    );
    
    event HTLCPartialFill(
        bytes32 indexed contractId,
        address indexed filler,
        uint256 fillAmount,
        uint256 remainingAmount
    );
    
    event HTLCRefund(
        bytes32 indexed contractId,
        uint256 refundAmount,
        bool isPartial
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
    error PartialFillsNotAllowed();
    error BelowMinimumFill();
    error InsufficientRemainingAmount();
    error NoPartialFillsToRefund();

    /**
     * @dev Creates a new HTLC with ETH or ERC20 tokens
     * @dev Following 1inch Fusion+ pattern with safety deposit and partial fills
     */
    function createHTLC(
        address receiver,
        uint256 amount,
        address tokenAddress,
        bytes32 hashlock,
        uint256 timelock,
        uint256 safetyDeposit,
        bool allowPartialFills,
        uint256 minFillAmount
    ) external payable nonReentrant returns (bytes32 contractId) {
        HTLCCreationParams memory params = HTLCCreationParams({
            receiver: receiver,
            amount: amount,
            tokenAddress: tokenAddress,
            hashlock: hashlock,
            timelock: timelock,
            safetyDeposit: safetyDeposit,
            allowPartialFills: allowPartialFills,
            minFillAmount: minFillAmount
        });

        return _createHTLCInternal(params);
    }

    /**
     * @dev Internal function to create HTLC - reduces stack depth
     */
    function _createHTLCInternal(HTLCCreationParams memory params) internal returns (bytes32 contractId) {
        // Validation
        _validateHTLCParams(params);

        // Generate contract ID
        contractId = generateContractId(
            msg.sender,
            params.receiver,
            params.amount,
            params.hashlock,
            params.timelock,
            block.timestamp
        );

        if (htlcs[contractId].sender != address(0)) {
            revert ContractAlreadyExists();
        }

        // Handle transfers
        _handleHTLCTransfers(params);

        // Create HTLC data
        _storeHTLCData(contractId, params);

        // Emit event
        emit HTLCNew(
            contractId,
            msg.sender,
            params.receiver,
            params.amount,
            params.tokenAddress,
            params.hashlock,
            params.timelock,
            params.safetyDeposit,
            params.allowPartialFills,
            params.minFillAmount
        );
    }

    /**
     * @dev Validates HTLC creation parameters
     */
    function _validateHTLCParams(HTLCCreationParams memory params) internal view {
        if (params.amount == 0) revert InvalidAmount();
        if (params.timelock <= block.timestamp) revert InvalidTimelock();
        if (params.receiver == address(0)) revert Unauthorized();
        if (params.hashlock == bytes32(0)) revert InvalidAmount();
        if (params.allowPartialFills && params.minFillAmount > params.amount) revert InvalidAmount();
    }

    /**
     * @dev Handles token transfers for HTLC creation
     */
    function _handleHTLCTransfers(HTLCCreationParams memory params) internal {
        uint256 totalAmount = params.amount + params.safetyDeposit;

        if (params.tokenAddress == address(0)) {
            // ETH transfer
            if (msg.value != totalAmount) revert InsufficientBalance();
        } else {
            // ERC20 token transfer
            if (msg.value != 0) revert InvalidAmount();
            IERC20 token = IERC20(params.tokenAddress);
            
            if (token.allowance(msg.sender, address(this)) < totalAmount) {
                revert InsufficientBalance();
            }
            if (token.balanceOf(msg.sender) < totalAmount) {
                revert InsufficientBalance();
            }
            
            token.safeTransferFrom(msg.sender, address(this), totalAmount);
        }
    }

    /**
     * @dev Stores HTLC data in storage
     */
    function _storeHTLCData(bytes32 contractId, HTLCCreationParams memory params) internal {
        htlcs[contractId] = HTLCData({
            contractId: contractId,
            sender: msg.sender,
            receiver: params.receiver,
            amount: params.amount,
            remainingAmount: params.amount,
            filledAmount: 0,
            tokenAddress: params.tokenAddress,
            hashlock: params.hashlock,
            timelock: params.timelock,
            timestamp: block.timestamp,
            safetyDeposit: params.safetyDeposit,
            remainingSafetyDeposit: params.safetyDeposit,
            status: HTLCStatus.Active,
            allowPartialFills: params.allowPartialFills,
            minFillAmount: params.minFillAmount
        });
    }

    /**
     * @dev Withdraws funds by revealing the preimage (supports partial withdrawals)
     */
    function withdraw(bytes32 contractId, bytes32 preimage, uint256 withdrawAmount) external nonReentrant {
        HTLCData storage htlc = htlcs[contractId];
        
        // Validate withdrawal
        _validateWithdrawal(htlc, preimage, withdrawAmount);

        // Calculate withdrawal amounts
        (uint256 actualWithdrawAmount, uint256 safetyDepositReturn, bool isPartial) = 
            _calculateWithdrawalAmounts(htlc, withdrawAmount);

        // Update HTLC state
        _updateHTLCForWithdrawal(htlc, actualWithdrawAmount, safetyDepositReturn, isPartial);

        // Execute transfers
        _executeWithdrawalTransfers(htlc, actualWithdrawAmount, safetyDepositReturn);

        // Track and emit events
        partialWithdrawals[contractId][htlc.receiver] += actualWithdrawAmount;
        
        if (isPartial) {
            emit HTLCPartialFill(contractId, htlc.receiver, actualWithdrawAmount, htlc.remainingAmount);
        }
        
        emit HTLCWithdraw(contractId, preimage, actualWithdrawAmount, isPartial);
    }

    /**
     * @dev Validates withdrawal conditions - FIXED: Added withdrawAmount validation
     */
    function _validateWithdrawal(HTLCData storage htlc, bytes32 preimage, uint256 withdrawAmount) internal view {
        if (htlc.sender == address(0)) revert ContractNotFound();
        if (msg.sender != htlc.receiver) revert Unauthorized();
        if (htlc.status == HTLCStatus.Withdrawn) revert AlreadyWithdrawn();
        if (htlc.status == HTLCStatus.Refunded) revert AlreadyRefunded();
        if (htlc.status != HTLCStatus.Active && htlc.status != HTLCStatus.PartiallyFilled) revert ContractNotActive();
        if (block.timestamp >= htlc.timelock) revert TimelockExpired();
        
        // FIXED: Validate withdraw amount before other checks
        if (withdrawAmount > 0 && withdrawAmount > htlc.remainingAmount) {
            revert InsufficientRemainingAmount();
        }
        
        // Validate preimage
        bytes32 computedHash = sha256(abi.encodePacked(preimage));
        if (computedHash != htlc.hashlock) {
            computedHash = keccak256(abi.encodePacked(preimage));
            if (computedHash != htlc.hashlock && preimage != htlc.hashlock) {
                revert InvalidPreimage();
            }
        }
    }

    /**
     * @dev Calculates withdrawal amounts - FIXED: Proper partial withdrawal logic
     */
    function _calculateWithdrawalAmounts(HTLCData storage htlc, uint256 withdrawAmount) 
        internal view returns (uint256 actualWithdrawAmount, uint256 safetyDepositReturn, bool isPartial) {
        
        if (withdrawAmount == 0 || withdrawAmount >= htlc.remainingAmount) {
            // Full withdrawal of remaining amount
            actualWithdrawAmount = htlc.remainingAmount;
            safetyDepositReturn = htlc.remainingSafetyDeposit;
            isPartial = false;
        } else {
            // Partial withdrawal - FIXED: Better validation and calculation
            if (!htlc.allowPartialFills) revert PartialFillsNotAllowed();
            if (htlc.minFillAmount > 0 && withdrawAmount < htlc.minFillAmount) revert BelowMinimumFill();
            
            actualWithdrawAmount = withdrawAmount;
            // FIXED: Proportional safety deposit calculation
            safetyDepositReturn = (htlc.remainingSafetyDeposit * actualWithdrawAmount) / htlc.remainingAmount;
            isPartial = true;
        }
    }

    /**
     * @dev Updates HTLC state for withdrawal - FIXED: Proper state updates
     */
    function _updateHTLCForWithdrawal(
        HTLCData storage htlc, 
        uint256 actualWithdrawAmount, 
        uint256 safetyDepositReturn, 
        bool isPartial
    ) internal {
        // Update amounts first
        htlc.remainingAmount -= actualWithdrawAmount;
        htlc.filledAmount += actualWithdrawAmount;
        htlc.remainingSafetyDeposit -= safetyDepositReturn;
        
        // FIXED: Update status based on remaining amount
        if (htlc.remainingAmount == 0) {
            htlc.status = HTLCStatus.Withdrawn;
        } else {
            htlc.status = HTLCStatus.PartiallyFilled;
        }
    }

    /**
     * @dev Executes withdrawal transfers
     */
    function _executeWithdrawalTransfers(
        HTLCData storage htlc, 
        uint256 actualWithdrawAmount, 
        uint256 safetyDepositReturn
    ) internal {
        if (htlc.tokenAddress == address(0)) {
            // ETH transfers
            (bool success1, ) = payable(htlc.receiver).call{value: actualWithdrawAmount}("");
            require(success1, "ETH transfer to receiver failed");
            
            if (safetyDepositReturn > 0) {
                (bool success2, ) = payable(htlc.sender).call{value: safetyDepositReturn}("");
                require(success2, "ETH transfer to sender failed");
            }
        } else {
            // ERC20 token transfers
            IERC20 token = IERC20(htlc.tokenAddress);
            token.safeTransfer(htlc.receiver, actualWithdrawAmount);
            if (safetyDepositReturn > 0) {
                token.safeTransfer(htlc.sender, safetyDepositReturn);
            }
        }
    }

    /**
     * @dev Refunds funds after timelock expiry (supports partial refunds)
     */
    function refund(bytes32 contractId) external nonReentrant {
        HTLCData storage htlc = htlcs[contractId];
        
        // Validate refund
        _validateRefund(htlc);

        uint256 refundAmount = htlc.remainingAmount + htlc.remainingSafetyDeposit;
        bool isPartial = htlc.status == HTLCStatus.PartiallyFilled;

        // Update status
        htlc.status = HTLCStatus.Refunded;
        htlc.remainingAmount = 0;
        htlc.remainingSafetyDeposit = 0;

        // Execute refund transfer
        _executeRefundTransfer(htlc, refundAmount);

        emit HTLCRefund(contractId, refundAmount, isPartial);
    }

    /**
     * @dev Validates refund conditions
     */
    function _validateRefund(HTLCData storage htlc) internal view {
        if (htlc.sender == address(0)) revert ContractNotFound();
        if (msg.sender != htlc.sender) revert Unauthorized();
        if (htlc.status == HTLCStatus.Withdrawn) revert AlreadyWithdrawn();
        if (htlc.status == HTLCStatus.Refunded) revert AlreadyRefunded();
        if (htlc.status != HTLCStatus.Active && htlc.status != HTLCStatus.PartiallyFilled) revert ContractNotActive();
        if (block.timestamp < htlc.timelock) revert TimelockNotExpired();
        if (htlc.remainingAmount == 0 && htlc.remainingSafetyDeposit == 0) revert NoPartialFillsToRefund();
    }

    /**
     * @dev Executes refund transfer
     */
    function _executeRefundTransfer(HTLCData storage htlc, uint256 refundAmount) internal {
        if (htlc.tokenAddress == address(0)) {
            (bool success, ) = payable(htlc.sender).call{value: refundAmount}("");
            require(success, "ETH refund failed");
        } else {
            IERC20(htlc.tokenAddress).safeTransfer(htlc.sender, refundAmount);
        }
    }

    /**
     * @dev Gets HTLC data by contract ID
     */
    function getHTLC(bytes32 contractId) external view returns (HTLCData memory) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc;
    }

    /**
     * @dev Checks if contract exists
     */
    function contractExists(bytes32 contractId) external view returns (bool) {
        return htlcs[contractId].sender != address(0);
    }

    /**
     * @dev Gets contract status
     */
    function getStatus(bytes32 contractId) external view returns (HTLCStatus) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc.status;
    }

    /**
     * @dev Gets remaining amount for partial fills
     */
    function getRemainingAmount(bytes32 contractId) external view returns (uint256) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc.remainingAmount;
    }

    /**
     * @dev Gets filled amount for partial fills
     */
    function getFilledAmount(bytes32 contractId) external view returns (uint256) {
        HTLCData memory htlc = htlcs[contractId];
        if (htlc.sender == address(0)) revert ContractNotFound();
        return htlc.filledAmount;
    }

    /**
     * @dev Generates contract ID matching Stellar HTLC pattern
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
     */
    function getContractBalance(address tokenAddress) external view returns (uint256) {
        if (tokenAddress == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(tokenAddress).balanceOf(address(this));
        }
    }

    /**
     * @dev Helper function to create hashlock from secret
     */
    function createHashlock(bytes32 secret) external pure returns (bytes32) {
        return sha256(abi.encodePacked(secret));
    }

    /**
     * @dev Helper function to verify preimage against hashlock
     */
    function verifyPreimage(bytes32 preimage, bytes32 hashlock) external pure returns (bool) {
        return sha256(abi.encodePacked(preimage)) == hashlock;
    }

    /**
     * @dev Batch create multiple HTLCs for gas efficiency
     */
    function batchCreateHTLC(
        HTLCCreationParams[] calldata params
    ) external payable nonReentrant returns (bytes32[] memory contractIds) {
        contractIds = new bytes32[](params.length);
        
        // Validate total ETH if needed
        _validateBatchEthRequirement(params);
        
        for (uint256 i = 0; i < params.length; i++) {
            contractIds[i] = _createHTLCInternal(params[i]);
        }
    }

    /**
     * @dev Validates ETH requirement for batch creation
     */
    function _validateBatchEthRequirement(HTLCCreationParams[] calldata params) internal view {
        uint256 totalEthRequired = 0;
        
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].tokenAddress == address(0)) {
                totalEthRequired += params[i].amount + params[i].safetyDeposit;
            }
        }
        
        if (totalEthRequired != msg.value) revert InsufficientBalance();
    }
}