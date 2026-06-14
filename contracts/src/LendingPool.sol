// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LendingPool — USDC pool for margin lending
/// @notice LP deposit USDC, protocol borrows for margin positions
contract LendingPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────
    IERC20 public immutable usdc;

    uint256 public totalDeposited;      // Total USDC deposited by LPs
    uint256 public totalBorrowed;       // Total USDC currently borrowed
    uint256 public totalShares;         // Total LP shares

    mapping(address => uint256) public deposits;     // LP deposit amount
    mapping(address => uint256) public shares;       // LP share amount
    mapping(uint256 => Debt) public debts;           // Active debts

    uint256 public nextDebtId;

    // Params
    uint256 public maxUtilizationBps = 8000;  // 80% max utilization
    uint256 public baseAPRBps = 500;          // 5% base APR
    uint256 public borrowFeeBps = 50;         // 0.5% borrow fee on open

    address public authorizedBorrower;        // MarginEngine address

    // ─── Structs ──────────────────────────────────────────────
    struct Debt {
        address borrower;
        uint256 amount;
        uint256 fee;
        uint256 startTime;
        bool    repaid;
    }

    // ─── Events ───────────────────────────────────────────────
    event Deposited(address indexed user, uint256 amount, uint256 shares);
    event Withdrawn(address indexed user, uint256 amount, uint256 shares);
    event Borrowed(address indexed borrower, uint256 debtId, uint256 amount);
    event Repaid(uint256 indexed debtId, uint256 amount, uint256 fee);
    event ParamsUpdated(uint256 maxUtilization, uint256 baseAPR, uint256 borrowFee);

    // ─── Constructor ──────────────────────────────────────────
    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20(_usdc);
    }

    // ─── Admin ────────────────────────────────────────────────

    function setAuthorizedBorrower(address _borrower) external onlyOwner {
        authorizedBorrower = _borrower;
    }

    function setParams(
        uint256 _maxUtilization,
        uint256 _baseAPR,
        uint256 _borrowFee
    ) external onlyOwner {
        require(_maxUtilization <= 9500, "Utilization too high");
        require(_baseAPR <= 2000, "APR too high");    // max 20%
        require(_borrowFee <= 500, "Fee too high");    // max 5%
        maxUtilizationBps = _maxUtilization;
        baseAPRBps = _baseAPR;
        borrowFeeBps = _borrowFee;
        emit ParamsUpdated(_maxUtilization, _baseAPR, _borrowFee);
    }

    // ─── LP Functions ─────────────────────────────────────────

    /// @notice Deposit USDC to earn yield from margin fees
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero deposit");

        uint256 share;
        if (totalShares == 0) {
            share = amount;
        } else {
            share = (amount * totalShares) / totalDeposited;
        }

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        deposits[msg.sender] += amount;
        shares[msg.sender] += share;
        totalDeposited += amount;
        totalShares += share;

        emit Deposited(msg.sender, amount, share);
    }

    /// @notice Withdraw USDC (pro-rata share of pool)
    function withdraw(uint256 shareAmount) external nonReentrant {
        require(shareAmount > 0 && shareAmount <= shares[msg.sender], "Invalid share");

        uint256 usdcAmount = (shareAmount * totalDeposited) / totalShares;
        require(
            totalDeposited - usdcAmount >= totalBorrowed,
            "Pool utilization too high"
        );

        shares[msg.sender] -= shareAmount;
        totalShares -= shareAmount;
        deposits[msg.sender] -= usdcAmount;
        totalDeposited -= usdcAmount;

        usdc.safeTransfer(msg.sender, usdcAmount);

        emit Withdrawn(msg.sender, usdcAmount, shareAmount);
    }

    // ─── Borrower Functions ───────────────────────────────────

    /// @notice Borrow USDC for margin position (only authorized borrower)
    function borrow(uint256 amount) external nonReentrant returns (uint256 debtId) {
        require(msg.sender == authorizedBorrower, "Not authorized");
        require(amount > 0, "Zero borrow");

        uint256 available = getAvailableLiquidity();
        require(amount <= available, "Insufficient liquidity");

        uint256 fee = (amount * borrowFeeBps) / 10000;

        debtId = nextDebtId++;
        debts[debtId] = Debt({
            borrower: msg.sender,
            amount: amount,
            fee: fee,
            startTime: block.timestamp,
            repaid: false
        });

        totalBorrowed += amount;

        // Transfer borrowed USDC to the borrower (MarginEngine)
        usdc.safeTransfer(msg.sender, amount);

        emit Borrowed(msg.sender, debtId, amount);
    }

    /// @notice Repay debt + fee
    function repay(uint256 debtId, uint256 amount) external nonReentrant {
        Debt storage debt = debts[debtId];
        require(!debt.repaid, "Already repaid");
        require(msg.sender == debt.borrower || msg.sender == owner(), "Not authorized");

        uint256 totalOwed = debt.amount + debt.fee;
        uint256 repayAmount = amount > totalOwed ? totalOwed : amount;

        usdc.safeTransferFrom(msg.sender, address(this), repayAmount);

        // Fee first, then principal
        uint256 remaining = repayAmount;
        uint256 feePayment = remaining > debt.fee ? debt.fee : remaining;
        debt.fee -= feePayment;
        remaining -= feePayment;
        uint256 principalPayment = remaining > debt.amount ? debt.amount : remaining;
        debt.amount -= principalPayment;

        if (debt.amount == 0 && debt.fee == 0) {
            debt.repaid = true;
        }

        uint256 totalRepaid = feePayment + principalPayment;
        totalBorrowed -= totalRepaid > totalBorrowed ? totalBorrowed : totalRepaid;
        totalDeposited += totalRepaid; // Fee goes to pool (increases LP value)

        emit Repaid(debtId, totalRepaid, feePayment);
    }

    // ─── View ─────────────────────────────────────────────────

    function getAvailableLiquidity() public view returns (uint256) {
        uint256 maxBorrow = (totalDeposited * maxUtilizationBps) / 10000;
        if (totalBorrowed >= maxBorrow) return 0;
        return maxBorrow - totalBorrowed;
    }

    function getUtilization() public view returns (uint256) {
        if (totalDeposited == 0) return 0;
        return (totalBorrowed * 10000) / totalDeposited;
    }

    function getDebt(uint256 debtId) external view returns (
        address borrower,
        uint256 amount,
        uint256 fee,
        uint256 totalOwed,
        bool repaid
    ) {
        Debt memory d = debts[debtId];
        return (d.borrower, d.amount, d.fee, d.amount + d.fee, d.repaid);
    }
}
