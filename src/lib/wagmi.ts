'use client';

import { createConfig, http, fallback } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { walletConnect, coinbaseWallet, safe } from '@wagmi/connectors';
import { CHAINS } from '@/config/chains';
import type { CreateConnectorFn } from 'wagmi';
import type { Chain } from 'viem/chains';

const chains = CHAINS.map((c) => c.viemChain) as [Chain, ...Chain[]];

/**
 * Construye la configuración de wagmi.
 * projectId opcional de WalletConnect (guardado en settings del usuario).
 */
export function buildWagmiConfig(walletConnectProjectId?: string): {
  config: ReturnType<typeof createConfig>;
} {
  const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })];

  if (walletConnectProjectId && walletConnectProjectId.length > 10) {
    try {
      connectors.push(walletConnect({ projectId: walletConnectProjectId, showQrModal: true }));
    } catch {
      // ignorar si el projectId no es válido
    }
  }
  connectors.push(coinbaseWallet({ appName: 'CryptoVault Dashboard', preference: 'all' }));
  connectors.push(safe({ shimDisconnect: true }));

  const config = createConfig({
    chains,
    connectors,
    transports: Object.fromEntries(
      CHAINS.map((c) => [
        c.id,
        fallback([http(c.viemChain.rpcUrls.default.http[0]), http(c.backupRpc)], {
          timeout: 12_000,
          retryCount: 1,
        }),
      ]),
    ),
    ssr: true,
  });
  return { config };
}

/** Transports por cadena para clientes viem directos (lecturas sin cartera) */
export function publicClientTransport(chainId: number) {
  const c = CHAINS.find((x) => x.id === chainId);
  if (!c) return http();
  return fallback([http(c.viemChain.rpcUrls.default.http[0]), http(c.backupRpc)], {
    timeout: 12_000,
    retryCount: 1,
  });
}
