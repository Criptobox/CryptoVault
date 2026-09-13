'use client';

/**
 * GRÁFICO DE EVOLUCIÓN DEL PORTAFOLIO — 24 h / 7 d / 30 d + PnL.
 * Aproximación: holdings actuales × precios históricos (CoinGecko).
 */

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { usePortfolioHistory, type HistoryPoint } from '@/hooks/usePortfolioHistory';
import type { ChainPortfolio } from '@/hooks/usePortfolio';
import { useFmt, useI18n } from '@/lib/i18n';
import type { ChartRange } from '@/lib/api/coingecko';
import { TrendingDown, TrendingUp, LineChart } from 'lucide-react';

type Range = ChartRange;

export function PortfolioChart({ chains, totalUsd }: { chains: ChainPortfolio[]; totalUsd: number | null }) {
  const { t } = useI18n();
  const { money, currency } = useFmt();
  const [range, setRange] = useState<Range>(7);
  const { points, pnlAbs, pnlPct, loading } = usePortfolioHistory(chains, totalUsd, range, currency);

  const data = useMemo(
    () => points.map((p: HistoryPoint) => ({ t: p.t, v: Math.round(p.v * 100) / 100, time: fmtTime(p.t, range) })),
    [points, range],
  );

  const ranges: { id: Range; label: string }[] = [
    { id: 1, label: t('chart.range24h') },
    { id: 7, label: t('chart.range7d') },
    { id: 30, label: t('chart.range30d') },
  ];

  const up = (pnlPct ?? 0) >= 0;

  return (
    <div className="glass-card relative overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-300 shadow-inner">
            <LineChart className="h-4 w-4" />
          </span>
          <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">{t('chart.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* PnL */}
          {pnlPct !== null && (
            <span
              className={`nums flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                up ? 'bg-emerald-500/[0.12] text-emerald-300' : 'bg-red-500/[0.12] text-red-300'
              }`}
            >
              {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {up ? '+' : ''}{money(pnlAbs, 2)} · {up ? '+' : ''}{pnlPct.toFixed(2)}%
              <span className="ml-1 font-medium opacity-60">{t('chart.pnl', { range: ranges.find((r) => r.id === range)?.label ?? '' })}</span>
            </span>
          )}
          <div className="flex gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.03] p-0.5">
            {ranges.map((r) => (
              <button
                key={r.id}
                onClick={() => setRange(r.id)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                  range === r.id
                    ? 'bg-gradient-to-r from-violet-600/40 to-cyan-600/25 text-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="h-44 sm:h-52">
        {loading && data.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-xs text-zinc-500">
            <span className="h-2 w-2 animate-ping rounded-full bg-violet-400" /> {t('chart.loading')}
          </div>
        ) : data.length < 3 ? (
          <div className="flex h-full items-center justify-center text-xs text-zinc-600">{t('chart.noData')}</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="pfFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.45} />
                  <stop offset="55%" stopColor="#8b5cf6" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="pfStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#22d3ee" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="time"
                tick={{ fill: '#65647e', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={48}
                dy={6}
              />
              <YAxis
                tick={{ fill: '#65647e', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={64}
                domain={['auto', 'auto']}
                tickFormatter={(v: number) => compactMoney(v)}
              />
              <Tooltip
                formatter={(v) => [money(Number(v)), '']}
                labelFormatter={(l) => String(l)}
                contentStyle={{
                  background: 'rgba(12,11,22,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  color: '#f2f2f8',
                  fontSize: 12,
                  backdropFilter: 'blur(8px)',
                }}
                itemStyle={{ color: '#c4b5fd' }}
                cursor={{ stroke: 'rgba(139,92,246,0.35)', strokeWidth: 1 }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke="url(#pfStroke)"
                strokeWidth={2.2}
                fill="url(#pfFill)"
                dot={false}
                activeDot={{ r: 3.5, fill: '#a78bfa', stroke: '#0c0b16', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="mt-1.5 text-[10px] text-zinc-600">{t('chart.note')}</p>
    </div>
  );
}

function fmtTime(ts: number, range: Range): string {
  const d = new Date(ts);
  if (range === 1) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) +
    (range === 7 ? ` ${d.getHours().toString().padStart(2, '0')}h` : '');
}

function compactMoney(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return v.toFixed(0);
}
