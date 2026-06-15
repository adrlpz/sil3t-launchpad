// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SiL3tFactory.sol";
import "../src/SiL3tToken.sol";

contract TestDeploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        SiL3tFactory factory = SiL3tFactory(0x2208A0710AAD12A20aE17791B94a54FA7123E1ed);

        bytes32 salt = 0x86dd465acf1fd6199838cb120fa467626cddf84bca228efb43d589667058629a;
        string memory name = "SiL3t Test Token";
        string memory symbol = "sTST";
        uint8 decimals = 18;
        uint256 totalSupply = 1000000 * 10**18;
        address recipient = deployer;

        // Predict
        (address predicted, bool valid) = factory.predictAddress(salt, name, symbol, decimals, totalSupply, recipient);
        console.log("Predicted:", predicted);
        console.log("Valid:", valid);

        vm.startBroadcast(deployerKey);

        address token = factory.deployToken(salt, name, symbol, decimals, totalSupply, recipient);
        console.log("Deployed at:", token);

        vm.stopBroadcast();
    }
}
