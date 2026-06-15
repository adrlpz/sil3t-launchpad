import { Hono } from 'hono';
import { z } from 'zod';
import { db } from '../db/index.js';
import { launches } from '../db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export const launchesRoutes = new Hono();

// GET /launches — list all launches
launchesRoutes.get('/', async (c) => {
  const chainId = c.req.query('chainId');
  const status = c.req.query('status'); // active, finalized, cancelled
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  try {
    let query = db.select().from(launches);

    const conditions = [];
    if (chainId) conditions.push(eq(launches.chainId, parseInt(chainId)));
    if (status === 'active') {
      conditions.push(eq(launches.finalized, false));
      conditions.push(eq(launches.cancelled, false));
    } else if (status === 'finalized') {
      conditions.push(eq(launches.finalized, true));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const result = await query
      .orderBy(desc(launches.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({
      launches: result.map(mapLaunch),
      total: result.length,
      limit,
      offset,
    });
  } catch (error) {
    console.error('GET /launches error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// GET /launches/:id — single launch
launchesRoutes.get('/:id', async (c) => {
  const id = parseInt(c.req.param('id'));

  try {
    const result = await db
      .select()
      .from(launches)
      .where(eq(launches.id, id))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Launch not found' }, 404);
    }

    return c.json({ launch: mapLaunch(result[0]) });
  } catch (error) {
    console.error('GET /launches/:id error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// POST /launches — create launch (from indexer or admin)
launchesRoutes.post('/', async (c) => {
  const body = await c.req.json();

  const schema = z.object({
    contractLaunchId: z.number(),
    chainId: z.number(),
    tokenAddress: z.string(),
    tokenName: z.string().optional(),
    tokenSymbol: z.string().optional(),
    targetRaise: z.string(),
    tokenPrice: z.string().optional(),
    marketCap: z.string().optional(),
    maxMargin: z.number().default(5000),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
  });

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await db.insert(launches).values({
      contractLaunchId: parsed.data.contractLaunchId,
      chainId: parsed.data.chainId,
      tokenAddress: parsed.data.tokenAddress,
      tokenName: parsed.data.tokenName || null,
      tokenSymbol: parsed.data.tokenSymbol || null,
      targetRaise: parsed.data.targetRaise,
      tokenPrice: parsed.data.tokenPrice || null,
      marketCap: parsed.data.marketCap || null,
      maxMargin: parsed.data.maxMargin,
      startTime: parsed.data.startTime ? new Date(parsed.data.startTime) : null,
      endTime: parsed.data.endTime ? new Date(parsed.data.endTime) : null,
    }).returning();

    return c.json({ launch: mapLaunch(result[0]) }, 201);
  } catch (error) {
    console.error('POST /launches error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Helper
function mapLaunch(row: any) {
  return {
    id: row.id,
    contractLaunchId: row.contractLaunchId,
    chainId: row.chainId,
    tokenAddress: row.tokenAddress,
    tokenName: row.tokenName,
    tokenSymbol: row.tokenSymbol,
    targetRaise: row.targetRaise,
    currentRaise: row.currentRaise || '0',
    tokenPrice: row.tokenPrice,
    marketCap: row.marketCap,
    maxMargin: row.maxMargin,
    startTime: row.startTime?.toISOString(),
    endTime: row.endTime?.toISOString(),
    finalized: row.finalized,
    cancelled: row.cancelled,
    createdAt: row.createdAt?.toISOString(),
  };
}
