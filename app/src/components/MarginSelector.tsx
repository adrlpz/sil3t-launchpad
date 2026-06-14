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
  borrowed: number;
  effectiveSize: number;
  liquidationMc: number;
  liquidationDrop: number;
  marginFee: number;
}

export function MarginSelector({ maxMargin, userBalance, entryMarketCap, onMarginChange }: MarginSelectorProps) {
  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [marginLevel, setMarginLevel] = useState<number>(25);

  const data = useMemo((): MarginData => {
    const marginFraction = marginLevel / 100;
    const borrowed = depositAmount * (marginFraction / (1 - marginFraction));
    const effectiveSize = depositAmount + borrowed;
    const marginFee = depositAmount * 0.015; // 1.5%
    const liquidationMc = entryMarketCap * (1 - marginFraction);
    const liquidationDrop = marginLevel;

    return {
      marginLevel,
      userDeposit: depositAmount,
      borrowed,
      effectiveSize,
      liquidationMc,
      liquidationDrop,
      marginFee,
    };
  }, [depositAmount, marginLevel, entryMarketCap]);

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
          <div className="text-xs text-gray-400 mb-1">Borrowed</div>
          <div className="text-xl font-bold text-blue-400">${data.borrowed.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Effective Position</div>
          <div className="text-xl font-bold text-green-400">${data.effectiveSize.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="text-xs text-gray-400 mb-1">Margin Fee (1.5%)</div>
          <div className="text-xl font-bold text-yellow-400">${data.marginFee.toFixed(2)}</div>
        </div>
      </div>

      {/* Liquidation Warning */}
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-red-500">⚠️</span>
          <span className="font-semibold text-red-400">Liquidation Threshold</span>
        </div>
        <div className="text-sm text-gray-300">
          If market cap drops <span className="text-red-400 font-bold">{data.liquidationDrop}%</span> to{' '}
          <span className="text-red-400 font-bold">${(data.liquidationMc / 1000).toFixed(0)}K</span>, your position will be liquidated and you lose your entire deposit.
        </div>
      </div>

      {/* Action Button */}
      <button className="w-full bg-orange-600 hover:bg-orange-700 py-4 rounded-lg font-bold text-lg transition">
        Open Position — ${data.effectiveSize.toFixed(2)} (with {marginLevel}% margin)
      </button>
    </div>
  );
}
