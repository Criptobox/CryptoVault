'use client';

/* ============================================================================
 * HOOK DEL RADAR DE AIRDROPS
 * - Escanea la actividad on-chain de la cartera (sin API key gracias a
 *   Blockscout; con key añade Etherscan + antigüedad exacta)
 * - Evalúa los criterios de cada airdrop contra esa actividad y los
 *   balances reales del portafolio
 * - Deriva el estado por airdrop: RECLAMABLE AHORA / PENDIENTE DE RECLAMO /
 *   CERCA DE RECLAMAR / ACUMULANDO / FINALIZADO
 * - Dispara notificaciones al detectar reclamables o "cerca de reclamar"
 * ==========================================================================*/

import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { collectWalletStats } from '@/lib/api/airdropScan';
import { AIRDROPS_DB, type AirdropDef, type UserAirdropStatus, type ScanContext, type CriterionResult } from '@/config/airdrops';
import { CHAINS } from '@/config/chains';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { useAppStore } from '@/lib/store';
import { fireNotification } from '@/lib/notifications';
import { t } from '@/lib/i18n';

export interface AirdropCriterionResult {
  label: string;
  hint?: string;
  done: boolean;
  progress: number;
  skip: boolean;
}

export interface AirdropResult {
  def: AirdropDef;
  status: UserAirdropStatus;
  /** 0…1 con los criterios evaluables */
  progress: number;
  criteria: AirdropCriterionResult[];
  /** Estado legible para UI */
  statusLabel: string;
}

const statusLabel = (s: UserAirdropStatus): string => t(`airdrop.status.${s}`);

function deriveStatus(def: AirdropDef, progress: number): UserAirdropStatus {
  if (def.category === 'closed') return 'closed';
  if (def.category === 'claimable') {
    if (progress >= 0.55) return 'claimable';
    if (progress >= 0.25) return 'near';
    return 'accumulating';
  }
  if (def.category === 'pending') {
    if (progress >= 0.55) return 'pending';
    if (progress >= 0.25) return 'near';
    return 'accumulating';
  }
  // accumulating (sin token aún)
  return progress >= 0.75 ? 'near' : 'accumulating';
}

export function useAirdrops(selectedChains?: number[]) {
  const { address } = useActiveAddress();
  const portfolio = usePortfolio(selectedChains);

  const scanQuery = useQuery({
    queryKey: ['airdrop-scan', address],
    enabled: !!address,
    staleTime: 10 * 60_000,
    retry: 1,
    queryFn: async () => {
      if (!address) return null;
      // ESCANEO EN TODAS LAS REDES soportadas: Blockscout público (13 redes)
      // + Etherscan V2 con key + nonce RPC como último recurso, así ninguna
      // cadena soportada queda fuera del radar.
      const chains = CHAINS.map((c) => c.id);
      return collectWalletStats(address, chains);
    },
  });

  /** Resultados computados contra el portafolio MÁS RECIENTE (balances en vivo) */
  const results: AirdropResult[] = useMemo(() => {
    const stats = scanQuery.data;
    if (!stats) return [];

    const usdByChain = new Map<number, number>();
    const nativeByChain = new Map<number, number>();
    for (const c of portfolio.chains) {
      let sum = c.native.usd ?? 0;
      for (const t of c.tokens) sum += t.usdValue ?? 0;
      usdByChain.set(c.chainId, sum);
      nativeByChain.set(c.chainId, c.native.balance);
    }

    const ctx: ScanContext = {
      stats,
      balanceUsd: (id) => usdByChain.get(id) ?? 0,
      nativeBalance: (id) => nativeByChain.get(id) ?? 0,
    };

    const out: AirdropResult[] = AIRDROPS_DB.map((def) => {
      const criteria: AirdropCriterionResult[] = def.criteria.map((c) => {
        let r: CriterionResult;
        try {
          r = c.eval(ctx);
        } catch {
          r = { done: false, progress: 0, skip: true };
        }
        return { label: c.label, hint: c.hint, done: !!r.done, progress: r.progress, skip: !!r.skip };
      });
      let weighted = 0;
      let totalWeight = 0;
      def.criteria.forEach((c, i) => {
        if (criteria[i].skip) return;
        weighted += criteria[i].progress * c.weight;
        totalWeight += c.weight;
      });
      const progress = totalWeight === 0 ? 0 : weighted / totalWeight;
      const status = deriveStatus(def, Number.isFinite(progress) ? progress : 0);
      return { def, status, progress: Math.max(0, Math.min(1, progress || 0)), criteria, statusLabel: statusLabel(status) };
    });

    const order: Record<UserAirdropStatus, number> = { claimable: 0, pending: 1, near: 2, accumulating: 3, closed: 4 };
    out.sort((a, b) => order[a.status] - order[b.status] || b.progress - a.progress);
    return out;
  }, [scanQuery.data, portfolio.chains]);

  /* ---- Notificaciones al completar el escaneo (resumen 1 vez por firma) ---- */
  const lastSigRef = useRef<string>('');
  useEffect(() => {
    if (!results.length || scanQuery.isFetching) return;
    const claimable = results.filter((r) => r.status === 'claimable').length;
    const pending = results.filter((r) => r.status === 'pending').length;
    const near = results.filter((r) => r.status === 'near').length;
    const sig = `${claimable}:${pending}:${near}`;
    if (sig === lastSigRef.current) return;
    lastSigRef.current = sig;
    if (claimable + pending + near === 0) return;
    const parts: string[] = [];
    if (claimable) parts.push(`🎁 ${claimable} reclamable${claimable > 1 ? 's' : ''} ahora`);
    if (pending) parts.push(`⏳ ${pending} pendiente${pending > 1 ? 's' : ''} de reclamo`);
    if (near) parts.push(`🔥 ${near} cerca de reclamar`);
    fireNotification({
      type: 'info',
      title: '🪂 Radar de Airdrops actualizado',
      body: parts.join(' · '),
    });
  }, [results, scanQuery.isFetching]);

  /* ---- Alertas por airdrop individual: detecta cambios de estado vs último escaneo ---- */
  useEffect(() => {
    if (!results.length || scanQuery.isFetching || !address) return;
    const KEY = 'cv-airdrop-snapshot';
    let prev: Record<string, { status: UserAirdropStatus; pct: number }> = {};
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Record<string, { status: UserAirdropStatus; pct: number }>>;
      prev = raw[address.toLowerCase()] ?? {};
    } catch { /* noop */ }

    const next: Record<string, { status: UserAirdropStatus; pct: number }> = {};
    const rank: Record<UserAirdropStatus, number> = { accumulating: 0, near: 1, pending: 2, claimable: 3, closed: -1 };
    let notified = 0;
    for (const r of results) {
      const pct = Math.round(r.progress * 100);
      next[r.def.id] = { status: r.status, pct };
      const before = prev[r.def.id];
      if (!before) continue; // primer vistazo de este airdrop
      if (before.status === r.status) continue;
      const wentUp = rank[r.status] > rank[before.status];
      const wentClosed = r.status === 'closed';
      if ((wentUp || wentClosed) && notified < 3) {
        notified++;
        fireNotification({
          type: 'info',
          title:
            r.status === 'claimable'
              ? t('airdrop.notifNewClaimable', { name: r.def.name })
              : t('airdrop.notifStatusUp', { name: r.def.name, status: statusLabel(r.status), pct }),
          body: `${before.status && statusLabel(before.status)} → ${statusLabel(r.status)} · ${pct}%`,
        });
      }
    }
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, Record<string, { status: UserAirdropStatus; pct: number }>>;
      raw[address.toLowerCase()] = next;
      localStorage.setItem(KEY, JSON.stringify(raw));
    } catch { /* noop */ }
  }, [results, scanQuery.isFetching, address]);

  return {
    results,
    scanning: scanQuery.isFetching,
    scanStarted: !!scanQuery.data || scanQuery.isFetching,
    error: scanQuery.error?.message,
    partial: scanQuery.data?.partial ?? false,
    refetch: () => scanQuery.refetch(),
    portfolioLoading: portfolio.loading,
  };
}

export function statusColors(status: UserAirdropStatus): { badge: string; dot: string; glow: string } {
  switch (status) {
    case 'claimable':
      return { badge: 'border-amber-400/40 bg-amber-400/10 text-amber-300 airdrop-badge-pulse', dot: 'bg-amber-300', glow: 'rgba(245,193,61,0.5)' };
    case 'pending':
      return { badge: 'border-violet-400/40 bg-violet-400/10 text-violet-300', dot: 'bg-violet-300', glow: 'rgba(139,92,246,0.45)' };
    case 'near':
      return { badge: 'border-cyan-400/40 bg-cyan-400/10 text-cyan-300', dot: 'bg-cyan-300', glow: 'rgba(34,211,238,0.4)' };
    case 'accumulating':
      return { badge: 'border-white/[0.09] bg-white/[0.04] text-zinc-400', dot: 'bg-zinc-500', glow: 'rgba(255,255,255,0.12)' };
    default:
      return { badge: 'border-white/[0.06] bg-white/[0.02] text-zinc-600', dot: 'bg-zinc-700', glow: 'transparent' };
  }
}
