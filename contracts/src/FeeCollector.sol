// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title FeeCollector — Collect and distribute protocol fees
contract FeeCollector is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;

    // Fee recipients
    address public treasury;
    address public insuranceFund;
    address public stakerPool;

    // Distribution ratios (in bps, must sum to 10000)
    uint256 public treasuryShareBps = 5000;    // 50%
    uint256 public insuranceShareBps = 3000;   // 30%
    uint256 public stakerShareBps = 2000;      // 20%

    uint256 public totalCollected;
    uint256 public totalDistributed;

    event FeeCollected(uint256 amount, string source);
    event FeeDistributed(uint256 treasury, uint256 insurance, uint256 stakers);
    event SharesUpdated(uint256 treasury, uint256 insurance, uint256 stakers);

    constructor(
        address _usdc,
        address _treasury,
        address _insuranceFund,
        address _stakerPool,
        address _owner
    ) Ownable(_owner) {
        usdc = IERC20(_usdc);
        treasury = _treasury;
        insuranceFund = _insuranceFund;
        stakerPool = _stakerPool;
    }

    /// @notice Deposit fees (called by MarginEngine / LaunchPool)
    function depositFee(uint256 amount, string calldata source) external {
        require(amount > 0, "Zero fee");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        totalCollected += amount;
        emit FeeCollected(amount, source);
    }

    /// @notice Distribute accumulated fees
    function distribute() external onlyOwner {
        uint256 balance = usdc.balanceOf(address(this));
        require(balance > 0, "No fees");

        uint256 toTreasury = (balance * treasuryShareBps) / 10000;
        uint256 toInsurance = (balance * insuranceShareBps) / 10000;
        uint256 toStakers = balance - toTreasury - toInsurance;

        if (toTreasury > 0) usdc.safeTransfer(treasury, toTreasury);
        if (toInsurance > 0) usdc.safeTransfer(insuranceFund, toInsurance);
        if (toStakers > 0) usdc.safeTransfer(stakerPool, toStakers);

        totalDistributed += balance;
        emit FeeDistributed(toTreasury, toInsurance, toStakers);
    }

    function setShares(
        uint256 _treasury,
        uint256 _insurance,
        uint256 _stakers
    ) external onlyOwner {
        require(_treasury + _insurance + _stakers == 10000, "Must sum to 10000");
        treasuryShareBps = _treasury;
        insuranceShareBps = _insurance;
        stakerShareBps = _stakers;
        emit SharesUpdated(_treasury, _insurance, _stakers);
    }

    function setRecipients(
        address _treasury,
        address _insurance,
        address _stakers
    ) external onlyOwner {
        treasury = _treasury;
        insuranceFund = _insurance;
        stakerPool = _stakers;
    }
}
