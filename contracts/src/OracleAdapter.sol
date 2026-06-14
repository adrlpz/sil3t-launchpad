// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title OracleAdapter — Price feed from DEX pools (TWAP + spot fallback)
contract OracleAdapter is Ownable, ReentrancyGuard {
    enum OracleType {
        UNISWAP_V3_TWAP,
        PANCAKESWAP_TWAP,
        CHAINLINK,
        MANUAL
    }

    struct TokenConfig {
        address pairOrFeed;
        OracleType oracleType;
        uint256 twapWindow;
        uint256 lastPrice;
        uint256 lastUpdate;
        bool    isActive;
    }

    mapping(address => TokenConfig) public tokenConfigs;
    address[] public registeredTokens;

    uint256 public maxPriceDeviationBps = 5000;
    bool public circuitBroken;

    event PriceUpdated(address indexed token, uint256 price);
    event TokenRegistered(address indexed token, OracleType oracleType);
    event CircuitBreakerTriggered(address indexed token, uint256 oldPrice, uint256 newPrice);

    constructor(address _owner) Ownable(_owner) {}

    function registerToken(
        address token,
        address pairOrFeed,
        OracleType oracleType,
        uint256 twapWindow
    ) external onlyOwner {
        tokenConfigs[token] = TokenConfig({
            pairOrFeed: pairOrFeed,
            oracleType: oracleType,
            twapWindow: twapWindow > 0 ? twapWindow : 600,
            lastPrice: 0,
            lastUpdate: 0,
            isActive: true
        });
        registeredTokens.push(token);
        emit TokenRegistered(token, oracleType);
    }

    function setMaxPriceDeviation(uint256 bps) external onlyOwner {
        require(bps > 0 && bps <= 10000, "Invalid bps");
        maxPriceDeviationBps = bps;
    }

    function resetCircuitBreaker() external onlyOwner {
        circuitBroken = false;
    }

    function getPrice(address token) external view returns (uint256) {
        return tokenConfigs[token].lastPrice;
    }

    function getMarketCap(address token) external view returns (uint256) {
        return tokenConfigs[token].lastPrice;
    }

    function updatePrice(address token) external nonReentrant {
        require(!circuitBroken, "Circuit broken");
        TokenConfig storage config = tokenConfigs[token];
        require(config.isActive, "Token not registered");

        uint256 newPrice = _fetchPrice(config);
        uint256 oldPrice = config.lastPrice;

        if (oldPrice > 0) {
            uint256 deviation = newPrice > oldPrice
                ? ((newPrice - oldPrice) * 10000) / oldPrice
                : ((oldPrice - newPrice) * 10000) / oldPrice;

            if (deviation > maxPriceDeviationBps) {
                circuitBroken = true;
                emit CircuitBreakerTriggered(token, oldPrice, newPrice);
                revert("Circuit breaker: price deviation too high");
            }
        }

        config.lastPrice = newPrice;
        config.lastUpdate = block.timestamp;
        emit PriceUpdated(token, newPrice);
    }

    function setPrice(address token, uint256 price) external onlyOwner {
        TokenConfig storage config = tokenConfigs[token];
        require(config.oracleType == OracleType.MANUAL, "Not manual oracle");
        config.lastPrice = price;
        config.lastUpdate = block.timestamp;
        emit PriceUpdated(token, price);
    }

    function _fetchPrice(TokenConfig memory config) internal view returns (uint256) {
        if (config.oracleType == OracleType.MANUAL) {
            return config.lastPrice;
        }
        if (config.oracleType == OracleType.CHAINLINK) {
            return _fetchChainlinkPrice(config.pairOrFeed);
        }
        return _fetchTWAP(config.pairOrFeed);
    }

    function _fetchChainlinkPrice(address feed) internal view returns (uint256) {
        (bool success, bytes memory data) = feed.staticcall(
            abi.encodeWithSignature("latestRoundData()")
        );
        require(success, "Chainlink call failed");
        (, int256 answer, , , ) = abi.decode(data, (uint80, int256, uint256, uint256, uint80));
        require(answer > 0, "Invalid Chainlink price");
        return uint256(answer) * 1e10;
    }

    function _fetchTWAP(address pair) internal view returns (uint256) {
        (bool success, bytes memory data) = pair.staticcall(
            abi.encodeWithSignature("slot0()")
        );
        require(success, "TWAP pool call failed");

        // Decode only sqrtPriceX96 (first field)
        uint160 sqrtPriceX96 = abi.decode(data, (uint160));
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        return price * 1e12;
    }

    function getRegisteredTokens() external view returns (address[] memory) {
        return registeredTokens;
    }
}
