# siL3t — PRD (Product Requirements Document)
### Leveraged Launchpad Protocol
**Version:** 1.0  
**Date:** 2026-06-14  
**Author:** SUPERAGENT × Fizz  

---

## 1. Executive Summary

**siL3t** is a Web3 launchpad protocol dengan fitur **margin trading built-in**. User bisa beli token baru dari launchpad dengan leverage dari platform — memungkinkan posisi lebih besar dari modal asli, dengan risiko likuidasi otomatis jika harga turun melewati threshold.

**Tagline:** *"Launch bigger. Get liquidated faster."*

**Core Innovation:** Launchpad tradisional = beli token pakai modal sendiri. siL3t = beli token pakai modal + pinjaman dari protocol. Kalau MC turun → posisi dilikuidasi → pinjaman dibalikin ke pool.

---

## 2. Problem Statement

| Problem | Detail |
|---------|--------|
| Modal kecil, exposure kecil | User dengan $100 cuma bisa beli token $100 worth di launchpad |
| Tidak ada leverage di launchpad | Perpetual DEX (GMX, Hyperliquid) punya leverage, tapi launchpad belum ada |
| FOMO buying tanpa risk management | User beli token launch tanpa mekanisme proteksi downside |
| Tidak ada liquidation engine di launchpad | Semua rugpull/loss = 100% user, tidak ada mekanisme otomatis cut-loss |

---

## 3. Solution Overview

### 3.1 Margin System

User beli token di launchpad dengan memilih **margin level**:

| Margin Level | User Modal | Protocol Loan | Effective Position | Liquidation Threshold |
|:---:|:---:|:---:|:---:|:---:|
| 0% (spot) | $200 | $0 | $200 | N/A (no liq) |
| 10% | $180 | $20 | $200 | MC turun ~10% |
| 20% | $160 | $40 | $200 | MC turun ~20% |
| 30% | $140 | $60 | $200 | MC turun ~30% |
| 50% | $100 | $100 | $200 | MC turun ~50% |
| 75% | $50 | $150 | $200 | MC turun ~75% |

### 3.2 Liquidation Mechanism

```
Liquidation Price = Entry MC × (1 - Margin Level)

Contoh:
- Entry MC: 200k
- Margin: 50% (user modal $100, pinjam $100)
- Liquidation MC: 200k × (1 - 0.5) = 100k

Kalau MC turun ke 100k → posisi dilikuidasi otomatis
- Sisa token dijual
- Protocol ambil kembali $100 (pinjaman)
- Sisa (jika ada) dikembalikan ke user
- Kalau rugpull/zero liquidity → user loss = modal sendiri ($100), protocol absorbs bad debt
```

### 3.3 Revenue Model

| Revenue Stream | Mechanic |
|----------------|----------|
| Margin Fee | 0.5-2% flat per margin position (ambil dari user modal saat open) |
| Liquidation Fee | 5-10% dari posisi saat likuidasi (ambil dari sisa value) |
| Launchpad Fee | 2-5% dari total raise (standard launchpad fee) |
| Protocol Treasury | Semua fee masuk treasury → buyback / distribute ke staker |
| Interest Accrual | Bunga harian atas pinjaman margin (opsional, v2) |

---

## 4. User Flows

### 4.1 Flow: Open Leveraged Position

```
1. User connect wallet ke siL3t dApp
2. User browse upcoming/active token launches
3. User pilih token → klik "Buy"
4. User input amount (e.g., $200)
5. User pilih margin level (slider: 0% → 75%)
   - UI show: "Your deposit: $100 | Borrowed: $100 | Liq. MC: 100k"
6. User confirm → approve USDC/ETH spend
7. Smart contract:
   a. Transfer user deposit ke contract
   b. Add protocol loan dari lending pool
   c. Execute buy → token dikirim ke user wallet/contract
   d. Record position: entry price, margin, liq threshold
8. Position visible di dashboard user
```

### 4.2 Flow: Liquidation

```
1. Oracle/AMM update harga token real-time
2. Liquidation bot monitor semua posisi
3. Jika token MC ≤ Liquidation MC:
   a. Trigger liquidation()
   b. Contract jual token ke AMM/pool
   c. Balikin pinjaman ke lending pool
   d. Sisa → user (jika ada)
   e. Deficit → protocol absorbs (dari insurance fund)
4. User notifikasi via UI / push notification
```

### 4.3 Flow: Close Position (Manual)

```
1. User klik "Close Position"
2. User pilih: close full / partial
3. Contract jual token di market
4. Balikin pinjaman + fee ke protocol
5. Sisa profit/loss → user
```

---

## 5. Core Features

### 5.1 MVP (v1.0)

| Feature | Priority | Description |
|---------|----------|-------------|
| Token Launch Page | P0 | Landing page per launch — info token, MC target, progress |
| Margin Selector | P0 | Slider/input pilih margin level (10-75%) |
| Position Manager | P0 | Dashboard buka/tutup posisi, PnL real-time |
| Liquidation Engine | P0 | Auto-liquidate saat MC ≤ threshold |
| Lending Pool | P0 | Pool USDC yang dipinjamkan ke margin user |
| Wallet Connect | P0 | MetaMask, WalletConnect, Rabby |
| Oracle Integration | P0 | Price feed dari DEX (Uniswap V3 / Raydium) |
| Admin Panel | P1 | Manage launches, fee config, emergency pause |

### 5.2 V2 Features

| Feature | Priority | Description |
|---------|----------|----------|
| Multi-chain | P1 | Base, Arbitrum, Solana support |
| Partial Close | P1 | Tutup sebagian posisi |
| Take Profit / Stop Loss | P1 | Auto close di target harga |
| Insurance Fund | P1 | Pool buat cover bad debt dari liquidation |
| Referral System | P2 | Fee sharing buat referrer |
| Leaderboard | P2 | Top traders, PnL ranking |
| Token Creator Tool | P2 | Siapa saja bisa bikin launch |
| Governance (siL3t DAO) | P2 | Vote fee structure, whitelist token |

### 5.3 V3 Features

| Feature | Priority | Description |
|---------|----------|----------|
| Cross-margin | P2 | Multiple positions share margin |
| Interest Rate Model | P2 | Dynamic rate based on utilization |
| NFT Collateral | P3 | Buka posisi pakai NFT sebagai collateral |
| Copy Trading | P3 | Ikutin posisi whale/trader top |
| Mobile App | P3 | React Native / Flutter |

---

## 6. Technical Architecture

### 6.1 Smart Contract Layer

```
┌─────────────────────────────────────────────────┐
│                   siL3t Protocol                 │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐   ┌───────────────────────┐   │
│  │ LaunchFactory │   │ MarginPositionManager │   │
│  │  - createLaunch│  │  - openPosition()     │   │
│  │  - setParams  │   │  - closePosition()    │   │
│  │  - whitelist  │   │  - liquidate()        │   │
│  └──────┬───────┘   └──────────┬────────────┘   │
│         │                      │                 │
│  ┌──────┴───────┐   ┌─────────┴──────────┐     │
│  │  LendingPool  │   │  LiquidationEngine  │     │
│  │  - deposit()  │   │  - checkHealth()    │     │
│  │  - withdraw() │   │  - triggerLiq()     │     │
│  │  - borrow()   │   │  - settleDebt()     │     │
│  │  - repay()    │   │                     │     │
│  └──────┬───────┘   └─────────┬──────────┘     │
│         │                      │                 │
│  ┌──────┴──────────────────────┴──────────┐     │
│  │              OracleAdapter              │     │
│  │  - getPrice(token)                      │     │
│  │  - getMC(token)                         │     │
│  │  - TWAP / spot                          │     │
│  └────────────────────────────────────────┘     │
│                                                  │
└─────────────────────────────────────────────────┘
```

### 6.3 Key Contracts

| Contract | Responsibility | Chains |
|----------|---------------|--------|
| `SiL3tFactory` | Deploy launch contracts, manage protocol config | All EVM |
| `LaunchPool` | Per-launch contract — collect funds, distribute tokens | All EVM |
| `MarginEngine` | Core margin logic — open/close/liquidate positions | All EVM |
| `LendingPool` | Lend USDC to margin users, manage utilization | All EVM |
| `LiquidationBot` | Off-chain keeper — monitor & trigger liquidations | All EVM |
| `OracleAdapter` | Fetch price from DEX pool (TWAP + spot) | All EVM |
| `InsuranceFund` | Buffer buat cover bad debt | All EVM |
| `FeeCollector` | Collect & distribute fees | All EVM |
| `CrossChainBridge` | Bridge positions/tokens cross-chain (v2) | LayerZero |
| Solana Program | Full siL3t logic in Rust/Anchor | Solana |

### 6.3 Multi-Chain Architecture

siL3t deploy ke 5 chain secara bertahap. EVM chains share smart contract code (same Solidity). Solana pakai program terpisah (Rust/Anchor). Lending pool per-chain = isolated risk.

```
┌──────────────────────────────────────────────────────────────┐
│                    siL3t Unified Frontend                      │
│              Next.js + wagmi + chain switcher                  │
│              1 app, user pilih chain via wallet                │
└────┬──────────┬──────────┬──────────┬──────────┬──────────────┘
     │          │          │          │          │
┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴──────────┐
│Ethereum│ │  Base  │ │Arbitrum│ │  BSC   │ │   Solana     │
│  L1   │ │  L2   │ │   L2   │ │   L1   │ │ (Rust/Anchor)│
│        │ │        │ │        │ │        │ │              │
│Contracts│ │Contracts│ │Contracts│ │Contracts│ │  Program     │
│(same)  │ │(same)  │ │(same)  │ │(same)  │ │ (separate)   │
└────────┘ └────────┘ └────────┘ └────────┘ └──────────────┘
```

#### Chain Strategy

| Chain | Phase | Priority | Oracle | DEX Router | Gas Cost | Target Audience |
|-------|-------|----------|--------|------------|----------|----------------|
| **Base** | v1.0 | 🥇 Primary | Uniswap V3 TWAP | Uniswap V3 / Aerodrome | Very Low | Degen retail, Coinbase users |
| **Arbitrum** | v1.0 | 🥇 Primary | Uniswap V3 TWAP | Uniswap V3 / Camelot | Low | Pro traders, GMX crowd |
| **Ethereum L1** | v1.5 | 🥇 Primary | Uniswap V3 TWAP | Uniswap V3 | High | Whales, institutional, credibility |
| **BSC** | v2.0 | 🥈 Secondary | PancakeSwap TWAP | PancakeSwap | Very Low | Asia market, meme culture |
| **Solana** | v2.0 | 🥈 Secondary | Jupiter / Raydium | Jupiter Aggregator | Lowest | Pump.fun crowd, mobile users |

#### Per-Chain Isolation Model

```
Each chain has INDEPENDENT:
├── Lending Pool (USDC pool per chain — no cross-chain lending)
├── Insurance Fund (per-chain risk buffer)
├── Oracle Adapter (chain-specific DEX price feed)
├── Liquidation Keeper (per-chain bot instance)
└── Launch Registry (launches are chain-specific)

Why isolated:
- Cross-chain messaging = attack surface + latency
- Liquidation needs <5s response time (bridges too slow)
- Each chain has different gas economics
- Simpler security model per deployment
```

#### Ethereum L1 — Special Considerations

Ethereum L1 punya gas cost tinggi, jadi strategi berbeda:

| Aspect | L1 Strategy |
|--------|-------------|
| Min launch raise | $50K (filter small/low-quality launches) |
| Max margin | 50% (lebih konservatif — high gas = fewer liquidation txs) |
| Target user | Whale, institutional, high-conviction degens |
| Gas optimization | Batch positions in single tx, multicall |
| Oracle | Chainlink primary + Uniswap V3 TWAP fallback |
| Fee structure | Higher margin fee (2%) to offset gas overhead |
| Liquidation | Flashbots Protect + priority fee optimization |
| Value prop | "Premium launches with institutional-grade liquidity" |

#### Cross-Chain Token Bridge (v2)

```
User flow: Launch di Base → bridge position ke Arbitrum

NOT cross-chain margin (too risky).
Instead: bridge the TOKEN, close position on source, open new on dest.

Bridge options:
├── LayerZero (omnichain messaging)
├── Across Protocol (fast, capital-efficient)
└── Wormhole (Solana ↔ EVM)

siL3t token: Omnichain (LayerZero OFT) — 1 address, all chains.
```

#### RPC & Infrastructure Per Chain

| Chain | RPC Provider | Block Explorer | DEX Oracle |
|-------|-------------|----------------|------------|
| Ethereum | Alchemy / Infura | Etherscan | Uniswap V3 TWAP |
| Base | Alchemy | Basescan | Uniswap V3 TWAP |
| Arbitrum | Alchemy | Arbiscan | Uniswap V3 TWAP |
| BSC | QuickNode | BscScan | PancakeSwap TWAP |
| Solana | Helius / Triton | Solscan | Jupiter / Raydium |

### 6.4 Tech Stack

```
Smart Contracts: Solidity 0.8.24+ / Foundry (EVM) + Anchor / Rust (Solana)
Frontend:        Next.js 14 + Tailwind + wagmi/viem + Solana wallet adapter
Indexer:         The Graph / custom subgraph (per chain)
Backend:         Node.js (Hono/Fastify) — liquidation bot, API
Oracle:          Uniswap V3 TWAP (EVM) + Chainlink fallback / Jupiter (Solana)
Database:        PostgreSQL (positions, analytics) — shared across chains
Cache:           Redis (real-time PnL, price cache)
Bridge:          LayerZero (token), Across (position bridge)
Infra:           Vercel (FE) + Railway/AWS (backend) + Alchemy + Helius (Solana)
```

---

## 7. Margin Mathematics

### 7.1 Position Calculation

```
Given:
  user_deposit    = amount user puts in (USDC)
  margin_level    = % borrowed (0.10, 0.20, ..., 0.75)
  debt            = user_deposit × (margin_level / (1 - margin_level))
  fee             = debt × 5% (dibayar di depan, dipotong dari deposit)
  net_deposit     = user_deposit - fee
  total_position  = user_deposit + debt (FULL, fee tidak mengurangi posisi)
  coins_owned     = total_position / entry_price
  safety_buffer   = 5% × total_position

Example:
  user_deposit    = $100
  margin_level    = 50%
  debt            = $100 × (0.50 / 0.50) = $50
  fee             = $50 × 5% = $2.50
  net_deposit     = $100 - $2.50 = $97.50
  total_position  = $100 + $50 = $150 (150 koin @ $1)
  safety_buffer   = 5% × $150 = $7.50
```

### 7.2 Liquidation Price (Equity-Based)

```
Ekuitas user = (coins_owned × current_price) - debt

Liq saat ekuitas ≤ safety_buffer:
  coins_owned × P - debt = safety_buffer
  P = (debt + safety_buffer) / coins_owned

Contoh:
  P = ($50 + $7.50) / 150 = $0.3833
  Drop = 1 - 0.3833 = 61.67%

Tabel:
  Margin  | Hutang | Fee 5% | Total Posisi | Safety 5% | Liq Price | Drop
  10%     | $10    | $0.50  | $110         | $5.50     | $0.1409   | 85.91%
  20%     | $20    | $1.00  | $120         | $6.00     | $0.2167   | 78.33%
  30%     | $30    | $1.50  | $130         | $6.50     | $0.2423   | 75.77%
  40%     | $40    | $2.00  | $140         | $7.00     | $0.3143   | 68.57%
  50%     | $50    | $2.50  | $150         | $7.50     | $0.3833   | 61.67%
  75%     | $150   | $7.50  | $250         | $12.50    | $0.5433   | 45.67%

Rumus umum:
  liq_price = (debt + safety_buffer) / coins_owned
  drop_pct  = 1 - liq_price / entry_price

Dengan:
  debt     = deposit × (margin / (1 - margin))
  fee      = debt × 5%
  posisi   = deposit + debt
  safety   = posisi × 5%
  liq_price = (debt + safety) / posisi
  drop     = 1 - liq_price
```

### 7.3 PnL Calculation

```
Harga per koin sekarang = current_mc / entry_mc (normalized)
Nilai posisi sekarang   = coins_owned × (current_mc / entry_mc)
Ekuitas user            = nilai_posisi - debt
PnL                     = ekuitas - net_deposit
ROI                     = PnL / net_deposit × 100%

Example (margin 50%, MC naik 50%):
  entry_mc      = 200k, current_mc = 300k
  coins_owned   = 150 koin
  nilai_posisi  = 150 × (300k/200k) = 225
  debt          = $50
  ekuitas       = 225 - 50 = $175
  net_deposit   = $97.50
  PnL           = 175 - 97.50 = $77.50
  ROI           = 77.50 / 97.50 = 79.5%

  Tanpa leverage:
  PnL = $100 × (300k/200k - 1) = $50
  ROI = 50 / 100 = 50%
```

### 7.4 Insurance Fund Model

```
insurance_fund += liquidation_surplus  (when liquidation value > debt)
insurance_fund -= bad_debt            (when liquidation value < debt)

Target: insurance_fund ≥ 10% of total_lending_pool

Funding sources:
  - 20% of all margin fees
  - 100% of liquidation surplus
  - Protocol treasury injection (bootstrap)
```

---

## 8. Security Considerations

| Risk | Mitigation |
|------|-----------|
| Oracle manipulation | TWAP with 10-min window, multiple source fallback |
| Flash loan attack | Position must exist >1 block before liquidation |
| Bad debt (insolvent position) | Insurance fund buffer, safety factor on liq price |
| Smart contract risk | Audit (Certik/PeckShield), bug bounty program |
| Rugpull token | Whitelist launches, due diligence, max margin cap per launch |
| Front-running liquidation | Private mempool (Flashbots), commit-reveal |
| Lending pool drain | Utilization cap (max 80% pool can be borrowed) |

---

## 9. Tokenomics (siL3t Token)

### 9.1 Token Utility

| Utility | Mechanic |
|---------|----------|
| Fee discount | Hold siL3t → get 10-50% discount on margin fees |
| Staking | Stake siL3t → earn % of protocol revenue |
| Governance | Vote on new launches, fee params, margin limits |
| Priority access | Staker get early access ke launch baru |
| Insurance backstop | siL3t staker earn yield tapi bisa di-slash buat cover bad debt |

### 9.2 Token Distribution

| Allocation | % | Vesting |
|------------|---|---------|
| Community / Airdrop | 30% | 12-month linear |
| Treasury | 20% | DAO controlled |
| Team | 15% | 12-month cliff, 24-month linear |
| Investors (seed/private) | 10% | 6-month cliff, 18-month linear |
| Liquidity (DEX) | 10% | Locked 12 months |
| Ecosystem / Grants | 10% | Vested by milestones |
| Advisors | 5% | 12-month cliff, 24-month linear |

**Total Supply:** 1,000,000,000 siL3t  
**Initial Circulating:** ~5-8% (liquidity + airdrop batch 1)

---

## 10. Go-To-Market Strategy

### Phase 1: Testnet (Month 1-2)
- Deploy smart contracts ke Base Sepolia / Arbitrum Sepolia / Ethereum Sepolia
- Public testnet — incentivized testing campaign
- Bug bounty (testnet)
- Community building: Twitter/X, Telegram, Discord

### Phase 2: Mainnet Beta (Month 3-4)
- Launch on Base + Arbitrum mainnet (low gas, high degen activity)
- 2-3 curated launches per chain (partner projects)
- Limited margin (max 50%)
- Insurance fund bootstrap per chain (protocol treasury)

### Phase 3: Full Launch (Month 5-6)
- Open launchpad (anyone can create)
- Full margin range (up to 75%)
- Ethereum L1 mainnet launch (whale/institutional tier)
- BSC + Solana expansion prep
- siL3t token launch + airdrop (Omnichain via LayerZero)

### Phase 4: Scale (Month 7-12)
- BSC + Solana mainnet deployment
- Cross-margin, advanced features
- Mobile app
- Governance DAO activation
- Cross-chain position bridge (Across / LayerZero)
- Strategic partnerships with existing launchpads

---

## 11. Competitive Landscape

| Platform | Launchpad | Margin | Leverage | Notes |
|----------|:---------:|:------:|:--------:|-------|
| Pump.fun | ✅ | ❌ | ❌ | Solana memecoin launcher, no leverage |
| Raydium | ✅ | ❌ | ❌ | AMM + IDO, no margin |
| GMX | ❌ | ✅ | ✅ | Perps DEX, not a launchpad |
| Hyperliquid | ❌ | ✅ | ✅ | Perps, not launchpad |
| **siL3t** | ✅ | ✅ | ✅ | **First leveraged launchpad** |

**Moat:** First-mover on leveraged launchpad. Combine degen launchpad energy + perps-level risk mechanics.

---

## 12. Risks & Mitigations

| Risk Level | Risk | Mitigation |
|:----------:|------|-----------|
| 🔴 High | Bad debt from mass liquidation | Insurance fund, max utilization cap, safety factor |
| 🔴 High | Oracle failure/manipulation | Multi-source TWAP, circuit breaker |
| 🟡 Medium | Low liquidity launches | Curated launches only at start, min liquidity requirement |
| 🟡 Medium | Regulatory (margin = leverage product) | Decentralized, non-custodial, no KYC in v1 |
| 🟢 Low | Smart contract exploit | Audit + bug bounty + upgradeable proxy |
| 🟢 Low | Competition copies model | First-mover advantage + community + token incentives |

---

## 13. Success Metrics (KPIs)

| Metric | Month 3 Target | Month 6 Target | Month 12 Target |
|--------|:--------------:|:--------------:|:---------------:|
| Total Value Locked (TVL) | $500K | $5M | $50M |
| Launches Completed | 10 | 50 | 500+ |
| Unique Users | 2,000 | 20,000 | 100,000+ |
| Total Volume | $2M | $25M | $500M+ |
| Avg Margin Used | 30% | 40% | 45% |
| Liquidation Rate | <15% | <20% | <25% |
| Protocol Revenue | $20K | $300K | $5M+ |

---

## 14. Appendix

### A. Glossary

| Term | Definition |
|------|-----------|
| Margin Level | Persentase pinjaman dari protocol terhadap posisi |
| Liquidation Threshold | Market cap dimana posisi otomatis ditutup |
| Insurance Fund | Buffer pool buat cover bad debt |
| Lending Pool | Pool USDC yang disediakan oleh LP untuk dipinjamkan |
| Safety Factor | Buffer multiplier supaya protocol tidak rugi saat liquidation |
| Bad Debt | Debt yang tidak bisa ditutup karena harga jatuh terlalu cepat |
| TWAP | Time-Weighted Average Price — harga rata-rata dalam periode waktu |

### B. References

- GMX v2 Documentation
- Aave v3 Lending Architecture
- Pump.fun Mechanics
- Uniswap V3 TWAP Oracle
- EIP-3525 (Semi-Fungible Token — for position representation)

---

*PRD v1.0 — siL3t Launchpad Protocol*  
*"Launch bigger. Get liquidated faster."*
