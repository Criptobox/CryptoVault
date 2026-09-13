'use client';

/**
 * GAS TRACKER — precio del gas en vivo por red + costo de una transferencia.
 * Nivel por red según su tipo (L1 vs L2) y notificación opcional cuando
 * el gas de Ethereum está bajo.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPublicClient, formatEther } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { getChain, type ChainConfig } from '@/config/chains';
import { fetchNativePrices } from '@/lib/api/coingecko';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { fireNotification } from '@/lib/notifications';

export type GasLevel = 'low' | 'mid' | 'high';

export interface GasInfo {
  chainId: number;
  gwei: number;
  level: GasLevel;
  /** costo estimado de una transferencia de 21.000 gas */
  transferCost: number | null;
}

const L2_CHAINS = new Set([10, 42161, 8453, 324, 59144, 534352, 1101, 130, 1329, 204, 5000]);

function levelFor(chain: ChainConfig, gwei: number): GasLevel {
  if (L2_CHAINS.has(chain.id)) {
    if (gwei < 0.5) return 'low';
    if (gwei < 2) return 'mid';
    return 'high';
  }
  if (gwei < 15) return 'low';
  if (gwei < 40) return 'mid';
  return 'high';
}

const GAS_NOTIFY_KEY = 'cv-gas-notify-last';

async function fetchChainGas(chain: ChainConfig): Promise<GasInfo | null> {
  try {
    const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chain.id) });
    const gasPrice = await client.getGasPrice();
    const gwei = Number(gasPrice) / 1e9;
    return { chainId: chain.id, gwei, level: levelFor(chain, gwei), transferCost: null };
  } catch {
    return null;
  }
}

export function useGasPrices(enabledChains: number[], currency: CurrencyCode = 'usd') {
  const gasAlerts = useAppStore((s) => s.settings.gasAlerts);

  const query = useQuery({
    queryKey: ['gas', enabledChains.join(','), currency],
    queryFn: async (): Promise<GasInfo[]> => {
      const chains = (enabledChains.slice(0, 12).map((id) => getChain(id)).filter(Boolean)) as ChainConfig[];
      const CONCURRENCY = 6;
      let idx = 0;
      const out: GasInfo[] = [];
      async function worker() {
        while (idx < chains.length) {
          const g = await fetchChainGas(chains[idx++]);
          if (g) out.push(g);
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));

      // Costos fiat de transferencia (una sola llamada de precios para todas las redes)
      const ids = [...new Set(chains.map((c) => c.nativeCgId))];
      const prices = await fetchNativePrices(ids, currency);
      for (const g of out) {
        const chain = getChain(g.chainId);
        const np = chain ? prices[chain.nativeCgId] : undefined;
        if (np) g.transferCost = g.gwei * 1e-9 * 21_000 * np.price;
      }
      out.sort((a, b) => a.gwei - b.gwei);
      return out;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Notificación de gas bajo en Ethereum (máx. 1 por hora) — en efecto, nunca en render
  const gas = query.data ?? [];
  const ethGas = gas.find((g) => g.chainId === 1);
  useEffect(() => {
    if (!gasAlerts || !ethGas || ethGas.gwei >= 12) return;
    const last = Number(localStorage.getItem(GAS_NOTIFY_KEY) ?? 0);
    if (Date.now() - last > 60 * 60_000) {
      localStorage.setItem(GAS_NOTIFY_KEY, String(Date.now()));
      fireNotification({
        type: 'info',
        title: '⛽ Gas bajo en Ethereum',
        body: `${ethGas.gwei.toFixed(1)} gwei — buen momento para transaccionar`,
      });
    }
  }, [gasAlerts, ethGas?.chainId, ethGas?.gwei]);

  return {
    gas,
    loading: query.isLoading || (query.isFetching && !query.data),
  };
}
