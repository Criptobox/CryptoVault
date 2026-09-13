'use client';

import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { buildWagmiConfig } from '@/lib/wagmi';
import { Toaster } from '@/components/ui/sonner';
import { useAppStore } from '@/lib/store';
import { LangProvider } from '@/lib/i18n';

const emptySubscribe = () => () => {};

export function Providers({ children }: { children: ReactNode }) {
  const settings = useAppStore((s) => s.settings);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );

  // Recrear config solo si cambia el projectId de WalletConnect.
  // La key remonta el provider para que wagmi reconstruya conectores sin estado residual.
  const projectId = settings.walletConnectProjectId || undefined;
  const { config } = useMemo(
    () => buildWagmiConfig(projectId),
    [projectId],
  );

  // Hidratar tras el montaje (zustand persist) — sin setState en effect
  const hydrated = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  if (!hydrated) return null;

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      <WagmiProvider key={projectId ?? 'wc-none'} config={config}>
        <QueryClientProvider client={queryClient}>
          <LangProvider>
            {children}
            <Toaster richColors position="top-right" />
          </LangProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </ThemeProvider>
  );
}
