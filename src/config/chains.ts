import {
  mainnet, bsc, polygon, arbitrum, base, optimism, avalanche, opBNB,
  fantom, zkSync, linea, scroll, gnosis, mantle, cronos, moonbeam,
  canto, coreDao, kava, celo, polygonZkEvm, unichain, sei,
  type Chain,
} from 'viem/chains';

export interface Marketplace {
  name: string;
  url: (contract: string, tokenId: string) => string;
}

export interface ChainConfig {
  id: number;
  viemChain: Chain;
  name: string;
  shortName: string;
  symbol: string;
  logo: string; // id del logo en ChainLogo.tsx
  color: string;
  explorer: string;
  /** CoinGecko id del token nativo */
  nativeCgId: string;
  /** CoinGecko platform id para token_price (null si no soportado) */
  cgPlatform: string | null;
  /** RPC backup adicional */
  backupRpc?: string;
  /** chainid compatible con Etherscan V2 */
  explorerChainId: number;
  marketplaces: Marketplace[];
}

const opensea = (slug: string): Marketplace => ({
  name: 'OpenSea',
  url: (c, t) => `https://opensea.io/assets/${slug}/${c}/${t}`,
});
const magiceden = (slug: string): Marketplace => ({
  name: 'Magic Eden',
  url: (c, t) => `https://magiceden.io/collectibles/${slug}/${c}/${t}`,
});
const okx = (slug: string): Marketplace => ({
  name: 'OKX',
  url: (c, t) => `https://www.okx.com/web3/marketplace/nft/asset/${slug}/${c}/${t}`,
});
const element = (slug: string): Marketplace => ({
  name: 'Element',
  url: (c, t) => `https://element.market/assets/${slug}/${c}/${t}`,
});
const blur = (): Marketplace => ({
  name: 'Blur',
  url: (c) => `https://blur.app/collections/${c}`,
});

export const CHAINS: ChainConfig[] = [
  {
    id: mainnet.id, viemChain: mainnet, name: 'Ethereum', shortName: 'ETH',
    symbol: 'ETH', logo: 'eth', color: '#627EEA',
    explorer: 'https://etherscan.io', nativeCgId: 'ethereum',
    cgPlatform: 'ethereum', backupRpc: 'https://ethereum-rpc.publicnode.com',
    explorerChainId: 1,
    marketplaces: [opensea('ethereum'), blur(), magiceden('ethereum'), okx('ethereum')],
  },
  {
    id: bsc.id, viemChain: bsc, name: 'BNB Smart Chain', shortName: 'BSC',
    symbol: 'BNB', logo: 'bsc', color: '#F0B90B',
    explorer: 'https://bscscan.com', nativeCgId: 'binancecoin',
    cgPlatform: 'binance-smart-chain', backupRpc: 'https://bsc-rpc.publicnode.com',
    explorerChainId: 56,
    marketplaces: [okx('bnb-smart-chain'), element('bnb-smart-chain'), magiceden('bsc')],
  },
  {
    id: polygon.id, viemChain: polygon, name: 'Polygon', shortName: 'POL',
    symbol: 'POL', logo: 'polygon', color: '#8247E5',
    explorer: 'https://polygonscan.com', nativeCgId: 'matic-network',
    cgPlatform: 'matic-network', backupRpc: 'https://polygon-bor-rpc.publicnode.com',
    explorerChainId: 137,
    marketplaces: [opensea('matic'), magiceden('polygon'), okx('polygon')],
  },
  {
    id: arbitrum.id, viemChain: arbitrum, name: 'Arbitrum One', shortName: 'ARB',
    symbol: 'ETH', logo: 'arbitrum', color: '#12AAFF',
    explorer: 'https://arbiscan.io', nativeCgId: 'ethereum',
    cgPlatform: 'arbitrum-one', backupRpc: 'https://arbitrum-one-rpc.publicnode.com',
    explorerChainId: 42161,
    marketplaces: [opensea('arbitrum'), magiceden('arbitrum'), okx('arbitrum')],
  },
  {
    id: base.id, viemChain: base, name: 'Base', shortName: 'BASE',
    symbol: 'ETH', logo: 'base', color: '#0052FF',
    explorer: 'https://basescan.org', nativeCgId: 'ethereum',
    cgPlatform: 'base', backupRpc: 'https://base-rpc.publicnode.com',
    explorerChainId: 8453,
    marketplaces: [opensea('base'), magiceden('base'), okx('base')],
  },
  {
    id: optimism.id, viemChain: optimism, name: 'Optimism', shortName: 'OP',
    symbol: 'ETH', logo: 'optimism', color: '#FF0420',
    explorer: 'https://optimistic.etherscan.io', nativeCgId: 'ethereum',
    cgPlatform: 'optimistic-ethereum', backupRpc: 'https://optimism-rpc.publicnode.com',
    explorerChainId: 10,
    marketplaces: [opensea('optimism'), magiceden('optimism'), okx('optimism')],
  },
  {
    id: avalanche.id, viemChain: avalanche, name: 'Avalanche', shortName: 'AVAX',
    symbol: 'AVAX', logo: 'avalanche', color: '#E84142',
    explorer: 'https://snowtrace.io', nativeCgId: 'avalanche-2',
    cgPlatform: 'avalanche', backupRpc: 'https://avalanche-c-chain-rpc.publicnode.com',
    explorerChainId: 43114,
    marketplaces: [opensea('avalanche'), magiceden('avalanche'), okx('avalanche')],
  },
  {
    id: opBNB.id, viemChain: opBNB, name: 'opBNB', shortName: 'opBNB',
    symbol: 'BNB', logo: 'bsc', color: '#F0B90B',
    explorer: 'https://opbnb.bnbchain.org', nativeCgId: 'binancecoin',
    cgPlatform: null, backupRpc: 'https://opbnb-rpc.publicnode.com',
    explorerChainId: 204,
    marketplaces: [okx('opbnb')],
  },
  {
    id: fantom.id, viemChain: fantom, name: 'Fantom', shortName: 'FTM',
    symbol: 'FTM', logo: 'fantom', color: '#1969FF',
    explorer: 'https://ftmscan.com', nativeCgId: 'fantom',
    cgPlatform: 'fantom', backupRpc: 'https://fantom-rpc.publicnode.com',
    explorerChainId: 250,
    marketplaces: [okx('fantom'), element('fantom')],
  },
  {
    id: zkSync.id, viemChain: zkSync, name: 'zkSync Era', shortName: 'ZK',
    symbol: 'ETH', logo: 'zksync', color: '#8C8DFC',
    explorer: 'https://era.zksync.network', nativeCgId: 'ethereum',
    cgPlatform: 'zksync', backupRpc: 'https://zksync-era-rpc.publicnode.com',
    explorerChainId: 324,
    marketplaces: [okx('zksync'), element('zksync')],
  },
  {
    id: linea.id, viemChain: linea, name: 'Linea', shortName: 'LINEA',
    symbol: 'ETH', logo: 'linea', color: '#61DFFF',
    explorer: 'https://lineascan.build', nativeCgId: 'ethereum',
    cgPlatform: 'linea', backupRpc: 'https://linea-rpc.publicnode.com',
    explorerChainId: 59144,
    marketplaces: [okx('linea'), element('linea')],
  },
  {
    id: scroll.id, viemChain: scroll, name: 'Scroll', shortName: 'SCR',
    symbol: 'ETH', logo: 'scroll', color: '#EBC28E',
    explorer: 'https://scrollscan.com', nativeCgId: 'ethereum',
    cgPlatform: 'scroll', backupRpc: 'https://scroll-rpc.publicnode.com',
    explorerChainId: 534352,
    marketplaces: [element('scroll'), okx('scroll')],
  },
  {
    id: gnosis.id, viemChain: gnosis, name: 'Gnosis Chain', shortName: 'GNO',
    symbol: 'xDAI', logo: 'gnosis', color: '#3E6957',
    explorer: 'https://gnosisscan.io', nativeCgId: 'xdai',
    cgPlatform: 'xdai', backupRpc: 'https://gnosis-rpc.publicnode.com',
    explorerChainId: 100,
    marketplaces: [element('gnosis-chain'), okx('gnosis-chain')],
  },
  {
    id: mantle.id, viemChain: mantle, name: 'Mantle', shortName: 'MNT',
    symbol: 'MNT', logo: 'mantle', color: '#24272E',
    explorer: 'https://mantlescan.xyz', nativeCgId: 'mantle',
    cgPlatform: 'mantle', backupRpc: 'https://mantle-rpc.publicnode.com',
    explorerChainId: 5000,
    marketplaces: [element('mantle'), okx('mantle')],
  },
  {
    id: cronos.id, viemChain: cronos, name: 'Cronos', shortName: 'CRO',
    symbol: 'CRO', logo: 'cronos', color: '#002D74',
    explorer: 'https://cronoscan.com', nativeCgId: 'crypto-com-chain',
    cgPlatform: 'cronos', backupRpc: 'https://cronos-rpc.publicnode.com',
    explorerChainId: 25,
    marketplaces: [element('cronos')],
  },
  {
    id: moonbeam.id, viemChain: moonbeam, name: 'Moonbeam', shortName: 'GLMR',
    symbol: 'GLMR', logo: 'moonbeam', color: '#53CBC9',
    explorer: 'https://moonbeam.moonscan.io', nativeCgId: 'moonbeam',
    cgPlatform: 'moonbeam', backupRpc: 'https://moonbeam-rpc.publicnode.com',
    explorerChainId: 1284,
    marketplaces: [],
  },
  {
    id: canto.id, viemChain: canto, name: 'Canto', shortName: 'CANTO',
    symbol: 'CANTO', logo: 'canto', color: '#25CDCD',
    explorer: 'https://cantoscan.com', nativeCgId: 'canto',
    cgPlatform: 'canto', backupRpc: 'https://canto-rpc.publicnode.com',
    explorerChainId: 7700,
    marketplaces: [],
  },
  {
    id: coreDao.id, viemChain: coreDao, name: 'Core DAO', shortName: 'CORE',
    symbol: 'CORE', logo: 'core', color: '#FF9100',
    explorer: 'https://scan.coredao.org', nativeCgId: 'core',
    cgPlatform: 'core', backupRpc: 'https://core-rpc.publicnode.com',
    explorerChainId: 1116,
    marketplaces: [element('core-dao')],
  },
  {
    id: kava.id, viemChain: kava, name: 'Kava EVM', shortName: 'KAVA',
    symbol: 'KAVA', logo: 'kava', color: '#FF564F',
    explorer: 'https://kavascan.com', nativeCgId: 'kava',
    cgPlatform: 'kava', backupRpc: 'https://kava-rpc.publicnode.com',
    explorerChainId: 2222,
    marketplaces: [],
  },
  {
    id: celo.id, viemChain: celo, name: 'Celo', shortName: 'CELO',
    symbol: 'CELO', logo: 'celo', color: '#FCFF52',
    explorer: 'https://celoscan.io', nativeCgId: 'celo-ecosystem-token',
    cgPlatform: 'celo', backupRpc: 'https://celo-rpc.publicnode.com',
    explorerChainId: 42220,
    marketplaces: [okx('celo')],
  },
  {
    id: polygonZkEvm.id, viemChain: polygonZkEvm, name: 'Polygon zkEVM', shortName: 'zkEVM',
    symbol: 'ETH', logo: 'polygon', color: '#6F4CC6',
    explorer: 'https://zkevm.polygonscan.com', nativeCgId: 'ethereum',
    cgPlatform: 'polygon-zkevm', backupRpc: 'https://polygon-zkevm-rpc.publicnode.com',
    explorerChainId: 1101,
    marketplaces: [okx('polygon-zkevm')],
  },
  {
    id: unichain.id, viemChain: unichain, name: 'Unichain', shortName: 'UNI',
    symbol: 'ETH', logo: 'unichain', color: '#F50DB4',
    explorer: 'https://uniscan.xyz', nativeCgId: 'ethereum',
    cgPlatform: null, backupRpc: 'https://unichain-rpc.publicnode.com',
    explorerChainId: 130,
    marketplaces: [],
  },
  {
    id: sei.id, viemChain: sei, name: 'Sei EVM', shortName: 'SEI',
    symbol: 'SEI', logo: 'sei', color: '#9E1F19',
    explorer: 'https://seitrace.com', nativeCgId: 'sei-network',
    cgPlatform: null, backupRpc: 'https://sei-evm-rpc.publicnode.com',
    explorerChainId: 1329,
    marketplaces: [],
  },
];

export const CHAIN_MAP = new Map<number, ChainConfig>(CHAINS.map((c) => [c.id, c]));
export const DEFAULT_CHAIN_IDS = CHAINS.map((c) => c.id);
export const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const;

export function getChain(id: number): ChainConfig | undefined {
  return CHAIN_MAP.get(id);
}
