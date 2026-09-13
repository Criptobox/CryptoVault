'use client';

import { useMemo, useState } from 'react';
import { useConfig, useWriteContract } from 'wagmi';
import { erc20Abi, encodeFunctionData, parseUnits, maxUint256 } from 'viem';
import { usePortfolio } from '@/hooks/usePortfolio';
import { getChain, MULTICALL3 } from '@/config/chains';
import { ChainLogo, TokenIcon } from '@/components/ChainLogo';
import { fmtMoney, fmtTokenAmount, isAddressValid } from '@/lib/format';
import { sendTxWithNotifications } from '@/hooks/useTxNotifications';
import { confirmTx } from '@/components/dashboard/ConfirmTxDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BrushCleaning, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n, useFmt } from '@/lib/i18n';
import { useActiveAddress } from '@/hooks/useActiveAddress';

const MULTICALL_ABI = [
  { inputs: [{ components: [{ internalType: 'address', name: 'target', type: 'address' }, { internalType: 'bytes', name: 'callData', type: 'bytes' }], internalType: 'struct Multicall3.Call3[]', name: 'calls', type: 'tuple[]' }], name: 'aggregate3', outputs: [{ internalType: 'bytes[]', name: 'returnData', type: 'bytes[]' }], stateMutability: 'payable', type: 'function' },
] as const;

/**
 * Barre el polvo: envía TODOS los tokens seleccionados a otra dirección
 * en UNA sola transacción (Multicall3). Ideal para consolidar wallets.
 * Con simulación previa on-chain antes de firmar.
 */
export function DustSweeper({ selectedChains }: { selectedChains: number[] }) {
  const { address, isConnected } = useActiveAddress();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { chains, loading } = usePortfolio(selectedChains);
  const { t } = useI18n();
  const { money } = useFmt();

  const [chainId, setChainId] = useState<number>(selectedChains[0] ?? 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dest, setDest] = useState('');
  const [executing, setExecuting] = useState(false);

  const available = useMemo(() => {
    const chain = chains.find((c) => c.chainId === chainId);
    return (chain?.tokens ?? []).filter((tk) => tk.balance > 0);
  }, [chains, chainId]);

  const selectedTokens = available.filter((tk) => selected.has(tk.address.toLowerCase()));
  const totalSelectedUsd = selectedTokens.reduce((s, tk) => s + (tk.usdValue ?? 0), 0);
  const native = chains.find((c) => c.chainId === chainId)?.native;

  const buildCalls = () => {
    const calls = selectedTokens.map((tk) => ({
      // 1. approve(dest, max) + 2. transfer(dest, balance)
      approve: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [dest as `0x${string}`, maxUint256],
      }),
      transfer: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [dest as `0x${string}`, parseUnits(String(tk.balance), tk.decimals)],
      }),
      token: tk.address as `0x${string}`,
    }));
    return calls.flatMap((c) => [
      { target: c.token, callData: c.approve, allowFailure: false, value: 0n },
      { target: c.token, callData: c.transfer, allowFailure: false, value: 0n },
    ]);
  };

  const executeSweep = async () => {
    if (!isAddressValid(dest)) {
      toast.error(t('dust.invalidDest'));
      return;
    }
    if (selectedTokens.length === 0) {
      toast.error(t('dust.selectOne'));
      return;
    }
    setExecuting(true);
    try {
      const calls = buildCalls();
      const data = encodeFunctionData({
        abi: MULTICALL_ABI,
        functionName: 'aggregate3',
        args: [calls] as never,
      });
      // SIMULACIÓN PREVIA on-chain del multicall completo
      const ok = await confirmTx({
        chainId,
        to: MULTICALL3,
        data,
        from: address,
        title: t('dust.execute'),
        fallbackLines: selectedTokens.map((tk) => `Envía ${fmtTokenAmount(tk.balance)} ${tk.symbol} (${money(tk.usdValue)}) a ${dest.slice(0, 8)}…`),
      });
      if (!ok) return;

      const hashPromise = writeContractAsync({
        address: MULTICALL3,
        abi: MULTICALL_ABI,
        functionName: 'aggregate3',
        args: [calls],
        chainId,
      } as never) as Promise<`0x${string}`>;

      const hash = await sendTxWithNotifications(config, {
        chainId,
        title: `Rescatar ${selectedTokens.length} tokens`,
        hashPromise,
        explorerBase: getChain(chainId)?.explorer,
      });
      if (hash) {
        toast.success(t('dust.onWay', { n: selectedTokens.length, dest: `${dest.slice(0, 8)}…` }));
        setSelected(new Set());
      }
    } finally {
      setExecuting(false);
    }
  };

  const sweepNative = async () => {
    toast.info(t('dust.nativeInfo'));
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
        <BrushCleaning className="h-7 w-7 text-zinc-700" />
        <p className="max-w-md text-sm text-zinc-500">{t('dust.connect')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm text-emerald-300 [&_b]:text-emerald-200"
        dangerouslySetInnerHTML={{ __html: t('dust.tip') }}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs">{t('dust.network')}</Label>
          <select
            value={chainId}
            onChange={(e) => { setChainId(Number(e.target.value)); setSelected(new Set()); }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
          >
            {selectedChains.map((id) => {
              const c = getChain(id);
              return c ? <option key={id} value={id}>{c.name}</option> : null;
            })}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">{t('dust.destination')}</Label>
          <Input
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder={t('dust.destPlaceholder')}
            className="bg-zinc-950 border-zinc-800 font-mono text-xs"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center justify-between border-b border-zinc-800 p-3">
          <p className="text-sm font-semibold text-zinc-200">{t('dust.available', { chain: getChain(chainId)?.shortName ?? '' })}</p>
          <div className="flex items-center gap-2">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
            ) : (
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-300">{available.length}</Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-emerald-500"
              onClick={() => {
                // Auto-seleccionar el polvo: valor < $5
                const dust = available.filter((tk) => (tk.usdValue ?? 999) < 5).map((tk) => tk.address.toLowerCase());
                setSelected(new Set(dust));
                if (!dust.length) toast.info(t('dust.noDust'));
              }}
            >
              {t('dust.selectDust')}
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-64">
          {available.length === 0 ? (
            <p className="p-6 text-center text-sm text-zinc-500">
              {loading ? t('dust.loading') : t('dust.empty')}
              {native && native.balance > 0 && (
                <button onClick={sweepNative} className="mt-2 block w-full text-xs text-zinc-600 underline">
                  {t('dust.nativeNote', { amount: fmtTokenAmount(native.balance), symbol: getChain(chainId)?.symbol ?? '' })}
                </button>
              )}
            </p>
          ) : (
            <div className="divide-y divide-zinc-800/60">
              {available.map((tk) => (
                <label key={tk.address} className="flex cursor-pointer items-center gap-3 px-3 py-2 transition hover:bg-zinc-950/40">
                  <Checkbox
                    checked={selected.has(tk.address.toLowerCase())}
                    onCheckedChange={(v) => {
                      const next = new Set(selected);
                      if (v) next.add(tk.address.toLowerCase());
                      else next.delete(tk.address.toLowerCase());
                      setSelected(next);
                    }}
                  />
                  <TokenIcon symbol={tk.symbol} className="h-7 w-7" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">{tk.symbol}</p>
                    <p className="truncate text-xs text-zinc-500">{tk.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-zinc-300">{fmtTokenAmount(tk.balance)}</p>
                    <p className="text-xs text-zinc-500">{money(tk.usdValue)}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex items-center justify-between gap-2 border-t border-zinc-800 p-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>{t('dust.summary', { n: selectedTokens.length, value: money(totalSelectedUsd) })}</span>
          </div>
          <Button
            onClick={executeSweep}
            disabled={executing || selectedTokens.length === 0 || !isAddressValid(dest)}
            className="btn-aurora text-white"
          >
            {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BrushCleaning className="h-4 w-4" />}
            {t('dust.execute')}
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ChainLogo chainId={chainId} className="h-4 w-4" />
        <p className="text-xs text-zinc-600">{t('dust.note')}</p>
      </div>
    </div>
  );
}
