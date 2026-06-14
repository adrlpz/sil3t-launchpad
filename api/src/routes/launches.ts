import { Hono } from 'hono';
import { z } from 'zod';

export const launchesRoutes = new Hono();

// Mock data for MVP — replace with DB queries
const mockLaunches = [
  {
    id: 0,
    chainId: 8453, // Base
    tokenAddress: '0x1234567890abcdef1234567890abcdef12345678',
    tokenName: 'DegenToken',
    tokenSymbol: 'DEGEN',
    targetRaise: '50000',
    currentRaise: '32500',
    tokenPrice: '1.0',
    marketCap: '200000',
    maxMargin: 5000,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    finalized: false,
    cancelled: false,
    progress: 65,
  },
  {
    id: 1,
    chainId: 42161, // Arbitrum
    tokenAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    tokenName: 'LaunchCoin',
    tokenSymbol: 'LAUNCH',
    targetRaise: '100000',
    currentRaise: '78000',
    tokenPrice: '0.5',
    marketCap: '500000',
    maxMargin: 7500,
    startTime: new Date().toISOString(),
    endTime: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    finalized: false,
    cancelled: false,
    progress: 78,
  },
];

// GET /launches — list all launches
launchesRoutes.get('/', (c) => {
  const chainId = c.req.query('chainId');
  const status = c.req.query('status'); // active, finalized, cancelled

  let filtered = [...mockLaunches];

  if (chainId) {
    filtered = filtered.filter((l) => l.chainId === parseInt(chainId));
  }

  if (status === 'active') {
    filtered = filtered.filter((l) => !l.finalized && !l.cancelled);
  } else if (status === 'finalized') {
    filtered = filtered.filter((l) => l.finalized);
  }

  return c.json({
    launches: filtered,
    total: filtered.length,
  });
});

// GET /launches/:id — single launch
launchesRoutes.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const launch = mockLaunches.find((l) => l.id === id);

  if (!launch) {
    return c.json({ error: 'Launch not found' }, 404);
  }

  return c.json({ launch });
});

// GET /launches/:id/depositors — list depositors for a launch
launchesRoutes.get('/:id/depositors', (c) => {
  const id = parseInt(c.req.param('id'));

  // Mock depositor data
  const depositors = [
    { address: '0x1111...aaaa', amount: '5000', timestamp: new Date().toISOString() },
    { address: '0x2222...bbbb', amount: '12000', timestamp: new Date().toISOString() },
    { address: '0x3333...cccc', amount: '15500', timestamp: new Date().toISOString() },
  ];

  return c.json({
    launchId: id,
    depositors,
    totalDepositors: depositors.length,
  });
});
