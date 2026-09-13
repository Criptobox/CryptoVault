'use client';

/**
 * Diálogo de confirmación con SIMULACIÓN on-chain.
 * Cualquier flujo de escritura (revocar, barrer, reclamar, contratos viejos)
 * pasa por aquí antes de llegar a la cartera.
 *
 * Uso:
 *   const ok = await confirmTx({ chainId, to, data, value, from, fallbackLines });
 *   if (!ok) return; // cancelado o simulación fallida
 *   ... writeContractAsync ...
 */

import { useEffect, useState } from 'react';
import { getChain } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { simulateTx, type TxSpec, type TxPreview } from '@/lib/simulate';
import { useAppStore } from '@/lib/store';
import { fmtMoney } from '@/lib/format';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, ShieldAlert, TriangleAlert, Fuel } from 'lucide-react';

let resolver: ((ok: boolean) => void) | null = null;

export function confirmTx(spec: TxSpec & { title?: string }): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = resolve;
    window.dispatchEvent(new CustomEvent('cv-confirm-tx', { detail: spec }));
  });
}

interface OpenState extends TxSpec {
  title?: string;
}

export function ConfirmTxHost() {
  const [open, setOpen] = useState(false);
  const [spec, setSpec] = useState<OpenState | null>(null);
  const [preview, setPreview] = useState<TxPreview | null>(null);
  const [running, setRunning] = useState(false);
  const currency = useAppStore((s) => s.settings.currency);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<OpenState>).detail;
      if (!detail) return;
      resolver?.(false); // cancela cualquier diálogo previo no resuelto
      resolver = null;
      setSpec(detail);
      setOpen(true);
      setPreview(null);
      setRunning(true);
      simulateTx(detail, currency)
        .then(setPreview)
        .catch(() =>
          setPreview({
            lines: detail.fallbackLines ?? [`Interactúa con ${detail.to}`],
            warnings: [],
            simulated: 'unknown',
            gasCostNative: null,
            gasCostFiat: null,
            nativeSymbol: 'ETH',
          }),
        )
        .finally(() => setRunning(false));
    };
    window.addEventListener('cv-confirm-tx', handler);
    return () => window.removeEventListener('cv-confirm-tx', handler);
  }, [currency]);

  const finish = (ok: boolean) => {
    setOpen(false);
    resolver?.(ok);
    resolver = null;
  };

  const chain = spec ? getChain(spec.chainId) : undefined;
  const simIcon =
    !preview || running ? (
      <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
    ) : preview.simulated === 'ok' ? (
      <ShieldCheck className="h-4 w-4 text-emerald-400" />
    ) : preview.simulated === 'revert' ? (
      <ShieldAlert className="h-4 w-4 text-red-400" />
    ) : (
      <TriangleAlert className="h-4 w-4 text-amber-400" />
    );
  const simText = !preview
    ? 'Simulando on-chain…'
    : preview.simulated === 'ok'
      ? '✅ Simulación exitosa — la transacción no revertirá'
      : preview.simulated === 'revert'
        ? '❌ La simulación falló: la transacción revertiría'
        : '⚠️ No se pudo simular (revisa los detalles en tu cartera)';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && finish(false)}>
      <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            {spec?.title ?? 'Simulación de transacción'}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Antes de firmar, simulamos la transacción on-chain para mostrarte exactamente qué hará.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-1">
          {/* Resultado de simulación */}
          <div
            className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${
              !preview || running
                ? 'border-violet-500/25 bg-violet-500/[0.07] text-violet-200'
                : preview.simulated === 'ok'
                  ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200'
                  : preview.simulated === 'revert'
                    ? 'border-red-500/30 bg-red-500/[0.08] text-red-200'
                    : 'border-amber-500/25 bg-amber-500/[0.07] text-amber-200'
            }`}
          >
            {simIcon}
            <span>{simText}</span>
          </div>
          {preview?.revertReason && (
            <p className="rounded-lg border border-red-500/20 bg-red-950/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-red-300/90">
              {preview.revertReason}
            </p>
          )}

          {/* Qué hará */}
          {preview && preview.lines.length > 0 && (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">Qué hará esta transacción</p>
              <ul className="space-y-1 text-sm text-zinc-200">
                {preview.lines.map((l, i) => (
                  <li key={i} className="flex gap-1.5"><span className="text-violet-400">›</span><span>{l}</span></li>
                ))}
              </ul>
            </div>
          )}

          {/* Advertencias */}
          {preview && preview.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-amber-400">
                <TriangleAlert className="h-3 w-3" /> Advertencias de seguridad
              </p>
              <ul className="space-y-1 text-[13px] leading-relaxed text-amber-200/90">
                {preview.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Costo + red */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
            {chain && (
              <span className="chip-glass flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <ChainLogo chainId={chain.id} className="h-3.5 w-3.5" /> {chain.name}
              </span>
            )}
            {preview?.gasCostNative != null && (
              <span className="chip-glass nums flex items-center gap-1.5 rounded-full px-2.5 py-1">
                <Fuel className="h-3 w-3 text-champagne" />
                gas ≈ {preview.gasCostNative.toFixed(5)} {preview.nativeSymbol}
                {preview.gasCostFiat != null ? ` · ${fmtMoney(preview.gasCostFiat, currency)}` : ''}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 rounded-xl border-white/[0.1] bg-white/[0.04]" onClick={() => finish(false)}>
            Cancelar
          </Button>
          {preview?.simulated === 'revert' ? (
            <Button variant="destructive" className="flex-1 rounded-xl" onClick={() => finish(true)}>
              Enviar de todas formas
            </Button>
          ) : (
            <Button className="btn-aurora flex-1 rounded-xl text-white" disabled={running} onClick={() => finish(true)}>
              {running ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar y firmar'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
