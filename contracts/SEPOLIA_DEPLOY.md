# siL3t — Sepolia L1 Testnet Addresses
# Deployed: 2026-06-14
# Chain: Ethereum Sepolia (11155111)
# Deployer: 0xB60aa2Bb88b36ffbE1F7F222da7524895DF33fA6

## Contract Addresses

| Contract       | Address                                      |
|---------------|----------------------------------------------|
| MockUSDC      | 0x7ae6a06e25b456c14ba6d81a9c493fbc9f8860b8   |
| OracleAdapter | 0x33a641b90dffc22bc027a8ea8732c2973c591eea   |
| InsuranceFund | 0xfae728a4070634a32f78df485c924d42c17ad46e   |
| FeeCollector  | 0xa51dc2cdb1ec62c2422a160dd5d6263f5a930fbb   |
| LendingPool   | 0x865a029b11fb37e7ea0f4a81bc1600c8e8f76d3a   |
| LaunchPool    | 0xaa1cd285da4da9883279263e12a67ac43e3aa52e   |
| MarginEngine  | 0x6d52368d0157152b5ce85842fe491d7a8a097852   |

## Verification

```bash
# Verify on Etherscan (needs ETHERSCAN_API_KEY)
forge verify-contract 0x7ae6a06e25b456c14ba6d81a9c493fbc9f8860b8 src/mock/MockUSDC.sol:MockUSDC --chain sepolia
forge verify-contract 0x33a641b90dffc22bc027a8ea8732c2973c591eea src/OracleAdapter.sol:OracleAdapter --chain sepolia
forge verify-contract 0xfae728a4070634a32f78df485c924d42c17ad46e src/InsuranceFund.sol:InsuranceFund --chain sepolia
forge verify-contract 0xa51dc2cdb1ec62c2422a160dd5d6263f5a930fbb src/FeeCollector.sol:FeeCollector --chain sepolia
forge verify-contract 0x865a029b11fb37e7ea0f4a81bc1600c8e8f76d3a src/LendingPool.sol:LendingPool --chain sepolia
forge verify-contract 0xaa1cd285da4da9883279263e12a67ac43e3aa52e src/LaunchPool.sol:LaunchPool --chain sepolia
forge verify-contract 0x6d52368d0157152b5ce85842fe491d7a8a097852 src/MarginEngine.sol:MarginEngine --chain sepolia
```

## Explorer Links

- [MockUSDC](https://sepolia.etherscan.io/address/0x7ae6a06e25b456c14ba6d81a9c493fbc9f8860b8)
- [OracleAdapter](https://sepolia.etherscan.io/address/0x33a641b90dffc22bc027a8ea8732c2973c591eea)
- [InsuranceFund](https://sepolia.etherscan.io/address/0xfae728a4070634a32f78df485c924d42c17ad46e)
- [FeeCollector](https://sepolia.etherscan.io/address/0xa51dc2cdb1ec62c2422a160dd5d6263f5a930fbb)
- [LendingPool](https://sepolia.etherscan.io/address/0x865a029b11fb37e7ea0f4a81bc1600c8e8f76d3a)
- [LaunchPool](https://sepolia.etherscan.io/address/0xaa1cd285da4da9883279263e12a67ac43e3aa52e)
- [MarginEngine](https://sepolia.etherscan.io/address/0x6d52368d0157152b5ce85842fe491d7a8a097852)
