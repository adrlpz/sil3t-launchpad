import 'dotenv/config';
import { createPublicClient, http, webSocket, parseAbi, formatUnits } from 'viem';
import { base, arbitrum, mainnet } from 'viem/chains';

// ─── Config ──────────────────────────────────────────────────

const CHAINS = {
  [base.id]: {
    chain: base,
    rpc: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    wsRpc: process.env.BASE_WS_URL,
    marginEngine: process.env.BASE_MARGIN_ENGINE as `0x${string}`,
  },
  [arbitrum.id]: {
    chain: arbitrum,
    rpc: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    wsRpc: process.env.ARBITRUM_WS_URL,
    marginEngine: process.env.ARBITRUM_MARGIN_ENGINE as `0x${string}`,
  },
  [mainnet.id]: {
    chain: mainnet,
    rpc: process.env.ETH_RPC_URL || 'https://eth.llamarpc.com',
    wsRpc: process.env.ETH_WS_URL,
    marginEngine: process.env.ETH_MARGIN_ENGINE as `0x${string}`,
  },
};

// MarginEngine ABI (subset for liquidation)
const MARGIN_ENGINE_ABI = parseAbi([
  'function positions(uint256) view returns (uint256 launchId, address trader, uint256 deposit, uint256 borrowed, uint256 effectiveSize, uint256 entryMC, uint256 marginLevel, uint256 openTimestamp, uint256 debtId, bool isActive)',
  'function isLiquidatable(uint256) view returns (bool)',
  'function liquidate(uint256) external',
  'function batchLiquidate(uint256[]) external',
  'function getPositionHealth(uint256) view returns (uint256 currentMC, uint256 liquidationMC, uint256 healthFactor, int256 unrealizedPnL)',
  'event PositionOpened(uint256 indexed positionId, address indexed trader, uint256 launchId, uint256 effectiveSize, uint256 entryMC, uint256 liquidationMC)',
  'event PositionClosed(uint256 indexed positionId, address indexed trader, int256 pnl, string reason)',
  'event PositionLiquidated(uint256 indexed positionId, address indexed liquidator, uint256 debtRepaid, uint256 liquidationReward)',
]);

// ─── State ───────────────────────────────────────────────────

const activePositions = new Map<string, Set<bigint>>(); // chainId -> positionIds
const POLL_INTERVAL = 5000; // 5 seconds

// ─── Clients ─────────────────────────────────────────────────

function createClient(chainId: number) {
  const config = CHAINS[chainId as keyof typeof CHAINS];
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);

  return createPublicClient({
    chain: config.chain,
    transport: http(config.rpc),
  });
}

// ─── Position Monitoring ─────────────────────────────────────

async function checkPositions(chainId: number) {
  const config = CHAINS[chainId as keyof typeof CHAINS];
  if (!config || !config.marginEngine) return;

  const client = createClient(chainId);
  const positions = activePositions.get(chainId.toString()) || new Set();

  if (positions.size === 0) {
    console.log(`[Chain ${chainId}] No active positions to monitor`);
    return;
  }

  console.log(`[Chain ${chainId}] Checking ${positions.size} positions...`);

  const liquidatableIds: bigint[] = [];

  for (const positionId of positions) {
    try {
      const isLiquidatable = await client.readContract({
        address: config.marginEngine,
        abi: MARGIN_ENGINE_ABI,
        functionName: 'isLiquidatable',
        args: [positionId],
      });

      if (isLiquidatable) {
        liquidatableIds.push(positionId);
        console.log(`[Chain ${chainId}] Position ${positionId} is LIQUIDATABLE!`);
      }
    } catch (error) {
      console.error(`[Chain ${chainId}] Error checking position ${positionId}:`, error);
    }
  }

  if (liquidatableIds.length > 0) {
    await executeLiquidation(chainId, liquidatableIds);
  }
}

// ─── Liquidation Execution ───────────────────────────────────

async function executeLiquidation(chainId: number, positionIds: bigint[]) {
  console.log(`[Chain ${chainId}] Executing liquidation for ${positionIds.length} positions...`);

  // In production: send tx via wallet with private key
  // For MVP: log the liquidation

  for (const positionId of positionIds) {
    console.log(`[Chain ${chainId}] Liquidating position ${positionId}...`);

    // TODO: Execute actual liquidation transaction
    // const walletClient = createWalletClient({...})
    // const hash = await walletClient.writeContract({
    //   address: config.marginEngine,
    //   abi: MARGIN_ENGINE_ABI,
    //   functionName: 'liquidate',
    //   args: [positionId],
    // })

    console.log(`[Chain ${chainId}] Position ${positionId} liquidated (simulated)`);
  }
}

// ─── Event Listener ──────────────────────────────────────────

async function listenForEvents(chainId: number) {
  const config = CHAINS[chainId as keyof typeof CHAINS];
  if (!config || !config.marginEngine) return;

  const client = createClient(chainId);

  // Watch for PositionOpened events
  const unwatch = client.watchContractEvent({
    address: config.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionOpened',
    onLogs: (logs) => {
      for (const log of logs) {
        const { positionId } = log.args;
        if (positionId !== undefined) {
          if (!activePositions.has(chainId.toString())) {
            activePositions.set(chainId.toString(), new Set());
          }
          activePositions.get(chainId.toString())!.add(positionId);
          console.log(`[Chain ${chainId}] New position opened: ${positionId}`);
        }
      }
    },
  });

  // Watch for PositionClosed / PositionLiquidated events
  client.watchContractEvent({
    address: config.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionClosed',
    onLogs: (logs) => {
      for (const log of logs) {
        const { positionId } = log.args;
        if (positionId !== undefined) {
          activePositions.get(chainId.toString())?.delete(positionId);
          console.log(`[Chain ${chainId}] Position closed: ${positionId}`);
        }
      }
    },
  });

  client.watchContractEvent({
    address: config.marginEngine,
    abi: MARGIN_ENGINE_ABI,
    eventName: 'PositionLiquidated',
    onLogs: (logs) => {
      for (const log of logs) {
        const { positionId } = log.args;
        if (positionId !== undefined) {
          activePositions.get(chainId.toString())?.delete(positionId);
          console.log(`[Chain ${chainId}] Position liquidated: ${positionId}`);
        }
      }
    },
  });

  return unwatch;
}

// ─── Main Loop ───────────────────────────────────────────────

async function main() {
  console.log('🔥 siL3t Liquidation Keeper starting...');
  console.log(`Monitoring chains: ${Object.keys(CHAINS).join(', ')}`);

  // Start event listeners for each chain
  for (const chainId of Object.keys(CHAINS)) {
    await listenForEvents(parseInt(chainId));
  }

  // Poll positions for liquidation
  setInterval(async () => {
    for (const chainId of Object.keys(CHAINS)) {
      await checkPositions(parseInt(chainId));
    }
  }, POLL_INTERVAL);

  console.log(`✅ Keeper running — polling every ${POLL_INTERVAL / 1000}s`);
}

main().catch(console.error);
