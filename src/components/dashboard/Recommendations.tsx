'use client';

import { useMemo } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useApprovals } from '@/hooks/useApprovals';
import { getChain } from '@/config/chains';
import { fmtMoney } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, ShieldCheck, ShieldAlert, Sparkles } from 'lucide-react';
import { useI18n, useFmt, t as tStatic } from '@/lib/i18n';
import type { CurrencyCode } from '@/lib/store';

interface Recommendation {
  level: 'ok' | 'warn' | 'info';
  text: string;
  action?: string;
}

/**
 * Panel dinámico de recomendaciones según el estado real de tu cartera.
 */
export function Recommendations({ selectedChains }: { selectedChains: number[] }) {
  const { chains, totalUsd } = usePortfolio(selectedChains);
  const { approvals } = useApprovals(selectedChains);
  const hasKey = approvals.length >= 0;
  const { lang } = useI18n();
  const { money, currency } = useFmt();

  const recs: Recommendation[] = useMemo(() => {
    const out: Recommendation[] = [];
    const t = (k: string, p?: Record<string, string | number>) => tStatic(k, p);

    // 1. Aprobaciones activas
    const active = approvals.filter((a) => selectedChains.includes(a.chainId));
    if (active.length > 0) {
      out.push({
        level: 'warn',
        text: t('reco.approvals', { n: active.length, u: active.filter((a) => a.isUnlimited).length }),
        action: t('reco.goApprovals'),
      });
    } else if (hasKey) {
      out.push({ level: 'ok', text: t('reco.noApprovals') });
    }

    // 2. Polvo acumulado
    let dustCount = 0;
    let dustUsd = 0;
    for (const c of chains) {
      for (const tk of c.tokens) {
        if ((tk.usdValue ?? 1) < 1 && tk.balance > 0) {
          dustCount++;
          dustUsd += tk.usdValue ?? 0;
        }
      }
    }
    if (dustCount >= 3) {
      out.push({
        level: 'info',
        text: t('reco.dust', { n: dustCount, value: fmtMoney(dustUsd, currency) }),
        action: t('reco.goDust'),
      });
    }

    // 3. Concentración en una red
    const values = chains.map((c) => ({
      id: c.chainId,
      v: (c.native.usd ?? 0) + c.tokens.reduce((s, tk) => s + (tk.usdValue ?? 0), 0),
    }));
    const total = values.reduce((s, x) => s + x.v, 0);
    const top = [...values].sort((a, b) => b.v - a.v)[0];
    if (top && total > 100 && top.v / total > 0.8) {
      out.push({
        level: 'info',
        text: t('reco.concentration', { pct: Math.round((top.v / total) * 100), chain: getChain(top.id)?.name ?? '' }),
      });
    }

    // 4. Redes con saldo nativo bajo (sin gas)
    const lowGas = chains.filter((c) => {
      const chain = getChain(c.chainId);
      return chain && c.native.balance > 0 && c.native.balance < 0.5 && c.tokens.length > 0 && (chain.id === 1 || chain.id === 42161 || chain.id === 10);
    });
    if (lowGas.length) {
      out.push({
        level: 'warn',
        text: t('reco.lowGas', { chains: lowGas.map((c) => getChain(c.chainId)?.shortName).join(', ') }),
      });
    }

    // 5. Consejos estáticos de seguridad
    out.push({ level: 'ok', text: t('reco.seed') });
    if (totalUsd !== null && totalUsd > 1000) {
      out.push({ level: 'info', text: t('reco.hardware') });
    }
    return out;
  }, [chains, approvals, selectedChains, hasKey, totalUsd, lang, currency]);

  const warnCount = recs.filter((r) => r.level === 'warn').length;
  const score = Math.max(10, 100 - warnCount * 25 - (recs.filter((r) => r.level === 'info').length * 5));
  const scoreColor = score >= 80 ? '#34d399' : score >= 50 ? '#f0b90b' : '#f87171';
  const { t } = useI18n();

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2.5 font-display text-sm font-bold tracking-tight text-zinc-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-violet-500/20 text-amber-300 shadow-inner">
            <Lightbulb className="h-4 w-4" />
          </span>
          {t('reco.title')}
        </h2>
        <span
          className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold"
          style={{ borderColor: `${scoreColor}44`, background: `${scoreColor}14`, color: scoreColor }}
        >
          {score >= 80 ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
          {t('reco.health')}: {score}
        </span>
      </div>
      {/* Barra de salud */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: `linear-gradient(90deg, ${scoreColor}88, ${scoreColor})` }}
        />
      </div>
      <div className="mt-3 grid gap-2">
        {recs.slice(0, 6).map((r, i) => (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-xl border p-2.5 text-[13px] leading-snug ${
              r.level === 'warn'
                ? 'border-amber-500/25 bg-amber-500/[0.07] text-amber-200'
                : r.level === 'ok'
                  ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200'
                  : 'border-white/[0.07] bg-white/[0.03] text-zinc-300'
            }`}
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
            <span>{r.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export type { CurrencyCode };
