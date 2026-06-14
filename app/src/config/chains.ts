// siL3t — Chain Configuration
// Deployed on Sepolia L1 testnet (2026-06-14)

export const CHAINS = {
  sepolia: {
    id: 11155111,
    name: 'Sepolia',
    rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
    explorerUrl: 'https://sepolia.etherscan.io',
    contracts: {
      mockUSDC: '0x7ae6a06e25b456c14ba6d81a9c493fbc9f8860b8',
      oracleAdapter: '0x33a641b90dffc22bc027a8ea8732c2973c591eea',
      insuranceFund: '0xfae728a4070634a32f78df485c924d42c17ad46e',
      feeCollector: '0xa51dc2cdb1ec62c2422a160dd5d6263f5a930fbb',
      lendingPool: '0x865a029b11fb37e7ea0f4a81bc1600c8e8f76d3a',
      launchPool: '0xaa1cd285da4da9883279263e12a67ac43e3aa52e',
      marginEngine: '0x6d52368d0157152b5ce85842fe491d7a8a097852',
    },
    isTestnet: true,
  },
  // Production chains (Phase 2+)
  base: {
    id: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    contracts: {
      mockUSDC: '',
      oracleAdapter: '',
      insuranceFund: '',
      feeCollector: '',
      lendingPool: '',
      launchPool: '',
      marginEngine: '',
    },
    isTestnet: false,
  },
  arbitrum: {
    id: 42161,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    contracts: {
      mockUSDC: '',
      oracleAdapter: '',
      insuranceFund: '',
      feeCollector: '',
      lendingPool: '',
      launchPool: '',
      marginEngine: '',
    },
    isTestnet: false,
  },
  ethereum: {
    id: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    contracts: {
      mockUSDC: '',
      oracleAdapter: '',
      insuranceFund: '',
      feeCollector: '',
      lendingPool: '',
      launchPool: '',
      marginEngine: '',
    },
    isTestnet: false,
  },
  bsc: {
    id: 56,
    name: 'BNB Chain',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    contracts: {
      mockUSDC: '',
      oracleAdapter: '',
      insuranceFund: '',
      feeCollector: '',
      lendingPool: '',
      launchPool: '',
      marginEngine: '',
    },
    isTestnet: false,
  },
} as const;

export type ChainId = keyof typeof CHAINS;
export const DEFAULT_CHAIN: ChainId = 'sepolia';

export function getChain(id: number) {
  return Object.values(CHAINS).find((c) => c.id === id);
}

export function getContract(chainId: number, name: string): string {
  const chain = getChain(chainId);
  if (!chain) throw new Error(`Chain ${chainId} not found`);
  return (chain.contracts as any)[name] || '';
}
