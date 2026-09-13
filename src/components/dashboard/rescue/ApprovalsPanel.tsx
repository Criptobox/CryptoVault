'use client';

import { useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { erc20Abi, encodeFunctionData, parseAbi } from 'viem';
import { useApprovals, revokeApproval } from '@/hooks/useApprovals';
import { getChain } from '@/config/chains';
import { ChainLogo, TokenIcon } from '@/components/ChainLogo';
import { shortAddress } from '@/lib/format';
import { sendTxWithNotifications } from '@/hooks/useTxNotifications';
import { confirmTx } from '@/components/dashboard/ConfirmTxDialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { KeyRound, ShieldAlert, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useActiveAddress } from '@/hooks/useActiveAddress';

/**
 * Lista de aprobaciones ERC-20 activas con botón de revocación en 1 clic.
 * Requiere API key de explorador para el escaneo completo.
 */
export function ApprovalsPanel({ selectedChains }: { selectedChains: number[] }) {
  const { address, isConnected } = useActiveAddress();
  const config = useConfig();
  const { approvals, loading, needsKey } = useApprovals(selectedChains);
  const { writeContractAsync } = useWriteContract();
  const [revoking, setRevoking] = useState<string | null>(null);
  const { t } = useI18n();

  const filtered = approvals.filter((a) => selectedChains.includes(a.chainId));
  const unlimitedCount = filtered.filter((a) => a.isUnlimited).length;

  const handleRevoke = async (chainId: number, token: string, spender: string, symbol: string) => {
    if (!address) return;
    const key = `${chainId}-${token}-${spender}`;
    setRevoking(key);
    try {
      const chain = getChain(chainId);
      // SIMULACIÓN PREVIA: approve(spender, 0)
      const data = encodeFunctionData({
        abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
        functionName: 'approve',
        args: [spender as `0x${string}`, 0n],
      });
      const ok = await confirmTx({
        chainId,
        to: token,
        data,
        from: address,
        title: `Revocar ${symbol}`,
        fallbackLines: [`Pone a CERO la aprobación de ${symbol} para ${shortAddress(spender, 6)}`],
      });
      if (!ok) return;
      const hash = await sendTxWithNotifications(config, {
        chainId,
        title: `Revocar ${symbol}`,
        hashPromise: revokeApproval(chainId, token, spender, writeContractAsync as never) as Promise<`0x${string}`>,
        explorerBase: chain?.explorer,
      });
      if (hash) toast.success(`Aprobación de ${symbol} revocada`);
    } finally {
      setRevoking(null);
    }
  };

  if (!address) {
    return <PanelInfo icon={KeyRound} message={t('approvals.connect')} />;
  }
  if (needsKey) {
    return (
      <PanelInfo
        icon={ShieldAlert}
        title={t('approvals.needKeyTitle')}
        message={t('approvals.needKey')}
        action={
          <Button size="sm" className="btn-aurora text-white" onClick={() => window.dispatchEvent(new CustomEvent('open-settings'))}>
            {t('approvals.openSettings')}
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] p-3">
        <p
          className="nums text-sm text-amber-200 [&_b]:text-amber-100"
          dangerouslySetInnerHTML={{ __html: t('approvals.active', { n: filtered.length, u: unlimitedCount }) }}
        />
        {isConnected && filtered.length > 1 && (
          <Button
            size="sm"
            variant="outline"
            disabled={revoking !== null}
            className="shrink-0 rounded-xl border-amber-500/35 text-amber-300 hover:bg-amber-500/10 hover:text-amber-200"
            onClick={async () => {
              for (const a of filtered.slice(0, 5)) {
                await handleRevoke(a.chainId, a.tokenAddress, a.spender, a.tokenSymbol);
              }
            }}
          >
            {t('approvals.revokeFirst5')}
          </Button>
        )}
      </div>
      {!isConnected && (
        <p className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.06] px-3 py-2 text-[11px] text-cyan-300">
          👁 {t('approvals.watchOnly')}
        </p>
      )}

      <ScrollArea className="max-h-96">
        {loading ? (
          <div className="grid gap-2 p-1">
            {[...Array(4)].map((_, i) => <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/[0.04]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">{t('approvals.none')}</p>
        ) : (
          <div className="grid gap-2">
            {filtered.map((a) => {
              const chain = getChain(a.chainId);
              const key = `${a.chainId}-${a.tokenAddress}-${a.spender}`;
              return (
                <div key={key} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 transition hover:border-white/[0.12] hover:bg-white/[0.045]">
                  <span className="relative shrink-0">
                    <TokenIcon symbol={a.tokenSymbol} className="h-9 w-9" />
                    <ChainLogo chainId={a.chainId} className="absolute -bottom-0.5 -right-0.5 h-4 w-4 shadow-md shadow-black/50" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-zinc-100">{a.tokenSymbol}</span>
                      <Badge variant="secondary" className={a.isUnlimited ? 'bg-red-950 text-red-300' : 'bg-zinc-800 text-zinc-400'}>
                        {a.isUnlimited ? 'ILIMITADA ⚠️' : a.allowanceFormatted}
                      </Badge>
                    </div>
                    <p className="truncate text-xs text-zinc-500">
                      → {a.spenderName ?? t('approvals.unknown')} ({shortAddress(a.spender)}) · {chain?.shortName}
                      {a.spenderRisk === 'high' && <span className="ml-1 text-red-400">{t('approvals.riskHigh')}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 rounded-xl bg-red-500/[0.12] text-red-300 shadow-inner hover:bg-red-500/25"
                      disabled={revoking === key}
                      onClick={() => handleRevoke(a.chainId, a.tokenAddress, a.spender, a.tokenSymbol)}
                    >
                      {revoking === key ? t('approvals.revoking') : t('approvals.revoke')}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('approvals.viewSpender')}
                      className="h-8 w-8 text-zinc-600"
                      onClick={() => window.open(`${chain?.explorer}/address/${a.spender}`, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

export function PanelInfo({
  icon: Icon, message, title, action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2.5 rounded-2xl border border-dashed border-white/[0.1] bg-white/[0.02] p-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15">
        <Icon className="h-5 w-5 text-violet-400/80" />
      </span>
      {title && <p className="font-display font-semibold text-zinc-200">{title}</p>}
      <p className="max-w-md text-sm leading-relaxed text-zinc-500">{message}</p>
      {action}
    </div>
  );
}
