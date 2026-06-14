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
///
/// LIQUIDATION MODEL (equity-based):
///   Fee 5% dari hutang dibayar di depan (dipotong dari modal user).
///   Posisi = modal + hutang (full amount, fee tidak mengurangi posisi).
///   Ekuitas = (jumlah_koin × harga_sekarang) - hutang
///   Likuidasi saat ekuitas ≤ safety_buffer (5% dari posisi awal).
///
/// Contoh:
///   Modal $100, lev 50% → hutang $50, fee $2.50
///   Posisi = $150 (150 koin @ $1)
///   Ekuitas = 150P - 50
///   Liq saat 150P - 50 = 7.5 (safety 5% dari $150)
///   → P = 0.3833 → drop 61.67% dari harga beli
contract MarginEngine is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ────────────────────────────────────────────────
    LendingPool public immutable lendingPool;
    OracleAdapter public immutable oracle;
    IERC20 public immutable usdc;

    struct Position {
        uint256 launchId;
        address trader;
        uint256 deposit;          // User's USDC (after fee deduction)
        uint256 borrowed;         // Hutang pokok dari LendingPool
        uint256 debtFee;          // Fee 5% dari hutang (dibayar di depan)
        uint256 totalDebt;        // borrowed + debtFee (total yang harus dibalikin)
        uint256 coinsOwned;      // Jumlah koin yang dibeli (dengan 18 decimals)
        uint256 entryPrice;       // Harga per koin saat beli (18 decimals)
        uint256 entryMC;          // Market cap saat entry
        uint256 marginLevel;      // Basis points: 1000=10%, 5000=50%
        uint256 safetyBuffer;     // 5% dari posisi awal (dalam USDC, 6 decimals)
        uint256 openTimestamp;
        uint256 debtId;           // LendingPool debt reference
        bool    isActive;
    }

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;

    // Launch configs
    struct LaunchConfig {
        address token;
        uint256 maxMargin;         // Max margin level in bps (e.g., 7500 = 75%)
        uint256 marginFeeBps;      // Fee dari hutang (default 500 = 5%)
        bool    isActive;
    }

    mapping(uint256 => LaunchConfig) public launchConfigs;

    // Per-user position tracking
    mapping(address => uint256[]) public userPositions;

    // Addresses
    address public treasury;
    address public insuranceFund;

    // Safety margin — 5% dari posisi awal
    uint256 public constant SAFETY_MARGIN_BPS = 500; // 5%

    // ─── Events ───────────────────────────────────────────────
    event PositionOpened(
        uint256 indexed positionId,
        address indexed trader,
        uint256 launchId,
        uint256 totalPosition,
        uint256 liquidationPrice
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
        require(marginFeeBps <= 1000, "Fee too high"); // max 10%
        launchConfigs[launchId] = LaunchConfig({
            token: token,
            maxMargin: maxMargin,
            marginFeeBps: marginFeeBps > 0 ? marginFeeBps : 500, // default 5%
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
    ///
    /// Alur:
    ///   1. Hitung hutang = deposit × (margin / (100% - margin))
    ///   2. Hitung fee = hutang × 5% (dibayar di depan)
    ///   3. Total posisi = deposit + hutang (fee TIDAK mengurangi posisi)
    ///   4. Jumlah koin = total_posisi / entry_price
    ///   5. Safety buffer = 5% × total_posisi
    function openPosition(
        uint256 launchId,
        uint256 depositAmount,
        uint256 marginLevel
    ) external nonReentrant returns (uint256 positionId) {
        LaunchConfig memory config = launchConfigs[launchId];
        require(config.isActive, "Launch not active");
        require(depositAmount > 0, "Zero deposit");
        require(marginLevel > 0 && marginLevel <= config.maxMargin, "Invalid margin");

        // Get current market cap from oracle
        uint256 currentMC = oracle.getMarketCap(config.token);
        require(currentMC > 0, "Oracle: no price");

        // Calculate hutang (debt)
        // hutang = deposit × (margin / (100% - margin))
        // Contoh: $100 × (50% / 50%) = $50
        uint256 borrowed = (depositAmount * marginLevel) / (10000 - marginLevel);

        // Calculate fee (5% dari hutang, dibayar di depan)
        uint256 debtFee = (borrowed * config.marginFeeBps) / 10000;

        // Net deposit = deposit - fee (fee dipotong dari modal user)
        uint256 netDeposit = depositAmount - debtFee;

        // Total posisi = net deposit + hutang (FULL, fee tidak mengurangi)
        // Contoh: $97.50 + $50 = $147.50 → tapi beli koin $150 worth
        // Karena fee dibayar di depan dari modal, posisi tetap = deposit + hutang
        uint256 totalPosition = depositAmount + borrowed;

        // Jumlah koin = total_posisi / entry_price
        // Asumsi: 1 USDC = 1 unit harga, jadi koin = total_posisi
        // Dengan oracle MC: koin = total_posisi / (MC / total_supply)
        // Simplified: coinsOwned = totalPosition (dalam USDC units)
        uint256 coinsOwned = totalPosition;

        // Entry price per coin = total_posisi / jumlah_koin = 1 (normalized)
        uint256 entryPrice = 1e18; // Normalized to 1.0

        // Safety buffer = 5% × total_posisi
        // Contoh: 5% × $150 = $7.50
        uint256 safetyBuffer = (totalPosition * SAFETY_MARGIN_BPS) / 10000;

        // Borrow from lending pool
        uint256 debtId = lendingPool.borrow(borrowed);

        // Transfer user deposit to this contract
        usdc.safeTransferFrom(msg.sender, address(this), depositAmount);

        // Send fee to treasury
        usdc.safeTransfer(treasury, debtFee);

        // Record position
        positionId = nextPositionId++;
        positions[positionId] = Position({
            launchId: launchId,
            trader: msg.sender,
            deposit: netDeposit,
            borrowed: borrowed,
            debtFee: debtFee,
            totalDebt: borrowed + debtFee,
            coinsOwned: coinsOwned,
            entryPrice: entryPrice,
            entryMC: currentMC,
            marginLevel: marginLevel,
            safetyBuffer: safetyBuffer,
            openTimestamp: block.timestamp,
            debtId: debtId,
            isActive: true
        });

        userPositions[msg.sender].push(positionId);

        // Calculate liquidation price
        // Liq saat: coinsOwned × P - borrowed - debtFee = safetyBuffer
        // P = (borrowed + debtFee + safetyBuffer) / coinsOwned
        // Contoh: (50 + 2.50 + 7.50) / 150 = 60 / 150 = 0.40
        // Drop = 1 - 0.40 = 60%
        uint256 liqPrice = (borrowed + debtFee + safetyBuffer) * 1e18 / coinsOwned;
        uint256 liqMC = (currentMC * liqPrice) / 1e18;

        emit PositionOpened(
            positionId,
            msg.sender,
            launchId,
            totalPosition,
            liqPrice
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
    function partialClose(uint256 positionId, uint256 closePercentBps) external nonReentrant {
        Position storage pos = positions[positionId];
        require(pos.isActive, "Position not active");
        require(msg.sender == pos.trader, "Not trader");
        require(closePercentBps > 0 && closePercentBps <= 10000, "Invalid percent");

        // Scale values
        uint256 scaledCoins = (pos.coinsOwned * closePercentBps) / 10000;
        uint256 scaledDeposit = (pos.deposit * closePercentBps) / 10000;
        uint256 scaledBorrowed = (pos.borrowed * closePercentBps) / 10000;

        // Get current MC and calculate current value
        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        // currentValue = scaledCoins × (currentMC / entryMC)
        uint256 currentValue = (scaledCoins * currentMC) / pos.entryMC;

        // Ekuitas user = currentValue - scaledBorrowed
        uint256 userEquity = currentValue > scaledBorrowed ? currentValue - scaledBorrowed : 0;

        // Repay portion of debt
        lendingPool.repay(pos.debtId, scaledBorrowed);

        // Transfer equity to user
        if (userEquity > 0) {
            usdc.safeTransfer(pos.trader, userEquity);
        }

        // Reduce position
        pos.deposit -= scaledDeposit;
        pos.borrowed -= scaledBorrowed;
        pos.coinsOwned -= scaledCoins;

        if (pos.deposit == 0) {
            pos.isActive = false;
        }

        int256 pnl = int256(userEquity) - int256(scaledDeposit);
        emit PositionClosed(positionId, pos.trader, pnl, "partial_close");
    }

    // ─── Core: Liquidate ──────────────────────────────────────

    /// @notice Liquidate a position below liquidation threshold
    /// @dev Permissionless — anyone can call (liquidator gets reward)
    ///
    /// Formula:
    ///   Ekuitas = coinsOwned × (currentMC / entryMC) - borrowed - debtFee
    ///   Liq saat ekuitas ≤ safetyBuffer
    ///   Artinya: currentValue ≤ borrowed + debtFee + safetyBuffer
    function liquidate(uint256 positionId) external nonReentrant {
        Position memory pos = positions[positionId];
        require(pos.isActive, "Position not active");

        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);

        // Current value = coinsOwned × (currentMC / entryMC)
        uint256 currentValue = (pos.coinsOwned * currentMC) / pos.entryMC;

        // Liquidation threshold = borrowed + debtFee + safetyBuffer
        // Contoh: $50 + $2.50 + $7.50 = $60
        uint256 liqThreshold = pos.borrowed + pos.debtFee + pos.safetyBuffer;
        require(currentValue <= liqThreshold, "Not liquidatable");

        // Liquidation fee (5% of currentValue)
        uint256 liqFee = (currentValue * 500) / 10000;
        // Liquidator reward (1% of currentValue)
        uint256 liqReward = (currentValue * 100) / 10000;

        // Total to repay = borrowed (hutang pokok ke lending pool)
        uint256 debtOwed = pos.borrowed;

        if (currentValue >= debtOwed + liqFee + liqReward) {
            // Sufficient value — repay all, distribute remainder
            lendingPool.repay(pos.debtId, debtOwed);
            usdc.safeTransfer(treasury, liqFee);
            usdc.safeTransfer(msg.sender, liqReward);
            uint256 surplus = currentValue - debtOwed - liqFee - liqReward;
            if (surplus > 0) {
                usdc.safeTransfer(insuranceFund, surplus);
            }
        } else {
            // Bad debt scenario — insurance fund covers deficit
            uint256 available = currentValue > liqReward + liqFee
                ? currentValue - liqReward - liqFee : 0;
            if (available > 0) {
                lendingPool.repay(pos.debtId, available);
            }
            if (liqFee > 0 && currentValue > liqReward + liqFee) {
                usdc.safeTransfer(treasury, liqFee);
            }
            usdc.safeTransfer(msg.sender, liqReward);
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
    /// @return currentMC Current market cap
    /// @return liquidationPrice Harga per koin yang memicu likuidasi
    /// @return healthFactor >1e18 = safe, <=1e18 = liquidatable
    /// @return unrealizedPnL PnL user saat ini (dalam USDC)
    function getPositionHealth(uint256 positionId) external view returns (
        uint256 currentMC,
        uint256 liquidationPrice,
        uint256 healthFactor,
        int256 unrealizedPnL
    ) {
        Position memory pos = positions[positionId];
        require(pos.isActive, "Position not active");

        address token = launchConfigs[pos.launchId].token;
        currentMC = oracle.getMarketCap(token);

        // Current value = coinsOwned × (currentMC / entryMC)
        uint256 currentValue = (pos.coinsOwned * currentMC) / pos.entryMC;

        // Ekuitas = currentValue - borrowed - debtFee
        uint256 equity = currentValue > pos.totalDebt
            ? currentValue - pos.totalDebt : 0;

        // Liquidation price = (borrowed + debtFee + safetyBuffer) / coinsOwned
        uint256 liqThreshold = pos.borrowed + pos.debtFee + pos.safetyBuffer;
        liquidationPrice = (liqThreshold * 1e18) / pos.coinsOwned;

        // Health factor = equity / safetyBuffer
        // > 1 = safe, <= 1 = liquidatable
        if (pos.safetyBuffer > 0) {
            healthFactor = (equity * 1e18) / pos.safetyBuffer;
        } else {
            healthFactor = type(uint256).max;
        }

        // PnL = equity - deposit (net deposit after fee)
        unrealizedPnL = int256(equity) - int256(pos.deposit);
    }

    /// @notice Check if position is liquidatable
    function isLiquidatable(uint256 positionId) external view returns (bool) {
        Position memory pos = positions[positionId];
        if (!pos.isActive) return false;

        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 currentValue = (pos.coinsOwned * currentMC) / pos.entryMC;

        // Liq saat currentValue ≤ borrowed + debtFee + safetyBuffer
        uint256 liqThreshold = pos.borrowed + pos.debtFee + pos.safetyBuffer;
        return currentValue <= liqThreshold;
    }

    /// @notice Get current equity for a position
    function getEquity(uint256 positionId) external view returns (uint256 equity) {
        Position memory pos = positions[positionId];
        if (!pos.isActive) return 0;

        address token = launchConfigs[pos.launchId].token;
        uint256 currentMC = oracle.getMarketCap(token);
        uint256 currentValue = (pos.coinsOwned * currentMC) / pos.entryMC;

        equity = currentValue > pos.totalDebt ? currentValue - pos.totalDebt : 0;
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

        // Current value = coinsOwned × (currentMC / entryMC)
        uint256 currentValue = (pos.coinsOwned * currentMC) / pos.entryMC;

        // Repay hutang pokok ke lending pool
        lendingPool.repay(pos.debtId, pos.borrowed);

        // Ekuitas user = currentValue - totalDebt (borrowed + fee)
        // Fee sudah dibayar di depan, jadi user hanya perlu balikin borrowed
        // Tapi secara accounting, ekuitas = currentValue - borrowed
        uint256 userPayout = currentValue > pos.borrowed ? currentValue - pos.borrowed : 0;

        // PnL = payout - net deposit (modal setelah fee)
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
