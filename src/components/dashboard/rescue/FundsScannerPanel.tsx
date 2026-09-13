'use client';

/* ============================================================================
 * FONDOS RESCATABLES — escáner automático en TODAS las redes
 *
 * 1. Pegas cualquier dirección (o usas la cartera conectada/vigilada)
 * 2. Un clic escanea las 23 redes buscando fondos atrapados en contratos
 *    viejos: farms deprecados, staking cerrado, vesting, presales, vaults…
 * 3. Cada fondo detectado lleva su botón RESCATAR (1 clic) con simulación
 *    previa on-chain antes de firmar.
 * ==========================================================================*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { encodeFunctionData } from 'viem';
import {
  scanAllRescuable,
  formatRescueAmount,
  rescueAbiFor,
  type RescueOpportunity,
  type ScanProgress,
} from '@/lib/api/rescueScan';
import { getChain, CHAINS } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { shortAddress, isAddressValid } from '@/lib/format';
import { sendTxWithNotifications } from '@/hooks/useTxNotifications';
import { confirmTx } from '@/components/dashboard/ConfirmTxDialog';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Landmark, Loader2, Radar, Wallet, ChevronDown, ChevronRight,
  CircleCheck, CircleAlert, History, WalletCards,
} from 'lucide-react';
import { toast } from 'sonner';

const CACHE_PREFIX = 'cv-rescue-scan';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 h

interface CachedScan {
  ts: number;
  results: RescueOpportunity[];
}

function readCache(addr: string): CachedScan | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}:${addr.toLowerCase()}`);
    if (!raw) return null;
    const c = JSON.parse(raw) as CachedScan;
    if (Date.now() - c.ts > CACHE_TTL) return null;
    return c;
  } catch {
    return null;
  }
}

const KIND_TONES: Record<string, { badge: string; text: string }> = {
  farm: { badge: 'bg-emerald-500/[0.12] text-emerald-300', text: 'text-emerald-300' },
  staking: { badge: 'bg-violet-500/[0.12] text-violet-300', text: 'text-violet-300' },
  rewards: { badge: 'bg-cyan-500/[0.12] text-cyan-300', text: 'text-cyan-300' },
  vesting: { badge: 'bg-amber-500/[0.12] text-amber-300', text: 'text-amber-300' },
  vault: { badge: 'bg-blue-500/[0.12] text-blue-300', text: 'text-blue-300' },
  presale: { badge: 'bg-fuchsia-500/[0.12] text-fuchsia-300', text: 'text-fuchsia-300' },
  airdrop: { badge: 'bg-champagne/15 text-champagne', text: 'text-champagne' },
  unknown: { badge: 'bg-zinc-500/[0.12] text-zinc-300', text: 'text-zinc-300' },
};

export function FundsScannerPanel() {
  const { address: active, isConnected } = useActiveAddress();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const pushNotification = useAppStore((s) => s.pushNotification);
  const { t } = useI18n();

  const [addr, setAddr] = useState('');
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<ScanProgress>({ done: 0, total: CHAINS.length });
  const [results, setResults] = useState<RescueOpportunity[]>([]);
  const [scannedFor, setScannedFor] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);
  const [rescuedKeys, setRescuedKeys] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [showHow, setShowHow] = useState(false);
  const autoRef = useRef(false);

  const startScan = useCallback(async (target?: string) => {
    const target0 = (target ?? addr).trim();
    if (!isAddressValid(target0)) {
      toast.error(t('funds.invalidAddr'));
      return;
    }
    setScanning(true);
    setFromCache(false);
    setResults([]);
    setScannedFor(target0);
    setProgress({ done: 0, total: CHAINS.length });
    try {
      const out = await scanAllRescuable(target0, (p) => setProgress(p));
      setResults(out);
      try {
        localStorage.setItem(
          `${CACHE_PREFIX}:${target0.toLowerCase()}`,
          JSON.stringify({ ts: Date.now(), results: out } satisfies CachedScan),
        );
      } catch { /* noop */ }
      if (out.length) {
        pushNotification({
          type: 'security',
          title: '💰 ' + t('funds.notifTitle', { n: out.length }),
          body: t('funds.notifBody', { n: out.length, chains: new Set(out.map((o) => o.chainId)).size }),
        });
      }
    } finally {
      setScanning(false);
    }
  }, [addr, pushNotification, t]);

  // Referencia estable al escaneo para el efecto de precarga (evita re-runs
  // del efecto en cada tecla del input, que resetearían lo escrito)
  const scanFnRef = useRef(startScan);
  scanFnRef.current = startScan;

  // Precarga: dirección activa + caché + auto-escaneo la primera vez
  useEffect(() => {
    if (!active) return;
    setAddr(active);
    const c = readCache(active);
    if (c) {
      setResults(c.results);
      setScannedFor(active);
      setFromCache(true);
    } else if (!autoRef.current) {
      autoRef.current = true;
      void scanFnRef.current(active);
    }
  }, [active]);

  const grouped = useMemo(() => {
    const map = new Map<number, RescueOpportunity[]>();
    for (const r of results) {
      const arr = map.get(r.chainId) ?? [];
      arr.push(r);
      map.set(r.chainId, arr);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [results]);

  const readyCount = results.filter((r) => r.simulation === 'ok' && !rescuedKeys.has(rescueKey(r))).length;
  const isWatchOnly = scannedFor !== null && !isConnected;

  const executeRescue = async (op: RescueOpportunity) => {
    const key = rescueKey(op);
    if (!op.rescueFn || !isConnected) return;
    setExecuting(key);
    try {
      const abi = rescueAbiFor(op.rescueFn);
      const name = op.rescueFn.sig.split('(')[0];
      const data = encodeFunctionData({ abi, functionName: name, args: op.rescueFn.args } as never) as `0x${string}`;
      const chain = getChain(op.chainId);
      const ok = await confirmTx({
        chainId: op.chainId,
        to: op.contract,
        data,
        value: 0n,
        title: t('funds.rescueTitle', { kind: t(`funds.kind.${op.kind}`) }),
        fallbackLines: [
          `${op.rescueFn.label} · ${formatRescueAmount(op)}`,
          `${shortAddress(op.contract, 6)} en ${chain?.name}`,
        ],
      });
      if (!ok) return;

      const hashPromise = writeContractAsync({
        address: op.contract as `0x${string}`,
        abi,
        functionName: name,
        args: op.rescueFn.args as never,
        chainId: op.chainId,
      } as never) as Promise<`0x${string}`>;

      const hash = await sendTxWithNotifications(config, {
        chainId: op.chainId,
        title: `${t('funds.rescue')} ${formatRescueAmount(op)}`,
        hashPromise,
        explorerBase: chain?.explorer,
      });
      if (hash) {
        setRescuedKeys((s) => new Set(s).add(key));
        toast.success(t('funds.rescued'));
        pushNotification({
          type: 'tx',
          title: '🔓 ' + t('funds.rescued'),
          body: `${op.rescueFn.label} · ${formatRescueAmount(op)} · ${chain?.name}`,
        });
      }
    } finally {
      setExecuting(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Entrada de dirección + escaneo */}
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Wallet className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" />
          <Input
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            placeholder={t('funds.addrPlaceholder')}
            className="border-zinc-800 bg-zinc-950 pl-9 font-mono text-xs"
            spellCheck={false}
          />
          {active && addr.toLowerCase() !== active.toLowerCase() && (
            <button
              onClick={() => setAddr(active)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-cyan-300 hover:bg-white/[0.08]"
            >
              {t('funds.useWallet')}
            </button>
          )}
        </div>
        <Button
          onClick={() => startScan()}
          disabled={scanning || !isAddressValid(addr)}
          className="btn-aurora text-white"
        >
          {scanning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Radar className="h-4 w-4" />
          )}
          {scanning
            ? t('funds.scanning', { done: progress.done, total: progress.total })
            : results.length && scannedFor === addr.trim()
              ? t('funds.rescan')
              : t('funds.scanBtn', { n: CHAINS.length })}
        </Button>
      </div>

      {/* Barra de progreso del escaneo */}
      {scanning && (
        <div className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-3">
          <div className="mb-1.5 flex items-center justify-between text-[11px] text-violet-200">
            <span className="flex items-center gap-1.5">
              <Radar className="h-3.5 w-3.5 animate-pulse" />
              {t('funds.progressLabel', { chain: progress.currentChain ? getChain(progress.currentChain)?.shortName ?? '' : '' })}
            </span>
            <span className="nums font-semibold">{progress.done}/{progress.total}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Ayuda: cómo funciona */}
      <button
        onClick={() => setShowHow((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] text-zinc-500 transition hover:text-zinc-300"
      >
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showHow ? 'rotate-180' : ''}`} />
        {t('funds.how')}
      </button>
      {showHow && (
        <div
          className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[11px] leading-relaxed text-zinc-400 [&_b]:text-zinc-200"
          dangerouslySetInnerHTML={{ __html: t('funds.howText') }}
        />
      )}

      {/* Aviso modo lectura */}
      {scannedFor && isWatchOnly && (
        <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2 text-[11px] text-cyan-300">
          👁 {t('funds.watchHint')}
        </p>
      )}

      {/* Resultados */}
      {scannedFor && !scanning && (
        results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.015] p-8 text-center">
            <CircleCheck className="h-7 w-7 text-emerald-500/60" />
            <p className="text-sm font-medium text-zinc-300">{t('funds.none')}</p>
            <p className="max-w-sm text-xs text-zinc-500">{t('funds.noneHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
                <Landmark className="h-4 w-4 text-champagne" />
                {t('funds.foundTitle', { n: results.length, chains: grouped.length })}
              </p>
              <div className="flex items-center gap-1.5">
                {fromCache && (
                  <span className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-0.5 text-[10px] text-zinc-500">
                    <History className="h-3 w-3" /> {t('funds.cached')}
                  </span>
                )}
                <Badge className="bg-emerald-500/[0.12] text-emerald-300">
                  {t('funds.readyCount', { n: readyCount })}
                </Badge>
              </div>
            </div>

            <ScrollArea className="max-h-[420px] pr-1">
              <div className="grid gap-2">
                {grouped.map(([chainId, ops]) => {
                  const chain = getChain(chainId);
                  const isCollapsed = collapsed.has(String(chainId));
                  return (
                    <div key={chainId} className="overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                      <button
                        onClick={() =>
                          setCollapsed((s) => {
                            const n = new Set(s);
                            if (n.has(String(chainId))) n.delete(String(chainId));
                            else n.add(String(chainId));
                            return n;
                          })
                        }
                        className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-white/[0.03]"
                      >
                        {isCollapsed ? <ChevronRight className="h-3.5 w-3.5 text-zinc-600" /> : <ChevronDown className="h-3.5 w-3.5 text-zinc-600" />}
                        <ChainLogo chainId={chainId} className="h-4.5 w-4.5" />
                        <span className="text-xs font-semibold text-zinc-200">{chain?.name}</span>
                        <span className="nums ml-auto rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] text-zinc-400">
                          {ops.length}
                        </span>
                      </button>
                      {!isCollapsed && (
                        <div className="divide-y divide-white/[0.04] border-t border-white/[0.04]">
                          {ops.map((op) => (
                            <RescueRow
                              key={rescueKey(op)}
                              op={op}
                              executing={executing === rescueKey(op)}
                              rescued={rescuedKeys.has(rescueKey(op))}
                              canSign={isConnected}
                              onRescue={() => executeRescue(op)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-zinc-600">
              <WalletCards className="mt-0.5 h-3 w-3 shrink-0" />
              {t('funds.footnote')}
            </p>
          </div>
        )
      )}
    </div>
  );
}

function rescueKey(op: RescueOpportunity): string {
  return `${op.chainId}:${op.contract.toLowerCase()}:${op.amountVia}`;
}

/* Fila de fondo rescatable */
function RescueRow({
  op, executing, rescued, canSign, onRescue,
}: {
  op: RescueOpportunity;
  executing: boolean;
  rescued: boolean;
  canSign: boolean;
  onRescue: () => void;
}) {
  const { t } = useI18n();
  const chain = getChain(op.chainId);
  const tone = KIND_TONES[op.kind] ?? KIND_TONES.unknown;
  const ready = op.simulation === 'ok' && op.rescueFn;

  return (
    <div className={`flex items-center gap-2.5 px-3 py-2.5 transition ${rescued ? 'opacity-45' : 'hover:bg-white/[0.025]'}`}>
      <ChainLogo chainId={op.chainId} className="h-8 w-8 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-zinc-100">{formatRescueAmount(op)}</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tone.badge}`}>
            {t(`funds.kind.${op.kind}`)}
          </span>
          {rescued && <Badge className="bg-emerald-500/15 text-emerald-300">✓ {t('funds.rescuedOk')}</Badge>}
        </div>
        <p className="truncate text-[11px] text-zinc-500">
          {op.rescueFn ? (
            <span className="text-zinc-400">{op.rescueFn.label} · </span>
          ) : null}
          <a
            href={`${chain?.explorer}/address/${op.contract}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-zinc-700 underline-offset-2 hover:text-cyan-300"
          >
            {shortAddress(op.contract, 6)}
          </a>
          {op.pid !== null && <span> · PID {op.pid}</span>}
        </p>
        {!ready && !rescued && (
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-amber-400/80">
            <CircleAlert className="h-3 w-3 shrink-0" />
            {t('funds.reviewNeeded')}
          </p>
        )}
      </div>
      <Button
        size="sm"
        disabled={!ready || executing || rescued || !canSign}
        onClick={onRescue}
        className={`h-8 shrink-0 rounded-xl px-3 text-xs font-bold ${ready && !rescued ? 'btn-aurora text-white' : ''}`}
        variant={ready && !rescued ? 'default' : 'secondary'}
        title={!canSign ? t('funds.watchHint') : undefined}
      >
        {executing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : rescued ? (
          t('funds.rescuedOk')
        ) : (
          t('funds.rescue')
        )}
      </Button>
    </div>
  );
}
