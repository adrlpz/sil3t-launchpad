export default function Home() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="text-center py-20">
        <h1 className="text-6xl font-bold mb-6">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Launch Bigger.
          </span>
          <br />
          <span className="text-gray-400">Get Liquidated Faster.</span>
        </h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
          siL3t is the first leveraged launchpad. Buy tokens with margin — 
          small capital, big positions, real liquidation risk.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/launches"
            className="bg-orange-600 hover:bg-orange-700 px-8 py-3 rounded-lg font-medium text-lg transition"
          >
            Explore Launches
          </a>
          <a
            href="/lend"
            className="border border-gray-700 hover:border-gray-600 px-8 py-3 rounded-lg font-medium text-lg transition"
          >
            Provide Liquidity
          </a>
        </div>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-4 gap-6">
        {[
          { label: 'Total Value Locked', value: '$1.25M' },
          { label: 'Total Volume', value: '$5.8M' },
          { label: 'Active Launches', value: '24' },
          { label: 'Positions Open', value: '156' },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
            <div className="text-3xl font-bold text-orange-500 mb-2">{stat.value}</div>
            <div className="text-gray-400">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* How It Works */}
      <section>
        <h2 className="text-3xl font-bold mb-8 text-center">How It Works</h2>
        <div className="grid grid-cols-3 gap-8">
          {[
            {
              step: '1',
              title: 'Choose a Launch',
              desc: 'Browse upcoming token launches on Base, Arbitrum, or Ethereum.',
            },
            {
              step: '2',
              title: 'Set Your Margin',
              desc: 'Pick 10%–75% margin. Higher margin = bigger position = higher risk.',
            },
            {
              step: '3',
              title: 'Get Liquidated (or Profit)',
              desc: 'If MC drops below threshold, your position is auto-liquidated. If it moons, you profit big.',
            },
          ].map((item) => (
            <div key={item.step} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center mb-4 font-bold">
                {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
              <p className="text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Margin Example */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-8">
        <h2 className="text-2xl font-bold mb-6">Margin Example</h2>
        <div className="grid grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-green-500">Without Margin (Spot)</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Deposit: $100</li>
              <li>• Position: $100</li>
              <li>• If MC doubles: You get $200 (100% ROI)</li>
              <li>• If MC drops 50%: You have $50 (-50%)</li>
            </ul>
          </div>
          <div>
            <h3 className="text-lg font-semibold mb-4 text-orange-500">With 50% Margin (2x Leverage)</h3>
            <ul className="space-y-2 text-gray-300">
              <li>• Deposit: $100 + Borrow: $100</li>
              <li>• Position: $200</li>
              <li>• If MC doubles: You get $300 (200% ROI)</li>
              <li>• If MC drops 50%: LIQUIDATED (100% loss)</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
