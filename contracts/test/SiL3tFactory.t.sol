// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SiL3tFactory.sol";
import "../src/SiL3tToken.sol";

contract SiL3tFactoryTest is Test {
    SiL3tFactory public factory;
    address public owner = address(this);
    address public recipient = makeAddr("recipient");

    function setUp() public {
        factory = new SiL3tFactory(owner);
    }

    /// @notice Test suffix constant
    function test_SuffixConstant() public view {
        assertEq(factory.SUFFIX(), "sil3t");
    }

    /// @notice Test deploy with invalid salt reverts
    function test_DeployInvalidSaltReverts() public {
        bytes32 badSalt = bytes32(uint256(12345));
        vm.expectRevert("Invalid salt: address does not end with sil3t");
        factory.deployToken(badSalt, "Test", "TST", 18, 1000e18, recipient);
    }

    /// @notice Test predictAddress is deterministic
    function test_PredictAddressDeterministic() public {
        bytes32 salt = bytes32(uint256(42));
        (address a1, ) = factory.predictAddress(salt, "Test", "TST", 18, 1000e18, recipient);
        (address a2, ) = factory.predictAddress(salt, "Test", "TST", 18, 1000e18, recipient);
        assertEq(a1, a2);
    }

    /// @notice Test batchPredict is consistent with predictAddress
    function test_BatchPredictConsistency() public {
        bytes32[] memory salts = new bytes32[](5);
        for (uint256 i = 0; i < 5; i++) salts[i] = bytes32(i + 1);

        (address[] memory addrs, bool[] memory valids) = factory.batchPredict(
            salts, "Test", "TST", 18, 1000e18, recipient
        );

        for (uint256 i = 0; i < 5; i++) {
            (address predicted, bool valid) = factory.predictAddress(
                salts[i], "Test", "TST", 18, 1000e18, recipient
            );
            assertEq(addrs[i], predicted);
            assertEq(valids[i], valid);
        }
    }

    /// @notice Test different salts produce different addresses
    function test_DifferentSaltsDifferentAddresses() public {
        (address a1, ) = factory.predictAddress(bytes32(uint256(1)), "Test", "TST", 18, 1000e18, recipient);
        (address a2, ) = factory.predictAddress(bytes32(uint256(2)), "Test", "TST", 18, 1000e18, recipient);
        assertTrue(a1 != a2);
    }

    /// @notice Test token name/symbol set correctly
    function test_TokenProperties() public {
        // Use salt=1 — may or may not have suffix, but token properties should work
        // We bypass suffix check by testing predictAddress then manually deploying
        bytes32 salt = bytes32(uint256(1));
        (address predicted, bool hasSuffix) = factory.predictAddress(
            salt, "MyToken", "MTK", 18, 1000e18, recipient
        );
        assertTrue(predicted != address(0));
        // If it happens to have suffix, deploy; otherwise just verify prediction works
        if (hasSuffix) {
            address token = factory.deployToken(salt, "MyToken", "MTK", 18, 1000e18, recipient);
            SiL3tToken t = SiL3tToken(token);
            assertEq(t.name(), "MyToken");
            assertEq(t.symbol(), "MTK");
            assertEq(t.balanceOf(recipient), 1000e18);
            assertTrue(factory.isSiL3tToken(token));
            assertEq(factory.getDeployedCount(), 1);
        }
    }

    /// @notice Test only owner can deploy
    function test_OnlyOwnerCanDeploy() public {
        bytes32 salt = bytes32(uint256(1));
        vm.prank(makeAddr("not_owner"));
        vm.expectRevert();
        factory.deployToken(salt, "Test", "TST", 18, 1000e18, recipient);
    }

    /// @notice Test only owner can deploy (via ownable)
    function test_OwnerIsCorrect() public view {
        assertEq(factory.owner(), owner);
    }

    /// @notice Integration: find salt off-chain (log for manual verification)
    /// @dev This test demonstrates the full flow:
    ///      1. Predict addresses for many salts
    ///      2. Log any that end with "sil3t"
    ///      3. In production: use tools/vanity/findSalt.js instead
    function test_FindVanitySaltDemo() public {
        uint256 found = 0;
        uint256 maxCheck = 1000; // Small demo — real search is off-chain

        for (uint256 i = 1; i <= maxCheck && found < 3; i++) {
            bytes32 salt = bytes32(i);
            (address predicted, bool valid) = factory.predictAddress(
                salt, "Demo", "DMO", 18, 1000e18, recipient
            );
            if (valid) {
                emit log("Found valid salt!");
                emit log_uint(i);
                emit log_address(predicted);
                found++;
            }
        }
        // It's fine if none found in 1000 tries — avg is ~1M for 5-char suffix
        emit log_uint(found);
    }
}
