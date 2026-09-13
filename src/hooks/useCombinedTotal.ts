'use client';

/**
 * TOTAL COMBINADO — suma el valor de la cartera activa + todas las vigiladas.
 * Ligero: solo native + tokens para el total (sin NFTs).
 */

import { useQuery } from '@tanstack/react-query';
import { fetchPortfolioForAddress } from '@/hooks/usePortfolio';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { getChain } from '@/config/chains';

export function useCombinedTotal(
  activeAddress: string | undefined,
  enabledChains: number[],
  currency: CurrencyCode,
) {
  const watched = useAppStore((s) => s.watchedAddresses);
  const includeDiscovered = useAppStore((s) => s.settings.etherscanApiKey.length > 10);
  const addresses = [activeAddress, ...watched.map((w) => w.address)].filter(
    (a): a is string => !!a && /^0x[a-fA-F0-9]{40}$/.test(a),
  );

  const query = useQuery({
    queryKey: ['combined-total', addresses.join(','), enabledChains.join(','), currency, includeDiscovered],
    enabled: addresses.length >= 2,
    staleTime: 60_000,
    queryFn: async (): Promise<number> => {
      let sum = 0;
      for (const addr of addresses.slice(0, 13)) {
        const chains = await fetchPortfolioForAddress(addr, enabledChains, includeDiscovered, currency).catch(() => []);
        for (const c of chains) {
          sum += c.native.usd ?? 0;
          for (const t of c.tokens) sum += t.usdValue ?? 0;
        }
      }
      return sum;
    },
  });

  return {
    combinedTotal: query.data ?? null,
    walletCount: addresses.length,
    loading: query.isLoading || (query.isFetching && !query.data),
    available: addresses.length >= 2,
  };
}

export function chainName(id: number): string {
  return getChain(id)?.name ?? String(id);
}
