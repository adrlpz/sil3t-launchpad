// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LaunchPool — Per-launch contract for token sales
contract LaunchPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Launch {
        address token;
        string  name;
        string  symbol;
        uint256 targetRaise;
        uint256 currentRaise;
        uint256 tokenPrice;
        uint256 totalTokens;
        uint256 marketCap;
        uint256 maxMargin;
        uint256 startTime;
        uint256 endTime;
        bool    finalized;
        bool    cancelled;
    }

    IERC20 public immutable usdc;
    mapping(uint256 => Launch) public launches;
    mapping(uint256 => mapping(address => uint256)) public userDeposits;
    uint256 public nextLaunchId;
    uint256 public launchpadFeeBps = 300;
    address public feeCollector;

    event LaunchCreated(uint256 indexed launchId, address indexed token, uint256 targetRaise, uint256 marketCap);
    event DepositMade(uint256 indexed launchId, address indexed user, uint256 amount);
    event TokensClaimed(uint256 indexed launchId, address indexed user, uint256 tokens);
    event LaunchFinalized(uint256 indexed launchId, uint256 totalRaised);
    event LaunchCancelled(uint256 indexed launchId);

    constructor(address _usdc, address _feeCollector, address _owner) Ownable(_owner) {
        usdc = IERC20(_usdc);
        feeCollector = _feeCollector;
    }

    function setFeeCollector(address _fc) external onlyOwner { feeCollector = _fc; }

    function setLaunchpadFee(uint256 _bps) external onlyOwner {
        require(_bps <= 1000, "Fee too high");
        launchpadFeeBps = _bps;
    }

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
        require(targetRaise > 0 && tokenPrice > 0 && totalTokens > 0, "Invalid params");
        require(endTime > startTime, "Invalid times");
        require(maxMargin <= 7500, "Margin too high");

        launchId = nextLaunchId++;
        Launch storage l = launches[launchId];
        l.token = token;
        l.name = name;
        l.symbol = symbol;
        l.targetRaise = targetRaise;
        l.tokenPrice = tokenPrice;
        l.totalTokens = totalTokens;
        l.marketCap = targetRaise;
        l.maxMargin = maxMargin;
        l.startTime = startTime;
        l.endTime = endTime;

        emit LaunchCreated(launchId, token, targetRaise, targetRaise);
    }

    function deposit(uint256 launchId, uint256 amount) external nonReentrant {
        Launch storage l = launches[launchId];
        require(!l.finalized && !l.cancelled, "Not active");
        require(block.timestamp >= l.startTime && block.timestamp <= l.endTime, "Time");
        require(amount > 0 && l.currentRaise + amount <= l.targetRaise, "Amount");

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        l.currentRaise += amount;
        userDeposits[launchId][msg.sender] += amount;

        emit DepositMade(launchId, msg.sender, amount);
    }

    function finalizeLaunch(uint256 launchId) external onlyOwner {
        Launch storage l = launches[launchId];
        require(!l.finalized && !l.cancelled, "Already done");
        require(l.currentRaise > 0, "No deposits");

        uint256 fee = (l.currentRaise * launchpadFeeBps) / 10000;
        if (fee > 0) usdc.safeTransfer(feeCollector, fee);

        l.finalized = true;
        emit LaunchFinalized(launchId, l.currentRaise);
    }

    function claimTokens(uint256 launchId) external nonReentrant {
        Launch storage l = launches[launchId];
        require(l.finalized, "Not finalized");

        uint256 deposit = userDeposits[launchId][msg.sender];
        require(deposit > 0, "No deposit");

        uint256 tokens = (deposit * 1e6) / l.tokenPrice;
        require(tokens > 0, "Zero tokens");

        userDeposits[launchId][msg.sender] = 0;
        IERC20(l.token).safeTransfer(msg.sender, tokens);

        emit TokensClaimed(launchId, msg.sender, tokens);
    }

    function cancelLaunch(uint256 launchId) external onlyOwner {
        launches[launchId].cancelled = true;
        emit LaunchCancelled(launchId);
    }

    function claimRefund(uint256 launchId) external nonReentrant {
        require(launches[launchId].cancelled, "Not cancelled");
        uint256 deposit = userDeposits[launchId][msg.sender];
        require(deposit > 0, "No deposit");
        userDeposits[launchId][msg.sender] = 0;
        usdc.safeTransfer(msg.sender, deposit);
    }

    function getLaunchProgress(uint256 launchId) external view returns (uint256, uint256, uint256) {
        Launch memory l = launches[launchId];
        uint256 progress = l.targetRaise > 0 ? (l.currentRaise * 10000) / l.targetRaise : 0;
        return (l.currentRaise, l.targetRaise, progress);
    }
}
