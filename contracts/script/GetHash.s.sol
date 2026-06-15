// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SiL3tToken.sol";

contract GetHash is Script {
    function run() external view {
        bytes memory bytecode = abi.encodePacked(
            type(SiL3tToken).creationCode,
            abi.encode("SiL3t Test Token", "sTST", uint8(18), uint256(1000000 * 10**18), address(vm.envAddress("DEPLOYER")))
        );
        // Can't emit in view, so revert with data
        bytes32 h = keccak256(bytecode);
        assembly {
            mstore(0x00, h)
            mstore(0x20, mload(bytecode))
            revert(0x00, 0x40)
        }
    }
}
