import { Hono } from 'hono';
import { db } from '../db/index.js';
import { launches, positions, liquidations, protocolStats } from '../db/schema.js';
import { eq, sql, desc } from 'drizzle-orm';

export const statsRoutes = new Hono();

// GET /stats — protocol overview
statsRoutes.get('/', async (c) => {
  try {
    const [launchCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(launches);

    const [activePositions] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(positions)
      .where(eq(positions.isActive, true));

    const [totalLiquidations] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(liquidations);

    return c.json({
      totalLaunches: launchCount?.count || 0,
      activePositions: activePositions?.count || 0,
      totalLiquidations: totalLiquidations?.count || 0,
    });
  } catch (error) {
    console.error('GET /stats error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /stats/tvl — total value locked
statsRoutes.get('/tvl', async (c) => {
  try {
    const result = await db
      .select({
        totalDeposits: sql<string>`coalesce(sum(${positions.deposit}), '0')`,
        totalBorrowed: sql<string>`coalesce(sum(${positions.borrowed}), '0')`,
      })
      .from(positions)
      .where(eq(positions.isActive, true));

    return c.json({
      tvl: result[0]?.totalDeposits || '0',
      totalBorrowed: result[0]?.totalBorrowed || '0',
    });
  } catch (error) {
    console.error('GET /stats/tvl error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /stats/volume — total volume
statsRoutes.get('/volume', async (c) => {
  try {
    const result = await db
      .select({
        totalVolume: sql<string>`coalesce(sum(${positions.effectiveSize}), '0')`,
        totalPositions: sql<number>`count(*)::int`,
      })
      .from(positions);

    return c.json({
      totalVolume: result[0]?.totalVolume || '0',
      totalPositions: result[0]?.totalPositions || 0,
    });
  } catch (error) {
    console.error('GET /stats/volume error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /stats/liquidations — recent liquidations
statsRoutes.get('/liquidations', async (c) => {
  const limit = parseInt(c.req.query('limit') || '20');

  try {
    const result = await db
      .select()
      .from(liquidations)
      .orderBy(desc(liquidations.createdAt))
      .limit(limit);

    return c.json({ liquidations: result });
  } catch (error) {
    console.error('GET /stats/liquidations error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
