// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./LendingPool.sol";
import "./MarginEngine.sol";
import "./LaunchPool.sol";
import "./OracleAdapter.sol";
import "./InsuranceFund.sol";
import "./FeeCollector.sol";

/// @title SiL3tProtocol — Protocol deployer and config manager
/// @notice Deploys all protocol contracts and manages global config
contract SiL3tProtocol is Ownable {

    // ─── Protocol Contracts ───────────────────────────────────
    LendingPool public lendingPool;
    MarginEngine public marginEngine;
    LaunchPool public launchPool;
    OracleAdapter public oracle;
    InsuranceFund public insuranceFund;
    FeeCollector public feeCollector;

    // ─── State ────────────────────────────────────────────────
    bool public initialized;

    // Global params
    uint256 public constant MAX_MARGIN = 7500;  // 75% hard cap
    uint256 public constant MAX_FEE = 500;      // 5% hard cap

    // ─── Events ───────────────────────────────────────────────
    event ProtocolInitialized(
        address lendingPool,
        address marginEngine,
        address launchPool,
        address oracle,
        address insuranceFund,
        address feeCollector
    );

    constructor(address _owner) Ownable(_owner) {}

    /// @notice Initialize all protocol contracts
    function initialize(
        address _usdc,
        address _treasury,
        address _stakerPool
    ) external onlyOwner {
        require(!initialized, "Already initialized");

        // Deploy Oracle
        oracle = new OracleAdapter(address(this));

        // Deploy LendingPool
        lendingPool = new LendingPool(_usdc, address(this));

        // Deploy InsuranceFund
        insuranceFund = new InsuranceFund(_usdc, address(this));

        // Deploy FeeCollector
        feeCollector = new FeeCollector(
            _usdc,
            _treasury,
            address(insuranceFund),
            _stakerPool,
            address(this)
        );

        // Deploy LaunchPool
        launchPool = new LaunchPool(_usdc, address(feeCollector), address(this));

        // Deploy MarginEngine
        marginEngine = new MarginEngine(
            address(lendingPool),
            address(oracle),
            _usdc,
            _treasury,
            address(insuranceFund),
            address(this)
        );

        // Wire up permissions
        lendingPool.setAuthorizedBorrower(address(marginEngine));
        insuranceFund.authorizeCaller(address(marginEngine));

        initialized = true;

        emit ProtocolInitialized(
            address(lendingPool),
            address(marginEngine),
            address(launchPool),
            address(oracle),
            address(insuranceFund),
            address(feeCollector)
        );
    }

    // ─── Launch Management ────────────────────────────────────

    /// @notice Create a new token launch
    function createLaunch(
        address token,
        string calldata name,
        string calldata symbol,
        uint256 targetRaise,
        uint256 tokenPrice,
        uint256 totalTokens,
        uint256 maxMargin,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (uint256 launchId) {
        require(initialized, "Not initialized");

        launchId = launchPool.createLaunch(
            token, name, symbol,
            targetRaise, tokenPrice, totalTokens,
            maxMargin, startTime, endTime
        );

        // Also configure margin engine for this launch
        uint256 marginFeeBps = 150; // 1.5% default
        if (maxMargin > 5000) marginFeeBps = 200; // 2% for high margin

        marginEngine.setLaunchConfig(launchId, token, maxMargin, marginFeeBps);
    }

    /// @notice Register a token in the oracle
    function registerToken(
        address token,
        address pairOrFeed,
        OracleAdapter.OracleType oracleType,
        uint256 twapWindow
    ) external onlyOwner {
        oracle.registerToken(token, pairOrFeed, oracleType, twapWindow);
    }

    // ─── Admin ────────────────────────────────────────────────

    function setTreasury(address _treasury) external onlyOwner {
        marginEngine.setTreasury(_treasury);
    }

    function setInsuranceFund(address _fund) external onlyOwner {
        marginEngine.setInsuranceFund(_fund);
    }
}
