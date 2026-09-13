'use client';

import { ChainLogo } from '@/components/ChainLogo';
import { getChain } from '@/config/chains';
import type { AirdropResult } from '@/hooks/useAirdrops';
import { statusColors } from '@/hooks/useAirdrops';
import { useI18n } from '@/lib/i18n';
import { CheckCircle2, XCircle, ChevronRight, Gift, Hourglass, Flame, TrendingUp, Lock } from 'lucide-react';

/* Anillo de progreso SVG */
export function ProgressRing({ value, size = 46, stroke = 4, color }: { value: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value)}
          className="transition-all duration-700 ease-out"
          style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}
        />
      </svg>
      <span className="nums absolute inset-0 flex items-center justify-center text-[10px] font-bold text-zinc-200">
        {Math.round(value * 100)}%
      </span>
    </div>
  );
}

const STATUS_ICON = {
  claimable: Gift,
  pending: Hourglass,
  near: Flame,
  accumulating: TrendingUp,
  closed: Lock,
};

export function AirdropCard({ result, onDetail, index = 0 }: { result: AirdropResult; onDetail: () => void; index?: number }) {
  const { t } = useI18n();
  const { def, status, progress, criteria } = result;
  const colors = statusColors(status);
  const StatusIcon = STATUS_ICON[status];
  const chain = getChain(def.chainId);
  const visible = criteria.filter((c) => !c.skip).slice(0, 3);
  const ringColor =
    status === 'claimable' ? '#f5c13d' : status === 'pending' ? '#a78bfa' : status === 'near' ? '#22d3ee' : status === 'accumulating' ? '#8b8fa3' : '#52525b';

  return (
    <button
      onClick={onDetail}
      className="airdrop-card-enter group relative flex w-full flex-col gap-2.5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-500/40 hover:bg-white/[0.035] hover:shadow-[0_14px_36px_-14px_rgba(139,92,246,0.45)]"
      style={{ animationDelay: `${Math.min(index * 60, 480)}ms` }}
    >
      {/* Cabecera: logo real de la red + nombre + anillo */}
      <div className="flex items-center gap-2.5">
        <ChainLogo chainId={def.chainId} className="h-9 w-9" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-display text-sm font-bold text-zinc-100">
            {def.name}
            <span className="rounded-md border border-white/[0.09] bg-white/[0.05] px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
              {def.token}
            </span>
          </p>
          <p className="truncate text-[11px] text-zinc-500">{chain?.name ?? def.activityChains.length + ' cadenas'}</p>
        </div>
        <ProgressRing value={progress} color={ringColor} />
      </div>

      {/* Badge de estado */}
      <div>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${colors.badge}`}>
          <StatusIcon className="h-3 w-3" />
          {result.statusLabel}
        </span>
      </div>

      {/* Criterios principales */}
      <ul className="space-y-1">
        {visible.map((c) => (
          <li key={c.label} className="flex items-start gap-1.5 text-[11px] leading-snug">
            {c.done ? (
              <CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="mt-px h-3.5 w-3.5 shrink-0 text-zinc-600" />
            )}
            <span className={c.done ? 'text-zinc-300' : 'text-zinc-500'}>{c.label}</span>
          </li>
        ))}
        {criteria.filter((c) => !c.skip).length > visible.length && (
          <li className="flex items-center gap-1.5 pl-5 text-[10px] text-zinc-600">
            +{criteria.filter((c) => !c.skip).length - visible.length} {t('airdrop.moreCriteria')}
          </li>
        )}
      </ul>

      {/* Pie: valor estimado + acceso al detalle */}
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.05] pt-2">
        <span className="nums truncate text-[10px] font-medium text-champagne/90">
          {def.estLabel ? `~ ${def.estLabel}` : 'valor no estimado'}
        </span>
        <span className="flex items-center gap-0.5 text-[10px] font-semibold text-violet-400 transition group-hover:text-violet-300">
          {t('airdrop.verify')} <ChevronRight className="h-3 w-3" />
        </span>
      </div>

      {/* Glow del estado */}
      {status === 'claimable' && (
        <span
          className="pointer-events-none absolute -top-8 left-1/2 h-16 w-32 -translate-x-1/2 rounded-full opacity-30 blur-2xl"
          style={{ background: 'radial-gradient(circle, #f5c13d, transparent 70%)' }}
          aria-hidden
        />
      )}
    </button>
  );
}
