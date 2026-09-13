'use client';

import { usePortfolio } from '@/hooks/usePortfolio';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { useCombinedTotal } from '@/hooks/useCombinedTotal';
import { fmtMoney, CURRENCIES } from '@/lib/format';
import { CHAINS } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { Skeleton } from '@/components/ui/skeleton';
import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Wallet, Layers, RefreshCw, EyeOff, TrendingUp, Gem, Eye, Download, Layers3 } from 'lucide-react';
import { useI18n, useFmt } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { downloadCsv } from '@/lib/exportCsv';

const AURORA_COLORS = ['#8b5cf6', '#22d3ee', '#34d399', '#f0b90b', '#f472b6', '#a78bfa', '#2dd4bf', '#fbbf24', '#c084fc', '#4ade80', '#38bdf8', '#fb923c', '#e879f9', '#facc15', '#5eead4', '#93c5fd'];

function Aurora({ opacity = 0.5 }: { opacity?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" style={{ opacity }} aria-hidden>
      <span className="aurora-blob animate-float-slow" style={{ width: 280, height: 280, top: -120, left: '8%', background: 'radial-gradient(circle, #7c3aed, transparent 70%)' }} />
      <span className="aurora-blob animate-float-slow" style={{ width: 240, height: 240, bottom: -130, right: '6%', background: 'radial-gradient(circle, #06b6d4, transparent 70%)', animationDelay: '-6s' }} />
      <span className="aurora-blob animate-float-slow" style={{ width: 200, height: 200, top: '20%', right: '28%', background: 'radial-gradient(circle, #34d399, transparent 70%)', animationDelay: '-3s', opacity: 0.18 }} />
    </div>
  );
}

export function PortfolioOverview({ selectedChains }: { selectedChains: number[] }) {
  const { address: active, source, isWatchOnly } = useActiveAddress();
  const isConnected = source === 'connected';
  const { chains, totalUsd, loading } = usePortfolio();
  const { t } = useI18n();
  const { money, currency } = useFmt();
  const watched = useAppStore((s) => s.watchedAddresses);
  const aggregateMode = useAppStore((s) => s.aggregateMode);
  const setActive = useAppStore((s) => s.setActiveAddress);
  const combined = useCombinedTotal(active, selectedChains, currency);

  const chainData = chains
    .map((c) => {
      const chain = CHAINS.find((x) => x.id === c.chainId);
      const value = (c.native.usd ?? 0) + c.tokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
      return { name: chain?.shortName ?? String(c.chainId), value, chainId: c.chainId };
    })
    .filter((d) => d.value > 0.01)
    .sort((a, b) => b.value - a.value);

  const totalAssets = chains.reduce((s, c) => s + 1 + c.tokens.length, 0);
  const displayTotal = aggregateMode && combined.available && combined.combinedTotal != null ? combined.combinedTotal : totalUsd;

  const exportPortfolio = () => {
    const rows: (string | number | null)[][] = [['Chain', 'Asset', 'Balance', 'Price', 'Value']];
    for (const c of chains) {
      const ch = CHAINS.find((x) => x.id === c.chainId);
      rows.push([ch?.name ?? c.chainId, ch?.symbol ?? 'NATIVE', c.native.balance, c.native.price, c.native.usd]);
      for (const tk of c.tokens) rows.push([ch?.name ?? c.chainId, tk.symbol, tk.balance, tk.price, tk.usdValue]);
    }
    rows.push(['TOTAL', '', '', '', displayTotal]);
    downloadCsv('cryptovault-portfolio.csv', rows);
  };

  if (!active) {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="iridescent-border relative overflow-hidden">
          <Aurora opacity={0.65} />
          <div className="relative flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-violet-950/40 backdrop-blur">
              <Wallet className="h-7 w-7 text-violet-300" />
            </span>
            <h2 className="font-display text-2xl font-bold tracking-tight text-zinc-50 sm:text-3xl">
              {t('hero.title1')} <span className="text-aurora">{t('hero.title2')}</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-zinc-400">
              {t('hero.desc', { n: CHAINS.length })}
            </p>
          </div>
        </div>
        <div className="glass-card relative overflow-hidden">
          <Aurora opacity={0.25} />
          <div className="relative p-5">
            <p className="flex items-center gap-2 text-sm font-medium text-zinc-300">
              <Gem className="h-4 w-4 text-champagne" /> {t('hero.networks')}
            </p>
            <div className="mt-4 grid grid-cols-6 gap-2.5">
              {CHAINS.map((c) => (
                <ChainLogo key={c.id} chainId={c.id} className="h-8 w-8 transition-transform duration-300 hover:scale-110" />
              ))}
            </div>
            <div className="mt-4 flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400">
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
              {t('hero.liveScan')}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
      {/* HERO */}
      <div className="iridescent-border relative overflow-hidden">
        <Aurora />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-zinc-500">{t('hero.totalValue')}</p>
              {loading ? (
                <Skeleton className="mt-2 h-12 w-56 skeleton-shimmer border-0 bg-transparent" />
              ) : (
                <p className="nums mt-1 font-display text-4xl font-bold tracking-tight text-aurora sm:text-5xl">
                  {fmtMoney(displayTotal, currency)}
                </p>
              )}
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <p className="nums truncate font-mono text-xs text-zinc-500">{active}</p>
                {isWatchOnly && (
                  <span className="flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                    <Eye className="h-2.5 w-2.5" /> {t('hero.watchMode')}
                    {watched.find((w) => w.address.toLowerCase() === active.toLowerCase())?.label ? ` · ${watched.find((w) => w.address.toLowerCase() === active.toLowerCase())?.label}` : ''}
                  </span>
                )}
                {aggregateMode && combined.available && (
                  <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-300">
                    <Layers3 className="h-2.5 w-2.5" />
                    {combined.loading ? t('hero.combinedOn', { n: combined.walletCount }) : t('hero.combined', { n: combined.walletCount })}
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="chip-glass hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-zinc-400 sm:flex">
                <RefreshCw className="h-3 w-3 text-violet-400" /> {t('hero.autoRefresh')}
              </span>
              <button
                onClick={exportPortfolio}
                className="chip-glass hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] text-zinc-400 transition hover:text-violet-300 sm:flex"
                title={t('hero.exportCsv')}
              >
                <Download className="h-3 w-3" /> {t('hero.exportCsv')}
              </button>
            </div>
          </div>
          {isWatchOnly && (
            <button
              onClick={() => { setActive(null); }}
              className="mt-2 text-[11px] font-medium text-cyan-400 underline-offset-2 hover:underline"
            >
              ← {t('hero.backToConnected')}
            </button>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <Stat icon={<Layers className="h-3.5 w-3.5 text-violet-400" />} label={t('hero.chainsWithFunds')} value={String(chainData.length)} />
            <Stat icon={<Wallet className="h-3.5 w-3.5 text-cyan-400" />} label={t('hero.totalAssets')} value={String(totalAssets)} />
            <Stat icon={<EyeOff className="h-3.5 w-3.5 text-emerald-400" />} label={t('hero.chainsScanned')} value={String(CHAINS.length)} />
            <Stat icon={<TrendingUp className="h-3.5 w-3.5 text-champagne" />} label={t('hero.bestChain')} value={chainData[0]?.name ?? '—'} />
          </div>
        </div>
      </div>

      {/* DISTRIBUCIÓN */}
      <div className="glass-card relative overflow-hidden">
        <Aurora opacity={0.22} />
        <div className="relative p-5">
          <p className="text-sm font-semibold text-zinc-200">{t('hero.distribution')}</p>
          {chainData.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <EyeOff className="h-6 w-6 text-zinc-700" />
              <p className="text-xs text-zinc-600">{t('hero.noFunds')}</p>
            </div>
          ) : (
            <div className="mt-2 flex items-center gap-3">
              <div className="relative h-40 w-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chainData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={74}
                      paddingAngle={2.5}
                      strokeWidth={0}
                      cornerRadius={5}
                    >
                      {chainData.map((_, i) => (
                        <Cell key={i} fill={AURORA_COLORS[i % AURORA_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, n) => [fmtMoney(Number(v), currency), String(n)]}
                      contentStyle={{
                        background: 'rgba(12,11,22,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 12,
                        color: '#f2f2f8',
                        fontSize: 12,
                        backdropFilter: 'blur(8px)',
                      }}
                      itemStyle={{ color: '#b9b8cb' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] uppercase tracking-widest text-zinc-600">{t('hero.total')}</span>
                  <span className="nums font-display text-sm font-bold text-zinc-100">{fmtMoney(displayTotal, currency)}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-1.5 overflow-y-auto pr-1" style={{ maxHeight: 168 }}>
                {chainData.slice(0, 6).map((d, i) => (
                  <div key={d.chainId} className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-white/[0.04]">
                    <ChainLogo chainId={d.chainId} className="h-5 w-5" />
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">{d.name}</span>
                    <span className="nums text-xs font-semibold text-zinc-100">{fmtMoney(d.value, currency)}</span>
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AURORA_COLORS[i % AURORA_COLORS.length] }} />
                  </div>
                ))}
                {chainData.length > 6 && (
                  <p className="pl-1.5 text-[10px] text-zinc-600">{t('hero.moreNetworks', { n: chainData.length - 6 })}</p>
                )}
              </div>
            </div>
          )}
          <p className="mt-2 text-[10px] text-zinc-600">{t('hero.chainNote', { currency: CURRENCIES[currency].intl })}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="chip-glass rounded-2xl p-2.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="nums font-display text-lg font-bold text-zinc-50">{value}</p>
      </div>
      <p className="mt-0.5 text-[10px] leading-tight text-zinc-500">{label}</p>
    </div>
  );
}
