// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SiL3tToken.sol";

/// @title Find bytecode hash the factory uses, then search for vanity salt
contract FindSalt is Script {
    function run() external {
        // Compute the bytecode hash that the factory will use
        bytes memory bytecode = abi.encodePacked(
            type(SiL3tToken).creationCode,
            abi.encode("SiL3t Test Token", "sTST", uint8(18), uint256(1000000 * 10**18), address(0xB60aa2Bb88b36ffbE1F7F222da7524895DF33fA6))
        );
        bytes32 bytecodeHash = keccak256(bytecode);
        emit log_bytes32(bytecodeHash);
        emit log_uint(bytecode.length);
    }
}
