# siL3t — Sepolia Testnet Deploy Guide

## Prerequisites

1. **Deployer wallet** with Sepolia ETH (≥ 0.5 ETH)
   - Faucet: https://sepoliafaucet.com / https://alchemy.com/faucets/ethereum-sepolia
2. **RPC URL** (Alchemy/Infura/public)

## Setup

```bash
cd contracts

# Create .env
cat > .env << 'EOF'
PRIVATE_KEY=your_deployer_private_key_here
SEPOLIA_RPC_URL=https://rpc.sepolia.org
TREASURY_ADDRESS=0xYOUR_TREASURY
STAKER_POOL_ADDRESS=0xYOUR_STAKER_POOL
EOF
```

## Deploy

```bash
# Load env
source .env

# Deploy all contracts (split deploy — avoids size limits)
forge script script/DeploySplit.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --broadcast \
  --verify \
  -vvv
```

## Post-Deploy

After deploy, update `api/.env` with contract addresses:

```bash
SEPOLIA_USDC=0x...
SEPOLIA_MARGIN_ENGINE=0x...
SEPOLIA_LAUNCH_POOL=0x...
SEPOLIA_LENDING_POOL=0x...
SEPOLIA_ORACLE=0x...
SEPOLIA_INSURANCE_FUND=0x...
SEPOLIA_FEE_COLLECTOR=0x...
```

## Verify Contracts

```bash
# If --verify didn't work during deploy:
forge verify-contract <CONTRACT_ADDRESS> src/ContractName.sol:ContractName \
  --chain-id 11155111 \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

## Test on Sepolia

```bash
# Mint test USDC
cast send <USDC_ADDRESS> "mint(address,uint256)" <YOUR_ADDRESS> 1000000000000 \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY

# Create a launch
cast send <LAUNCH_POOL> "createLaunch(...)" \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY
```
