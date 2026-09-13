'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, formatUnits, multicall3Abi, erc20Abi } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { CHAINS, MULTICALL3, getChain, type ChainConfig } from '@/config/chains';
import { KNOWN_TOKENS, findKnownToken, type KnownToken } from '@/config/tokens';
import { fetchNativePrices, fetchTokenPrices } from '@/lib/api/coingecko';
import { fetchTokenTransfers, type TokenTx } from '@/lib/api/explorer';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { useActiveAddress } from '@/hooks/useActiveAddress';

export interface TokenBalance {
  chainId: number;
  address: string; // 'native' o dirección del token
  symbol: string;
  name: string;
  decimals: number;
  balance: number;
  price: number | null;
  usdValue: number | null;
  imageUrl?: string | null;
  isCustom?: boolean;
}

export interface ChainPortfolio {
  chainId: number;
  native: { balance: number; price: number | null; usd: number | null };
  tokens: TokenBalance[];
}

interface Portfolio {
  chains: ChainPortfolio[];
  totalUsd: number | null;
  loading: boolean;
  error?: string;
  scannedWithKey: boolean;
}

const CUSTOM_TOKENS_KEY = 'cryptovault-custom-tokens';
export interface CustomTokenEntry {
  chainId: number;
  address: string;
  symbol?: string;
  decimals?: number;
}

export function getCustomTokens(): CustomTokenEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_TOKENS_KEY) ?? '[]') as CustomTokenEntry[];
  } catch {
    return [];
  }
}
export function addCustomToken(entry: CustomTokenEntry) {
  const all = getCustomTokens();
  all.push(entry);
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(all));
}
export function removeCustomToken(chainId: number, address: string) {
  const all = getCustomTokens().filter(
    (t) => !(t.chainId === chainId && t.address.toLowerCase() === address.toLowerCase()),
  );
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(all));
}

/** Descubre tokens adicionales por transfers (requiere API key de explorador) */
async function discoverTokens(
  chain: ChainConfig,
  address: string,
): Promise<KnownToken[]> {
  const txs: TokenTx[] = await fetchTokenTransfers(chain.id, address);
  const byContract = new Map<string, { tx: TokenTx; count: number }>();
  for (const tx of txs) {
    const c = tx.contractAddress?.toLowerCase();
    if (!c) continue;
    const prev = byContract.get(c);
    byContract.set(c, { tx, count: (prev?.count ?? 0) + 1 });
  }
  const out: KnownToken[] = [];
  for (const [contract, { tx }] of byContract) {
    const known = findKnownToken(chain.id, contract);
    if (known) continue; // ya está en la lista base
    const decimals = parseInt(tx.tokenDecimal ?? '18', 10);
    if (Number.isNaN(decimals) || decimals < 0 || decimals > 18) continue;
    out.push({
      address: tx.contractAddress,
      symbol: tx.tokenSymbol || 'TOKEN',
      name: tx.tokenName || 'Token desconocido',
      decimals,
    });
  }
  return out.slice(0, 120); // límite de seguridad de multicall
}

async function fetchChainPortfolio(
  chain: ChainConfig,
  address: string,
  includeDiscovered: boolean,
  currency: CurrencyCode = 'usd',
): Promise<ChainPortfolio> {
  const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chain.id) });

  // 1. Saldo nativo
  const nativeWei = await client.getBalance({ address }).catch(() => 0n);

  // 2. Lista de tokens: conocidos + custom + descubiertos
  let candidates: KnownToken[] = [...(KNOWN_TOKENS[chain.id] ?? [])];
  for (const ct of getCustomTokens()) {
    if (ct.chainId !== chain.id) continue;
    if (candidates.some((t) => t.address.toLowerCase() === ct.address.toLowerCase())) continue;
    candidates.push({
      address: ct.address,
      symbol: ct.symbol ?? 'TOKEN',
      name: 'Token personalizado',
      decimals: ct.decimals ?? 18,
    });
  }
  if (includeDiscovered) {
    const discovered = await discoverTokens(chain, address).catch(() => []);
    candidates = candidates.concat(discovered);
  }
  candidates = candidates.filter(
    (t, i, arr) => arr.findIndex((x) => x.address.toLowerCase() === t.address.toLowerCase()) === i,
  );

  // 3. Saldos ERC20 por multicall (lotes de 40)
  const tokenBalances: TokenBalance[] = [];
  const BATCH = 40;
  const addr = address as `0x${string}`;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const results = await client
      .multicall({
        contracts: batch.map(
          (t) =>
            ({
              address: t.address as `0x${string}`,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [addr],
            }) as const,
        ),
        multicallAddress: MULTICALL3,
        allowFailure: true,
      })
      .catch(() => []);
    batch.forEach((t, idx) => {
      const res = results[idx];
      if (!res || res.status !== 'success') return;
      const raw = res.result as bigint;
      if (raw === 0n) return;
      const bal = Number(formatUnits(raw, t.decimals));
      if (bal <= 0) return;
      tokenBalances.push({
        chainId: chain.id,
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        balance: bal,
        price: null,
        usdValue: null,
      });
    });
  }

  // 4. Precios (en la moneda seleccionada en Ajustes)
  const nativePriceData = await fetchNativePrices([chain.nativeCgId], currency);
  const nativePrice = nativePriceData[chain.nativeCgId]?.price ?? null;
  if (chain.cgPlatform && tokenBalances.length) {
    const prices = await fetchTokenPrices(chain.cgPlatform, tokenBalances.map((t) => t.address), currency);
    for (const t of tokenBalances) {
      const p = prices[t.address.toLowerCase()]?.price;
      if (p !== undefined) {
        t.price = p;
        t.usdValue = t.balance * p;
      }
    }
  }

  return {
    chainId: chain.id,
    native: {
      balance: Number(formatUnits(nativeWei, 18)),
      price: nativePrice,
      usd: nativePrice ? Number(formatUnits(nativeWei, 18)) * nativePrice : null,
    },
    tokens: tokenBalances,
  };
}

/**
 * Portafolio completo de UNA dirección (exportable para agregación multi-cartera)
 */
export async function fetchPortfolioForAddress(
  addr: string,
  chainIds: number[],
  includeDiscovered: boolean,
  currency: CurrencyCode = 'usd',
): Promise<ChainPortfolio[]> {
  const results: ChainPortfolio[] = [];
  const queue = chainIds.map((id) => getChain(id)).filter(Boolean) as ChainConfig[];
  const CONCURRENCY = 6;
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const c = queue[idx++];
      const p = await fetchChainPortfolio(c, addr, includeDiscovered, currency).catch(() => null);
      if (p) results.push(p);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

export function usePortfolio(enabledChains?: number[]): Portfolio {
  const { address } = useActiveAddress();
  const includeDiscovered = useAppStore((s) => s.settings.etherscanApiKey.length > 10);
  const refreshIntervalSec = useAppStore((s) => s.settings.refreshIntervalSec);
  const currency = useAppStore((s) => s.settings.currency);
  const chainsToScan = enabledChains && enabledChains.length ? enabledChains : CHAINS.map((c) => c.id);

  const query = useQuery({
    queryKey: ['portfolio', address, chainsToScan.join(','), includeDiscovered, currency],
    enabled: !!address,
    queryFn: async (): Promise<ChainPortfolio[]> => {
      if (!address) return [];
      return fetchPortfolioForAddress(address, chainsToScan, includeDiscovered, currency);
    },
    refetchInterval: refreshIntervalSec * 1000,
  });

  const totalUsd = useMemo(() => {
    let sum = 0;
    let hasNull = false;
    for (const c of query.data ?? []) {
      if (c.native.usd === null) hasNull = true;
      else sum += c.native.usd;
      for (const t of c.tokens) {
        if (t.usdValue === null) hasNull = true;
        else sum += t.usdValue;
      }
    }
    return hasNull && sum === 0 ? null : sum;
  }, [query.data]);

  return {
    chains: query.data ?? [],
    totalUsd,
    loading: query.isLoading || (query.isFetching && !query.data),
    error: query.error?.message,
    scannedWithKey: includeDiscovered,
  };
}
