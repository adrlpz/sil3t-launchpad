# siL3t — Leveraged Launchpad Protocol 🚀

> *"Launch bigger. Get liquidated faster."*

**siL3t** adalah Web3 launchpad dengan fitur **margin trading built-in**. Beli token di launchpad dengan leverage — modal kecil, posisi besar, risiko likuidasi otomatis.

---

## 🎯 Concept

```
Traditional Launchpad:
  $100 modal → $100 worth of tokens → if price drops 50% → you hold -50%

siL3t Launchpad:
  $100 modal + 50% margin → $200 worth of tokens → if price drops 50% → LIQUIDATED
```

User bisa pilih margin level (10%, 20%, 30%, 50%, 75%) saat beli token di launchpad. Leverage besar, exposure besar, tapi risiko likuidasi juga besar.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│              siL3t Frontend                  │
│         Next.js + wagmi + viem               │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────┴────────────────────────┐
│              siL3t API (Hono)                │
│      Indexer · Liquidation Keeper · Stats    │
└────────────────────┬────────────────────────┘
                     │
┌────────────────────┴────────────────────────┐
│              Smart Contracts                  │
│  LendingPool · MarginEngine · LaunchPool     │
│  LiquidationEngine · OracleAdapter · Fees    │
└─────────────────────────────────────────────┘
```

---

## 📊 Margin Levels

| Level | Deposit | Borrow | Position | Liq. Threshold |
|:-----:|:-------:|:------:|:--------:|:--------------:|
| 0% | $200 | $0 | $200 | N/A |
| 10% | $180 | $20 | $200 | MC -10% |
| 25% | $150 | $50 | $200 | MC -25% |
| 50% | $100 | $100 | $200 | MC -50% |
| 75% | $50 | $150 | $200 | MC -75% |

---

## 🛠️ Tech Stack

- **Smart Contracts:** Solidity + Foundry
- **Frontend:** Next.js 14 + Tailwind + wagmi/viem
- **Backend:** Hono + PostgreSQL + Redis
- **Oracle:** Uniswap V3 TWAP
- **Chain:** Base (primary), Arbitrum, Solana

---

## 📁 Project Structure

```
sil3t/
├── contracts/     # Foundry — Solidity smart contracts
├── app/           # Next.js frontend
├── api/           # Hono backend services
├── keeper/        # Liquidation monitoring bot
└── docs/          # PRD, architecture, API docs
```

---

## 📄 Documentation

- [PRD (Product Requirements)](./docs/PRD.md)
- [Technical Plan](./docs/PLAN.md)

---

## ⚠️ Disclaimer

This is experimental DeFi software. Margin trading involves significant risk of loss. Use at your own risk. Smart contracts are unaudited until formal audit is completed.

---

**Built by Fizz × SUPERAGENT** 🔥
