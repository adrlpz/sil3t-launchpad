import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { launchesRoutes } from './routes/launches.js';
import { positionsRoutes } from './routes/positions.js';
import { statsRoutes } from './routes/stats.js';
import { healthRoutes } from './routes/health.js';
import { startIndexer } from './services/indexer.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());

// Routes
app.route('/health', healthRoutes);
app.route('/launches', launchesRoutes);
app.route('/positions', positionsRoutes);
app.route('/stats', statsRoutes);

// Root
app.get('/', (c) => {
  return c.json({
    name: 'siL3t API',
    version: '1.0.0',
    description: 'Leveraged Launchpad Protocol — Backend API',
    chain: 'Sepolia Testnet',
    endpoints: {
      health: '/health',
      launches: '/launches',
      positions: '/positions',
      stats: '/stats',
    },
  });
});

const port = parseInt(process.env.PORT || '3001');

// Start indexer
startIndexer().catch(console.error);

serve({ fetch: app.fetch, port }, () => {
  console.log(`🔥 siL3t API running on http://localhost:${port}`);
});
