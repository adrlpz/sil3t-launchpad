import 'dotenv/config';
import { createPublicClient, http, webSocket, parseAbi, formatUnits, type Log } from 'viem';
import { sepolia } from 'viem/chains';
import { db } from '../db/index.js';
import { launches, positions, liquidations } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ─── Config ──────────────────────────────────────────────────

const CHAIN_ID = 11155111; // Sepolia
const RPC_URL = process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org';
const WS_URL = process.env.SEPOLIA_WS_URL;

const MARGIN_ENGINE = process.env.SEPOLIA_MARGIN_ENGINE as `0x${string}`;
const LAUNCH_POOL = process.env.SEPOLIA_LAUNCH_POOL as `0x${string}`;

// ─── ABIs ────────────────────────────────────────────────────

const MARGIN_ENGINE_ABI = parseAbi([
  'event PositionOpened(uint256 indexed positionId, address indexed trader, uint256 launchId, uint256 effectiveSize, uint256 entryMC, uint256 liquidationMC)',
  'event PositionClosed(uint256 indexed positionId, address indexed trader, int256 pnl, string reason)',
  'event PositionLiquidated(uint256 indexed positionId, address indexed liquidator, uint256 debtRepaid, uint256 liquidationReward)',
]);

const LAUNCH_POOL_ABI = parseAbi([
  'event LaunchCreated(uint256 indexed launchId, address indexed token, uint256 targetRaise, uint256 marketCap)',
  'event DepositMade(uint256 indexed launchId, address indexed user, uint256 amount)',
  'event TokensClaimed(uint256 indexed launchId, address indexed user, uint256 tokens)',
  'event LaunchFinalized(uint256 indexed launchId, uint256 totalRaised)',
  'event LaunchCancelled(uint256 indexed launchId)',
]);

// ─── Client ──────────────────────────────────────────────────

function createClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(RPC_URL),
  });
}

// ─── Event Handlers ──────────────────────────────────────────

async function handleLaunchCreated(log: any) {
  const { launchId, token, targetRaise, marketCap } = log.args;
  console.log(`[Indexer] LaunchCreated: id=${launchId} token=${token}`);

  try {
    await db.insert(launches).values({
      contractLaunchId: Number(launchId),
      chainId: CHAIN_ID,
      tokenAddress: token,
      targetRaise: targetRaise.toString(),
      marketCap: marketCap.toString(),
    });
  } catch (error) {
    console.error('[Indexer] Failed to insert launch:', error);
  }
}

async function handleDepositMade(log: any) {
  const { launchId, user, amount } = log.args;
  console.log(`[Indexer] DepositMade: launch=${launchId} user=${user} amount=${amount}`);

  try {
    // Update currentRaise on the launch
    const existing = await db
      .select()
      .from(launches)
      .where(eq(launches.contractLaunchId, Number(launchId)))
      .limit(1);

    if (existing.length > 0) {
      const current = BigInt(existing[0].currentRaise || '0');
      const updated = (current + amount).toString();
      await db
        .update(launches)
        .set({ currentRaise: updated })
        .where(eq(launches.id, existing[0].id));
    }
  } catch (error) {
    console.error('[Indexer] Failed to update deposit:', error);
  }
}

async function handleLaunchFinalized(log: any) {
  const { launchId, totalRaised } = log.args;
  console.log(`[Indexer] LaunchFinalized: id=${launchId} raised=${totalRaised}`);

  try {
    await db
      .update(launches)
      .set({ finalized: true, currentRaise: totalRaised.toString() })
      .where(eq(launches.contractLaunchId, Number(launchId)));
  } catch (error) {
    console.error('[Indexer] Failed to finalize launch:', error);
  }
}

async function handlePositionOpened(log: any) {
  const { positionId, trader, launchId, effectiveSize, entryMC, liquidationMC } = log.args;
  console.log(`[Indexer] PositionOpened: id=${positionId} trader=${trader}`);

  try {
    // Find launch DB id
    const launch = await db
      .select()
      .from(launches)
      .where(eq(launches.contractLaunchId, Number(launchId)))
      .limit(1);

    await db.insert(positions).values({
      contractPositionId: Number(positionId),
      chainId: CHAIN_ID,
      launchId: launch.length > 0 ? launch[0].id : null,
      traderAddress: trader.toLowerCase(),
      deposit: '0', // Will be enriched from chain
      borrowed: '0',
      effectiveSize: effectiveSize.toString(),
      entryMc: entryMC.toString(),
      marginLevel: 0, // Will be enriched from chain
    });
  } catch (error) {
    console.error('[Indexer] Failed to insert position:', error);
  }
}

async function handlePositionClosed(log: any) {
  const { positionId, trader, pnl, reason } = log.args;
  console.log(`[Indexer] PositionClosed: id=${positionId} pnl=${pnl} reason=${reason}`);

  try {
    await db
      .update(positions)
      .set({ isActive: false, closedAt: new Date() })
      .where(eq(positions.contractPositionId, Number(positionId)));
  } catch (error) {
    console.error('[Indexer] Failed to close position:', error);
  }
}

async function handlePositionLiquidated(log: any) {
  const { positionId, liquidator, debtRepaid, liquidationReward } = log.args;
  console.log(`[Indexer] PositionLiquidated: id=${positionId} by=${liquidator}`);

  try {
    // Mark position as liquidated
    await db
      .update(positions)
      .set({ isActive: false, liquidated: true, closedAt: new Date() })
      .where(eq(positions.contractPositionId, Number(positionId)));

    // Record liquidation
    const pos = await db
      .select()
      .from(positions)
      .where(eq(positions.contractPositionId, Number(positionId)))
      .limit(1);

    if (pos.length > 0) {
      await db.insert(liquidations).values({
        positionId: pos[0].id,
        chainId: CHAIN_ID,
        liquidatorAddress: liquidator.toLowerCase(),
        debtRepaid: debtRepaid.toString(),
        rewardPaid: liquidationReward.toString(),
        txHash: log.transactionHash,
      });
    }
  } catch (error) {
    console.error('[Indexer] Failed to process liquidation:', error);
  }
}

// ─── Main ────────────────────────────────────────────────────

export async function startIndexer() {
  if (!MARGIN_ENGINE || !LAUNCH_POOL) {
    console.warn('[Indexer] Contract addresses not set, skipping indexer');
    return;
  }

  const client = createClient();

  console.log(`[Indexer] Starting on Sepolia (chain ${CHAIN_ID})`);
  console.log(`[Indexer] MarginEngine: ${MARGIN_ENGINE}`);
  console.log(`[Indexer] LaunchPool: ${LAUNCH_POOL}`);

  // Watch LaunchPool events
  client.watchContractEvent({
    address: LAUNCH_POOL,
    abi: LAUNCH_POOL_ABI,
    eventName: 'LaunchCreated',
    onLogs: (logs) => logs.forEach(handleLaunchCreated),
  });

  client.watchContractEvent({
    address: LAUNCH_POOL,
    abi: LAUNCH_POOL_ABI,
    eventName: 'DepositMade',
    onLogs: (logs) => logs.forEach(handleDepositMade),
  });

  client.watchContractEvent({
    address: LAUNCH_POOL,
    abi: LAUNCH_POOL_ABI,
    eventName: 'LaunchFinalized',
    onLogs: (logs) => logs.forEach(handleLaunchFinalized),
  });

  // Watch MarginEngine events
  client.watchContractEvent({
    address: MARGIN_ENGINE,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionOpened',
    onLogs: (logs) => logs.forEach(handlePositionOpened),
  });

  client.watchContractEvent({
    address: MARGIN_ENGINE,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionClosed',
    onLogs: (logs) => logs.forEach(handlePositionClosed),
  });

  client.watchContractEvent({
    address: MARGIN_ENGINE,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionLiquidated',
    onLogs: (logs) => logs.forEach(handlePositionLiquidated),
  });

  console.log('[Indexer] ✅ Event listeners active');
}
