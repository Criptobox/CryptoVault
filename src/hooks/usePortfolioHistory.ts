'use client';

/**
 * HISTÓRICO DEL PORTAFOLIO — evolución del valor + PnL.
 * Aproximación honesta: holdings actuales × precios históricos de CoinGecko.
 * - Activos con cgId (nativos + tokens conocidos top por valor): curva real
 * - Activos sin histórico: precio actual constante (estables ≈ plano)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMarketChart, type ChartRange } from '@/lib/api/coingecko';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import type { ChainPortfolio } from './usePortfolio';

export interface HistoryPoint {
  t: number; // timestamp ms
  v: number; // valor del portafolio
}

export interface PortfolioHistory {
  points: HistoryPoint[];
  pnlAbs: number | null;
  pnlPct: number | null;
  loading: boolean;
}

interface AssetSeries {
  balance: number;
  currentPrice: number;
  /** serie de precios [(t, price)] — null = plano */
  series: [number, number][] | null;
}

const CACHE_KEY = 'cv-portfolio-history-cache';

function readCache(key: string): [number, number][] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, { ts: number; data: [number, number][] }>;
    const hit = obj[key];
    if (hit && Date.now() - hit.ts < 10 * 60_000) return hit.data;
    return null;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: [number, number][]) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    const obj = raw ? (JSON.parse(raw) as Record<string, { ts: number; data: [number, number][] }>) : {};
    obj[key] = { ts: Date.now(), data };
    // limitar tamaño del caché
    const keys = Object.keys(obj);
    if (keys.length > 40) {
      for (const k of keys.slice(0, 10)) delete obj[k];
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(obj));
  } catch {
    /* noop */
  }
}

/** Nombres de símbolo → cgId conocidos para histórico (top assets) */
const SYMBOL_TO_CGID: Record<string, string> = {
  ETH: 'ethereum', WETH: 'ethereum', STETH: 'staked-ether', WSTETH: 'wrapped-steth',
  BNB: 'binancecoin', POL: 'polygon-ecosystem-token', MATIC: 'matic-network',
  ARB: 'arbitrum', OP: 'optimism', AVAX: 'avalanche-2', FTM: 'fantom',
  XDAI: 'xdai', ZK: 'zksync', MNT: 'mantle', CRO: 'crypto-com-chain',
  GLMR: 'moonbeam', CANTO: 'canto', CORE: 'core', KAVA: 'kava', CELO: 'celo-ecosystem-token', SEI: 'sei-network',
  WBTC: 'wrapped-bitcoin', LINK: 'chainlink', UNI: 'uniswap', AAVE: 'aave', PEPE: 'pepe',
  CAKE: 'pancake-swap', AERO: 'aerodrome-finance', LDO: 'lido-dao', CRV: 'curve-dao-token',
  USDT: 'tether', USDC: 'usd-coin', DAI: 'dai', BUSD: 'binance-usd', FDUSD: 'first-digital-usd',
};

const FLAT_OK = new Set(['tether', 'usd-coin', 'dai', 'binance-usd', 'first-digital-usd']);

export function usePortfolioHistory(
  chains: ChainPortfolio[],
  totalValue: number | null,
  range: ChartRange,
  currency: CurrencyCode,
): PortfolioHistory {
  const query = useQuery({
    queryKey: ['portfolio-history', chains.map((c) => c.chainId).join(','), currency, range, Math.round(totalValue ?? 0)],
    enabled: chains.length > 0 && totalValue !== null && totalValue > 0,
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async (): Promise<AssetSeries[]> => {
      return buildAssets(chains, currency, range);
    },
  });

  const points = useMemo<HistoryPoint[]>(() => {
    const assets = query.data;
    if (!assets || !assets.length) return [];
    // 2. Construir rejilla temporal común
    let minT = Infinity;
    let maxT = -Infinity;
    for (const a of assets) {
      if (!a.series) continue;
      if (a.series.length) {
        minT = Math.min(minT, a.series[0][0]);
        maxT = Math.max(maxT, a.series[a.series.length - 1][0]);
      }
    }
    if (!Number.isFinite(minT) || !Number.isFinite(maxT) || maxT <= minT) return [];

    const buckets = range === 1 ? 120 : range === 7 ? 130 : 90;
    const step = (maxT - minT) / buckets;
    const out: HistoryPoint[] = [];
    for (let b = 0; b <= buckets; b++) {
      const t = minT + b * step;
      let v = 0;
      for (const a of assets) {
        if (!a.series) {
          v += a.balance * a.currentPrice; // plano
          continue;
        }
        // búsqueda del precio más cercano hacia atrás (ventana de 2 buckets)
        let price = a.series[0][1];
        // búsqueda binaria simple
        let lo = 0;
        let hi = a.series.length - 1;
        while (lo < hi) {
          const mid = (lo + hi + 1) >> 1;
          if (a.series[mid][0] <= t) lo = mid;
          else hi = mid - 1;
        }
        if (t - a.series[lo][0] < step * 3) price = a.series[lo][1];
        v += a.balance * price;
      }
      out.push({ t: Math.round(t), v });
    }
    return out;
  }, [query.data, range]);

  const pnlAbs = useMemo(() => {
    if (points.length < 2 || totalValue == null) return null;
    const first = points[0].v;
    const last = points[points.length - 1].v;
    if (!Number.isFinite(first) || first <= 0) return null;
    return last - first;
  }, [points, totalValue]);

  const pnlPct = useMemo(() => {
    if (points.length < 2) return null;
    const first = points[0].v;
    const last = points[points.length - 1].v;
    if (!Number.isFinite(first) || first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [points]);

  return {
    points,
    pnlAbs,
    pnlPct,
    loading: query.isLoading || (query.isFetching && !query.data),
  };
}

/** Construye las series de precios por activo (máx 6 curvas reales) */
async function buildAssets(
  chains: ChainPortfolio[],
  currency: CurrencyCode,
  range: ChartRange,
): Promise<AssetSeries[]> {
  const NATIVE_CG: Record<number, string> = {
    1: 'ethereum', 56: 'binancecoin', 137: 'polygon-ecosystem-token', 10: 'ethereum',
    42161: 'ethereum', 8453: 'ethereum', 43114: 'avalanche-2', 204: 'binancecoin',
    250: 'fantom', 324: 'ethereum', 59144: 'ethereum', 534352: 'ethereum', 100: 'xdai',
    5000: 'mantle', 25: 'crypto-com-chain', 1284: 'moonbeam', 7700: 'canto', 1116: 'core',
    2222: 'kava', 42220: 'celo-ecosystem-token', 1101: 'ethereum', 130: 'ethereum', 1329: 'sei-network',
  };

  interface Candidate {
    key: string;
    cgId: string | null;
    balance: number;
    currentPrice: number;
    stableLike: boolean;
  }
  const candidates: Candidate[] = [];

  for (const c of chains) {
    if (c.native.usd != null && c.native.balance > 0) {
      candidates.push({
        key: `native-${c.chainId}`,
        cgId: NATIVE_CG[c.chainId] ?? null,
        balance: c.native.balance,
        currentPrice: c.native.usd / c.native.balance,
        stableLike: false,
      });
    }
    for (const t of c.tokens) {
      if (t.usdValue == null || t.usdValue <= 0 || t.price == null) continue;
      const cgId = SYMBOL_TO_CGID[t.symbol?.toUpperCase() ?? ''] ?? null;
      const stableLike = ['USDT', 'USDC', 'DAI', 'BUSD', 'FDUSD'].includes(t.symbol?.toUpperCase() ?? '');
      candidates.push({
        key: `${c.chainId}-${t.address.toLowerCase()}`,
        cgId,
        balance: t.balance,
        currentPrice: t.price,
        stableLike,
      });
    }
  }

  // Top por valor para no saturar la API (máx 6 curvas reales)
  candidates.sort((a, b) => b.balance * b.currentPrice - a.balance * a.currentPrice);
  const withCg = candidates.filter((c) => c.cgId && !c.stableLike).slice(0, 6);

  const out: AssetSeries[] = [];
  for (const c of candidates) {
    const real = withCg.find((x) => x.key === c.key);
    if (real) {
      const cacheK = `${real.cgId}-${currency}-${range}`;
      let series = readCache(cacheK);
      if (!series) {
        series = (await fetchMarketChart(real.cgId!, currency, range).catch(() => null)) ?? null;
        if (series) writeCache(cacheK, series);
        // pequeño respiro anti-429
        await new Promise((r) => setTimeout(r, 350));
      }
      out.push({ balance: c.balance, currentPrice: c.currentPrice, series });
    } else {
      out.push({ balance: c.balance, currentPrice: c.currentPrice, series: null });
    }
  }
  return out;
}
