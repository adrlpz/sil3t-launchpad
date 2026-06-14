import { base, arbitrum, mainnet, bsc } from 'viem/chains';

export const SIL3T_CHAINS = [base, arbitrum, mainnet, bsc] as const;

export type ChainConfig = {
  marginEngine: `0x${string}`;
  lendingPool: `0x${string}`;
  launchPool: `0x${string}`;
  oracle: `0x${string}`;
  maxMargin: number;
  marginFeeBps: number;
  oracleType: 'uniswap-v3-twap' | 'chainlink' | 'pancakeswap-twap';
};

export const CHAIN_CONFIG: Record<number, ChainConfig> = {
  [base.id]: {
    marginEngine: '0x0000000000000000000000000000000000000000',
    lendingPool: '0x0000000000000000000000000000000000000000',
    launchPool: '0x0000000000000000000000000000000000000000',
    oracle: '0x0000000000000000000000000000000000000000',
    maxMargin: 7500,
    marginFeeBps: 150,
    oracleType: 'uniswap-v3-twap',
  },
  [arbitrum.id]: {
    marginEngine: '0x0000000000000000000000000000000000000000',
    lendingPool: '0x0000000000000000000000000000000000000000',
    launchPool: '0x0000000000000000000000000000000000000000',
    oracle: '0x0000000000000000000000000000000000000000',
    maxMargin: 7500,
    marginFeeBps: 150,
    oracleType: 'uniswap-v3-twap',
  },
  [mainnet.id]: {
    marginEngine: '0x0000000000000000000000000000000000000000',
    lendingPool: '0x0000000000000000000000000000000000000000',
    launchPool: '0x0000000000000000000000000000000000000000',
    oracle: '0x0000000000000000000000000000000000000000',
    maxMargin: 5000, // 50% max on ETH L1
    marginFeeBps: 200, // 2% on ETH L1
    oracleType: 'chainlink',
  },
  [bsc.id]: {
    marginEngine: '0x0000000000000000000000000000000000000000',
    lendingPool: '0x0000000000000000000000000000000000000000',
    launchPool: '0x0000000000000000000000000000000000000000',
    oracle: '0x0000000000000000000000000000000000000000',
    maxMargin: 7500,
    marginFeeBps: 150,
    oracleType: 'pancakeswap-twap',
  },
};

export function getChainConfig(chainId: number): ChainConfig {
  const config = CHAIN_CONFIG[chainId];
  if (!config) throw new Error(`Unsupported chain: ${chainId}`);
  return config;
}
