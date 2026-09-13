'use client';

/**
 * GAS TRACKER — tira de redes con gas en vivo, nivel y costo de transferencia.
 */

import { useGasPrices, type GasLevel } from '@/hooks/useGasPrices';
import { useFmt, useI18n } from '@/lib/i18n';
import { getChain } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { Fuel } from 'lucide-react';

const LEVEL_STYLES: Record<GasLevel, { dot: string; text: string; border: string }> = {
  low: { dot: 'bg-emerald-400', text: 'text-emerald-300', border: 'border-emerald-500/25' },
  mid: { dot: 'bg-amber-400', text: 'text-amber-300', border: 'border-amber-500/25' },
  high: { dot: 'bg-red-400', text: 'text-red-300', border: 'border-red-500/25' },
};

export function GasTracker({ selectedChains }: { selectedChains: number[] }) {
  const { t } = useI18n();
  const { money, currency } = useFmt();
  const { gas, loading } = useGasPrices(selectedChains, currency);

  return (
    <div className="glass-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-600/20 text-emerald-300 shadow-inner">
            <Fuel className="h-4 w-4" />
          </span>
          {t('gas.title')}
        </p>
        {loading && <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {loading && gas.length === 0
          ? [...Array(6)].map((_, i) => <div key={i} className="h-14 w-24 shrink-0 animate-pulse rounded-xl bg-white/[0.04]" />)
          : gas.map((g) => {
              const chain = getChain(g.chainId);
              const s = LEVEL_STYLES[g.level];
              return (
                <div
                  key={g.chainId}
                  className={`flex w-28 shrink-0 flex-col gap-0.5 rounded-xl border ${s.border} bg-white/[0.025] px-2.5 py-2`}
                  title={`${chain?.name} · ${t('gas.note')}`}
                >
                  <div className="flex items-center gap-1.5">
                    <ChainLogo chainId={g.chainId} className="h-4 w-4" />
                    <span className="truncate text-[11px] font-semibold text-zinc-300">{chain?.shortName}</span>
                    <span className={`ml-auto h-1.5 w-1.5 shrink-0 rounded-full ${s.dot} ${g.level === 'low' ? 'animate-pulse' : ''}`} />
                  </div>
                  <p className={`nums font-display text-base font-bold leading-none ${s.text}`}>
                    {g.gwei < 0.1 ? g.gwei.toFixed(3) : g.gwei.toFixed(1)}
                    <span className="ml-0.5 text-[9px] font-normal text-zinc-500">{t('gas.gwei')}</span>
                  </p>
                  <p className="nums truncate text-[10px] text-zinc-500">
                    {g.transferCost != null ? t('gas.transfer', { cost: money(g.transferCost, 4) }) : `— ${t('gas.gwei')}`}
                  </p>
                </div>
              );
            })}
      </div>
    </div>
  );
}
