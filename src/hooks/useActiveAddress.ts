'use client';

/**
 * Dirección "activa" del dashboard:
 * - modo normal → la cartera conectada
 * - modo lectura → una dirección vigilada (override)
 */

import { useAccount } from 'wagmi';
import { useAppStore } from '@/lib/store';

export type AddressSource = 'connected' | 'watched' | 'none';

export function useActiveAddress() {
  const { address: connected, isConnected } = useAccount();
  const override = useAppStore((s) => s.activeAddressOverride);
  const watched = useAppStore((s) => s.watchedAddresses);

  let address: `0x${string}` | undefined;
  let source: AddressSource = 'none';

  if (override && /^0x[a-fA-F0-9]{40}$/.test(override)) {
    address = override as `0x${string}`;
    source = 'watched';
  } else if (isConnected && connected) {
    address = connected;
    source = 'connected';
  }

  const activeWatched =
    source === 'watched' ? watched.find((w) => w.address.toLowerCase() === override?.toLowerCase()) : undefined;

  return {
    /** dirección activa (conectada o vigilada) */
    address,
    source,
    /** true cuando se está viendo una cartera en modo lectura */
    isWatchOnly: source === 'watched',
    isConnected,
    connected,
    activeLabel: activeWatched?.label,
  };
}
