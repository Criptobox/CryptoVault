'use client';

import { useMemo, useState } from 'react';
import { useConfig, useWriteContract, useAccount } from 'wagmi';
import { createPublicClient, encodeFunctionData, formatEther, getContract, parseAbi, type Abi } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { getChain } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { shortAddress, isAddressValid } from '@/lib/format';
import { sendTxWithNotifications } from '@/hooks/useTxNotifications';
import { fetchContractAbi } from '@/lib/api/explorer';
import { useAppStore } from '@/lib/store';
import { confirmTx } from '@/components/dashboard/ConfirmTxDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Landmark, Loader2, Wand2, CircleDollarSign, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n';
import { useActiveAddress } from '@/hooks/useActiveAddress';

/** Funciones de retiro/claim comunes en contratos viejos */
const RESCUE_PATTERNS: { name: string; label: string; needsArgs?: string[]; danger?: boolean }[] = [
  { name: 'withdraw', label: 'Retirar todo (withdraw)' },
  { name: 'withdrawAll', label: 'Retirar todo (withdrawAll)' },
  { name: 'emergencyWithdraw', label: 'Retiro de emergencia 🚨', needsArgs: ['pid'] },
  { name: 'emergencyWithdraw', label: 'Retiro de emergencia 🚨' },
  { name: 'claim', label: 'Reclamar recompensas (claim)' },
  { name: 'claimRewards', label: 'Reclamar recompensas' },
  { name: 'getReward', label: 'Reclamar recompensas (getReward)' },
  { name: 'harvest', label: 'Cosechar (harvest)' },
  { name: 'exit', label: 'Salir de la pool (exit)' },
  { name: 'unstake', label: 'Desbloquear (unstake)', needsArgs: ['amount'] },
  { name: 'unstakeAll', label: 'Desbloquear todo' },
  { name: 'redeem', label: 'Redimir (redeem)', needsArgs: ['shares'] },
  { name: 'drain', label: 'Drenar (drain)', danger: true },
  { name: 'releaseFunds', label: 'Liberar fondos' },
];

interface DetectedFn {
  signature: string;
  label: string;
  inputs: { name: string; type: string }[];
  stateMutability: string;
  danger?: boolean;
}

export function OldContractsPanel({ selectedChains }: { selectedChains: number[] }) {
  const { address, isConnected, chainId } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const pushNotification = useAppStore((s) => s.pushNotification);
  const { t } = useI18n();

  const [targetChain, setTargetChain] = useState<number>(chainId ?? selectedChains[0] ?? 1);
  const [contractAddr, setContractAddr] = useState('');
  const [abiJson, setAbiJson] = useState('');
  const [loading, setLoading] = useState(false);
  const [contractBalance, setContractBalance] = useState<string | null>(null);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [executing, setExecuting] = useState<string | null>(null);

  const detected: DetectedFn[] = useMemo(() => {
    if (!abiJson.trim()) return [];
    try {
      const abi: Abi = typeof abiJson === 'string' ? JSON.parse(abiJson) : abiJson;
      const fns = abi.filter(
        (f): f is Extract<Abi[number], { type: 'function' }> =>
          f.type === 'function' && (f.stateMutability === 'payable' || f.stateMutability === 'nonpayable'),
      );
      const out: DetectedFn[] = [];
      const seen = new Set<string>();
      for (const pattern of RESCUE_PATTERNS) {
        for (const fn of fns) {
          if (fn.name.toLowerCase() !== pattern.name.toLowerCase()) continue;
          const sig = `${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
          if (seen.has(sig + pattern.label)) continue;
          seen.add(sig + pattern.label);
          out.push({
            signature: sig,
            label: pattern.label,
            inputs: fn.inputs.map((i) => ({ name: i.name || 'valor', type: i.type })),
            stateMutability: fn.stateMutability,
            danger: pattern.danger,
          });
        }
      }
      return out.slice(0, 8);
    } catch {
      return [];
    }
  }, [abiJson]);

  const lookupAbi = async () => {
    if (!isAddressValid(contractAddr)) {
      toast.error('Dirección de contrato inválida');
      return;
    }
    setLoading(true);
    try {
      const chain = getChain(targetChain);
      const res = await fetchContractAbi(targetChain, contractAddr);
      if (res.ok && res.data && res.data !== 'Contract source code not verified') {
        setAbiJson(res.data);
        toast.success('ABI cargado desde el explorador — funciones de rescate detectadas abajo');
      } else {
        toast.error('No se pudo obtener el ABI (contrato sin verificar?). Pega el ABI manualmente.');
      }
      // Saldo del contrato (¿hay fondos atascados?)
      const client = createPublicClient({ chain: chain!.viemChain, transport: publicClientTransport(targetChain) });
      const bal = await client.getBalance({ address: contractAddr as `0x${string}` }).catch(() => 0n);
      setContractBalance(formatEther(bal));
    } finally {
      setLoading(false);
    }
  };

  const execute = async (fn: DetectedFn) => {
    if (!isAddressValid(contractAddr) || !address) return;
    const args = fn.inputs.map((i) => {
      const v = argValues[`${fn.signature}:${i.name}`] ?? '';
      if (i.type === 'uint256' || i.type === 'uint' || i.type.startsWith('uint')) return BigInt(v || '0');
      if (i.type === 'address') return v as `0x${string}`;
      return v;
    });
    const abi = parseAbi([`function ${fn.signature} ${fn.stateMutability === 'payable' ? 'payable' : ''}`]);
    setExecuting(fn.signature + fn.label);
    try {
      const chain = getChain(targetChain);
      // SIMULACIÓN PREVIA on-chain con los args reales
      let data: string | undefined;
      try {
        data = encodeFunctionData({
          abi,
          functionName: fn.signature.split('(')[0] as never,
          args: args as never,
        });
      } catch {
        data = undefined;
      }
      const ok = await confirmTx({
        chainId: targetChain,
        to: contractAddr,
        data,
        value: 0n,
        from: address,
        title: fn.label,
        fallbackLines: [`Ejecuta ${fn.signature} en el contrato ${shortAddress(contractAddr, 6)}`],
      });
      if (!ok) return;

      const hashPromise = writeContractAsync({
        address: contractAddr as `0x${string}`,
        abi,
        functionName: fn.signature.split('(')[0] as never,
        args: args as never,
        chainId: targetChain,
      } as never) as Promise<`0x${string}`>;

      await sendTxWithNotifications(config, {
        chainId: targetChain,
        title: `${fn.label} en ${shortAddress(contractAddr)}`,
        hashPromise,
        explorerBase: chain?.explorer,
      });
      pushNotification({
        type: 'security',
        title: t('old.interacted'),
        body: `${fn.label} · ${shortAddress(contractAddr)} en ${chain?.name}`,
      });
    } catch {
      // toast ya mostrado por sendTxWithNotifications
    } finally {
      setExecuting(null);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
        <Landmark className="h-7 w-7 text-zinc-700" />
        <p className="max-w-md text-sm text-zinc-500">{t('old.connect')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3 text-sm text-emerald-300 [&_b]:text-emerald-200 [&_em]:text-emerald-400"
        dangerouslySetInnerHTML={{ __html: t('old.tip') }}
      />

      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto]">
        <div>
          <Label className="mb-1.5 block text-xs">{t('old.network')}</Label>
          <select
            value={targetChain}
            onChange={(e) => setTargetChain(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200"
          >
            {[...new Set([chainId, ...selectedChains])].filter((x): x is number => typeof x === 'number').map((id) => {
              const c = getChain(id);
              return c ? <option key={id} value={id}>{c.name}</option> : null;
            })}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">{t('old.contractAddr')}</Label>
          <Input
            value={contractAddr}
            onChange={(e) => setContractAddr(e.target.value)}
            placeholder={t('old.contractPlaceholder')}
            className="bg-zinc-950 border-zinc-800 font-mono text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={lookupAbi} disabled={loading} className="w-full btn-aurora text-white sm:w-auto">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            {t('old.analyze')}
          </Button>
        </div>
      </div>

      {contractBalance !== null && Number(contractBalance) > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3">
          <CircleDollarSign className="h-5 w-5 text-emerald-400" />
          <p className="text-sm text-emerald-300">
            {t('old.contractHolds', { amount: Number(contractBalance).toFixed(4), symbol: getChain(targetChain)?.symbol ?? '' })}
          </p>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block text-xs">{t('old.abiLabel')}</Label>
        <Textarea
          value={abiJson}
          onChange={(e) => setAbiJson(e.target.value)}
          placeholder='[{"inputs":[],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}, …]'
          className="h-24 bg-zinc-950 border-zinc-800 font-mono text-xs"
        />
      </div>

      {detected.length > 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-200">
            <Wand2 className="h-4 w-4 text-emerald-500" /> {t('old.detected')}
          </p>
          <ScrollArea className="max-h-72">
            <div className="grid gap-2 sm:grid-cols-2">
              {detected.map((fn) => (
                <div key={fn.signature + fn.label} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">{fn.label}</p>
                    {fn.danger ? (
                      <Badge className="bg-red-950 text-red-300">{t('old.danger')}</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">{fn.inputs.length ? t('old.arg', { n: fn.inputs.length }) : t('old.oneClick')}</Badge>
                    )}
                  </div>
                  {fn.inputs.map((i) => (
                    <div key={i.name} className="mb-2">
                      <Label className="text-[10px] text-zinc-500">{i.name} ({i.type})</Label>
                      <Input
                        value={argValues[`${fn.signature}:${i.name}`] ?? ''}
                        onChange={(e) => setArgValues((s) => ({ ...s, [`${fn.signature}:${i.name}`]: e.target.value }))}
                        placeholder={i.type === 'address' ? '0x…' : '0'}
                        className="h-8 bg-zinc-950 border-zinc-800 font-mono text-xs"
                      />
                    </div>
                  ))}
                  <Button
                    size="sm"
                    variant={fn.danger ? 'destructive' : 'default'}
                    disabled={executing !== null}
                    className={fn.danger ? '' : 'w-full btn-aurora text-white'}
                    onClick={() => execute(fn)}
                  >
                    {executing === fn.signature + fn.label ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : fn.danger ? t('old.executeCareful') : t('old.execute')}
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-zinc-500">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <p>{t('old.review')}</p>
          </div>
        </div>
      ) : abiJson.trim() ? (
        <p className="text-center text-sm text-zinc-500">
          {t('old.noFns')}
        </p>
      ) : (
        <p className="text-center text-xs text-zinc-600">{t('old.pasteFirst')}</p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600">
        <ChainLogo chainId={targetChain} className="h-4 w-4" />
        {getChain(targetChain)?.name} ·{' '}
        {isAddressValid(contractAddr) && (
          <a href={`${getChain(targetChain)?.explorer}/address/${contractAddr}`} target="_blank" rel="noreferrer" className="text-emerald-500 underline">
            {t('old.viewContract')}
          </a>
        )}
      </div>
    </div>
  );
}
