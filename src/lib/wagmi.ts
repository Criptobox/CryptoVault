'use client';

import { createConfig, http, fallback } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { walletConnect, coinbaseWallet, safe } from '@wagmi/connectors';
import { CHAINS } from '@/config/chains';
import type { CreateConnectorFn } from 'wagmi';
import type { Chain } from 'viem/chains';

const chains = CHAINS.map((c) => c.viemChain) as [Chain, ...Chain[]];

/**
 * Metadata de la app que verá la wallet al emparejar por QR (WalletConnect v2).
 * Los iconos apuntan al origen desplegado (GitHub Pages) + logo público de respaldo.
 */
function wcMetadata() {
  const origin = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://cryptovault.app';
  return {
    name: 'CryptoVault Premium',
    description:
      'Dashboard multi-red no custodial: portafolio, NFTs, rescate de fondos y radar de airdrops.',
    url: origin,
    icons: [
      `${origin}/icons/icon-192.png`,
      'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png',
    ],
  };
}

/**
 * Construye la configuración de wagmi.
 * projectId opcional de WalletConnect (guardado en settings del usuario).
 * Con projectId válido se activa la conexión por QR: el modal oficial de
 * WalletConnect (@walletconnect/modal) muestra el código QR + 400+ carteras.
 */
export function buildWagmiConfig(walletConnectProjectId?: string): {
  config: ReturnType<typeof createConfig>;
} {
  const connectors: CreateConnectorFn[] = [injected({ shimDisconnect: true })];

  if (walletConnectProjectId && walletConnectProjectId.length > 10) {
    try {
      connectors.push(
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
          // Con 23 cadenas configuradas evitamos la desconexión automática por
          // cadenas "stale" no aprobadas aún en la sesión de la wallet.
          isNewChainsStale: false,
          metadata: wcMetadata(),
          qrModalOptions: {
            themeMode: 'dark',
            themeVariables: {
              '--wcm-accent-color': '#8b5cf6',
              '--wcm-z-index': '999999',
            },
          },
        }),
      );
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
