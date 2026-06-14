// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title InsuranceFund — Buffer pool to cover bad debt from liquidations
contract InsuranceFund is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    uint256 public balance;

    // Track bad debt coverage
    uint256 public totalBadDebtCovered;
    uint256 public totalDeposited;

    // Authorized callers
    mapping(address => bool) public authorizedCallers;

    event Deposited(address indexed from, uint256 amount);
    event BadDebtCovered(uint256 amount, uint256 remaining);
    event CallerAuthorized(address indexed caller);

    constructor(address _usdc, address _owner) Ownable(_owner) {
        usdc = IERC20(_usdc);
    }

    function authorizeCaller(address caller) external onlyOwner {
        authorizedCallers[caller] = true;
        emit CallerAuthorized(caller);
    }

    /// @notice Deposit surplus from liquidations
    function deposit(uint256 amount) external {
        require(amount > 0, "Zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        balance += amount;
        totalDeposited += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Cover bad debt — called by MarginEngine during shortfall
    function coverBadDebt(uint256 amount) external {
        require(authorizedCallers[msg.sender], "Not authorized");
        require(amount <= balance, "Insufficient insurance");

        usdc.safeTransfer(msg.sender, amount);
        balance -= amount;
        totalBadDebtCovered += amount;

        emit BadDebtCovered(amount, balance);
    }

    /// @notice Withdraw excess (owner only, for treasury operations)
    function withdraw(uint256 amount, address to) external onlyOwner {
        require(amount <= balance, "Insufficient balance");
        usdc.safeTransfer(to, amount);
        balance -= amount;
    }

    /// @notice Get health ratio — insurance fund vs total lending pool
    function getHealthRatio(uint256 lendingPoolTotal) external view returns (uint256) {
        if (lendingPoolTotal == 0) return 10000; // 100%
        return (balance * 10000) / lendingPoolTotal;
    }
}
