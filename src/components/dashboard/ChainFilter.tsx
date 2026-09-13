'use client';

import { useState } from 'react';
import { CHAINS } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { Globe, Search } from 'lucide-react';

/**
 * Barra con TODAS las redes y sus logos reales. Permite ver todo el portafolio
 * agregado ("Todas") o filtrar por red individual.
 */
export function ChainFilter({
  selected, onChange, chainStats,
}: {
  selected: number[];
  onChange: (ids: number[]) => void;
  chainStats?: Record<number, number>; // chainId -> nº de activos
}) {
  const [query, setQuery] = useState('');
  const { t } = useI18n();
  const allSelected = selected.length === CHAINS.length;

  const filtered = CHAINS.filter(
    (c) => c.name.toLowerCase().includes(query.toLowerCase()) || c.shortName.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="glass-card p-3">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(CHAINS.map((c) => c.id))}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition min-h-8',
              allSelected
                ? 'text-white shadow-lg shadow-violet-950/40'
                : 'chip-glass text-zinc-400 hover:text-zinc-200',
            )}
            style={allSelected ? { background: 'linear-gradient(120deg,#7c3aed,#a855f7 50%,#06b6d4)' } : undefined}
          >
            <Globe className="h-3.5 w-3.5" /> {t('chains.all')}
          </button>
          <div className="relative hidden sm:block">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('chains.search')}
              className="h-8 w-44 rounded-full border border-white/[0.07] bg-white/[0.03] pl-8 pr-3 text-xs text-zinc-300 outline-none transition placeholder:text-zinc-600 focus:border-violet-500/50 focus:bg-white/[0.05]"
            />
          </div>
        </div>
        {!allSelected && (
          <button
            onClick={() => onChange(CHAINS.map((c) => c.id))}
            className="text-xs font-medium text-violet-400 hover:text-violet-300"
          >
            {t('common.viewAll')}
          </button>
        )}
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {filtered.map((c) => {
          const active = selected.includes(c.id);
          return (
            <button
              key={c.id}
              onClick={() => {
                if (active) {
                  const next = selected.filter((x) => x !== c.id);
                  onChange(next.length ? next : CHAINS.map((x) => x.id));
                } else {
                  onChange([c.id]);
                }
              }}
              title={`${c.name} · gas en ${c.symbol}`}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 pr-2.5 text-xs transition-all duration-300 min-h-8',
                active
                  ? 'border-violet-500/50 bg-violet-500/[0.12] text-violet-200 shadow-[0_0_16px_-4px_rgba(139,92,246,0.45)]'
                  : 'border-white/[0.06] bg-white/[0.03] text-zinc-400 hover:border-white/[0.14] hover:bg-white/[0.06] hover:text-zinc-200',
              )}
            >
              <ChainLogo chainId={c.id} className={cn('h-5 w-5 transition-transform duration-300', active ? 'scale-105' : 'group-hover:scale-110')} />
              <span className="font-semibold">{c.shortName}</span>
              {chainStats && chainStats[c.id] > 0 && (
                <span className={cn(
                  'nums rounded-full px-1.5 text-[10px] font-bold',
                  active ? 'bg-violet-500/25 text-violet-100' : 'bg-white/[0.07] text-zinc-500',
                )}>
                  {chainStats[c.id]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
