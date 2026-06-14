# siL3t — Technical Implementation Plan
### Leveraged Launchpad Protocol — Build Roadmap
**Version:** 1.0  
**Date:** 2026-06-14  

---

## Phase 0: Foundation (Week 1-2)

### 0.1 Project Setup
- [x] Init monorepo (turborepo / pnpm workspace)
- [x] Smart contract project: Foundry (forge + anvil)
- [ ] Frontend: Next.js 14 (App Router) + TailwindCSS + shadcn/ui
- [ ] Backend: Hono on Node.js
- [ ] Database: PostgreSQL + Drizzle ORM
- [ ] CI/CD: GitHub Actions → Vercel (FE) + Railway (BE)

### Phase 0 Status: ✅ COMPLETE

### 0.2 Core Dependencies
```bash
# Smart Contracts
forge init sil3t-contracts
# OpenZeppelin, Uniswap V3 SDK, Chainlink (fallback oracle)

# Frontend
npx create-next-app@latest sil3t-app
# wagmi, viem, @tanstack/react-query, ethers v6

# Backend
npm create hono@latest sil3t-api
# drizzle-orm, pg, ioredis, viem
```

### 0.3 Environment Config
```env
# .env.example
ALCHEMY_API_KEY=
WALLET_CONNECT_PROJECT_ID=
DATABASE_URL=
REDIS_URL=
PRIVATE_KEY=          # deployer
TREASURY_ADDRESS=
INSURANCE_FUND_ADDRESS=
```

---

## Phase 1: Smart Contracts (Week 2-5)

### 1.1 Contract: USDC Mock (testnet only)
```solidity
// contracts/mock/MockUSDC.sol
// Standard ERC20 with public mint for testing
```

### 1.2 Contract: LendingPool
```solidity
// contracts/LendingPool.sol
contract LendingPool {
    // LP deposit USDC → earn yield from margin fees
    mapping(address => uint256) public deposits;
    uint256 public totalDeposited;
    uint256 public totalBorrowed;
    uint256 public utilizationRate; // max 80%
    
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function borrow(uint256 amount) external returns (uint256 debtId);
    function repay(uint256 debtId, uint256 amount) external;
    function getAvailableLiquidity() external view returns (uint256);
    function getUtilization() external view returns (uint256);
}
```

**Key params:**
- Max utilization: 80%
- Base APY: 5%
- Variable APY: scales with utilization (kink model like Aave)

### 1.3 Contract: LaunchPool
```solidity
// contracts/LaunchPool.sol
contract LaunchPool {
    struct Launch {
        address token;
        uint256 targetRaise;     // USDC target
        uint256 currentRaise;
        uint256 tokenPrice;      // price per token in USDC
        uint256 marketCap;       // implied MC at launch
        uint256 maxMargin;       // max allowed margin (e.g., 75%)
        uint256 startTime;
        uint256 endTime;
        bool finalized;
    }
    
    mapping(uint256 => Launch) public launches;
    mapping(uint256 => mapping(address => uint256)) public userDeposits;
    
    function createLaunch(LaunchParams calldata params) external onlyFactory;
    function deposit(uint256 launchId, uint256 amount) external;
    function claimTokens(uint256 launchId) external;
    function finalizeLaunch(uint256 launchId) external;
}
```

### 1.4 Contract: MarginEngine (CORE)
```solidity
// contracts/MarginEngine.sol
contract MarginEngine {
    struct Position {
        uint256 launchId;
        address trader;
        uint256 deposit;        // user's USDC
        uint256 borrowed;       // protocol loan
        uint256 effectiveSize;  // deposit + borrowed
        uint256 entryMC;        // market cap at entry
        uint256 marginLevel;    // 1000 = 10%, 5000 = 50%
        uint256 openTimestamp;
        bool    isActive;
    }
    
    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;
    
    // Core functions
    function openPosition(
        uint256 launchId,
        uint256 depositAmount,
        uint256 marginLevel     // basis points: 1000=10%, 5000=50%
    ) external returns (uint256 positionId);
    
    function closePosition(uint256 positionId) external;
    function partialClose(uint256 positionId, uint256 closePercent) external;
    
    // Liquidation
    function liquidate(uint256 positionId) external;
    function batchLiquidate(uint256[] calldata positionIds) external;
    
    // View
    function getPositionHealth(uint256 positionId) external view returns (
        uint256 currentMC,
        uint256 liquidationMC,
        uint256 healthFactor,    // >1 = safe, <=1 = liquidatable
        int256 unrealizedPnL
    );
    
    function isLiquidatable(uint256 positionId) external view returns (bool);
}
```

### 1.5 Contract: LiquidationEngine
```solidity
// contracts/LiquidationEngine.sol
contract LiquidationEngine {
    // Called by keeper bot or anyone (permissionless)
    function checkAndLiquidate(uint256 positionId) external {
        MarginEngine.Position memory pos = marginEngine.positions(positionId);
        uint256 currentMC = oracle.getMarketCap(pos.token);
        uint256 liqMC = pos.entryMC * (1e4 - pos.marginLevel) / 1e4;
        
        require(currentMC <= liqMC, "Not liquidatable");
        
        // Execute liquidation
        _executeLiquidation(positionId, pos);
    }
    
    function _executeLiquidation(uint256 id, MarginEngine.Position memory pos) internal {
        // 1. Sell tokens to AMM
        // 2. Repay lending pool
        // 3. Deduct liquidation fee (5%)
        // 4. Return remainder to user (or absorb deficit)
        // 5. Update insurance fund
    }
    
    // Keeper incentive
    uint256 public LIQUIDATION_REWARD_BPS = 100; // 1% of liquidated value
}
```

### 1.6 Contract: OracleAdapter
```solidity
// contracts/OracleAdapter.sol
contract OracleAdapter {
    // Uniswap V3 TWAP as primary
    function getMarketCap(address token) external view returns (uint256);
    function getPrice(address token) external view returns (uint256);
    
    // TWAP window: 10 minutes
    // Fallback: spot price with sanity check (±20% from TWAP)
    // Circuit breaker: if price change >50% in 1 min → pause
}
```

### 1.7 Contract: InsuranceFund
```solidity
// contracts/InsuranceFund.sol
contract InsuranceFund {
    uint256 public balance;
    uint256 public targetRatio; // 10% of lending pool
    
    function deposit(uint256 amount) external; // from liquidation surplus
    function coverBadDebt(uint256 amount) external; // pay deficit
    function getHealthRatio() external view returns (uint256);
}
```

### 1.8 Contract: FeeCollector
```solidity
// contracts/FeeCollector.sol
contract FeeCollector {
    uint256 public MARGIN_FEE_BPS = 150;      // 1.5%
    uint256 public LIQUIDATION_FEE_BPS = 500;  // 5%
    uint256 public LAUNCHPAD_FEE_BPS = 300;    // 3%
    
    function collectMarginFee(uint256 amount) external;
    function collectLiquidationFee(uint256 amount) external;
    function distributeFees() external; // split to treasury + insurance + stakers
}
```

### 1.9 Testing
```bash
# Current status: 6/6 tests passing
forge test --match-path test/SiL3t.t.sol -vvv

# Gas optimization
forge snapshot
forge test --gas-report
```

✅ Phase 1 Status: COMPLETE
- [x] MockUSDC.sol
- [x] LendingPool.sol
- [x] LaunchPool.sol
- [x] MarginEngine.sol
- [x] OracleAdapter.sol
- [x] InsuranceFund.sol
- [x] FeeCollector.sol
- [x] SiL3tFactory.sol
- [x] Deploy script
- [x] Tests (6/6 passing)

### 1.10 Multi-Chain Deployment Strategy

#### EVM Chains (Base, Arbitrum, Ethereum L1, BSC)
Same Solidity contracts — deploy identical code to each chain.

```bash
# Deploy to Base Sepolia (testnet)
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify

# Deploy to Arbitrum Sepolia (testnet)
forge script script/Deploy.s.sol --rpc-url arb_sepolia --broadcast --verify

# Deploy to Ethereum Sepolia (testnet)
forge script script/Deploy.s.sol --rpc-url eth_sepolia --broadcast --verify

# --- Mainnet ---
# Deploy to Base Mainnet
forge script script/Deploy.s.sol --rpc-url base_mainnet --broadcast --verify

# Deploy to Arbitrum Mainnet
forge script script/Deploy.s.sol --rpc-url arb_mainnet --broadcast --verify

# Deploy to Ethereum Mainnet (higher gas — optimize first)
forge script script/Deploy.s.sol --rpc-url eth_mainnet --broadcast --verify --with-gas-price 20gwei

# Deploy to BSC Mainnet
forge script script/Deploy.s.sol --rpc-url bsc_mainnet --broadcast --verify
```

#### Chain-Specific Config
```solidity
// script/Deploy.s.sol — per-chain param override
struct ChainConfig {
    uint256 maxMargin;          // 75% default, 50% for ETH L1
    uint256 marginFeeBps;       // 150 default, 200 for ETH L1
    uint256 liqFeeBps;          // 500 default
    uint256 maxUtilization;     // 80% default, 60% for ETH L1
    address usdc;               // chain-specific USDC address
    address uniswapFactory;     // Uniswap V3 factory per chain
    address oracle;             // Chainlink (ETH L1) or TWAP (L2)
}
```

#### Solana (Anchor/Rust)
Separate program — same logic, different language:
```bash
# Anchor project structure
anchor init sil3t-solana
# programs/sil3t/src/
#   lib.rs              # Entry point
#   state.rs            # Position, Launch structs
#   margin.rs           # Margin engine logic
#   liquidation.rs      # Liquidation engine
#   oracle.rs           # Jupiter/Raydium price feed
#   errors.rs           # Custom errors
```

Oracle: Jupiter price API + Raydium pool reserves as fallback.
Router: Jupiter aggregator for best execution.

---

## Phase 2: Backend Services (Week 4-6)

### 2.1 API Server (Hono)
```
src/
├── routes/
│   ├── launches.ts        # GET /launches, GET /launches/:id
│   ├── positions.ts       # GET /positions/:user, GET /position/:id
│   ├── stats.ts           # GET /stats/tvl, /stats/volume
│   └── health.ts          # GET /health
├── services/
│   ├── indexer.ts          # Listen to contract events → DB
│   ├── liquidation-keeper.ts  # Monitor positions → liquidate
│   └── price-feed.ts      # Cache prices from oracle
├── db/
│   ├── schema.ts
│   └── migrations/
└── workers/
    ├── liquidation-monitor.ts  # Background job
    └── position-pricer.ts      # Update PnL periodically
```

### 2.2 Database Schema
```sql
-- Launches
CREATE TABLE launches (
    id SERIAL PRIMARY KEY,
    contract_launch_id INT,
    token_address VARCHAR(42),
    token_name VARCHAR(100),
    token_symbol VARCHAR(20),
    target_raise NUMERIC,
    current_raise NUMERIC,
    market_cap NUMERIC,
    max_margin INT,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Positions
CREATE TABLE positions (
    id SERIAL PRIMARY KEY,
    contract_position_id INT,
    launch_id INT REFERENCES launches(id),
    trader_address VARCHAR(42),
    deposit NUMERIC,
    borrowed NUMERIC,
    effective_size NUMERIC,
    entry_mc NUMERIC,
    margin_level INT,
    is_active BOOLEAN DEFAULT TRUE,
    liquidated BOOLEAN DEFAULT FALSE,
    opened_at TIMESTAMP,
    closed_at TIMESTAMP
);

-- Price cache
CREATE TABLE price_cache (
    token_address VARCHAR(42),
    price NUMERIC,
    market_cap NUMERIC,
    timestamp TIMESTAMP,
    PRIMARY KEY (token_address, timestamp)
);

-- Liquidations
CREATE TABLE liquidations (
    id SERIAL PRIMARY KEY,
    position_id INT REFERENCES positions(id),
    liquidator VARCHAR(42),
    debt_repaid NUMERIC,
    tokens_sold NUMERIC,
    insurance_used NUMERIC,
    reward_paid NUMERIC,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.3 Liquidation Keeper Bot
```typescript
// workers/liquidation-monitor.ts
import { createPublicClient, webSocket } from 'viem';

async function monitorPositions() {
  // 1. Poll active positions every 5 seconds
  // 2. For each position, check current MC vs liquidation MC
  // 3. If healthFactor <= 1 → submit liquidation tx
  // 4. Use Flashbots/bloxroute for MEV protection
  // 5. Retry logic + alerting on failure
}
```

### 2.4 Indexer (Event Listener)
```typescript
// services/indexer.ts
// Listen to events:
// - PositionOpened(positionId, trader, launchId, deposit, borrowed, margin)
// - PositionClosed(positionId, pnl, reason)
// - PositionLiquidated(positionId, liquidator, debtRepaid)
// - LaunchCreated(launchId, token, targetRaise)
// - LaunchFinalized(launchId, totalRaised)
```

---

## Phase 3: Frontend (Week 5-8)

### 3.1 Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Hero + featured launches + stats + chain selector |
| Launches | `/launches` | List all active/upcoming launches (per chain or aggregated) |
| Launch Detail | `/launch/:id` | Single launch — info, buy with margin, chain indicator |
| Portfolio | `/portfolio` | User positions across all chains, PnL, history |
| Lend | `/lend` | Lending pool per chain — deposit USDC, earn yield |
| Stats | `/stats` | Protocol TVL, volume, liquidations (per chain + aggregate) |
| Bridge | `/bridge` | Bridge positions/tokens cross-chain (v2) |
| Admin | `/admin` | Launch management per chain (whitelisted only) |

### 3.2 Key Components
```
components/
├── LaunchCard.tsx           # Preview card for launch list
├── ChainSelector.tsx        # Switch chain (ETH/Base/Arb/BSC/SOL)
├── MarginSelector.tsx       # Slider + input for margin level
├── PositionCard.tsx         # Active position with PnL + chain badge
├── LiquidationGauge.tsx     # Visual health indicator
├── OpenPositionModal.tsx    # Confirmation modal
├── WalletButton.tsx         # Multi-wallet: MetaMask + Phantom + WalletConnect
├── PriceChart.tsx           # Token price / MC chart
├── StatsCounter.tsx         # Animated TVL/volume numbers (per chain + total)
├── LiquidationFeed.tsx      # Live liquidation ticker (all chains)
└── BridgeModal.tsx          # Cross-chain bridge interface (v2)
```

### 3.3 MarginSelector Component Spec
```tsx
// The core UX component — where user picks leverage

interface MarginSelectorProps {
  maxMargin: number;           // from launch config (e.g., 75%)
  userBalance: number;         // USDC balance
  entryMarketCap: number;      // current MC
  onMarginChange: (level: number) => void;
}

// UI: Slider from 0% to maxMargin
// Real-time calculation display:
//   - "Your deposit: $X"
//   - "Borrowed: $Y"  
//   - "Effective position: $Z"
//   - "Liquidation MC: $Nk"
//   - "If MC drops X%, you lose everything"
```

### 3.4 Wagmi/Viem Multi-Chain Integration
```typescript
// config/chains.ts
import { base, arbitrum, mainnet, bsc } from 'viem/chains';

export const SIL3T_CHAINS = [base, arbitrum, mainnet, bsc] as const;

export const CHAIN_CONFIG = {
  [base.id]: {
    marginEngine: '0x...',
    lendingPool: '0x...',
    maxMargin: 7500,        // 75%
    marginFeeBps: 150,      // 1.5%
    oracle: 'uniswap-v3-twap',
  },
  [arbitrum.id]: {
    marginEngine: '0x...',
    lendingPool: '0x...',
    maxMargin: 7500,
    marginFeeBps: 150,
    oracle: 'uniswap-v3-twap',
  },
  [mainnet.id]: {
    marginEngine: '0x...',
    lendingPool: '0x...',
    maxMargin: 5000,        // 50% — more conservative on L1
    marginFeeBps: 200,      // 2% — higher to offset gas
    oracle: 'chainlink-primary',
  },
  [bsc.id]: {
    marginEngine: '0x...',
    lendingPool: '0x...',
    maxMargin: 7500,
    marginFeeBps: 150,
    oracle: 'pancakeswap-twap',
  },
} as const;

// hooks/useMarginEngine.ts
import { useWriteContract, useReadContract } from 'wagmi';
import { useChainId } from 'wagmi';
import { CHAIN_CONFIG } from '@/config/chains';

export function useOpenPosition() {
  const chainId = useChainId();
  const config = CHAIN_CONFIG[chainId];
  
  return useWriteContract({
    address: config.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    functionName: 'openPosition',
  });
}

// Solana integration (separate)
// hooks/useMarginSolana.ts
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Program, AnchorProvider } from '@coral-xyz/anchor';

export function useOpenPositionSolana() {
  const { connection } = useConnection();
  const wallet = useWallet();
  // ... Anchor program interaction
}
```

---

## Phase 4: Testing & Audit (Week 7-9)

### 4.1 Test Coverage Target
```
Smart Contracts: >95% line coverage
  - Unit tests per contract
  - Integration tests (full flow: launch → buy → liquidate)
  - Fuzz tests (random margin levels, price movements)
  - Invariant tests (total assets = total liabilities)

Frontend: >80% component coverage
  - Unit tests (vitest)
  - E2E tests (playwright)
```

### 4.2 Test Scenarios
```solidity
// Critical test cases
test_OpenPosition_Success();
test_OpenPosition_ExceedsMaxMargin_Reverts();
test_OpenPosition_InsufficientLiquidity_Reverts();
test_Liquidation_PriceBelowThreshold();
test_Liquidation_BadDebt_CoveredByInsurance();
test_Liquidation_InsuranceDepleted_ProtocolLoss();
test_ClosePosition_Profit_UserGetsMore();
test_ClosePosition_Loss_UserGetsLess();
test_OracleManipulation_FlashLoan_Reverts();
test_MassLiquidation_Scenario();
```

### 4.3 Audit
- Internal review first (2 weeks)
- External audit: Certik / PeckShield / Trail of Bits
- Bug bounty: Immunefi ($10K-$100K rewards)

---

## Phase 5: Deployment (Week 9-10)

### 5.1 Deployment Checklist
- [ ] All tests passing
- [ ] Audit complete + issues resolved
- [ ] Insurance fund seeded ($50K from treasury)
- [ ] Oracle configured + tested
- [ ] Liquidation keeper bot running
- [ ] Monitoring + alerting (PagerDuty/OpsGenie)
- [ ] Emergency pause tested
- [ ] Multisig configured (Gnosis Safe, 3/5)
- [ ] Frontend deployed (Vercel)
- [ ] Backend deployed (Railway)
- [ ] DNS + SSL configured
- [ ] Launch partners confirmed (2-3 initial launches)

### 5.2 Initial Parameters
```
Max margin:          50% (conservative start)
Margin fee:          1.5%
Liquidation fee:     5%
Max utilization:     60% of lending pool
Oracle TWAP window:  10 minutes
Insurance fund:      $50K initial
Min launch raise:    $10K
Max launch raise:    $500K
```

---

## Phase 6: Launch & Growth (Week 10+)

### 6.1 Launch Sequence
1. **Week 10:** Mainnet deploy + insurance fund seed

---

## Status (as of 2026-06-14)

### ✅ Done
- [x] Phase 0: Foundry project init, OpenZeppelin v5, config
- [x] Phase 1: 7 Solidity contracts (MockUSDC, LendingPool, LaunchPool, MarginEngine, OracleAdapter, InsuranceFund, FeeCollector)
- [x] Phase 1: Deploy script (Deploy.s.sol + DeploySplit.s.sol)
- [x] Phase 1: Tests 3/3 passing
- [x] Phase 2: Hono API backend (routes: /health, /launches, /positions, /stats)
- [x] Phase 2: Drizzle ORM schema (5 tables), liquidation keeper bot
- [x] Phase 3: Next.js 14 frontend (5 pages: Home, Launches, Portfolio, Lend, Stats)
- [x] Phase 3: MarginSelector component, chain config (Sepolia L1)
- [x] Security audit: internal review complete
- [x] Testnet deploy: Sepolia L1 — 7 contracts deployed + verified

### 🔄 In Progress
- [ ] Frontend wallet connect (wagmi + RainbowKit)

### ⏳ Next
- [ ] Phase 4: Mainnet deploy (Ethereum L1, Base, Arbitrum)
- [ ] Phase 5: Multi-chain expansion
2. **Week 11:** Partner launch #1 (curated, max 30% margin)
3. **Week 12:** Partner launch #2 (max 50% margin)
4. **Week 13:** Public launch announcement + trading competition
5. **Week 14+:** Open for community launches

### 6.2 Growth Tactics
- Trading competition: $10K prizes for top PnL
- Referral program: 10% fee share
- Twitter/X threads: leverage mechanics explainer
- KOL partnerships: seed 5-10 CT KOLs for launch coverage
- Telegram bot: real-time liquidation alerts
- Dune dashboard: public protocol analytics

---

## Repository Structure

```
sil3t/
├── contracts/                    # Foundry project (EVM chains)
│   ├── src/
│   │   ├── LendingPool.sol
│   │   ├── LaunchPool.sol
│   │   ├── MarginEngine.sol
│   │   ├── LiquidationEngine.sol
│   │   ├── OracleAdapter.sol
│   │   ├── InsuranceFund.sol
│   │   ├── FeeCollector.sol
│   │   ├── SiL3tFactory.sol
│   │   ├── CrossChainBridge.sol # LayerZero integration (v2)
│   │   └── mock/
│   │       └── MockUSDC.sol
│   ├── test/
│   ├── script/
│   │   ├── Deploy.s.sol
│   │   └── DeployAllChains.s.sol
│   └── foundry.toml
├── solana/                       # Anchor project (Solana)
│   ├── programs/
│   │   └── sil3t/
│   │       ├── src/
│   │       │   ├── lib.rs
│   │       │   ├── state.rs
│   │       │   ├── margin.rs
│   │       │   ├── liquidation.rs
│   │       │   └── oracle.rs
│   │       └── Cargo.toml
│   ├── tests/
│   ├── Anchor.toml
│   └── Cargo.toml
├── app/                          # Next.js frontend (all chains)
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── launches/
│   │   │   ├── launch/[id]/
│   │   │   ├── portfolio/
│   │   │   ├── lend/
│   │   │   ├── bridge/
│   │   │   └── stats/
│   │   ├── components/
│   │   ├── hooks/
│   │   │   ├── useMarginEngine.ts   # EVM hooks
│   │   │   ├── useMarginSolana.ts   # Solana hooks
│   │   │   └── useChainConfig.ts    # Chain selector logic
│   │   ├── config/
│   │   │   ├── chains.ts
│   │   │   ├── contracts.ts
│   │   │   └── wagmi.ts
│   │   └── lib/
│   └── next.config.js
├── api/                          # Hono backend (all chains)
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   │   ├── indexer-evm.ts       # EVM event listener
│   │   │   ├── indexer-solana.ts    # Solana account listener
│   │   │   └── price-feed.ts
│   │   ├── workers/
│   │   │   ├── liquidation-evm.ts
│   │   │   └── liquidation-solana.ts
│   │   └── db/
│   └── package.json
├── keeper/                       # Liquidation bot (per chain)
│   ├── src/
│   │   ├── monitor.ts
│   │   ├── chains/
│   │   │   ├── ethereum.ts
│   │   │   ├── base.ts
│   │   │   ├── arbitrum.ts
│   │   │   ├── bsc.ts
│   │   │   └── solana.ts
│   │   ├── liquidator.ts
│   │   └── alert.ts
│   └── package.json
├── docs/
│   ├── PRD.md
│   ├── PLAN.md
│   ├── ARCHITECTURE.md
│   └── API.md
├── .env.example
├── docker-compose.yml
├── turbo.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Timeline Summary

```
Week 1-2:   Project setup, tooling, architecture docs
Week 2-5:   Smart contracts EVM (LendingPool, MarginEngine, Liquidation, Oracle)
Week 4-6:   Backend (API, indexer, liquidation keeper) — EVM first
Week 5-8:   Frontend (dApp, chain switcher, margin selector, portfolio)
Week 7-9:   Testing EVM (unit, integration, fuzz, E2E)
Week 8-9:   Security audit (EVM contracts)
Week 9-10:  Testnet beta — Base + Arbitrum + Ethereum Sepolia
Week 10:    Mainnet launch — Base + Arbitrum (curated launches)
Week 11:    Ethereum L1 mainnet launch (whale tier)
Week 12+:   Public launch + token + growth
Week 14:    Solana program development start
Week 16:    BSC mainnet deployment
Week 18:    Solana mainnet launch
Week 20:    Cross-chain bridge (LayerZero)
```

**Total estimated time:**
- EVM mainnet: 10-12 weeks
- Full multi-chain (incl. Solana): 18-20 weeks

---

## Budget Estimate

| Item | Cost |
|------|------|
| Smart Contract Audit (EVM) | $30K-$80K |
| Smart Contract Audit (Solana) | $20K-$50K |
| Frontend Development | $20K-$30K |
| Backend Development | $12K-$18K |
| Solana Program Development | $15K-$25K |
| Infrastructure (year 1, all chains) | $8K-$15K |
| Insurance Fund (bootstrap, per chain) | $100K-$200K |
| Bug Bounty (Immunefi) | $10K-$50K |
| Marketing & Growth | $15K-$25K |
| RPC Costs (Alchemy + Helius, year 1) | $5K-$10K |
| **Total** | **$235K-$503K** |

---

## Next Immediate Steps

1. **Create GitHub repo** `sil3t-launchpad` under adrlpz  ✅ DONE
2. **Init Foundry project** — basic contract scaffolding  ✅ DONE
3. **Init Next.js app** — basic pages + wagmi setup  ✅ DONE
4. **Write MarginEngine.sol** — core contract, most critical  ✅ DONE
5. **Write tests** — before any feature work  ✅ DONE (6/6 passing)
6. **Init Next.js frontend** — pages + wagmi + chain switcher
7. **Write backend API** — indexer + liquidation keeper  ✅ DONE
8. **Deploy to testnet** — Base Sepolia + Arbitrum Sepolia
9. **Security audit** — internal review first  ✅ DONE
10. **Init Next.js frontend** — NEXT STEP

---

## Progress Checklist

### Phase 0: Foundation ✅\|- [x] Foundry project initialized
- [x] OpenZeppelin installed
- [x] Foundry config (remappings, optimizer)
- [ ] Next.js frontend
- [ ] Backend (Hono)
- [ ] Database (PostgreSQL)

### Phase 1: Smart Contracts ✅\|- [x] MockUSDC.sol (testnet)
- [x] LendingPool.sol (deposit, borrow, repay)
- [x] LaunchPool.sol (create, deposit, finalize, claim)
- [x] MarginEngine.sol (open, close, liquidate, health check)
- [x] OracleAdapter.sol (TWAP, Chainlink, Manual)
- [x] InsuranceFund.sol (deposit, cover bad debt)
- [x] FeeCollector.sol (collect, distribute)
- [x] SiL3tFactory.sol (deploy + wire all contracts)
- [x] Deploy script (Deploy.s.sol)
- [x] Tests (6/6 passing)
- [ ] LiquidationEngine.sol (standalone — currently in MarginEngine)
- [ ] CrossChainBridge.sol (v2)

### Phase 2: Backend ✅ COMPLETE
- [x] API server (Hono) — routes: /health, /launches, /positions, /stats
- [x] Indexer (event listener) — watches PositionOpened/Closed/Liquidated
- [x] Liquidation keeper bot — polls positions, auto-liquidates
- [x] Price feed service — integrated in keeper
- [x] Database schema (Drizzle ORM)
- [x] .env.example

### Phase 3: Frontend ✅ COMPLETE
- [x] Next.js app (App Router + Tailwind)
- [x] Homepage (hero, stats, how it works)
- [x] Launches page (list, filter, chain badges)
- [x] Portfolio page (active/closed positions, PnL)
- [x] Lending pool page (deposit/withdraw, APY)
- [x] Stats page (TVL, volume, liquidations, per-chain)
- [x] MarginSelector component (slider, calculations, liq warning)
- [x] Chain config (Base, Arbitrum, ETH, BSC)
- [ ] Chain switcher (wagmi/RainbowKit — needs npm install)
- [ ] Wallet connect integration

---

*Plan v1.2 — siL3t Leveraged Launchpad — Backend Complete*
