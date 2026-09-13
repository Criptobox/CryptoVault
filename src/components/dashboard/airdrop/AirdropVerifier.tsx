'use client';

/* ============================================================================
 * VERIFICADOR DE AIRDROPS PERSONALIZADOS
 * Pega la dirección de CUALQUIER contrato de claim → el escáner sondea
 * on-chain (solo lecturas): monto reclamable, flag de ya-reclamado,
 * simulación de la función de reclamo y saldo retenido. Si el claim es
 * viable, ofrece el botón de RECLAMO EN 1 CLIC (tú firmas siempre).
 * ==========================================================================*/

import { useState } from 'react';
import { useAccount, useConfig, useWriteContract } from 'wagmi';
import { type Abi, encodeFunctionData } from 'viem';
import { getChain } from '@/config/chains';
import { CHAINS } from '@/config/chains';
import { probeClaimContract, formatClaimAmount } from '@/lib/api/airdropScan';
import { useAppStore, type CustomAirdropEntry } from '@/lib/store';
import { sendTxWithNotifications } from '@/hooks/useTxNotifications';
import { confirmTx } from '@/components/dashboard/ConfirmTxDialog';
import { useI18n } from '@/lib/i18n';
import { ChainLogo } from '@/components/ChainLogo';
import { isAddressValid, shortAddress, timeAgo } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScanLine, Loader2, Gift, ShieldCheck, ShieldAlert, Plus, Trash2, XCircle, CheckCircle2, Wallet } from 'lucide-react';
import { toast } from 'sonner';

interface ProbeUI {
  claimableLabel: string | null;
  claimableVia: string | null;
  isClaimed: boolean | null;
  claimedVia: string | null;
  zeroArgFn: string | null;
  simulation: 'ok' | 'revert' | 'unknown';
  revertReason: string | null;
  contractNative: string | null;
}

export function AirdropVerifier() {
  const { address, isConnected, chainId: walletChain } = useAccount();
  const config = useConfig();
  const { writeContractAsync } = useWriteContract();
  const { t } = useI18n();
  const customAirdrops = useAppStore((s) => s.customAirdrops);
  const addCustomAirdrop = useAppStore((s) => s.addCustomAirdrop);
  const removeCustomAirdrop = useAppStore((s) => s.removeCustomAirdrop);
  const updateCheck = useAppStore((s) => s.updateCustomAirdropCheck);
  const pushNotification = useAppStore((s) => s.pushNotification);

  const [name, setName] = useState('');
  const [targetChain, setTargetChain] = useState<number>(walletChain ?? 1);
  const [contract, setContract] = useState('');
  const [probing, setProbing] = useState(false);
  const [probe, setProbe] = useState<ProbeUI | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const runProbe = async (chainId: number, contractAddr: string): Promise<ProbeUI | null> => {
    if (!address || !isAddressValid(contractAddr)) return null;
    const p = await probeClaimContract(chainId, contractAddr, address);
    return {
      claimableLabel: p.claimableRaw !== null ? formatClaimAmount(p.claimableRaw) : null,
      claimableVia: p.claimableVia,
      isClaimed: p.isClaimed,
      claimedVia: p.claimedVia,
      zeroArgFn: p.zeroArgFn,
      simulation: p.simulation,
      revertReason: p.revertReason,
      contractNative: p.contractNative,
    };
  };

  const verify = async () => {
    if (!isAddressValid(contract)) {
      toast.error('Introduce una dirección de contrato válida (0x…)');
      return;
    }
    setProbing(true);
    setProbe(null);
    try {
      const p = await runProbe(targetChain, contract);
      setProbe(p);
      if (!p) {
        toast.error('No se pudo sondear el contrato en esa red');
      } else if (p.zeroArgFn) {
        toast.success(`¡Reclamo viable! Función ${p.zeroArgFn} simulada con éxito`);
        pushNotification({
          type: 'security',
          title: '🪂 Airdrop verificado',
          body: `${shortAddress(contract)} en ${getChain(targetChain)?.name}: claim simulado OK`,
        });
      } else if (p.claimableLabel) {
        toast.info(`Monto legible: ${p.claimableLabel} — pero la función de reclamo necesita argumentos`);
      } else {
        toast.message('Verificación completada', { description: p.revertReason ? `Revert: ${p.revertReason}` : 'Sin monto reclamable detectado' });
      }
    } finally {
      setProbing(false);
    }
  };

  const saveToRadar = () => {
    if (!probe || !isAddressValid(contract)) return;
    addCustomAirdrop({
      id: crypto.randomUUID(),
      chainId: targetChain,
      address: contract,
      name: name.trim() || `Airdrop ${shortAddress(contract, 4)}`,
      addedAt: Date.now(),
      lastCheck: {
        ts: Date.now(),
        claimableRaw: null,
        decimals: 18,
        claimFn: probe.zeroArgFn,
        simulation: probe.simulation,
        revertReason: probe.revertReason ?? undefined,
        claimableVia: probe.claimableVia,
        isClaimed: probe.isClaimed,
        contractNative: probe.contractNative,
      },
    });
    toast.success('Añadido a tu radar — lo vigilaremos en cada escaneo');
    setProbe(null);
    setContract('');
    setName('');
  };

  const claimCustom = async (entry: CustomAirdropEntry) => {
    const fn = entry.lastCheck?.claimFn;
    if (!fn) return;
    setClaiming(entry.id);
    try {
      const fnName = fn.split('(')[0];
      // Confirmación con simulación on-chain del reclamo
      const ok = await confirmTx({
        chainId: entry.chainId,
        to: entry.address,
        data: encodeFunctionData({
          abi: [{ type: 'function', name: fnName, stateMutability: 'nonpayable', inputs: [], outputs: [] }] as unknown as Abi,
          functionName: fnName,
          args: [],
        }),
        from: address,
        title: `Reclamar ${entry.name}`,
        fallbackLines: [`Llama a ${fn}() en el contrato de claim ${shortAddress(entry.address, 6)}`],
      });
      if (!ok) return;
      const abi = [
        { type: 'function', name: fnName, stateMutability: 'nonpayable', inputs: [], outputs: [] },
      ] as unknown as Abi;
      const hashPromise = writeContractAsync({
        address: entry.address as `0x${string}`,
        abi,
        functionName: fnName,
        args: [],
        chainId: entry.chainId,
      } as never) as Promise<`0x${string}`>;
      await sendTxWithNotifications(config, {
        chainId: entry.chainId,
        title: `Reclamo ${entry.name}`,
        hashPromise,
        explorerBase: getChain(entry.chainId)?.explorer,
      });
    } catch {
      // toast ya mostrado
    } finally {
      setClaiming(null);
    }
  };

  const recheckSaved = async (entry: CustomAirdropEntry) => {
    if (!address) return;
    setProbing(true);
    try {
      const p = await runProbe(entry.chainId, entry.address);
      updateCheck(entry.id, {
        ts: Date.now(),
        claimableRaw: null,
        decimals: 18,
        claimFn: p?.zeroArgFn ?? entry.lastCheck?.claimFn ?? null,
        simulation: p?.simulation ?? 'unknown',
        revertReason: p?.revertReason ?? undefined,
        claimableVia: p?.claimableVia,
        isClaimed: p?.isClaimed,
        contractNative: p?.contractNative,
      });
      toast.info(`Verificado ${entry.name}: ${p?.zeroArgFn ? 'claim disponible' : p?.revertReason ? `revert (${p.revertReason})` : 'sin cambios'}`);
    } finally {
      setProbing(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] p-4 text-sm text-zinc-500">
        <Wallet className="h-4 w-4 shrink-0" />
        Conecta tu cartera para verificar contratos de airdrop personalizados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Formulario de verificación */}
      <div className="grid gap-3 sm:grid-cols-[110px_1fr_auto]">
        <div>
          <Label className="mb-1.5 block text-xs">Red</Label>
          <select
            value={targetChain}
            onChange={(e) => setTargetChain(Number(e.target.value))}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2.5 py-2 text-sm text-zinc-200"
          >
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs">Contrato del airdrop (claim)</Label>
          <Input
            value={contract}
            onChange={(e) => setContract(e.target.value)}
            placeholder="0x… contrato de reclamo"
            className="border-zinc-800 bg-zinc-950 font-mono text-xs"
          />
        </div>
        <div className="flex items-end">
          <Button onClick={verify} disabled={probing} className="btn-aurora w-full text-white sm:w-auto">
            {probing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
            Verificar
          </Button>
        </div>
      </div>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre (opcional, ej: Airdrop deXYZ)"
        className="h-8 border-zinc-800 bg-zinc-950 text-xs"
      />

      {/* Resultado del sondeo */}
      {probe && (
        <div className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5">
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
            <ScanLine className="h-3.5 w-3.5 text-violet-400" /> Resultado de la verificación
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            {probe.claimableLabel && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-2.5">
                <Gift className="h-4 w-4 text-emerald-400" />
                <div className="min-w-0">
                  <p className="nums text-sm font-bold text-emerald-300">{probe.claimableLabel}</p>
                  <p className="text-[10px] text-zinc-500">vía {probe.claimableVia} (asume 18 decimales)</p>
                </div>
              </div>
            )}
            {probe.isClaimed !== null && (
              <div className={`flex items-center gap-2 rounded-xl border p-2.5 ${probe.isClaimed ? 'border-zinc-800 bg-zinc-900/40' : 'border-emerald-900/60 bg-emerald-950/20'}`}>
                {probe.isClaimed ? <XCircle className="h-4 w-4 text-zinc-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                <p className="text-xs text-zinc-300">{probe.isClaimed ? 'Ya reclamaste este airdrop' : 'Aún sin reclamar'} <span className="text-zinc-600">({probe.claimedVia})</span></p>
              </div>
            )}
            <div className={`flex items-center gap-2 rounded-xl border p-2.5 ${probe.simulation === 'ok' ? 'border-emerald-900/60 bg-emerald-950/20' : probe.simulation === 'revert' ? 'border-amber-900/60 bg-amber-950/20' : 'border-white/[0.06] bg-white/[0.02]'}`}>
              {probe.simulation === 'ok' ? <ShieldCheck className="h-4 w-4 text-emerald-400" /> : <ShieldAlert className="h-4 w-4 text-amber-400" />}
              <p className="min-w-0 text-xs text-zinc-300">
                {probe.simulation === 'ok' && <>Simulación OK — claim viable con <span className="font-mono text-emerald-300">{probe.zeroArgFn}</span></>}
                {probe.simulation === 'revert' && <>La simulación revirtió: <span className="text-amber-300">{probe.revertReason}</span></>}
                {probe.simulation === 'unknown' && 'No se pudo simular automáticamente (quizá requiere argumentos Merkle)'}
              </p>
            </div>
            {probe.contractNative !== null && Number(probe.contractNative) > 0 && (
              <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
                <Wallet className="h-4 w-4 text-cyan-400" />
                <p className="nums text-xs text-zinc-300">El contrato retiene {Number(probe.contractNative).toFixed(4)} nativo</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={saveToRadar} className="btn-aurora text-white">
              <Plus className="h-3.5 w-3.5" /> Guardar en el radar
            </Button>
            {getChain(targetChain) && isAddressValid(contract) && (
              <Button size="sm" variant="ghost" asChild className="border border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]">
                <a href={`${getChain(targetChain)!.explorer}/address/${contract}`} target="_blank" rel="noreferrer">
                  Ver en el explorador
                </a>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Airdrops personalizados guardados */}
      {customAirdrops.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Mis airdrops verificados ({customAirdrops.length})</p>
          {customAirdrops.map((a) => {
            const check = a.lastCheck;
            const canClaim = !!check?.claimFn && check.simulation === 'ok' && check.isClaimed !== true;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-2.5">
                <ChainLogo chainId={a.chainId} className="h-7 w-7" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-zinc-200">{a.name}</p>
                  <p className="truncate font-mono text-[10px] text-zinc-600">
                    {shortAddress(a.address, 6)} · {getChain(a.chainId)?.shortName}
                    {check && ` · verificado ${timeAgo(check.ts)}`}
                  </p>
                </div>
                {check?.simulation === 'ok' ? (
                  <Badge className="border-amber-400/40 bg-amber-400/10 text-amber-300">CLAIM OK</Badge>
                ) : check?.simulation === 'revert' ? (
                  <Badge variant="secondary" className="bg-zinc-800 text-zinc-400">sin reclamo</Badge>
                ) : null}
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-zinc-400 hover:text-white" disabled={probing} onClick={() => recheckSaved(a)}>
                    <ScanLine className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    disabled={!canClaim || claiming !== null}
                    className={`h-7 px-2.5 text-xs ${canClaim ? 'btn-aurora text-white' : 'bg-zinc-800 text-zinc-500'}`}
                    onClick={() => claimCustom(a)}
                  >
                    {claiming === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gift className="h-3 w-3" />}
                    Reclamar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-zinc-600 hover:text-red-400" onClick={() => removeCustomAirdrop(a.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
