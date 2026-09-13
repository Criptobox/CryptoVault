'use client';

import { useState, useEffect, memo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/dashboard/Header';
import { PortfolioOverview } from '@/components/dashboard/PortfolioOverview';
import { ChainFilter } from '@/components/dashboard/ChainFilter';
import { ConfirmTxHost } from '@/components/dashboard/ConfirmTxDialog';
import { usePriceAlertWatcher } from '@/hooks/usePriceAlerts';
import { CHAINS } from '@/config/chains';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useI18n } from '@/lib/i18n';
import { Gem, ShieldCheck } from 'lucide-react';

/* --------------------------------------------------------------------------
 * RENDIMIENTO: los paneles pesados (gráfico, radar, NFTs, rescate, gas…)
 * se cargan con dynamic import → el bundle inicial es mucho más pequeño y
 * la primera pintura es rápida. Además React.memo evita que un cambio de
 * estado local del layout (abrir ajustes, notificaciones…) re-renderice
 * subárboles completos que no dependen de él.
 * ------------------------------------------------------------------------ */
const PanelSkeleton = () => (
  <div className="glass-card p-4">
    <div className="skeleton-shimmer h-8 w-40 rounded-xl" />
    <div className="skeleton-shimmer mt-3 h-24 rounded-2xl" />
  </div>
);

const PortfolioChart = memo(dynamic(
  () => import('@/components/dashboard/PortfolioChart').then((m) => ({ default: m.PortfolioChart })),
  { ssr: false, loading: PanelSkeleton },
));
const GasTracker = memo(dynamic(
  () => import('@/components/dashboard/GasTracker').then((m) => ({ default: m.GasTracker })),
  { ssr: false, loading: PanelSkeleton },
));
const AirdropRadar = memo(dynamic(
  () => import('@/components/dashboard/airdrop/AirdropRadar').then((m) => ({ default: m.AirdropRadar })),
  { ssr: false, loading: PanelSkeleton },
));
const TokenTable = memo(dynamic(
  () => import('@/components/dashboard/TokenTable').then((m) => ({ default: m.TokenTable })),
  { ssr: false, loading: PanelSkeleton },
));
const NFTGallery = memo(dynamic(
  () => import('@/components/dashboard/NFTGallery').then((m) => ({ default: m.NFTGallery })),
  { ssr: false, loading: PanelSkeleton },
));
const RescuePanel = memo(dynamic(
  () => import('@/components/dashboard/RescuePanel').then((m) => ({ default: m.RescuePanel })),
  { ssr: false, loading: PanelSkeleton },
));
const Recommendations = memo(dynamic(
  () => import('@/components/dashboard/Recommendations').then((m) => ({ default: m.Recommendations })),
  { ssr: false, loading: PanelSkeleton },
));
const SettingsDialog = dynamic(
  () => import('@/components/dashboard/SettingsDialog').then((m) => ({ default: m.SettingsDialog })),
  { ssr: false },
);
const AddressBookDialog = dynamic(
  () => import('@/components/dashboard/AddressBookDialog').then((m) => ({ default: m.AddressBookDialog })),
  { ssr: false },
);
const GlobalSearch = dynamic(
  () => import('@/components/dashboard/GlobalSearch').then((m) => ({ default: m.GlobalSearch })),
  { ssr: false },
);

/** Escena aurora fija de fondo: blobs iridiscentes + rejilla + grano.
 *  Los blobs usan gradientes radiales multi-parada (suaves de nacimiento)
 *  en vez de filter:blur → visual idéntico, coste de GPU mínimo. */
function AuroraScene() {
  return (
    <div className="aurora-scene" aria-hidden>
      <span className="aurora-blob animate-float-slow" style={{ width: 560, height: 560, top: -240, left: '12%', background: 'radial-gradient(circle, rgba(109,40,217,0.85) 0%, rgba(109,40,217,0.32) 42%, transparent 70%)' }} />
      <span className="aurora-blob animate-float-slow" style={{ width: 460, height: 460, top: '20%', right: -160, background: 'radial-gradient(circle, rgba(14,116,144,0.8) 0%, rgba(14,116,144,0.28) 45%, transparent 70%)', animationDelay: '-5s' }} />
      <span className="aurora-blob animate-float-slow" style={{ width: 420, height: 420, bottom: -180, left: '28%', background: 'radial-gradient(circle, rgba(6,95,70,0.75) 0%, rgba(6,95,70,0.24) 45%, transparent 72%)', animationDelay: '-9s', opacity: 0.22 }} />
      <span className="aurora-blob animate-float-slow" style={{ width: 300, height: 300, top: '45%', left: -140, background: 'radial-gradient(circle, rgba(126,34,206,0.7) 0%, rgba(126,34,206,0.22) 45%, transparent 72%)', animationDelay: '-3s', opacity: 0.18 }} />
      <div className="aurora-grid" />
      <div className="noise-overlay" />
    </div>
  );
}

export default function Dashboard() {
  const [selectedChains, setSelectedChains] = useState<number[]>(CHAINS.map((c) => c.id));
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  usePriceAlertWatcher();
  const { chains, loading, totalUsd } = usePortfolio(selectedChains);
  const { t } = useI18n();

  // Estadística de activos por cadena para los badges del filtro
  const chainStats: Record<number, number> = {};
  for (const c of chains) {
    chainStats[c.chainId] = 1 + c.tokens.length;
  }

  // Listener global para abrir ajustes (usado por paneles que piden API key)
  useEffect(() => {
    const open = () => setSettingsOpen(true);
    window.addEventListener('open-settings', open);
    return () => window.removeEventListener('open-settings', open);
  }, []);

  // Toggle de red desde el buscador global
  useEffect(() => {
    const h = (e: Event) => {
      const { chainId } = (e as CustomEvent<{ chainId: number }>).detail;
      setSelectedChains((prev) =>
        prev.length === 1 && prev[0] === chainId ? CHAINS.map((c) => c.id) : [chainId],
      );
      document.getElementById('token-table')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('cv-toggle-chain', h);
    return () => window.removeEventListener('cv-toggle-chain', h);
  }, []);

  // Abrir agenda de carteras desde eventos
  useEffect(() => {
    const h = () => setBookOpen(true);
    window.addEventListener('cv-open-addressbook', h);
    return () => window.removeEventListener('cv-open-addressbook', h);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col">
      <AuroraScene />

      <div className="relative z-10 flex min-h-screen flex-col">
        <Header />

        <main className="mx-auto w-full min-w-0 max-w-7xl space-y-4 px-4 py-5 pb-16">
          <PortfolioOverview selectedChains={selectedChains} />

          <PortfolioChart chains={chains} totalUsd={totalUsd} />

          <ChainFilter selected={selectedChains} onChange={setSelectedChains} chainStats={chainStats} />

          <AirdropRadar selectedChains={selectedChains} />

          <GasTracker selectedChains={selectedChains} />

          <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_380px]">
            <div className="min-w-0 space-y-4">
              <TokenTable selectedChains={selectedChains} />
              <NFTGallery selectedChains={selectedChains} />
            </div>
            <div className="min-w-0 space-y-4">
              <RescuePanel selectedChains={selectedChains} />
              <Recommendations selectedChains={selectedChains} />
              <div className="glass-card p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 text-emerald-400 shadow-inner">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div className="text-xs leading-relaxed text-zinc-400">
                    <p className="mb-1 font-semibold text-zinc-200">{t('footer.nonCustodialTitle')}</p>
                    {t('footer.nonCustodial')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full border border-white/[0.09] bg-[#0c0b16]/90 px-4 py-2 text-xs text-zinc-300 shadow-2xl shadow-black/60 backdrop-blur-xl">
              <span className="h-2 w-2 animate-ping rounded-full bg-violet-400" />
              {t('footer.scanning')}
            </div>
          )}
        </main>

        <footer className="mt-auto border-t border-white/[0.05] bg-[#06050c]/70 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-zinc-600">
            <p className="flex items-center gap-1.5">
              <Gem className="h-3 w-3 text-champagne/70" aria-hidden />
              {t('footer.brand', { n: CHAINS.length })}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={() => setSettingsOpen(true)} className="transition hover:text-violet-400">{t('footer.settingsLink')}</button>
              <span>·</span>
              <a href="https://etherscan.io/apis" target="_blank" rel="noreferrer" className="transition hover:text-violet-400">
                {t('footer.apiKey')}
              </a>
            </div>
          </div>
        </footer>

        <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
        <AddressBookDialog open={bookOpen} onOpenChange={setBookOpen} />
        <GlobalSearch selectedChains={selectedChains} />
        <ConfirmTxHost />
      </div>
    </div>
  );
}
