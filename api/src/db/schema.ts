import { pgTable, serial, varchar, numeric, boolean, timestamp, integer, bigint } from 'drizzle-orm/pg-core';

// Launches table
export const launches = pgTable('launches', {
  id: serial('id').primaryKey(),
  contractLaunchId: integer('contract_launch_id').notNull(),
  chainId: integer('chain_id').notNull(),
  tokenAddress: varchar('token_address', { length: 42 }).notNull(),
  tokenName: varchar('token_name', { length: 100 }),
  tokenSymbol: varchar('token_symbol', { length: 20 }),
  targetRaise: numeric('target_raise', { precision: 30, scale: 6 }).notNull(),
  currentRaise: numeric('current_raise', { precision: 30, scale: 6 }).default('0'),
  tokenPrice: numeric('token_price', { precision: 30, scale: 18 }),
  marketCap: numeric('market_cap', { precision: 30, scale: 18 }),
  maxMargin: integer('max_margin').default(5000), // bps
  startTime: timestamp('start_time'),
  endTime: timestamp('end_time'),
  finalized: boolean('finalized').default(false),
  cancelled: boolean('cancelled').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Positions table
export const positions = pgTable('positions', {
  id: serial('id').primaryKey(),
  contractPositionId: integer('contract_position_id').notNull(),
  chainId: integer('chain_id').notNull(),
  launchId: integer('launch_id').references(() => launches.id),
  traderAddress: varchar('trader_address', { length: 42 }).notNull(),
  deposit: numeric('deposit', { precision: 30, scale: 6 }).notNull(),
  borrowed: numeric('borrowed', { precision: 30, scale: 6 }).notNull(),
  effectiveSize: numeric('effective_size', { precision: 30, scale: 6 }).notNull(),
  entryMc: numeric('entry_mc', { precision: 30, scale: 18 }).notNull(),
  marginLevel: integer('margin_level').notNull(), // bps
  isActive: boolean('is_active').default(true),
  liquidated: boolean('liquidated').default(false),
  openedAt: timestamp('opened_at').defaultNow(),
  closedAt: timestamp('closed_at'),
});

// Price cache
export const priceCache = pgTable('price_cache', {
  id: serial('id').primaryKey(),
  tokenAddress: varchar('token_address', { length: 42 }).notNull(),
  chainId: integer('chain_id').notNull(),
  price: numeric('price', { precision: 30, scale: 18 }).notNull(),
  marketCap: numeric('market_cap', { precision: 30, scale: 18 }),
  timestamp: timestamp('timestamp').defaultNow(),
});

// Liquidations
export const liquidations = pgTable('liquidations', {
  id: serial('id').primaryKey(),
  positionId: integer('position_id').references(() => positions.id),
  chainId: integer('chain_id').notNull(),
  liquidatorAddress: varchar('liquidator_address', { length: 42 }),
  debtRepaid: numeric('debt_repaid', { precision: 30, scale: 6 }),
  tokensSold: numeric('tokens_sold', { precision: 30, scale: 18 }),
  insuranceUsed: numeric('insurance_used', { precision: 30, scale: 6 }),
  rewardPaid: numeric('reward_paid', { precision: 30, scale: 6 }),
  txHash: varchar('tx_hash', { length: 66 }),
  createdAt: timestamp('created_at').defaultNow(),
});

// Protocol stats
export const protocolStats = pgTable('protocol_stats', {
  id: serial('id').primaryKey(),
  chainId: integer('chain_id').notNull(),
  date: timestamp('date').notNull(),
  tvl: numeric('tvl', { precision: 30, scale: 6 }),
  totalVolume: numeric('total_volume', { precision: 30, scale: 6 }),
  totalLaunches: integer('total_launches').default(0),
  totalPositions: integer('total_positions').default(0),
  totalLiquidations: integer('total_liquidations').default(0),
  totalRevenue: numeric('total_revenue', { precision: 30, scale: 6 }),
});
