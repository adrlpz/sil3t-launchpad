// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SiL3tProtocol.sol";
import "../src/mock/MockUSDC.sol";

/// @title Deploy siL3t Protocol
/// @notice Deploy all contracts and wire them together
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envOr("TREASURY_ADDRESS", msg.sender);
        address stakerPool = vm.envOr("STAKER_POOL_ADDRESS", msg.sender);

        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // 1. Deploy Mock USDC (testnet only — use real USDC on mainnet)
        MockUSDC usdc = new MockUSDC();
        console.log("USDC deployed at:", address(usdc));

        // 2. Deploy SiL3t Factory
        SiL3tProtocol factory = new SiL3tProtocol(deployer);
        console.log("Factory deployed at:", address(factory));

        // 3. Initialize protocol (deploys all sub-contracts)
        factory.initialize(
            address(usdc),
            treasury,
            stakerPool
        );

        // 4. Log all addresses
        console.log("siL3t Protocol Deployed!");
        console.log("USDC:          ", address(usdc));
        console.log("Factory:       ", address(factory));
        console.log("LendingPool:   ", address(factory.lendingPool()));
        console.log("MarginEngine:  ", address(factory.marginEngine()));
        console.log("LaunchPool:    ", address(factory.launchPool()));
        console.log("Oracle:        ", address(factory.oracle()));
        console.log("InsuranceFund: ", address(factory.insuranceFund()));
        console.log("FeeCollector:  ", address(factory.feeCollector()));

        vm.stopBroadcast();
    }
}
