'use client';

import { useState, useMemo } from 'react';

interface MarginSelectorProps {
  maxMargin: number;        // max margin in % (e.g., 75)
  userBalance: number;      // USDC balance
  entryMarketCap: number;   // current MC
  onMarginChange?: (data: MarginData) => void;
}

export interface MarginData {
  marginLevel: number;
  userDeposit: number;
  debt: number;             // hutang pokok
  debtFee: number;          // 5% dari hutang (dibayar di depan)
  netDeposit: number;       // deposit - fee
  totalPosition: number;    // deposit + hutang (FULL)
  coinsOwned: number;       // jumlah koin
  safetyBuffer: number;     // 5% dari total posisi
  liquidationPrice: number; // harga per koin yang memicu liq
  liquidationDrop: number;  // % drop dari harga beli
}

export function MarginSelector({ maxMargin, userBalance, entryMarketCap, onMarginChange }: MarginSelectorProps) {
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [marginLevel, setMarginLevel] = useState<number>(25);

  const data = useMemo((): MarginData => {
    const marginFraction = marginLevel / 100;

    // Hutang = deposit × (margin / (1 - margin))
    // Contoh: $100 × (50% / 50%) = $50
    const debt = depositAmount * (marginFraction / (1 - marginFraction));

    // Fee 5% dari hutang (dibayar di depan)
    const debtFee = debt * 0.05;

    // Net deposit = deposit - fee
    const netDeposit = depositAmount - debtFee;

    // Total posisi = deposit + hutang (FULL, fee tidak mengurangi)
    const totalPosition = depositAmount + debt;

    // Jumlah koin (normalized)
    const coinsOwned = totalPosition;

    // Safety buffer = 5% × total posisi
    const safetyBuffer = totalPosition * 0.05;

    // Liquidation price = (debt + safetyBuffer) / coinsOwned
    // Contoh: (50 + 7.50) / 150 = 0.3833 → drop 61.67%
    const liquidationPrice = (debt + safetyBuffer) / coinsOwned;
    const liquidationDrop = (1 - liquidationPrice) * 100;

    return {
      marginLevel,
      userDeposit: depositAmount,
      debt,
      debtFee,
      netDeposit,
      totalPosition,
      coinsOwned,
      safetyBuffer,
      liquidationPrice,
      liquidationDrop,
    };
  }, [depositAmount, marginLevel]);

  const handleDepositChange = (value: string) => {
    const num = parseFloat(value) || 0;
    setDepositAmount(Math.min(num, userBalance));
    onMarginChange?.({ ...data, userDeposit: num });
  };

  const handleMarginChange = (value: number) => {
    setMarginLevel(value);
    onMarginChange?.({ ...data, marginLevel: value });
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
      <h3 className="text-lg font-semibold">Open Leveraged Position</h3>

      {/* Deposit Amount */}
      <div>
        <label className="block text-sm text-gray-400 mb-2">
          Deposit Amount (USDC)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => handleDepositChange(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
            placeholder="100"
            min={0}
            max={userBalance}
          />
          <button
            onClick={() => handleDepositChange(userBalance.toString())}
            className="bg-gray-800 border border-gray-700 px-4 py-3 rounded-lg text-orange-500 hover:bg-gray-700 transition"
          >
            MAX
          </button>
        </div>
        <div className="text-xs text-gray-500 mt-1">Balance: ${userBalance.toFixed(2)} USDC</div>
      </div>

      {/* Margin Slider */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm text-gray-400">Margin Level</label>
          <span className="text-orange-500 font-bold">{marginLevel}%</span>
        </div>
        <input
          type="range"
          min={10}
          max={maxMargin}
          step={5}
          value={marginLevel}
          onChange={(e) => handleMarginChange(parseInt(e.target.value))}
          className="w-full h-2 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>10%</span>
          <span>{maxMargin}%</span>
        </div>
      </div>

      {/* Calculated Values */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Your Deposit</div>
          <div className="text-xl font-bold">${data.userDeposit.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Debt (Hutang)</div>
          <div className="text-xl font-bold text-blue-400">${data.debt.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Fee (5% of debt)</div>
          <div className="text-xl font-bold text-yellow-400">${data.debtFee.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Net Deposit</div>
          <div className="text-xl font-bold text-green-400">${data.netDeposit.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Total Position</div>
          <div className="text-xl font-bold text-green-400">${data.totalPosition.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Safety Buffer (5%)</div>
          <div className="text-xl font-bold text-purple-400">${data.safetyBuffer.toFixed(2)}</div>
        </div>
      </div>

      {/* Liquidation Warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500">⚠️</span>
          <span className="font-semibold text-red-400">Liquidation Threshold</span>
        </div>
        <div className="text-sm text-gray-300">
          Jika harga koin turun <span className="text-red-400 font-bold">{data.liquidationDrop.toFixed(1)}%</span> dari harga beli
          (harga per koin ≤ <span className="text-red-400 font-bold">${data.liquidationPrice.toFixed(4)}</span>), posisi kamu akan dilikuidasi dan kamu kehilangan seluruh deposit.
        </div>
        <div className="text-xs text-gray-500 mt-2">
          Rumus: Liq Price = (Debt + Safety Buffer) / Coins = (${data.debt.toFixed(2)} + ${data.safetyBuffer.toFixed(2)}) / {data.coinsOwned.toFixed(0)} = ${data.liquidationPrice.toFixed(4)}
        </div>
      </div>

      {/* Action Button */}
      <button className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition">
        Open Position — ${data.totalPosition.toFixed(2)} ({marginLevel}% margin, {data.liquidationDrop.toFixed(0)}% liq)
      </button>
    </div>
  );
}
