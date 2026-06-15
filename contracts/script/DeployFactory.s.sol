// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SiL3tFactory.sol";

/// @title Deploy SiL3tFactory (vanity address deployer)
contract DeployFactory is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        SiL3tFactory factory = new SiL3tFactory(deployer);
        console.log("SiL3tFactory deployed at:", address(factory));
        console.log("Owner:", deployer);

        vm.stopBroadcast();
    }
}
