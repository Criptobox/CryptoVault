'use client';

import { getChain } from '@/config/chains';

/* ============================================================================
 * RADAR DE AIRDROPS — base de datos curada + criterios evaluables on-chain
 *
 * El escáner (src/lib/api/airdropScan.ts) recopila la actividad real de la
 * cartera (transacciones, edad, contratos usados, balances USD) y cada
 * airdrop define criterios que se puntúan contra esa actividad.
 *
 * Estados por airdrop (categoría base, es el estado de la VENTANA de claim):
 *  - 'claimable'    → la ventana de reclamo está ABIERTA ahora mismo
 *  - 'pending'      → token anunciado, ventana aún no abierta
 *  - 'accumulating' → sin token todavía: la actividad acumula elegibilidad
 *  - 'closed'       → ventana cerrada (solo informativo/histórico)
 *
 * El hook useAirdrops combina categoría + progreso del usuario para derivar
 * el estado final: RECLAMABLE AHORA · PENDIENTE DE RECLAMO · CERCA DE
 * RECLAMAR · ACUMULANDO · FINALIZADO.
 * ==========================================================================*/

export type AirdropCategory = 'claimable' | 'pending' | 'accumulating' | 'closed';

export type UserAirdropStatus = 'claimable' | 'pending' | 'near' | 'accumulating' | 'closed';

export interface WalletStats {
  address: string;
  /** Antigüedad estimada de la cartera en días (null = sin datos) */
  ageDays: number | null;
  /** Actividad por chainId */
  chains: Record<number, ChainStats>;
  /** Interacciones detectadas con protocolos conocidos: nombre → nº de txs */
  protocolHits: Record<string, number>;
  /** Nº de cadenas distintas con actividad */
  chainsActive: number;
  /** Escaneo parcial (sin acceso a historial completo) */
  partial: boolean;
}

export interface ChainStats {
  txs: number;
  firstTxTs: number | null;
  /** Contratos con los que interactuó (muestra reciente, lowercase) */
  sampleContracts: string[];
}

export interface ScanContext {
  stats: WalletStats;
  /** Valor USD total (nativo + tokens) en una cadena, 0 si desconocido */
  balanceUsd: (chainId: number) => number;
  /** Balance nativo (unidades enteras de token) en una cadena */
  nativeBalance: (chainId: number) => number;
}

export interface CriterionResult {
  done: boolean;
  /** 0…1 */
  progress: number;
  /** No se puede evaluar (sin datos) → se excluye del denominador */
  skip?: boolean;
}

export interface AirdropCriterion {
  id: string;
  label: string;
  /** Cómo cumplirlo */
  hint?: string;
  weight: number;
  eval: (ctx: ScanContext) => CriterionResult;
}

export interface AirdropDef {
  id: string;
  name: string;
  /** Ticker del token o 'SIN TOKEN' */
  token: string;
  /** Cadena principal asociada (logo/chip) */
  chainId: number;
  /** Cadenas donde cuenta la actividad para este airdrop */
  activityChains: number[];
  category: AirdropCategory;
  officialUrl: string;
  /** Sitio donde se reclama si la ventana está abierta */
  claimUrl?: string;
  /** Valor estimado (texto, no oficial) */
  estLabel?: string;
  desc: string;
  criteria: AirdropCriterion[];
}

/* --------------------------------------------------------------------------
 * Contratos de protocolos conocidos (para detectar interacciones reales)
 * ------------------------------------------------------------------------ */
export const PROTOCOL_CONTRACTS: { name: string; addresses: string[] }[] = [
  { name: 'OpenSea (Seaport)', addresses: ['0x00000000006c3852cbef3e08e8df289169ede5814', '0x00000000000000adc04c56bf30ac9d3c0aaf14dc', '0x00000000000001ad428e4906aee9d7052050ebf7'] },
  { name: 'Blur', addresses: ['0x00000000000006c40b3c6b0d6b7e150c1d7c7f3f'] },
  { name: 'MetaMask Swaps', addresses: ['0x881d40237659c251811cec9c364ef91dc08d300c'] },
  { name: 'Uniswap', addresses: ['0x7a250d5630b4cf539739df2c5dacb4c659f2488d', '0xe592427a0aece92de3edee1f18e0157c05861564', '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45'] },
  { name: 'Aerodrome', addresses: ['0x420dd381b31aef6683db6a90e087cd971ece46e5'] },
  { name: 'PancakeSwap', addresses: ['0x10ed43c718714eb63d5aa57b78b54704e256024e'] },
  { name: 'SushiSwap', addresses: ['0xd9e1ce17f2641f24ae83637ab66a2cba4a6b1227'] },
  { name: '1inch', addresses: ['0x1111111254eeb25477b68fb85ed929f73a960582', '0x111111125421ca6dc452d289314280a0f8842a65'] },
  { name: '0x Protocol', addresses: ['0xdef1c0ded9bec7f1a1670819833240f027b25eff'] },
  { name: 'KyberSwap', addresses: ['0x6131b5fae19ea4f9d964eac0408e4408b66337b5'] },
  { name: 'Aave', addresses: ['0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2', '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9'] },
  { name: 'Lido', addresses: ['0xae7ab96520de3a18e5e111b5eaab095312d7fe84'] },
];

const R = (v: number): number => Math.max(0, Math.min(1, v));

const txFactor = (chainId: number, target: number) => (ctx: ScanContext) => {
  const s = ctx.stats.chains[chainId];
  if (!s || s.txs === 0) return { done: false, progress: 0 };
  return { done: s.txs >= target, progress: R(s.txs / target) };
};

const balanceFactor = (chainId: number, minUsd: number) => (ctx: ScanContext) => {
  const usd = ctx.balanceUsd(chainId);
  if (usd <= 0) return { done: false, progress: 0 };
  return { done: usd >= minUsd, progress: R(usd / minUsd) };
};

const ageFactor = (minDays: number) => (ctx: ScanContext) => {
  if (ctx.stats.ageDays === null) return { done: false, progress: 0, skip: true };
  return { done: ctx.stats.ageDays >= minDays, progress: R(ctx.stats.ageDays / minDays) };
};

const protocolFactor = (protocol: string, minHits: number) => (ctx: ScanContext) => {
  const hits = ctx.stats.protocolHits[protocol] ?? 0;
  if (hits === 0) return { done: false, progress: 0 };
  return { done: hits >= minHits, progress: R(hits / minHits) };
};

const anySwapFactor = (chainIds: number[]) => (ctx: ScanContext) => {
  // ¿Interactuó con algún router/DEX en esas cadenas?
  const names = ['Uniswap', 'Aerodrome', 'PancakeSwap', 'SushiSwap', '1inch', '0x Protocol', 'KyberSwap', 'MetaMask Swaps'];
  let best = 0;
  for (const id of chainIds) {
    const s = ctx.stats.chains[id];
    if (!s) continue;
    for (const c of s.sampleContracts) {
      for (const p of PROTOCOL_CONTRACTS) {
        if (!names.includes(p.name)) continue;
        if (p.addresses.includes(c)) best = Math.max(best, 1);
      }
    }
    if (best === 1) break;
  }
  return { done: best === 1, progress: best };
};

const multiChainFactor = (minChains: number) => (ctx: ScanContext) => {
  return { done: ctx.stats.chainsActive >= minChains, progress: R(ctx.stats.chainsActive / minChains) };
};

/* --------------------------------------------------------------------------
 * Base de datos curada (estado a septiembre 2026 — verifica siempre en el
 * sitio oficial; los valores estimados NO son oficiales)
 * ------------------------------------------------------------------------ */
export const AIRDROPS_DB: AirdropDef[] = [
  {
    id: 'optimism',
    name: 'Optimism',
    token: 'OP',
    chainId: 10,
    activityChains: [10, 1],
    category: 'claimable',
    officialUrl: 'https://app.optimism.io/airdrops',
    claimUrl: 'https://app.optimism.io/airdrops',
    estLabel: 'según temporada',
    desc: 'Repartos periódicos de OP a usuarios reales de la Superchain. La actividad en OP Mainnet, la antigüedad de la cartera y el uso de DeFi históricamente puntúan. Verifica tu elegibilidad en el sitio oficial.',
    criteria: [
      { id: 'op-txs', label: 'Actividad en OP Mainnet (10+ txs)', hint: 'Usa la red Optimism: swaps, puentes, DeFi', weight: 2, eval: txFactor(10, 10) },
      { id: 'op-balance', label: 'Fondos en Optimism', hint: 'Mantén saldo o tokens en OP Mainnet', weight: 1, eval: balanceFactor(10, 20) },
      { id: 'swaps', label: 'Swaps en L2 con routers conocidos', hint: 'Opera en Uniswap/Aerodrome sobre L2', weight: 1, eval: anySwapFactor([10]) },
      { id: 'age', label: 'Cartera con 90+ días de antigüedad', weight: 1, eval: ageFactor(90) },
    ],
  },
  {
    id: 'eigenlayer',
    name: 'EigenLayer',
    token: 'EIGEN',
    chainId: 1,
    activityChains: [1],
    category: 'pending',
    officialUrl: 'https://www.eigenlayer.xyz',
    claimUrl: 'https://claims.eigenlayer.xyz',
    estLabel: 'según temporada de stakedrop',
    desc: 'Repartos por temporadas a usuarios que restakean o delegan. La ventana de claim por temporada es limitada: verifica en claims.eigenlayer.xyz si te corresponde algún reparto pendiente.',
    criteria: [
      { id: 'eth-balance', label: 'Balance ETH relevante (≥0.05)', hint: 'Mantén ETH en mainnet para restaking', weight: 2, eval: (ctx) => { const b = ctx.nativeBalance(1); return { done: b >= 0.05, progress: R(b / 0.05) }; } },
      { id: 'age', label: 'Cartera con 60+ días', weight: 1, eval: ageFactor(60) },
      { id: 'eth-txs', label: 'Actividad en Ethereum (5+ txs)', weight: 1, eval: txFactor(1, 5) },
      { id: 'defi', label: 'Uso de DeFi (Aave/Lido/DEX)', hint: 'Interactúa con protocolos blue-chip', weight: 1, eval: protocolFactor('Lido', 1) },
    ],
  },
  {
    id: 'ethena',
    name: 'Ethena',
    token: 'ENA',
    chainId: 1,
    activityChains: [1],
    category: 'pending',
    officialUrl: 'https://ethena.fi',
    claimUrl: 'https://app.ethena.fi',
    estLabel: 'según temporada de shards',
    desc: 'Temporadas continuas de shards por depositar USDe o stablecoins. Las temporadas pasadas repartieron ENA a participantes; la actividad estable sigue acumulando.',
    criteria: [
      { id: 'stables', label: 'Balance en stablecoins (≥$100)', hint: 'Deposita USDC/USDT/DAI en Ethena', weight: 2, eval: (ctx) => { const usd = ctx.balanceUsd(1); return { done: usd >= 100, progress: R(usd / 100) }; } },
      { id: 'eth-txs', label: 'Actividad en Ethereum (5+ txs)', weight: 1, eval: txFactor(1, 5) },
      { id: 'age', label: 'Cartera con 30+ días', weight: 1, eval: ageFactor(30) },
    ],
  },
  {
    id: 'opensea',
    name: 'OpenSea',
    token: 'SEA',
    chainId: 1,
    activityChains: [1, 137, 42161, 8453, 10],
    category: 'pending',
    officialUrl: 'https://opensea.io',
    estLabel: 'rumor de token SEA',
    desc: 'El mayor marketplace NFT ha confirmado su token SEA. El volumen histórico y el uso de Seaport (compra/venta de NFTs) son las señales clásicas de elegibilidad.',
    criteria: [
      { id: 'seaport', label: 'Interacción con OpenSea/Seaport', hint: 'Compra o vende NFTs en OpenSea', weight: 3, eval: protocolFactor('OpenSea (Seaport)', 2) },
      { id: 'blur', label: 'Actividad NFT en Blur u otros markets', weight: 1, eval: protocolFactor('Blur', 1) },
      { id: 'age', label: 'Cartera con 90+ días', weight: 1, eval: ageFactor(90) },
      { id: 'multichain', label: 'Actividad en 2+ cadenas', weight: 1, eval: multiChainFactor(2) },
    ],
  },
  {
    id: 'metamask',
    name: 'MetaMask',
    token: 'MASK',
    chainId: 1,
    activityChains: [1, 137, 42161, 10, 8453, 56],
    category: 'pending',
    officialUrl: 'https://metamask.io',
    estLabel: 'token anunciado por Consensys',
    desc: 'Consensys confirmó el token MASK. El histórico de swaps con el router de MetaMask y el uso multirred de la cartera son criterios muy citados por la comunidad.',
    criteria: [
      { id: 'mm-swaps', label: 'Swaps con el router de MetaMask', hint: 'Usa la función swap dentro de MetaMask', weight: 3, eval: protocolFactor('MetaMask Swaps', 2) },
      { id: 'multichain', label: 'Actividad en 3+ cadenas', weight: 1, eval: multiChainFactor(3) },
      { id: 'age', label: 'Cartera con 180+ días', weight: 1, eval: ageFactor(180) },
    ],
  },
  {
    id: 'base',
    name: 'Base',
    token: 'SIN TOKEN',
    chainId: 8453,
    activityChains: [8453, 1],
    category: 'accumulating',
    officialUrl: 'https://base.org',
    estLabel: '$300 – $2.500 (estimado comunitario)',
    desc: 'L2 de Coinbase sin token lanzado. La actividad real y sostenida (puente de fondos, swaps, volumen) es el patrón que históricamente premian los airdrops de L2.',
    criteria: [
      { id: 'base-balance', label: 'Fondos en Base', hint: 'Puentea ETH o stablecoins a Base', weight: 2, eval: balanceFactor(8453, 50) },
      { id: 'base-txs', label: '10+ transacciones en Base', hint: 'Usa dApps de Base regularmente', weight: 2, eval: txFactor(8453, 10) },
      { id: 'base-swaps', label: 'Swaps en Base (Aerodrome/Uniswap)', hint: 'Opera en Aerodrome o Uniswap sobre Base', weight: 2, eval: anySwapFactor([8453]) },
      { id: 'age', label: 'Cartera con 90+ días', weight: 1, eval: ageFactor(90) },
    ],
  },
  {
    id: 'unichain',
    name: 'Unichain',
    token: 'SIN TOKEN',
    chainId: 130,
    activityChains: [130, 1],
    category: 'accumulating',
    officialUrl: 'https://unichain.org',
    estLabel: 'estimado comunitario',
    desc: 'L2 de Uniswap Labs. Sin token propio aún (UNI gobierna el ecosistema). La actividad temprana en la red es la jugada clásica para futuros repartos.',
    criteria: [
      { id: 'uni-txs', label: '5+ transacciones en Unichain', hint: 'Usa dApps y puentes de Unichain', weight: 3, eval: txFactor(130, 5) },
      { id: 'uni-balance', label: 'Fondos en Unichain', weight: 1, eval: balanceFactor(130, 20) },
      { id: 'age', label: 'Cartera con 30+ días', weight: 1, eval: ageFactor(30) },
    ],
  },
  {
    id: 'linea',
    name: 'Linea',
    token: 'LINEA',
    chainId: 59144,
    activityChains: [59144],
    category: 'closed',
    officialUrl: 'https://linea.build',
    desc: 'El claim de LINEA se abrió en septiembre 2025 y ya cerró. Se mantiene en el radar por si se anuncian repartos adicionales (ecosistema/Vault).',
    criteria: [
      { id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) },
    ],
  },
  {
    id: 'zksync',
    name: 'zkSync Era',
    token: 'ZK',
    chainId: 324,
    activityChains: [324],
    category: 'closed',
    officialUrl: 'https://zksync.io',
    desc: 'El claim de ZK (junio 2024) cerró en enero 2025. Vigila futuros programas del ecosistema Elastic Chain.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'scroll',
    name: 'Scroll',
    token: 'SCR',
    chainId: 534352,
    activityChains: [534352],
    category: 'closed',
    officialUrl: 'https://scroll.io',
    desc: 'SCR se distribuyó en octubre 2025. Ventana de claim finalizada.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum One',
    token: 'ARB',
    chainId: 42161,
    activityChains: [42161],
    category: 'closed',
    officialUrl: 'https://arbitrum.io',
    desc: 'El histórico airdrop de ARB (marzo 2023) cerró en septiembre de ese año. La DAO sigue distribuyendo fondos vía programas específicos.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'layerzero',
    name: 'LayerZero',
    token: 'ZRO',
    chainId: 1,
    activityChains: [1, 42161, 10, 8453, 137],
    category: 'closed',
    officialUrl: 'https://layerzero.network',
    desc: 'El claim de ZRO (junio 2025) ya finalizó. Mantente atento a campañas futuras del ecosistema.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'blast',
    name: 'Blast',
    token: 'BLAST',
    chainId: 1,
    activityChains: [1],
    category: 'closed',
    officialUrl: 'https://blast.io',
    desc: 'Airdrop de BLAST (junio 2024) finalizado.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'berachain',
    name: 'Berachain',
    token: 'BERA',
    chainId: 1,
    activityChains: [1],
    category: 'closed',
    officialUrl: 'https://berachain.com',
    desc: 'Airdrop de BERA (febrero 2025) finalizado.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'monad',
    name: 'Monad',
    token: 'MON',
    chainId: 1,
    activityChains: [1],
    category: 'closed',
    officialUrl: 'https://monad.xyz',
    desc: 'Airdrop de MON (noviembre 2025) finalizado.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'plasma',
    name: 'Plasma',
    token: 'XPL',
    chainId: 1,
    activityChains: [1],
    category: 'closed',
    officialUrl: 'https://plasma.to',
    desc: 'Airdrop de XPL (septiembre 2025) finalizado.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
  {
    id: 'zora',
    name: 'Zora',
    token: 'ZORA',
    chainId: 1,
    activityChains: [1],
    category: 'closed',
    officialUrl: 'https://zora.co',
    desc: 'Airdrop de ZORA (abril 2025) finalizado.',
    criteria: [{ id: 'info', label: 'Claim finalizado', weight: 1, eval: () => ({ done: false, progress: 0 }) }],
  },
];

export function getAirdropChainName(id: number): string {
  return getChain(id)?.shortName ?? `#${id}`;
}

/** Metadatos de airdrops personalizados añadidos por el usuario */
export interface CustomAirdrop {
  id: string;
  chainId: number;
  address: string;
  name: string;
  addedAt: number;
  /** Último resultado de verificación */
  lastCheck?: {
    ts: number;
    claimableRaw: string | null; // bigint en string, null si no legible
    claimFn: string | null;      // firma detectada p.ej. 'claim()'
    simulation: 'ok' | 'revert' | 'unknown';
    revertReason?: string;
  };
}
