'use client';

const mockPositions = [
  {
    id: 0,
    token: 'DEGEN',
    chain: 'Base',
    deposit: 100,
    borrowed: 100,
    effectiveSize: 198.5,
    entryMc: 200000,
    currentMc: 250000,
    marginLevel: 50,
    healthFactor: 1.25,
    pnl: 49.63,
    status: 'active',
  },
  {
    id: 1,
    token: 'LAUNCH',
    chain: 'Arbitrum',
    deposit: 50,
    borrowed: 150,
    effectiveSize: 198.5,
    entryMc: 500000,
    currentMc: 400000,
    marginLevel: 75,
    healthFactor: 0.8,
    pnl: -39.7,
    status: 'liquidated',
  },
];

export default function PortfolioPage() {
  const activePositions = mockPositions.filter((p) => p.status === 'active');
  const closedPositions = mockPositions.filter((p) => p.status !== 'active');

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Portfolio</h1>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Deposited', value: '$150.00' },
          { label: 'Active Positions', value: '1' },
          { label: 'Unrealized PnL', value: '+$49.63', color: 'text-green-500' },
          { label: 'Total Liquidated', value: '1', color: 'text-red-500' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="text-xs text-gray-400 mb-1">{stat.label}</div>
            <div className={`text-2xl font-bold ${stat.color || 'text-white'}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Active Positions */}
      <h2 className="text-xl font-semibold mb-4">Active Positions</h2>
      {activePositions.length === 0 ? (
        <div className="text-gray-500 text-center py-12">No active positions</div>
      ) : (
        <div className="space-y-4 mb-8">
          {activePositions.map((pos) => (
            <div key={pos.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-xl font-bold">{pos.token}</span>
                    <span className="border border-gray-700 px-2 py-0.5 rounded text-xs text-gray-400">
                      {pos.chain}
                    </span>
                    <span className="border border-orange-500/30 text-orange-400 px-2 py-0.5 rounded text-xs">
                      {pos.marginLevel}% margin
                    </span>
                  </div>
                  <div className="text-sm text-gray-400 mt-1">
                    Entry MC: ${(pos.entryMc / 1000).toFixed(0)}K → Current: ${(pos.currentMc / 1000).toFixed(0)}K
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-400">Health Factor</div>
                  <div className={`text-2xl font-bold ${pos.healthFactor > 1 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.healthFactor.toFixed(2)}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-400">PnL</div>
                  <div className={`text-2xl font-bold ${pos.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)} USDC
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg transition">
                    Close
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Closed Positions */}
      <h2 className="text-xl font-semibold mb-4">Closed / Liquidated</h2>
      {closedPositions.length === 0 ? (
        <div className="text-gray-500 text-center py-12">No closed positions</div>
      ) : (
        <div className="space-y-4">
          {closedPositions.map((pos) => (
            <div key={pos.id} className="bg-gray-900/50 border border-gray-800/50 rounded-xl p-6 opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold">{pos.token}</span>
                  <span className="border border-gray-700 px-2 py-0.5 rounded text-xs text-gray-400">
                    {pos.chain}
                  </span>
                  <span className="border border-red-500/30 text-red-400 px-2 py-0.5 rounded text-xs">
                    LIQUIDATED
                  </span>
                </div>
                <div className="text-red-500 font-bold">{pos.pnl.toFixed(2)} USDC</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
