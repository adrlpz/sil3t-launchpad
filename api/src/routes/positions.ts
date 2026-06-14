import { Hono } from 'hono';

export const positionsRoutes = new Hono();

// Mock data for MVP
const mockPositions = [
  {
    id: 0,
    chainId: 8453,
    launchId: 0,
    traderAddress: '0xUser1111111111111111111111111111111111',
    deposit: '100',
    borrowed: '100',
    effectiveSize: '198.5',
    entryMc: '200000',
    currentMc: '250000',
    marginLevel: 5000,
    isActive: true,
    liquidated: false,
    healthFactor: 1.25,
    unrealizedPnl: '49.63',
    liquidationMc: '100000',
    openedAt: new Date().toISOString(),
  },
  {
    id: 1,
    chainId: 8453,
    launchId: 0,
    traderAddress: '0xUser2222222222222222222222222222222222',
    deposit: '50',
    borrowed: '150',
    effectiveSize: '198.5',
    entryMc: '200000',
    currentMc: '250000',
    marginLevel: 7500,
    isActive: true,
    liquidated: false,
    healthFactor: 1.67,
    unrealizedPnl: '49.63',
    liquidationMc: '50000',
    openedAt: new Date().toISOString(),
  },
];

// GET /positions — list positions (with filters)
positionsRoutes.get('/', (c) => {
  const trader = c.req.query('trader');
  const chainId = c.req.query('chainId');
  const active = c.req.query('active');

  let filtered = [...mockPositions];

  if (trader) {
    filtered = filtered.filter((p) => p.traderAddress.toLowerCase() === trader.toLowerCase());
  }

  if (chainId) {
    filtered = filtered.filter((p) => p.chainId === parseInt(chainId));
  }

  if (active === 'true') {
    filtered = filtered.filter((p) => p.isActive);
  }

  return c.json({
    positions: filtered,
    total: filtered.length,
  });
});

// GET /positions/:id — single position with health data
positionsRoutes.get('/:id', (c) => {
  const id = parseInt(c.req.param('id'));
  const position = mockPositions.find((p) => p.id === id);

  if (!position) {
    return c.json({ error: 'Position not found' }, 404);
  }

  return c.json({ position });
});

// GET /positions/:id/health — health check for liquidation monitoring
positionsRoutes.get('/:id/health', (c) => {
  const id = parseInt(c.req.param('id'));
  const position = mockPositions.find((p) => p.id === id);

  if (!position) {
    return c.json({ error: 'Position not found' }, 404);
  }

  const isLiquidatable = position.currentMc <= position.liquidationMc;

  return c.json({
    positionId: id,
    currentMc: position.currentMc,
    liquidationMc: position.liquidationMc,
    healthFactor: position.healthFactor,
    isLiquidatable,
    unrealizedPnl: position.unrealizedPnl,
  });
});
