// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./SiL3tToken.sol";

/// @title SiL3tFactory — Deploy tokens with vanity address suffix "51131"
/// @notice Uses CREATE2 to deploy token contracts whose address ends with "51131"
///
/// Flow:
///   1. Off-chain: brute-force salt until address ends with "51131"
///   2. On-chain: factory.deployToken(salt, name, symbol, ...) → address ends with "51131"
///
/// The factory uses CREATE2:
///   address = keccak256(0xff ++ factory ++ salt ++ keccak(bytecode))[12:]
///   We search for salt where last 5 hex chars = "51131"
contract SiL3tFactory is Ownable {

    // ─── Events ───────────────────────────────────────────────

    event TokenDeployed(
        address indexed token,
        string name,
        string symbol,
        uint256 totalSupply,
        bytes32 salt,
        address indexed deployer
    );

    // ─── State ────────────────────────────────────────────────

    /// @notice Record of all deployed tokens
    address[] public deployedTokens;

    /// @notice Mapping to check if address is a siL3t token
    mapping(address => bool) public isSiL3tToken;

    /// @notice Required suffix (hex-valid)
    /// "51131" — all chars valid hex (0-9, a-f)
    string public constant SUFFIX = "51131";

    // ─── Constructor ──────────────────────────────────────────

    constructor(address _owner) Ownable(_owner) {}

    // ─── Core: Deploy Token with Vanity Address ───────────────

    /// @notice Deploy a token using a pre-computed salt
    /// @dev Caller MUST have found a valid salt off-chain where
    ///      CREATE2(factory, salt, bytecode) address ends with "51131"
    /// @param salt The salt that produces a vanity address ending in "51131"
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param decimals Token decimals (usually 18)
    /// @param totalSupply Total supply in smallest units
    /// @param recipient Who receives the total supply
    /// @return token The deployed token address (ends with "sil3t")
    function deployToken(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 totalSupply,
        address recipient
    ) external onlyOwner returns (address token) {
        // Build creation code with constructor args
        bytes memory bytecode = abi.encodePacked(
            type(SiL3tToken).creationCode,
            abi.encode(name, symbol, decimals, totalSupply, recipient)
        );

        // Compute CREATE2 address
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        token = address(uint160(uint256(hash)));

        // Verify suffix
        require(
            _hasSuffix(token, SUFFIX),
            "Invalid salt: address does not end with 51131"
        );

        // Deploy via CREATE2
        token = address(new SiL3tToken{salt: salt}(name, symbol, decimals, totalSupply, recipient));

        // Record
        deployedTokens.push(token);
        isSiL3tToken[token] = true;

        emit TokenDeployed(token, name, symbol, totalSupply, salt, msg.sender);
    }

    // ─── Verification ─────────────────────────────────────────

    /// @notice Verify a salt will produce a valid vanity address (call before deploy)
    /// @param salt The salt to verify
    /// @param name Token name
    /// @param symbol Token symbol
    /// @param decimals Token decimals
    /// @param totalSupply Total supply
    /// @param recipient Supply recipient
    /// @return predicted The predicted deploy address
    /// @return valid Whether the address ends with "51131"
    function predictAddress(
        bytes32 salt,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 totalSupply,
        address recipient
    ) external returns (address predicted, bool valid) {
        bytes memory bytecode = _getBytecode(name, symbol, decimals, totalSupply, recipient);
        predicted = _predict(salt, bytecode);
        valid = _hasSuffix(predicted, SUFFIX);
    }

    /// @notice Batch predict addresses for multiple salts (gas-efficient for off-chain search)
    function batchPredict(
        bytes32[] calldata salts,
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 totalSupply,
        address recipient
    ) external returns (address[] memory addresses, bool[] memory valids) {
        bytes memory bytecode = _getBytecode(name, symbol, decimals, totalSupply, recipient);
        bytes32 bytecodeHash = keccak256(bytecode);
        
        uint256 len = salts.length;
        addresses = new address[](len);
        valids = new bool[](len);
        
        for (uint256 i = 0; i < len; i++) {
            addresses[i] = _predictWithHash(salts[i], bytecodeHash);
            valids[i] = _hasSuffix(addresses[i], SUFFIX);
        }
    }

    function _getBytecode(
        string calldata name,
        string calldata symbol,
        uint8 decimals,
        uint256 totalSupply,
        address recipient
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            type(SiL3tToken).creationCode,
            abi.encode(name, symbol, decimals, totalSupply, recipient)
        );
    }

    function _predict(bytes32 salt, bytes memory bytecode) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        return address(uint160(uint256(hash)));
    }

    function _predictWithHash(bytes32 salt, bytes32 bytecodeHash) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                bytecodeHash
            )
        );
        return address(uint160(uint256(hash)));
    }

    // ─── Query ────────────────────────────────────────────────

    function getDeployedTokens() external view returns (address[] memory) {
        return deployedTokens;
    }

    function getDeployedCount() external view returns (uint256) {
        return deployedTokens.length;
    }

    // ─── Internal ─────────────────────────────────────────────

    /// @dev Check if address ends with given suffix (case-insensitive hex)
    function _hasSuffix(address addr, string memory suffix) internal pure returns (bool) {
        bytes memory addrHex = bytes(_addressToHex(addr));
        bytes memory suf = bytes(suffix);

        if (suf.length > addrHex.length) return false;

        uint256 offset = addrHex.length - suf.length;
        for (uint256 i = 0; i < suf.length; i++) {
            // Case-insensitive comparison
            bytes1 a = _toLower(addrHex[offset + i]);
            bytes1 b = _toLower(suf[i]);
            if (a != b) return false;
        }
        return true;
    }

    /// @dev Convert address to lowercase hex string (without 0x prefix)
    function _addressToHex(address addr) internal pure returns (string memory) {
        bytes20 value = bytes20(uint160(addr));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(40);
        for (uint256 i = 0; i < 20; i++) {
            str[i * 2]     = alphabet[uint8(value[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }

    /// @dev Convert byte to lowercase
    function _toLower(bytes1 b) internal pure returns (bytes1) {
        if (b >= 0x41 && b <= 0x5A) { // A-Z
            return bytes1(uint8(b) + 32);
        }
        return b;
    }
}
