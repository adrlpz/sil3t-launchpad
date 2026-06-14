'use client';

import { useState } from 'react';

export default function LendPage() {
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Lending Pool</h1>

      {/* Pool Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Deposited', value: '$1.25M' },
          { label: 'Total Borrowed', value: '$750K' },
          { label: 'Utilization', value: '60%', color: 'text-yellow-500' },
          { label: 'Current APY', value: '8.5%', color: 'text-green-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color || 'text-white'}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-8">
        {/* Deposit/Withdraw */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex gap-2 mb-6">
            {(['deposit', 'withdraw'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 rounded-lg capitalize font-medium transition ${
                  activeTab === tab ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">Amount (USDC)</label>
              <input
                type="number"
                value={depositAmount || ''}
                onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                placeholder="0.00"
              />
            </div>

            <div className="bg-gray-800 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Your Share</span>
                <span>0 LP tokens</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expected APY</span>
                <span className="text-green-500">8.5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Pool Utilization</span>
                <span className="text-yellow-500">60%</span>
              </div>
            </div>

            <button className="w-full bg-orange-600 hover:bg-orange-700 py-3 rounded-lg font-medium transition">
              {activeTab === 'deposit' ? 'Deposit USDC' : 'Withdraw USDC'}
            </button>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">How Lending Works</h3>
          <div className="space-y-4 text-gray-300">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                1
              </div>
              <div>
                <div className="font-medium mb-1">Deposit USDC</div>
                <div className="text-sm text-gray-400">
                  Your USDC goes into the lending pool used by margin traders.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                2
              </div>
              <div>
                <div className="font-medium mb-1">Earn Yield</div>
                <div className="text-sm text-gray-400">
                  When traders borrow for margin positions, they pay interest. You earn a share.
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm">
                3
              </div>
              <div>
                <div className="font-medium mb-1">Withdraw Anytime</div>
                <div className="text-sm text-gray-400">
                  Withdraw your USDC + yield anytime (subject to pool utilization).
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <div className="text-sm text-yellow-400 font-medium mb-1">⚠️ Risk Disclaimer</div>
            <div className="text-xs text-gray-400">
              In extreme market conditions, bad debt from liquidations may affect pool funds. 
              The insurance fund covers deficits first, but in rare cases, LPs may absorb losses.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
