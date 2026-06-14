import { Hono } from 'hono';

export const statsRoutes = new Hono();

// GET /stats — protocol-wide stats
statsRoutes.get('/', (c) => {
  return c.json({
    tvl: '1250000',
    totalVolume: '5800000',
    totalLaunches: 24,
    totalPositions: 156,
    totalLiquidations: 12,
    totalRevenue: '87000',
    chains: {
      base: { tvl: '750000', launches: 15, positions: 98 },
      arbitrum: { tvl: '400000', launches: 7, positions: 45 },
      ethereum: { tvl: '100000', launches: 2, positions: 13 },
    },
  });
});

// GET /stats/tvl — TVL per chain
statsRoutes.get('/tvl', (c) => {
  return c.json({
    total: '1250000',
    byChain: {
      8453: '750000',    // Base
      42161: '400000',   // Arbitrum
      1: '100000',       // Ethereum
    },
  });
});

// GET /stats/volume — 24h volume
statsRoutes.get('/volume', (c) => {
  return c.json({
    total24h: '320000',
    byChain: {
      8453: '200000',
      42161: '100000',
      1: '20000',
    },
  });
});

// GET /stats/liquidations — recent liquidations
statsRoutes.get('/liquidations', (c) => {
  const liquidations = [
    {
      id: 0,
      positionId: 5,
      chainId: 8453,
      liquidator: '0xLiq111111111111111111111111111111111111',
      debtRepaid: '100',
      reward: '1.5',
      txHash: '0xabc123...',
      timestamp: new Date().toISOString(),
    },
    {
      id: 1,
      positionId: 12,
      chainId: 42161,
      liquidator: '0xLiq222222222222222222222222222222222222',
      debtRepaid: '250',
      reward: '3.75',
      txHash: '0xdef456...',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    },
  ];

  return c.json({
    liquidations,
    total: liquidations.length,
  });
});
