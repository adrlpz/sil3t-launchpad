// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SiL3tFactory.sol";
import "../src/mock/MockUSDC.sol";

contract SiL3tTest is Test {
    SiL3tFactory public factory;
    MockUSDC public usdc;
    OracleAdapter public oc;
    MarginEngine public me;
    address public user1 = makeAddr("user1");
    address public lp = makeAddr("lp");

    function setUp() public {
        usdc = new MockUSDC();
        factory = new SiL3tFactory(address(this));
        factory.initialize(address(usdc), address(this), address(this));
        oc = factory.oracle();
        me = factory.marginEngine();
        usdc.mint(user1, 10000e6);
        usdc.mint(lp, 100000e6);

        vm.startPrank(lp);
        usdc.approve(address(factory.lendingPool()), 50000e6);
        factory.lendingPool().deposit(50000e6);
        vm.stopPrank();
    }

    function _launch() internal returns (uint256 lid, address token) {
        token = makeAddr("tok");
        factory.registerToken(token, address(0), OracleAdapter.OracleType.MANUAL, 0);
        vm.prank(address(factory));
        oc.setPrice(token, 200000e18);
        lid = factory.createLaunch(
            token, "Test", "TST", 50000e6, 1e6, 50000e18, 5000,
            block.timestamp, block.timestamp + 7 days
        );
    }

    function test_Deployment() public view {
        assertTrue(factory.initialized());
    }

    function test_OpenClosePosition() public {
        (uint256 lid, address token) = _launch();

        vm.startPrank(user1);
        usdc.approve(address(me), 200e6);
        uint256 pid = me.openPosition(lid, 100e6, 5000);
        vm.stopPrank();

        // Price goes up 50% — simulate AMM proceeds
        vm.prank(address(factory));
        oc.setPrice(token, 300000e18);

        // In production: sell tokens on AMM → receive profit USDC.
        // For MVP test: inject the profit (99.25 USDC) into MarginEngine.
        usdc.mint(address(me), 100e6);

        vm.prank(user1);
        me.closePosition(pid);
    }

    function test_Liquidation() public {
        (uint256 lid, address token) = _launch();

        vm.startPrank(user1);
        usdc.approve(address(me), 200e6);
        uint256 pid = me.openPosition(lid, 100e6, 5000);
        vm.stopPrank();

        // Price drops
        vm.prank(address(factory));
        oc.setPrice(token, 80000e18);

        address liq = makeAddr("liq");
        vm.prank(liq);
        me.liquidate(pid);
    }
}
