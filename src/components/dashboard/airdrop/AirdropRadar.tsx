'use client';

/* ============================================================================
 * RADAR DE AIRDROPS — panel principal
 * Escanea + verifica airdrops accesibles para la cartera conectada y los
 * clasifica en: RECLAMABLE AHORA · PENDIENTE DE RECLAMO · CERCA DE RECLAMAR ·
 * ACUMULANDO · FINALIZADO. Incluye verificador de contratos personalizados.
 * ==========================================================================*/

import { useMemo, useState, useEffect } from 'react';
import { useAirdrops, type AirdropResult } from '@/hooks/useAirdrops';
import { AirdropCard } from '@/components/dashboard/airdrop/AirdropCard';
import { AirdropDetail } from '@/components/dashboard/airdrop/AirdropDetail';
import { AirdropVerifier } from '@/components/dashboard/airdrop/AirdropVerifier';
import { PanelInfo } from '@/components/dashboard/rescue/ApprovalsPanel';
import { Button } from '@/components/ui/button';
import { Radar, RefreshCw, Gift, Hourglass, Flame, TrendingUp, ChevronDown, Sparkles, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useActiveAddress } from '@/hooks/useActiveAddress';

type Filter = 'all' | 'claimable' | 'pending' | 'near' | 'accumulating' | 'closed';

const FILTER_KEYS: { id: Filter; key: string; icon?: React.ComponentType<{ className?: string }> }[] = [
  { id: 'all', key: 'airdrop.filterAll' },
  { id: 'claimable', key: 'airdrop.filterClaimable', icon: Gift },
  { id: 'pending', key: 'airdrop.filterPending', icon: Hourglass },
  { id: 'near', key: 'airdrop.filterNear', icon: Flame },
  { id: 'accumulating', key: 'airdrop.filterAccumulating', icon: TrendingUp },
  { id: 'closed', key: 'airdrop.filterClosed' },
];

export function AirdropRadar({ selectedChains }: { selectedChains: number[] }) {
  const { address } = useActiveAddress();
  const { results, scanning, scanStarted, error, partial, refetch, portfolioLoading } = useAirdrops(selectedChains);
  const [filter, setFilter] = useState<Filter>('all');
  const [detail, setDetail] = useState<AirdropResult | null>(null);
  const [verifierOpen, setVerifierOpen] = useState(false);
  const { t } = useI18n();

  // Abrir detalle de un airdrop desde el buscador global
  useEffect(() => {
    const h = (e: Event) => {
      const { id } = (e as CustomEvent<{ id: string }>).detail;
      const found = results.find((r) => r.def.id === id);
      if (found) {
        setDetail(found);
        document.getElementById('airdrop-radar')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    window.addEventListener('cv-open-airdrop', h);
    return () => window.removeEventListener('cv-open-airdrop', h);
  }, [results]);

  const counts = useMemo(
    () => ({
      claimable: results.filter((r) => r.status === 'claimable').length,
      pending: results.filter((r) => r.status === 'pending').length,
      near: results.filter((r) => r.status === 'near').length,
      accumulating: results.filter((r) => r.status === 'accumulating').length,
      closed: results.filter((r) => r.status === 'closed').length,
    }),
    [results],
  );

  const filtered = filter === 'all' ? results : results.filter((r) => r.status === filter);

  return (
    <div className="glass-card relative overflow-hidden" id="airdrop-radar">
      {/* Resplandor superior */}
      <div
        className="pointer-events-none absolute -top-20 left-1/3 h-36 w-72 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #a855f7, transparent 70%)' }}
        aria-hidden
      />

      {/* Cabecera */}
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/25 to-cyan-500/20 text-violet-300 shadow-inner">
            <Radar className="h-4 w-4" />
            {scanning && <span className="absolute inset-0 animate-ping rounded-lg bg-violet-500/20" />}
          </span>
          <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">{t('airdrop.title')}</h2>
          <span className="rounded-full border border-champagne/30 bg-champagne/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-champagne">
            {t('airdrop.new')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {address && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                refetch();
                toast.info(t('airdrop.rescan'));
              }}
              disabled={scanning}
              className="h-7 gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-zinc-300 hover:bg-white/[0.08] hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? t('airdrop.scanning') : t('airdrop.scan')}
            </Button>
          )}
        </div>
      </div>

      {!address ? (
        <div className="p-4">
          <PanelInfo
            icon={Radar}
            title={t('airdrop.connectTitle')}
            message={t('airdrop.connectMsg')}
          />
        </div>
      ) : (
        <>
          {/* Tira de estadísticas */}
          <div className="relative grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
            <StatChip icon={Gift} label={t('airdrop.statClaimable')} value={counts.claimable} tone="gold" loading={scanning && !scanStarted} />
            <StatChip icon={Hourglass} label={t('airdrop.statPending')} value={counts.pending} tone="violet" loading={scanning && !scanStarted} />
            <StatChip icon={Flame} label={t('airdrop.statNear')} value={counts.near} tone="cyan" loading={scanning && !scanStarted} />
            <StatChip icon={TrendingUp} label={t('airdrop.statAccumulating')} value={counts.accumulating} tone="zinc" loading={scanning && !scanStarted} />
          </div>

          {partial && scanStarted && !scanning && (
            <p className="mx-3 mb-2 flex items-start gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10px] leading-relaxed text-zinc-500">
              <Info className="mt-px h-3 w-3 shrink-0" />
              {t('airdrop.partial')}
            </p>
          )}

          {/* Filtros */}
          <div className="relative flex flex-wrap gap-1 px-3 pb-2">
            {FILTER_KEYS.map((f) => {
              const count = f.id === 'all' ? results.length : counts[f.id];
              const active = filter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? 'bg-gradient-to-r from-violet-600/30 to-cyan-600/20 text-zinc-100 shadow-[0_0_12px_-4px_rgba(139,92,246,0.6)]'
                      : 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300'
                  }`}
                >
                  {f.icon && <f.icon className="h-3 w-3" />}
                  {t(f.key)}
                  {count > 0 && <span className="nums opacity-70">{count}</span>}
                </button>
              );
            })}
          </div>

          {/* Grid de airdrops */}
          <div className="relative max-h-[560px] overflow-y-auto p-3 pt-1">
            {scanning && !scanStarted ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="skeleton-shimmer h-48 rounded-2xl" />
                ))}
              </div>
            ) : error ? (
              <p className="p-6 text-center text-sm text-zinc-500">{t('airdrop.scanError', { error })}</p>
            ) : filtered.length === 0 ? (
              <p className="p-6 text-center text-sm text-zinc-500">
                {filter === 'all' ? t('airdrop.emptyAll') : t('airdrop.emptyFilter')}
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((r, i) => (
                  <AirdropCard key={r.def.id} result={r} index={i} onDetail={() => setDetail(r)} />
                ))}
              </div>
            )}
          </div>

          {/* Verificador personalizado */}
          <div className="relative border-t border-white/[0.06]">
            <button
              onClick={() => setVerifierOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3.5 py-3 text-left transition hover:bg-white/[0.02]"
            >
              <span className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-600/20 text-cyan-300 shadow-inner">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span>
                  <span className="block font-display text-sm font-bold text-zinc-100">{t('airdrop.verifierTitle')}</span>
                  <span className="block text-[11px] text-zinc-500">{t('airdrop.verifierSub')}</span>
                </span>
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${verifierOpen ? 'rotate-180' : ''}`} />
            </button>
            {verifierOpen && (
              <div className="border-t border-white/[0.05] p-3.5">
                <AirdropVerifier />
              </div>
            )}
          </div>
        </>
      )}

      <AirdropDetail result={detail} open={!!detail} onOpenChange={(v) => !v && setDetail(null)} />
    </div>
  );
}

/* Chip de estadística con tono por estado */
function StatChip({
  icon: Icon,
  label,
  value,
  tone,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: 'gold' | 'violet' | 'cyan' | 'zinc';
  loading?: boolean;
}) {
  const tones: Record<string, { bg: string; text: string; glow: string }> = {
    gold: { bg: 'from-amber-500/15 to-yellow-600/10 border-amber-500/25', text: 'text-amber-300', glow: 'rgba(245,193,61,0.25)' },
    violet: { bg: 'from-violet-500/15 to-purple-600/10 border-violet-500/25', text: 'text-violet-300', glow: 'rgba(139,92,246,0.25)' },
    cyan: { bg: 'from-cyan-500/15 to-teal-600/10 border-cyan-500/25', text: 'text-cyan-300', glow: 'rgba(34,211,238,0.25)' },
    zinc: { bg: 'from-zinc-500/10 to-zinc-600/5 border-white/[0.08]', text: 'text-zinc-300', glow: 'transparent' },
  };
  const t = tones[tone];
  return (
    <div
      className={`relative flex items-center gap-2.5 overflow-hidden rounded-2xl border bg-gradient-to-br p-2.5 ${t.bg}`}
      style={tone !== 'zinc' ? { boxShadow: `0 8px 24px -16px ${t.glow}, inset 0 1px 0 rgba(255,255,255,0.05)` } : undefined}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] ${t.text}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className={`nums font-display text-xl font-bold leading-none ${loading ? 'opacity-40' : ''} ${t.text}`}>{loading ? '·' : value}</p>
        <p className="mt-1 truncate text-[10px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      </div>
    </div>
  );
}
