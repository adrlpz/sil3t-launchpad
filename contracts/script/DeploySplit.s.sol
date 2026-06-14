// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/LendingPool.sol";
import "../src/LaunchPool.sol";
import "../src/MarginEngine.sol";
import "../src/OracleAdapter.sol";
import "../src/InsuranceFund.sol";
import "../src/FeeCollector.sol";
import "../src/mock/MockUSDC.sol";

/// @title Deploy siL3t Protocol — Split Deploy (no factory)
/// @notice Deploys each contract individually to avoid contract size limits
contract DeploySplit is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address stakerPool = vm.envOr("STAKER_POOL_ADDRESS", deployer);

        vm.startBroadcast(deployerKey);

        // 1. Deploy Mock USDC (testnet only)
        MockUSDC usdc = new MockUSDC();
        console.log("USDC:", address(usdc));

        // 2. Deploy Oracle
        OracleAdapter oracle = new OracleAdapter(deployer);
        console.log("OracleAdapter:", address(oracle));

        // 3. Deploy Insurance Fund
        InsuranceFund insurance = new InsuranceFund(address(usdc), deployer);
        console.log("InsuranceFund:", address(insurance));

        // 4. Deploy Fee Collector
        FeeCollector fees = new FeeCollector(address(usdc), treasury, address(insurance), stakerPool, deployer);
        console.log("FeeCollector:", address(fees));

        // 5. Deploy Lending Pool
        LendingPool lending = new LendingPool(address(usdc), deployer);
        console.log("LendingPool:", address(lending));

        // 6. Deploy Launch Pool
        LaunchPool launch = new LaunchPool(address(usdc), address(fees), deployer);
        console.log("LaunchPool:", address(launch));

        // 7. Deploy Margin Engine
        MarginEngine margin = new MarginEngine(
            address(lending),
            address(oracle),
            address(usdc),
            treasury,
            address(insurance),
            deployer
        );
        console.log("MarginEngine:", address(margin));

        // 8. Wire: LendingPool authorize MarginEngine
        lending.setAuthorizedBorrower(address(margin));
        console.log("LendingPool authorized MarginEngine");

        // 9. Wire: InsuranceFund authorize MarginEngine
        insurance.authorizeCaller(address(margin));
        console.log("InsuranceFund authorized MarginEngine");

        // 10. Mint test USDC to deployer for testing
        usdc.mint(deployer, 1000000e6);
        console.log("Minted 1M test USDC to deployer");

        // 11. Seed lending pool
        usdc.approve(address(lending), 500000e6);
        lending.deposit(500000e6);
        console.log("Seeded lending pool with 500K USDC");

        // 12. Seed insurance fund
        usdc.approve(address(insurance), 100000e6);
        insurance.deposit(100000e6);
        console.log("Seeded insurance fund with 100K USDC");

        vm.stopBroadcast();

        console.log("\n=== siL3t Protocol Deployed to Sepolia L1 ===");
        console.log("Deployer:", deployer);
        console.log("Chain: Sepolia (11155111)");
        console.log("\nSave these addresses for frontend config!");
    }
}
