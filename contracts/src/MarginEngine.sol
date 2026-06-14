// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./LendingPool.sol";
import "./OracleAdapter.sol";

/// @title MarginEngine — Core margin logic for siL3t launchpad
/// @notice Manages leveraged positions: open, close, liquidate
contract MarginEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────
    LendingPool public immutable lendingPool;
    OracleAdapter public immutable oracle;
    IERC20 public immutable usdc;

    struct Position {
        uint256 launchId;
        address trader;
        uint256 deposit;        // User's USDC (after fee deduction)
        uint256 borrowed;       // Protocol loan from LendingPool
        uint256 effectiveSize;  // deposit + borrowed
        uint256 entryMC;        // Market cap at entry
        uint256 marginLevel;    // Basis points: 1000=10%, 5000=50%
        uint256 openTimestamp;
        uint256 debtId;         // LendingPool debt reference
        bool    isActive;
    }

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;

    // Launch configs
    struct LaunchConfig {
        address token;
        uint256 maxMargin;       // Max margin level in bps (e.g., 7500 = 75%)
        uint256 marginFeeBps;    // Margin fee (e.g., 150 = 1.5%)
        bool    isActive;
    }

    mapping(uint256 => LaunchConfig) public launchConfigs;

    // Per-user position tracking
    mapping(address => uint256[]) public userPositions;

    // Addresses
    address public treasury;
    address public insuranceFund;

    // Safety factor — liquidation fires slightly before full debt loss
    uint256 public constant SAFETY_FACTOR_BPS = 9500; // 95%

    // ─── Events ───────────────────────────────────────────────
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 launchId,
        uint256 effectiveSize,
        uint256 entryMC,
        uint256 liquidationMC
    );
    event PositionClosed(
        uint256 indexed positionId,
        address indexed trader,
        int256 pnl,
        string reason
    );
    event PositionLiquidated(
        uint256 indexed positionId,
        address indexed liquidator,
        uint256 debtRepaid,
        uint256 liquidationReward
    );
    event LaunchConfigSet(uint256 indexed launchId, address token, uint256 maxMargin);

    // ─── Constructor ──────────────────────────────────────────
    constructor(
        address _lendingPool,
        address _oracle,
        address _usdc,
        address _treasury,
        address _insuranceFund,
        address _owner
    ) Ownable(_owner) {
        lendingPool = LendingPool(_lendingPool);
        oracle = OracleAdapter(_oracle);
        usdc = IERC20(_usdc);
        treasury = _treasury;
        insuranceFund = _insuranceFund;

        // Approve lending pool to pull USDC for repayments
        usdc.safeIncreaseAllowance(_lendingPool, type(uint256).max);
    }

    // ─── Admin ────────────────────────────────────────────────

    function setLaunchConfig(
        uint256 launchId,
        address token,
        uint256 maxMargin,
        uint256 marginFeeBps
    ) external onlyOwner {
        require(maxMargin <= 7500, "Max margin too high");
        require(marginFeeBps <= 500, "Fee too high");
        launchConfigs[launchId] = LaunchConfig({
            token: token,
            maxMargin: maxMargin,
            marginFeeBps: marginFeeBps,
            isActive: true
        });
        emit LaunchConfigSet(launchId, token, maxMargin);
    }

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
    }

    function setInsuranceFund(address _fund) external onlyOwner {
        insuranceFund = _fund;
    }

    // ─── Core: Open Position ──────────────────────────────────

    /// @notice Open a leveraged position on a token launch
    /// @param launchId The launch ID
    /// @param depositAmount USDC amount user puts in
    /// @param marginLevel Margin level in bps (1000=10%, 5000=50%)
    function openPosition(
        uint256 launchId,
        uint256 depositAmount,
        uint256 marginLevel
    ) external nonReentrant returns (uint256 positionId) {
        LaunchConfig memory config = launchConfigs[launchId];
        require(config.isActive, "Launch not active");
        require(depositAmount > 0, "Zero deposit");
        require(marginLevel > 0 && marginLevel <= config.maxMargin, "Invalid margin");

        // Calculate loan amount
        uint256 loanAmount = (depositAmount * marginLevel) / (10000 - marginLevel);

        // Calculate margin fee (deducted from deposit)
        uint256 marginFee = (depositAmount * config.marginFeeBps) / 10000;
        uint256 netDeposit = depositAmount - marginFee;

        // Effective size = net deposit + loan
        uint256 effectiveSize = netDeposit + loanAmount;

        // Get current market cap from oracle
        uint256 currentMC = oracle.getMarketCap(config.token);
        require(currentMC > 0, "Oracle: no price");

        // Borrow from lending pool
        uint256 debtId = lendingPool.borrow(loanAmount);

        // Transfer user deposit to this contract
        usdc.safeTransferFrom(msg.sender, address(this), depositAmount);

        // Send fee to treasury
        usdc.safeTransfer(treasury, marginFee);

        // Record position
        positionId = nextPositionId++;
        positions[positionId] = Position({
            launchId: launchId,
            trader: msg.sender,
            deposit: netDeposit,
            borrowed: loanAmount,
            effectiveSize: effectiveSize,
            entryMC: currentMC,
            marginLevel: marginLevel,
            openTimestamp: block.timestamp,
            debtId: debtId,
            isActive: true
        });

        userPositions[msg.sender].push(positionId);

        // Calculate liquidation MC
        uint256 liqMC = (currentMC * (10000 - marginLevel)) / 10000;

        emit PositionOpened(
            positionId,
            msg.sender,
            launchId,
            effectiveSize,
            currentMC,
            liqMC
        );
    }

    // ─── Core: Close Position ─────────────────────────────────

    /// @notice Close full position and settle PnL
    function closePosition(uint256 positionId) external nonReentrant {
        Position memory pos = positions[positionId];
        require(pos.isActive, "Position not active");
        require(msg.sender == pos.trader || msg.sender == owner(), "Not authorized");

        _settlePosition(positionId, pos, "manual_close");
    }

    /// @notice Close partial position (percentage)
    /// @param closePercentBps Percentage to close in bps (5000 = 50%)
    function partialClose(uint256 positionId, uint256 closePercentBps) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isActive, "Position not active");
        require(msg.sender == pos.trader, "Not trader");
        require(closePercentBps > 0 && closePercentBps <= 10000, "Invalid percent");

        // Scale values
        uint256 scaledDeposit = (pos.deposit * closePercentBps) / 10000;
        uint256 scaledBorrowed = (pos.borrowed * closePercentBps) / 10000;
        uint256 scaledSize = (pos.effectiveSize * closePercentBps) / 10000;

        // Get current value
        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 currentValue = (scaledSize * currentMC) / pos.entryMC;

        // Repay portion of debt
        lendingPool.repay(pos.debtId, scaledBorrowed);

        // Transfer value to user
        if (currentValue > 0) {
            usdc.safeTransfer(pos.trader, currentValue);
        }

        // Reduce position
        pos.deposit -= scaledDeposit;
        pos.borrowed -= scaledBorrowed;
        pos.effectiveSize -= scaledSize;

        if (pos.deposit == 0) {
            pos.isActive = false;
        }

        int256 pnl = int256(currentValue) - int256(scaledSize);
        emit PositionClosed(positionId, pos.trader, pnl, "partial_close");
    }

    // ─── Core: Liquidate ──────────────────────────────────────

    /// @notice Liquidate a position below liquidation threshold
    /// @dev Permissionless — anyone can call (liquidator gets reward)
    function liquidate(uint256 positionId) external nonReentrant {
        Position memory pos = positions[positionId];
        require(pos.isActive, "Position not active");

        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 liqMC = (pos.entryMC * SAFETY_FACTOR_BPS * (10000 - pos.marginLevel)) / (10000 * 10000);
        require(currentMC <= liqMC, "Not liquidatable");

        // Current position value
        uint256 currentValue = (pos.effectiveSize * currentMC) / pos.entryMC;

        // Fees
        uint256 liqFee = (currentValue * 500) / 10000;     // 5% liquidation fee
        uint256 liqReward = (currentValue * 100) / 10000;   // 1% to liquidator

        // Repay debt
        uint256 debtOwed = pos.borrowed;
        if (currentValue >= debtOwed + liqFee + liqReward) {
            lendingPool.repay(pos.debtId, debtOwed);
            usdc.safeTransfer(treasury, liqFee);
            usdc.safeTransfer(msg.sender, liqReward);
            uint256 surplus = currentValue - debtOwed - liqFee - liqReward;
            if (surplus > 0) {
                usdc.safeTransfer(insuranceFund, surplus);
            }
        } else {
            // Bad debt scenario
            uint256 available = currentValue > liqReward + liqFee
                ? currentValue - liqReward - liqFee : 0;
            if (available > 0) {
                lendingPool.repay(pos.debtId, available);
            }
            if (liqFee > 0 && currentValue > liqReward + liqFee) {
                usdc.safeTransfer(treasury, liqFee);
            }
            usdc.safeTransfer(msg.sender, liqReward);
            // deficit = debtOwed - available → insurance fund covers
        }

        positions[positionId].isActive = false;
        emit PositionLiquidated(positionId, msg.sender, debtOwed, liqReward);
    }

    /// @notice Batch liquidate multiple positions
    function batchLiquidate(uint256[] calldata positionIds) external {
        for (uint256 i = 0; i < positionIds.length; i++) {
            try this.liquidate(positionIds[i]) {} catch {}
        }
    }

    // ─── View ─────────────────────────────────────────────────

    /// @notice Get position health status
    function getPositionHealth(uint256 positionId) external view returns (
        uint256 currentMC,
        uint256 liquidationMC,
        uint256 healthFactor,    // >1e18 = safe, <=1e18 = liquidatable
        int256 unrealizedPnL
    ) {
        Position memory pos = positions[positionId];
        require(pos.isActive, "Position not active");

        address token = launchConfigs[pos.launchId].token;
        currentMC = oracle.getMarketCap(token);
        liquidationMC = (pos.entryMC * SAFETY_FACTOR_BPS * (10000 - pos.marginLevel)) / (10000 * 10000);

        if (liquidationMC > 0) {
            healthFactor = (currentMC * 1e18) / liquidationMC;
        }

        uint256 currentValue = (pos.effectiveSize * currentMC) / pos.entryMC;
        unrealizedPnL = int256(currentValue) - int256(pos.effectiveSize);
    }

    function isLiquidatable(uint256 positionId) external view returns (bool) {
        Position memory pos = positions[positionId];
        if (!pos.isActive) return false;

        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 liqMC = (pos.entryMC * SAFETY_FACTOR_BPS * (10000 - pos.marginLevel)) / (10000 * 10000);
        return currentMC <= liqMC;
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    // ─── Internal ─────────────────────────────────────────────

    function _settlePosition(
        uint256 positionId,
        Position memory pos,
        string memory reason
    ) internal {
        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 currentValue = (pos.effectiveSize * currentMC) / pos.entryMC;

        // Repay lending pool first
        lendingPool.repay(pos.debtId, pos.borrowed);

        // User gets: currentValue - borrowed (debt goes back to pool)
        uint256 userPayout = currentValue > pos.borrowed ? currentValue - pos.borrowed : 0;

        // Calculate PnL on user's deposit
        int256 pnl = int256(userPayout) - int256(pos.deposit);

        if (userPayout > 0) {
            usdc.safeTransfer(pos.trader, userPayout);
        }

        positions[positionId].isActive = false;
        emit PositionClosed(positionId, pos.trader, pnl, reason);
    }

    // ─── Rescue ───────────────────────────────────────────────

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
}
