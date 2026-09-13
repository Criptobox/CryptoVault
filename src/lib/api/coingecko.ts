'use client';

/**
 * Cliente CoinGecko (API pública gratuita) — multi-moneda.
 * Cache en memoria 60s para respetar rate-limits (~30 req/min).
 */

import type { CurrencyCode } from '@/lib/store';

const BASE = 'https://api.coingecko.com/api/v3';
const CACHE_TTL = 60_000;

type CacheEntry = { data: unknown; ts: number };
const cache = new Map<string, CacheEntry>();

async function cachedFetch<T>(url: string, ttlMs = CACHE_TTL): Promise<T | null> {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < ttlMs) return hit.data as T;
  try {
    const res = await fetch(url, { headers: { accept: 'application/json' } });
    if (!res.ok) {
      // 429 => devolver caché aunque expirada si existe
      if (res.status === 429 && hit) return hit.data as T;
      return null;
    }
    const data = (await res.json()) as T;
    cache.set(url, { data, ts: Date.now() });
    return data;
  } catch {
    return hit ? (hit.data as T) : null;
  }
}

export interface PriceInfo {
  price: number;
  /** cambio % en 24h si CoinGecko lo devuelve */
  change24h?: number;
}

type CGSimpleRow = Record<string, number | string>;

/**
 * Precios de tokens nativos por cgId en la moneda solicitada:
 * { ethereum: { price: 3400, change24h: -1.2 }, ... }
 */
export async function fetchNativePrices(
  cgIds: string[],
  vs: CurrencyCode = 'usd',
): Promise<Record<string, PriceInfo>> {
  if (!cgIds.length) return {};
  const ids = [...new Set(cgIds)].join(',');
  const data = await cachedFetch<Record<string, CGSimpleRow>>(
    `${BASE}/simple/price?ids=${ids}&vs_currencies=${vs}&include_24hr_change=true`,
  );
  const out: Record<string, PriceInfo> = {};
  if (data) {
    for (const [id, row] of Object.entries(data)) {
      const p = Number(row[vs]);
      if (Number.isFinite(p) && p > 0) {
        out[id] = { price: p, change24h: Number(row[`${vs}_24h_change`]) || undefined };
      }
    }
  }
  return out;
}

/**
 * Precios de tokens ERC20 por plataforma en la moneda solicitada:
 * { '0x...': { price: 1 } }
 */
export async function fetchTokenPrices(
  platform: string,
  contractAddresses: string[],
  vs: CurrencyCode = 'usd',
): Promise<Record<string, PriceInfo>> {
  if (!contractAddresses.length || !platform) return {};
  const contracts = [...new Set(contractAddresses)].join(',');
  const data = await cachedFetch<Record<string, CGSimpleRow>>(
    `${BASE}/simple/token_price/${platform}?contract_addresses=${contracts}&vs_currencies=${vs}&include_24hr_change=true`,
  );
  const out: Record<string, PriceInfo> = {};
  if (data) {
    for (const [addr, row] of Object.entries(data)) {
      const p = Number(row[vs]);
      if (Number.isFinite(p) && p > 0) {
        out[addr.toLowerCase()] = { price: p, change24h: Number(row[`${vs}_24h_change`]) || undefined };
      }
    }
  }
  return out;
}

export type ChartRange = 1 | 7 | 30;

/**
 * Histórico de precios de una moneda (timestamps ms + precio).
 * days=1 → granularidad ~5min · days=7/30 → horaria/diaria.
 */
export async function fetchMarketChart(
  cgId: string,
  vs: CurrencyCode = 'usd',
  days: ChartRange = 7,
): Promise<[number, number][] | null> {
  const url = `${BASE}/coins/${encodeURIComponent(cgId)}/market_chart?vs_currency=${vs}&days=${days}`;
  const data = await cachedFetch<{ prices: [number, number][] }>(url, 10 * 60_000);
  return data?.prices ?? null;
}

/** Precio de un NFT no disponible en CoinGecko — placeholder para futuras integraciones */
export function marketplaceSearchUrl(name: string): string {
  return `https://opensea.io/assets?search[query]=${encodeURIComponent(name)}`;
}
