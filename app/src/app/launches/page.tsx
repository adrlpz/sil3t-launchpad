'use client';

import { useState } from 'react';

const mockLaunches = [
  {
    id: 0,
    name: 'DegenToken',
    symbol: 'DEGEN',
    chain: 'Base',
    chainId: 8453,
    targetRaise: 50000,
    currentRaise: 32500,
    marketCap: 200000,
    maxMargin: 50,
    timeLeft: '3d 12h',
    status: 'active',
  },
  {
    id: 1,
    name: 'LaunchCoin',
    symbol: 'LAUNCH',
    chain: 'Arbitrum',
    chainId: 42161,
    targetRaise: 100000,
    currentRaise: 78000,
    marketCap: 500000,
    maxMargin: 75,
    timeLeft: '5d 8h',
    status: 'active',
  },
  {
    id: 2,
    name: 'MoonShot',
    symbol: 'MOON',
    chain: 'Base',
    chainId: 8453,
    targetRaise: 25000,
    currentRaise: 25000,
    marketCap: 150000,
    maxMargin: 50,
    timeLeft: 'Ended',
    status: 'finalized',
  },
];

export default function LaunchesPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'finalized'>('all');

  const filtered = mockLaunches.filter((l) => {
    if (filter === 'active') return l.status === 'active';
    if (filter === 'finalized') return l.status === 'finalized';
    return true;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Token Launches</h1>
        <div className="flex gap-2">
          {(['all', 'active', 'finalized'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg capitalize transition ${
                filter === f ? 'bg-orange-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4">
        {filtered.map((launch) => (
          <a
            key={launch.id}
            href={`/launches/${launch.id}`}
            className="block bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-orange-500/50 transition"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center font-bold text-lg">
                  {launch.symbol[0]}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{launch.name}</h3>
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <span>{launch.symbol}</span>
                    <span className="border border-gray-700 px-2 py-0.5 rounded text-xs">
                      {launch.chain}
                    </span>
                    <span className="border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded text-xs">
                      Max {launch.maxMargin}% margin
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Market Cap</div>
                <div className="text-xl font-semibold">${(launch.marketCap / 1000).toFixed(0)}K</div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Raise Progress</div>
                <div className="flex items-center gap-3">
                  <div className="w-32 bg-gray-800 rounded-full h-2">
                    <div
                      className="bg-orange-500 rounded-full h-2"
                      style={{ width: `${(launch.currentRaise / launch.targetRaise) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {((launch.currentRaise / launch.targetRaise) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div className="text-right">
                <div className="text-sm text-gray-400 mb-1">Time Left</div>
                <div className={`font-medium ${launch.status === 'finalized' ? 'text-gray-500' : 'text-green-500'}`}>
                  {launch.timeLeft}
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
