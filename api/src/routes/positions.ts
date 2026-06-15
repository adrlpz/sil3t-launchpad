import { Hono } from 'hono';
import { db } from '../db/index.js';
import { positions, launches } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export const positionsRoutes = new Hono();

// GET /positions — list positions (optionally filtered by trader)
positionsRoutes.get('/', async (c) => {
  const trader = c.req.query('trader');
  const chainId = c.req.query('chainId');
  const active = c.req.query('active');
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = db.select().from(positions);

    const conditions = [];
    if (trader) conditions.push(eq(positions.traderAddress, trader.toLowerCase()));
    if (chainId) conditions.push(eq(positions.chainId, parseInt(chainId)));
    if (active === 'true') conditions.push(eq(positions.isActive, true));

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query
      .orderBy(desc(positions.openedAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      positions: result.map(mapPosition),
      total: result.length,
    });
  } catch (error) {
    console.error('GET /positions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /positions/:id — single position
positionsRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  try {
    const result = await db
      .select()
      .from(positions)
      .where(eq(positions.id, id))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Position not found' }, 404);
    }

    return c.json({ position: mapPosition(result[0]) });
  } catch (error) {
    console.error('GET /positions/:id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /positions/trader/:address — all positions for a trader
positionsRoutes.get('/trader/:address', async (c) => {
  const address = c.req.param('address').toLowerCase();

  try {
    const result = await db
      .select()
      .from(positions)
      .where(eq(positions.traderAddress, address))
      .orderBy(desc(positions.openedAt));

    return c.json({
      trader: address,
      positions: result.map(mapPosition),
      total: result.length,
      activeCount: result.filter((p) => p.isActive).length,
    });
  } catch (error) {
    console.error('GET /positions/trader/:address error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /positions — create position (from indexer)
positionsRoutes.post('/', async (c) => {
  const body = await c.req.json();

  try {
    const result = await db.insert(positions).values({
      contractPositionId: body.contractPositionId,
      chainId: body.chainId,
      launchId: body.launchId || null,
      traderAddress: body.traderAddress.toLowerCase(),
      deposit: body.deposit,
      borrowed: body.borrowed,
      effectiveSize: body.effectiveSize,
      entryMc: body.entryMc,
      marginLevel: body.marginLevel,
    }).returning();

    return c.json({ position: mapPosition(result[0]) }, 201);
  } catch (error) {
    console.error('POST /positions error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /positions/:id/close — close position
positionsRoutes.patch('/:id/close', async (c) => {
  const id = parseInt(c.req.param('id'));

  try {
    const result = await db
      .update(positions)
      .set({ isActive: false, closedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Position not found' }, 404);
    }

    return c.json({ position: mapPosition(result[0]) });
  } catch (error) {
    console.error('PATCH /positions/:id/close error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// PATCH /positions/:id/liquidate — mark as liquidated
positionsRoutes.patch('/:id/liquidate', async (c) => {
  const id = parseInt(c.req.param('id'));

  try {
    const result = await db
      .update(positions)
      .set({ isActive: false, liquidated: true, closedAt: new Date() })
      .where(eq(positions.id, id))
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Position not found' }, 404);
    }

    return c.json({ position: mapPosition(result[0]) });
  } catch (error) {
    console.error('PATCH /positions/:id/liquidate error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

function mapPosition(row: any) {
  return {
    id: row.id,
    contractPositionId: row.contractPositionId,
    chainId: row.chainId,
    launchId: row.launchId,
    traderAddress: row.traderAddress,
    deposit: row.deposit,
    borrowed: row.borrowed,
    effectiveSize: row.effectiveSize,
    entryMc: row.entryMc,
    marginLevel: row.marginLevel,
    isActive: row.isActive,
    liquidated: row.liquidated,
    openedAt: row.openedAt?.toISOString(),
    closedAt: row.closedAt?.toISOString(),
  };
}
