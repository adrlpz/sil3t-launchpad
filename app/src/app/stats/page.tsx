'use client';

export default function StatsPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Protocol Stats</h1>

      {/* Global Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Total Value Locked', value: '$1.25M', change: '+12.5%' },
          { label: 'Total Volume', value: '$5.8M', change: '+8.3%' },
          { label: 'Protocol Revenue', value: '$87K', change: '+15.2%' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="text-sm text-gray-400 mb-2">{stat.label}</div>
            <div className="text-3xl font-bold mb-1">{stat.value}</div>
            <div className="text-sm text-green-500">{stat.change} (24h)</div>
          </div>
        ))}
      </div>

      {/* Per Chain Stats */}
      <h2 className="text-xl font-semibold mb-4">By Chain</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left p-4 text-gray-400 font-medium">Chain</th>
              <th className="text-right p-4 text-gray-400 font-medium">TVL</th>
              <th className="text-right p-4 text-gray-400 font-medium">Launches</th>
              <th className="text-right p-4 text-gray-400 font-medium">Positions</th>
              <th className="text-right p-4 text-gray-400 font-medium">Liquidations</th>
            </tr>
          </thead>
          <tbody>
            {[
              { chain: 'Base', tvl: '$750K', launches: 15, positions: 98, liquidations: 8 },
              { chain: 'Arbitrum', tvl: '$400K', launches: 7, positions: 45, liquidations: 3 },
              { chain: 'Ethereum', tvl: '$100K', launches: 2, positions: 13, liquidations: 1 },
            ].map((row) => (
              <tr key={row.chain} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="p-4 font-medium">{row.chain}</td>
                <td className="p-4 text-right">{row.tvl}</td>
                <td className="p-4 text-right">{row.launches}</td>
                <td className="p-4 text-right">{row.positions}</td>
                <td className="p-4 text-right text-red-400">{row.liquidations}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Recent Liquidations */}
      <h2 className="text-xl font-semibold mb-4">Recent Liquidations</h2>
      <div className="space-y-3">
        {[
          { id: 0, token: 'DEGEN', chain: 'Base', debt: '$100', reward: '$1.50', time: '2 min ago' },
          { id: 1, token: 'LAUNCH', chain: 'Arbitrum', debt: '$250', reward: '$3.75', time: '1 hour ago' },
          { id: 2, token: 'MOON', chain: 'Base', debt: '$75', reward: '$1.13', time: '3 hours ago' },
        ].map((liq) => (
          <div key={liq.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-red-500">🔴</span>
              <div>
                <span className="font-medium">{liq.token}</span>
                <span className="text-gray-400 text-sm ml-2">on {liq.chain}</span>
              </div>
            </div>
            <div className="text-sm text-gray-400">Debt: {liq.debt}</div>
            <div className="text-sm text-green-500">Reward: {liq.reward}</div>
            <div className="text-sm text-gray-500">{liq.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
