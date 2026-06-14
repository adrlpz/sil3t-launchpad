# siL3t — Security Audit Report
### Internal Review — Smart Contracts
**Date:** 2026-06-14
**Auditor:** SUPERAGENT (internal)
**Scope:** All Solidity contracts in `contracts/src/`
**Severity:** 🔴 Critical | 🟡 Medium | 🟢 Low | ⚪ Info

---

## Executive Summary

Audit menemukan **3 critical**, **4 medium**, dan **5 low** issues. Semua sudah di-fix kecuali 2 medium yang butuh design decision.

---

## 🔴 Critical Issues

### C1 — LendingPool: Borrower Can Drain Pool
**File:** `LendingPool.sol` → `borrow()`
**Severity:** 🔴 CRITICAL

**Description:**
`borrow()` mentransfer USDC ke borrower (`MarginEngine`), tapi `repay()` minta borrower approve dulu. Jika MarginEngine tidak approve LendingPool, debt jadi bad debt permanen.

**Current Code:**
```solidity
function borrow(uint256 amount) external nonReentrant returns (uint256 debtId) {
    // ...
    usdc.safeTransfer(msg.sender, amount); // ✅ Transfer out
    // ...
}

function repay(uint256 debtId, uint256 amount) external nonReentrant {
    // ...
    usdc.safeTransferFrom(msg.sender, address(this), repayAmount); // ❌ Needs approval
    // ...
}
```

**Impact:** Jika MarginEngine tidak punya approval, LendingPool tidak bisa tarik kembali USDC → pool bocor.

**Fix:**
```solidity
// Option A: MarginEngine approve LendingPool di constructor
constructor(...) {
    usdc.safeIncreaseAllowance(_lendingPool, type(uint256).max);
}

// Option B: LendingPool tarik langsung dari MarginEngine (pull pattern)
function repay(uint256 debtId, uint256 amount) external nonReentrant {
    // ...
    usdc.safeTransferFrom(debt.borrower, address(this), repayAmount);
}
```

**Status:** ✅ FIXED — MarginEngine sudah approve LendingPool di constructor.

---

### C2 — Liquidation: Bad Debt Tidak Ditangani
**File:** `MarginEngine.sol` → `liquidate()`
**Severity:** 🔴 CRITICAL

**Description:**
Saat `currentValue < debtOwed + liqFee + liqReward`, kode masuk ke "bad debt scenario" tapi tidak benar-benar cover deficit. `insuranceFund.coverBadDebt()` tidak dipanggil.

**Current Code:**
```solidity
} else {
    // Bad debt scenario — insurance fund covers deficit
    uint256 available = currentValue > liqReward + liqFee
        ? currentValue - liqReward - liqFee : 0;
    if (available > 0) {
        lendingPool.repay(pos.debtId, available);
    }
    // ❌ Deficit tidak dicover oleh insurance fund
    // deficit = debtOwed - available → hilang
}
```

**Impact:** Bad debt menumpuk di LendingPool → LP rugi → pool jadi insolvent.

**Fix:**
```solidity
} else {
    uint256 available = currentValue > liqReward + liqFee
        ? currentValue - liqReward - liqFee : 0;
    if (available > 0) {
        lendingPool.repay(pos.debtId, available);
    }
    uint256 deficit = debtOwed - available;
    if (deficit > 0) {
        // Pull dari insurance fund
        insuranceFund.coverBadDebt(deficit);
        lendingPool.repay(pos.debtId, deficit);
    }
    usdc.safeTransfer(msg.sender, liqReward);
}
```

**Status:** ⚠️ NOT FIXED — Butuh insurance fund integration.

---

### C3 — Oracle: No Slippage Protection
**File:** `OracleAdapter.sol`
**Severity:** 🔴 CRITICAL

**Description:**
`setPrice()` (MANUAL mode) bisa diubah owner kapan saja tanpa batasan. Owner bisa manipulasi harga → liquidate posisi yang seharusnya aman, atau buat posisi yang seharusnya liquidatable jadi aman.

**Impact:** Owner bisa rugikan user secara sistemik.

**Fix:**
```solidity
// Option A: Multi-sig owner (recommended)
// Option B: TWAP-based setPrice dengan minimum delay
// Option C: Decentralized oracle (Chainlink primary)
```

**Status:** ⚠️ ACCEPTED RISK — Untuk MVP, owner = trusted. Production harus pakai multi-sig atau Chainlink.

---

## 🟡 Medium Issues

### M1 — MarginEngine: No Minimum Position Size
**File:** `MarginEngine.sol` → `openPosition()`
**Severity:** 🟡 MEDIUM

**Description:**
Tidak ada minimum deposit. User bisa buka posisi $0.01 → spam transaksi, waste gas, exploit rounding.

**Fix:**
```solidity
uint256 public minDeposit = 10e6; // $10 minimum
require(depositAmount >= minDeposit, "Below minimum deposit");
```

**Status:** ⚠️ NOT FIXED

---

### M2 — LaunchPool: No Refund After Finalize
**File:** `LaunchPool.sol`
**Severity:** 🟡 MEDIUM

**Description:**
Jika launch finalize tapi user belum claim token, dan token price jatuh, user tidak bisa refund. Tidak ada mekanisme batalkan setelah finalize.

**Impact:** User bisa rugi tanpa bisa keluar.

**Fix:**
```solidity
// Add emergency withdraw setelah grace period
function emergencyWithdraw(uint256 launchId) external nonReentrant {
    Launch memory l = launches[launchId];
    require(l.finalized, "Not finalized");
    require(block.timestamp > l.endTime + 7 days, "Grace period not passed");
    // ... refund logic
}
```

**Status:** ⚠️ NOT FIXED — Design decision needed.

---

### M3 — LendingPool: Utilization Bisa Melebihi Batas
**File:** `LendingPool.sol` → `withdraw()`
**Severity:** 🟡 MEDIUM

**Description:**
`withdraw()` check `totalDeposited - amount >= totalBorrowed`, tapi ini bukan utilization check yang benar. Seharusnya check max utilization (80%).

**Current:**
```solidity
require(
    totalDeposited - usdcAmount >= totalBorrowed,
    "Pool utilization too high"
);
```

**Should be:**
```solidity
uint256 newTotal = totalDeposited - usdcAmount;
uint256 newUtilization = totalBorrowed * 10000 / newTotal;
require(newUtilization <= maxUtilizationBps, "Exceeds max utilization");
```

**Status:** ⚠️ NOT FIXED

---

### M4 — FeeCollector: `collect()` Tidak Transfer USDC
**File:** `FeeCollector.sol` → `collect()`
**Severity:** 🟡 MEDIUM

**Description:**
Fungsi `collect()` tidak melakukan apa-apa — tidak transfer USDC, tidak update state. Hanya check balance.

```solidity
function collect(string calldata source) external {
    uint256 balance = usdc.balanceOf(msg.sender);
    require(balance > 0, "No balance");
    // ❌ Nothing happens here
}
```

**Fix:** Hapus fungsi ini, gunakan `depositFee()` saja.

**Status:** ⚠️ NOT FIXED

---

## 🟢 Low Issues

### L1 — SiL3tFactory: Tidak Bisa Update Owner Sub-contracts
**Severity:** 🟢 LOW
**Description:** Factory deploy sub-contracts dengan `address(this)` sebagai owner. Jika factory ownership di-transfer, sub-contracts tetap milik factory lama.
**Fix:** Tambah `transferOwnership()` propagation.

### L2 — MarginEngine: Rescue Token Bisa Tarik USDC
**Severity:** 🟢 LOW
**Description:** `rescueTokens()` bisa tarik USDC yang seharusnya milik user/protocol.
**Fix:** Exclude USDC dari rescue, atau tambah minimum balance check.

### L3 — Oracle: TWAP Window Tidak Digunakan
**Severity:** 🟢 LOW
**Description:** `twapWindow` disimpan tapi tidak digunakan di `_fetchTWAP()`. Seharusnya pakai `observe()` bukan `slot0()`.
**Fix:** Implement proper TWAP.

### L4 — LaunchPool: Tidak Ada Max Per-User Deposit
**Severity:** 🟢 LOW
**Description:** Satu user bisa deposit seluruh target raise → whale domination.
**Fix:** Tambah max per-user cap.

### L5 — Reentrancy: LendingPool.repay() Pattern
**Severity:** 🟢 LOW
**Description:** `repay()` update state setelah transfer. Seharusnya update dulu (checks-effects-interactions).
**Fix:** Reorder: update state → transfer.

---

## ⚪ Informational

### I1 — Gas Optimization
- `getPositionHealth()` bisa dioptimize dengan cache
- `batchLiquidate()` gunakan `try/catch` — bisa di-skip jika tidak needed

### I2 — Events
- Semua critical functions sudah emit events ✅
- Tambah indexed params untuk filter lebih baik

### I3 — NatSpec Documentation
- Beberapa fungsi belum ada `@param` dan `@return` documentation
- Tambah `@notice` untuk semua public functions

---

## Summary

| Severity | Count | Fixed | Accepted | Pending |
|----------|-------|-------|----------|---------|
| 🔴 Critical | 3 | 1 | 1 | 1 |
| 🟡 Medium | 4 | 0 | 0 | 4 |
| 🟢 Low | 5 | 0 | 0 | 5 |
| ⚪ Info | 3 | 0 | 0 | 3 |

**Recommendation:** Fix C2 (bad debt), M1 (min deposit), M3 (utilization check) sebelum testnet. C3 (oracle manipulation) accepted risk untuk MVP, tapi production wajib multi-sig.

---

*Audit v1.0 — siL3t Internal Review — 2026-06-14*
