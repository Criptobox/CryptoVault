'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChainLogo } from '@/components/ChainLogo';
import { getChain } from '@/config/chains';
import type { AirdropResult } from '@/hooks/useAirdrops';
import { statusColors } from '@/hooks/useAirdrops';
import { ProgressRing } from '@/components/dashboard/airdrop/AirdropCard';
import { useI18n } from '@/lib/i18n';
import { CheckCircle2, XCircle, Minus, ExternalLink, Gift, Hourglass, Flame, TrendingUp, Lock, ShieldAlert, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_ICON = {
  claimable: Gift,
  pending: Hourglass,
  near: Flame,
  accumulating: TrendingUp,
  closed: Lock,
};

export function AirdropDetail({ result, open, onOpenChange }: { result: AirdropResult | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useI18n();
  if (!result) return null;
  const { def, status, progress, criteria } = result;
  const colors = statusColors(status);
  const StatusIcon = STATUS_ICON[status];
  const ringColor =
    status === 'claimable' ? '#f5c13d' : status === 'pending' ? '#a78bfa' : status === 'near' ? '#22d3ee' : status === 'accumulating' ? '#8b8fa3' : '#52525b';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto border-white/[0.09] bg-[#0b0a14]/95 backdrop-blur-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <ChainLogo chainId={def.chainId} className="h-11 w-11" />
            <div className="min-w-0 flex-1">
              <DialogTitle className="flex items-center gap-2 font-display text-lg text-zinc-50">
                {def.name}
                <span className="rounded-md border border-white/[0.09] bg-white/[0.05] px-1.5 py-px text-[10px] font-semibold uppercase text-zinc-400">
                  {def.token}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                {def.activityChains.map((id) => getChain(id)?.shortName).filter(Boolean).join(' · ')}
              </DialogDescription>
            </div>
            <ProgressRing value={progress} size={54} stroke={5} color={ringColor} />
          </div>
          <div>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${colors.badge}`}>
              <StatusIcon className="h-3.5 w-3.5" />
              {result.statusLabel}
            </span>
          </div>
        </DialogHeader>

        <p className="text-sm leading-relaxed text-zinc-400">{def.desc}</p>

        {def.estLabel && (
          <div className="flex items-center justify-between rounded-xl border border-champagne/25 bg-champagne/[0.06] px-3 py-2">
            <span className="text-xs text-zinc-400">Valor estimado (no oficial)</span>
            <span className="nums text-sm font-bold text-champagne">~ {def.estLabel}</span>
          </div>
        )}

        {/* Checklist de criterios */}
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <Lightbulb className="h-3.5 w-3.5 text-champagne/80" /> Verificación de elegibilidad
          </p>
          {criteria.map((c) => (
            <div
              key={c.label}
              className={`flex items-start gap-2.5 rounded-xl border p-2.5 transition ${
                c.skip
                  ? 'border-white/[0.05] bg-white/[0.015] opacity-70'
                  : c.done
                    ? 'border-emerald-900/60 bg-emerald-950/20'
                    : 'border-white/[0.06] bg-white/[0.02]'
              }`}
            >
              {c.skip ? (
                <Minus className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
              ) : c.done ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-zinc-600" />
              )}
              <div className="min-w-0">
                <p className={`text-sm font-medium ${c.done ? 'text-emerald-200' : 'text-zinc-300'}`}>{c.label}</p>
                {c.hint && !c.done && <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">💡 {c.hint}</p>}
                {c.skip && <p className="mt-0.5 text-[11px] text-zinc-600">Sin datos suficientes para evaluar este criterio</p>}
              </div>
            </div>
          ))}
        </div>

        {/* Verificación de seguridad */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-900/50 bg-amber-950/20 p-3">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-amber-200/90">
            <strong>Seguridad primero:</strong> reclama SOLO desde el sitio oficial (comprueba la URL). Ningún airdrop legítimo
            pide tu semilla ni aprobar tokens para «desbloquear» el reclamo. Esta app nunca firma por ti.
          </p>
        </div>

        {/* Acciones */}
        <div className="flex flex-wrap gap-2">
          {def.claimUrl && (status === 'claimable' || status === 'pending' || status === 'near') && (
            <Button asChild className="btn-aurora flex-1 text-white">
              <a href={def.claimUrl} target="_blank" rel="noreferrer">
                <Gift className="h-4 w-4" /> {t('airdrop.claimOfficial')}
              </a>
            </Button>
          )}
          <Button asChild variant="ghost" className="flex-1 border border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08] hover:text-white">
            <a href={def.officialUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" /> {t('airdrop.officialSite')}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
