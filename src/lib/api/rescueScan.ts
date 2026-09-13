'use client';

/* ============================================================================
 * ESCÁNER DE FONDOS RESCATABLES — contratos viejos en TODAS las redes
 *
 * Objetivo: dada CUALQUIER dirección (conectada, vigilada o pegada a mano),
 * descubrir automáticamente en todas las redes soportadas los fondos que
 * quedaron atrapados en contratos viejos: farms MasterChef deprecados,
 * pools de staking que cerraron, vaults reemplazados, presales antiguas,
 * vesting olvidados y airdrops sin reclamar — y ofrecer UN BOTÓN para
 * rescatar cada posición.
 *
 * Cómo funciona (por cadena, 5 en paralelo):
 *  1. Historial → contratos con los que interactuó la dirección
 *     (Etherscan V2 con key · Blockscout público · registro curado como base)
 *  2. Sondas de lectura por multicall3 sobre patrones universales de
 *     valor atrapado (balanceOf, userInfo(pid,user), earned, claimable,
 *     withdrawable, deposits, pendingRewards…)
 *  3. Para cada posición con saldo → busca la función de retiro real
 *     (withdraw/withdrawAll/exit/emergencyWithdraw/redeem/unstake/claim…)
 *     y la SIMULA on-chain (eth_call, sin firmar nada) para confirmar que
 *     el rescate funcionaría hoy.
 *  4. Devuelve posiciones con: cadena, contrato, tipo, monto, símbolo y la
 *     función de rescate lista para ejecutar en 1 clic.
 * ==========================================================================*/

import { createPublicClient, decodeFunctionData, encodeFunctionData, formatUnits, keccak256, parseAbi, toHex, type Chain } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { CHAINS, MULTICALL3, getChain } from '@/config/chains';
import { PROTOCOL_CONTRACTS } from '@/config/airdrops';
import { hasExplorerKey, fetchRecentTxs } from '@/lib/api/explorer';
import { extractRevertReason } from '@/lib/api/airdropScan';

/* --------------------------------------------------------------------------
 * Tipos
 * ------------------------------------------------------------------------ */
export type RescueKind = 'farm' | 'staking' | 'rewards' | 'vesting' | 'vault' | 'presale' | 'airdrop' | 'unknown';

export interface RescueFn {
  /** firma completa p.ej. "withdraw(uint256)" */
  sig: string;
  args: unknown[];
  label: string;
}

export interface RescueOpportunity {
  chainId: number;
  contract: string;
  kind: RescueKind;
  /** monto crudo de la posición principal */
  amountRaw: bigint;
  decimals: number | null;
  symbol: string | null;
  /** lectura que reveló el fondo p.ej. "userInfo(3,user)" */
  amountVia: string;
  /** función de rescate simulada con éxito */
  rescueFn: RescueFn | null;
  /** otras funciones de retiro detectadas (respaldo manual) */
  altFns: RescueFn[];
  simulation: 'ok' | 'revert' | 'unknown';
  simError: string | null;
  /** pid de MasterChef si aplica */
  pid: number | null;
}

export interface ScanProgress {
  done: number;
  total: number;
  currentChain?: number;
}

/* --------------------------------------------------------------------------
 * Registro curado de contratos viejos famosos (fallback sin explorador)
 * ------------------------------------------------------------------------ */
const KNOWN_OLD_CONTRACTS: Record<number, { address: string; kind: RescueKind; note: string }[]> = {
  1: [
    { address: '0xc2edad668737f69f8e8bc4e8c0eaca9ebb44b7f', kind: 'farm', note: 'SushiSwap MasterChef v1' },
    { address: '0xef0881ec094557b8e35f79453992778393251f6e', kind: 'farm', note: 'SushiSwap MasterChef v2' },
  ],
  56: [
    { address: '0x73feaa1ee314f8c655e354234017be2193c9e24e', kind: 'farm', note: 'PancakeSwap MasterChef v1' },
    { address: '0xa5f8c5dbd5ffed6f71c05c8b4ca5d76e66116ed8', kind: 'farm', note: 'PancakeSwap MasterChef v2' },
  ],
  137: [
    { address: '0x0769fd68dfb93167989c6f7254cd0d766fb2841f', kind: 'farm', note: 'SushiSwap MiniChef v2' },
  ],
};

/* --------------------------------------------------------------------------
 * Patrones de lectura (montos atrapados) y de escritura (rescate)
 * ------------------------------------------------------------------------ */
const OWNER_READS: { sig: string; kind: RescueKind; weight: number }[] = [
  { sig: 'balanceOf(address)', kind: 'staking', weight: 2 },
  { sig: 'deposits(address)', kind: 'presale', weight: 2 },
  { sig: 'contributions(address)', kind: 'presale', weight: 2 },
  { sig: 'earned(address)', kind: 'rewards', weight: 1 },
  { sig: 'claimable(address)', kind: 'airdrop', weight: 2 },
  { sig: 'withdrawable(address)', kind: 'vesting', weight: 2 },
  { sig: 'pendingReward(address)', kind: 'rewards', weight: 1 },
  { sig: 'pendingRewards(address)', kind: 'rewards', weight: 1 },
  { sig: 'vested(address)', kind: 'vesting', weight: 1 },
  { sig: 'staked(address)', kind: 'staking', weight: 1 },
  { sig: 'getUserStake(address)', kind: 'staking', weight: 1 },
];

/** Funciones de retiro principal (devuelven el capital) */
const WITHDRAW_FNS = [
  { sig: 'withdraw()', label: 'Retirar todo', argless: true },
  { sig: 'withdrawAll()', label: 'Retirar todo', argless: true },
  { sig: 'exit()', label: 'Salir y retirar', argless: true },
  { sig: 'emergencyWithdraw()', label: 'Retiro de emergencia', argless: true },
  { sig: 'unstakeAll()', label: 'Desbloquear todo', argless: true },
  { sig: 'withdraw(uint256)', label: 'Retirar saldo', argless: false },
  { sig: 'redeem(uint256)', label: 'Redimir acciones', argless: false },
  { sig: 'unstake(uint256)', label: 'Desbloquear saldo', argless: false },
];

/** Funciones de reclamo de recompensas */
const CLAIM_FNS = [
  { sig: 'getReward()', label: 'Reclamar recompensas', argless: true },
  { sig: 'claim()', label: 'Reclamar', argless: true },
  { sig: 'claimRewards()', label: 'Reclamar recompensas', argless: true },
  { sig: 'harvest()', label: 'Cosechar', argless: true },
  { sig: 'harvest(uint256)', label: 'Cosechar pool', argless: false },
];

/** Selectores de interés del historial MasterChef: deposit/withdraw con pid */
const CHEF_METHODS = ['deposit', 'withdraw', 'emergencyWithdraw', 'harvest', 'depositAll'];

const READ_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function deposits(address) view returns (uint256)',
  'function contributions(address) view returns (uint256)',
  'function earned(address) view returns (uint256)',
  'function claimable(address) view returns (uint256)',
  'function withdrawable(address) view returns (uint256)',
  'function pendingReward(address) view returns (uint256)',
  'function pendingRewards(address) view returns (uint256)',
  'function vested(address) view returns (uint256)',
  'function staked(address) view returns (uint256)',
  'function getUserStake(address) view returns (uint256)',
  'function userInfo(uint256,address) view returns (uint256 amount, uint256 rewardDebt)',
  'function poolLength() view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
]);

const isContractAddr = (a: string) => /^0x[a-fA-F0-9]{40}$/.test(a ?? '');
const SKIP_ADDRESSES = new Set([
  '0x0000000000000000000000000000000000000000',
  '0x000000000000000000000000000000000000dead',
  MULTICALL3.toLowerCase(),
]);

/* --------------------------------------------------------------------------
 * Historial: contratos candidatos por cadena (3 fuentes en cascada)
 * ------------------------------------------------------------------------ */
interface Candidate {
  address: string;
  kind?: RescueKind;
  pids: number[];
}

interface HistoryTx {
  to: string;
  method?: string;
  input?: string;
  isError?: boolean;
}

async function blockscoutTxs(chainId: number, address: string): Promise<HistoryTx[]> {
  const hosts: Record<number, string> = {
    1: 'https://eth.blockscout.com',
    137: 'https://polygon.blockscout.com',
    10: 'https://optimism.blockscout.com',
    42161: 'https://arbitrum.blockscout.com',
    8453: 'https://base.blockscout.com',
    100: 'https://gnosis.blockscout.com',
    59144: 'https://linea.blockscout.com',
    534352: 'https://scroll.blockscout.com',
    324: 'https://zksync.blockscout.com',
    5000: 'https://explorer.mantle.xyz',
    2222: 'https://kavascan.com',
    1329: 'https://seitrace.com',
    130: 'https://uniscan.xyz',
  };
  const host = hosts[chainId];
  if (!host) return [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(`${host}/api/v2/addresses/${address}/transactions?limit=50`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: { to?: { hash?: string }; method?: string; raw_input?: string; status?: string }[] };
    return (json.items ?? [])
      .filter((i) => i.to?.hash && i.status !== 'error')
      .map((i) => ({ to: i.to!.hash!.toLowerCase(), method: i.method || undefined, input: i.raw_input || undefined }));
  } catch {
    return [];
  }
}

async function historyForChain(chainId: number, address: string): Promise<HistoryTx[]> {
  // 1. Etherscan V2 (si hay key — el historial más completo)
  if (hasExplorerKey()) {
    const txs = await fetchRecentTxs(chainId, address, 100).catch(() => []);
    if (txs.length) {
      return txs
        .filter((t) => !t.isError || t.isError === '0')
        .map((t) => ({
          to: (t.to ?? '').toLowerCase(),
          method: t.functionName?.split('(')[0] || undefined,
          input: (t as unknown as { input?: string }).input || undefined,
        }));
    }
  }
  // 2. Blockscout público
  const bs = await blockscoutTxs(chainId, address);
  if (bs.length) return bs;
  return [];
}

/** Extrae pids de MasterChef desde el input de txs deposit/withdraw */
function extractPids(txs: HistoryTx[]): number[] {
  const pids = new Set<number>();
  for (const tx of txs) {
    if (!tx.method || !CHEF_METHODS.includes(tx.method) || !tx.input || tx.input.length < 10) continue;
    try {
      // deposit(uint256,...) / withdraw(uint256,...) / emergencyWithdraw(uint256)
      const decoded = decodeFunctionData({
        abi: parseAbi(['function deposit(uint256,uint256)', 'function withdraw(uint256,uint256)', 'function emergencyWithdraw(uint256)', 'function harvest(uint256)', 'function depositAll(uint256)']),
        data: tx.input as `0x${string}`,
      });
      const first = decoded.args?.[0];
      if (typeof first === 'bigint') {
        const pid = Number(first);
        if (pid >= 0 && pid < 100_000) pids.add(pid);
      }
    } catch {
      // input no decodificable — ignorar
    }
  }
  return [...pids].slice(0, 6);
}

/* --------------------------------------------------------------------------
 * Utilidades RPC
 * ------------------------------------------------------------------------ */
function clientFor(chainId: number) {
  const chain = getChain(chainId)!;
  return createPublicClient({ chain: chain.viemChain as Chain, transport: publicClientTransport(chainId) });
}

async function trySimulate(
  client: ReturnType<typeof createPublicClient>,
  contract: `0x${string}`,
  from: `0x${string}`,
  data: `0x${string}`,
): Promise<{ ok: boolean; reason: string | null }> {
  try {
    await client.call({ account: from, to: contract, data });
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: extractRevertReason(e) };
  }
}

/* --------------------------------------------------------------------------
 * Escaneo por cadena
 * ------------------------------------------------------------------------ */
async function scanChain(chainId: number, address: string): Promise<RescueOpportunity[]> {
  const client = clientFor(chainId);
  const owner = address as `0x${string}`;

  // ---- 1. Candidatos: historial + registro curado -----------------------
  const txs = await historyForChain(chainId, address).catch(() => []);
  const knownRouters = new Set(PROTOCOL_CONTRACTS.flatMap((p) => p.addresses.map((a) => a.toLowerCase())));
  const userTokens = new Set<string>(); // contratos que son tokens ERC20 puros → excluir
  const byAddr = new Map<string, Candidate>();

  const chefPids = extractPids(txs);
  const chefTargets = new Set<string>();
  for (const tx of txs) {
    if (tx.method && CHEF_METHODS.includes(tx.method) && isContractAddr(tx.to)) chefTargets.add(tx.to);
  }

  for (const tx of txs) {
    const to = tx.to;
    if (!isContractAddr(to) || SKIP_ADDRESSES.has(to) || knownRouters.has(to)) continue;
    const c = byAddr.get(to) ?? { address: to, pids: [] as number[] };
    byAddr.set(to, c);
  }
  // pids del historial → añadir a todos los contratos chef detectados
  for (const addr of chefTargets) {
    const c = byAddr.get(addr);
    if (c) c.pids = chefPids;
  }
  // registro curado como base garantizada (sin explorador también)
  for (const k of KNOWN_OLD_CONTRACTS[chainId] ?? []) {
    const c = byAddr.get(k.address);
    if (c) { c.kind = k.kind; continue; }
    byAddr.set(k.address, { address: k.address, kind: k.kind, pids: k.kind === 'farm' ? [0, 1, 2] : [] });
  }

  let candidates = [...byAddr.values()];
  if (!candidates.length) return [];

  // Prioridad: contratos chef con pids conocidos primero; máx 12 por cadena
  candidates.sort((a, b) => (b.pids.length > 0 ? 1 : 0) - (a.pids.length > 0 ? 1 : 0));
  candidates = candidates.slice(0, 12);

  // ---- 2. Sondas de lectura por multicall -------------------------------
  interface ReadHit { cand: Candidate; sig: string; kind: RescueKind; raw: bigint; pid: number | null }
  const hits: ReadHit[] = [];

  const buildReads = (cand: Candidate) => {
    const calls: { contract: `0x${string}`; functionName: string; args?: unknown[]; sig: string; kind: RescueKind; pid: number | null }[] = [];
    for (const r of OWNER_READS) {
      calls.push({ contract: cand.address as `0x${string}`, functionName: r.sig.split('(')[0], args: [owner], sig: r.sig, kind: r.kind, pid: null });
    }
    for (const pid of cand.pids) {
      calls.push({ contract: cand.address as `0x${string}`, functionName: 'userInfo', args: [BigInt(pid), owner], sig: `userInfo(${pid},user)`, kind: 'farm', pid });
    }
    return calls;
  };

  const BATCH = 5;
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH);
    const flat = batch.flatMap((c) => buildReads(c).map((f) => ({ ...f, candRef: c })));
    const results = await client
      .multicall({
        contracts: flat.map((f) => ({ address: f.contract, abi: READ_ABI, functionName: f.functionName, args: f.args }) as const),
        multicallAddress: MULTICALL3,
        allowFailure: true,
      })
      .catch(() => []);
    flat.forEach((f, idx) => {
      const res = results[idx];
      if (!res || res.status !== 'success') return;
      const v = res.result;
      // userInfo devuelve struct {amount, rewardDebt}
      const raw = typeof v === 'object' && v !== null && 'amount' in (v as Record<string, unknown>) ? (v as { amount: bigint }).amount : (v as bigint);
      if (typeof raw !== 'bigint' || raw <= 0n) return;
      hits.push({ cand: f.candRef, sig: f.sig, kind: f.kind, raw, pid: f.pid });
    });
  }

  if (!hits.length) return [];

  // Deduplicar por contrato (mejor hit por peso: farm > staking > rewards…)
  const weight = (k: RescueKind) => ({ farm: 6, presale: 5, vesting: 4, airdrop: 4, staking: 3, vault: 3, rewards: 2, unknown: 1 }[k]);
  const bestByContract = new Map<string, ReadHit>();
  for (const h of hits) {
    const prev = bestByContract.get(h.cand.address);
    if (!prev || weight(h.kind) > weight(prev.kind) || (weight(h.kind) === weight(prev.kind) && h.raw > prev.raw)) {
      bestByContract.set(h.cand.address, h);
    }
  }

  // ---- 3. Metadatos: decimales y símbolo del contrato -------------------
  const finals = [...bestByContract.values()];
  const metaResults = await client
    .multicall({
      contracts: finals.flatMap((h) => [
        { address: h.cand.address as `0x${string}`, abi: READ_ABI, functionName: 'decimals' } as const,
        { address: h.cand.address as `0x${string}`, abi: READ_ABI, functionName: 'symbol' } as const,
      ]),
      multicallAddress: MULTICALL3,
      allowFailure: true,
    })
    .catch(() => []);

  const out: RescueOpportunity[] = [];
  for (let i = 0; i < finals.length; i++) {
    const h = finals[i];
    const dec = metaResults[i * 2];
    const sym = metaResults[i * 2 + 1];
    const decimals = dec?.status === 'success' ? Number(dec.result) : null;
    const symbol = sym?.status === 'success' ? String(sym.result) : null;

    // ¿Es un token ERC20 puro que el usuario ya ve en su portafolio?
    // (symbol + decimals responden y la única lectura fue balanceOf) →
    // entonces NO es un fondo atrapado: es un token normal y se excluye.
    const plainTokenHolding =
      decimals !== null && symbol !== null && h.sig === 'balanceOf(address)' && h.cand.pids.length === 0;
    if (plainTokenHolding) continue;

    out.push({
      chainId,
      contract: h.cand.address,
      kind: h.kind,
      amountRaw: h.raw,
      decimals,
      symbol,
      amountVia: h.sig,
      rescueFn: null,
      altFns: [],
      simulation: 'unknown',
      simError: null,
      pid: h.pid,
    });
  }

  // ---- 4. Buscar + simular la función de rescate (presupuesto 12/chain) --
  let simBudget = 12;
  for (const op of out) {
    if (simBudget <= 0) break;
    const contract = op.contract as `0x${string}`;
    const fnsToTry: { sig: string; label: string; argless: boolean }[] = [];
    // Principal: capital → retiro; recompensas → claim; también probar claim para farms
    if (op.kind === 'farm' || op.kind === 'staking' || op.kind === 'vault' || op.kind === 'presale' || op.kind === 'vesting') {
      fnsToTry.push(...WITHDRAW_FNS);
      fnsToTry.push(...CLAIM_FNS.slice(0, 2));
    } else {
      fnsToTry.push(...CLAIM_FNS);
      fnsToTry.push(...WITHDRAW_FNS.slice(0, 4));
    }
    // emergencyWithdraw(pid) si hay pid (patrón MasterChef)
    if (op.pid !== null) {
      fnsToTry.unshift({ sig: `emergencyWithdraw(uint256)`, label: 'Retiro de emergencia', argless: false });
      fnsToTry.unshift({ sig: `withdraw(uint256,uint256)`, label: 'Retirar todo (chef)', argless: false });
    }

    const amounts = [op.amountRaw, 2n ** 256n - 1n];
    for (const f of fnsToTry.slice(0, 8)) {
      if (simBudget <= 0) break;
      let simulated = false;
      const name = f.sig.split('(')[0];
      const hasArgs = !f.argless && f.sig.split('(')[1].replace(')', '').split(',').filter(Boolean).length > 0;
      if (!hasArgs) {
        simBudget--;
        const data = `0x${fnSelector(f.sig)}` as `0x${string}`;
        const sim = await trySimulate(client, contract, owner, data);
        if (sim.ok) {
          op.rescueFn = { sig: f.sig, args: [], label: f.label };
          op.simulation = 'ok';
          simulated = true;
        } else {
          op.altFns.push({ sig: f.sig, args: [], label: f.label });
          if (!op.simError && sim.reason) op.simError = sim.reason;
        }
      } else {
        for (const amount of amounts) {
          if (simBudget <= 0) break;
          simBudget--;
          const args: unknown[] =
            f.sig === 'withdraw(uint256,uint256)'
              ? [BigInt(op.pid ?? 0), amount]
              : f.sig === 'emergencyWithdraw(uint256)'
                ? [BigInt(op.pid ?? 0)]
                : [amount];
          try {
            const data = encodeFunctionData({ abi: parseAbi([`function ${f.sig}`] as never), functionName: name, args } as never) as `0x${string}`;
            const sim = await trySimulate(client, contract, owner, data as `0x${string}`);
            if (sim.ok) {
              op.rescueFn = { sig: f.sig, args, label: f.label };
              op.simulation = 'ok';
              simulated = true;
              break;
            }
            op.altFns.push({ sig: f.sig, args, label: f.label });
            if (!op.simError && sim.reason) op.simError = sim.reason;
          } catch {
            // encode falló (args inválidos) — probar siguiente
          }
        }
      }
      if (simulated) break;
    }
    if (!op.rescueFn) op.simulation = op.simError ? 'revert' : 'unknown';
    op.altFns = op.altFns.slice(0, 4);
  }

  return out;
}

/* Keccak selector cacheado */
const selectorCache = new Map<string, string>();
function fnSelector(sig: string): string {
  if (selectorCache.has(sig)) return selectorCache.get(sig)!;
  const sel = keccak256(toHex(sig)).slice(2, 10);
  selectorCache.set(sig, sel);
  return sel;
}

/* --------------------------------------------------------------------------
 * Escaneo completo — todas las redes
 * ------------------------------------------------------------------------ */
export async function scanAllRescuable(
  address: string,
  onProgress?: (p: ScanProgress) => void,
): Promise<RescueOpportunity[]> {
  const chains = CHAINS.map((c) => c.id);
  const total = chains.length;
  let done = 0;
  const results: RescueOpportunity[] = [];

  const CONCURRENCY = 5;
  const queue = [...chains];
  async function worker() {
    while (queue.length) {
      const chainId = queue.shift()!;
      try {
        const ops = await scanChain(chainId, address);
        results.push(...ops);
      } catch {
        // red caída o RPC lento — continuar con las demás
      }
      done++;
      onProgress?.({ done, total, currentChain: chainId });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Orden: listos para rescatar primero, luego por valor relativo
  results.sort((a, b) => {
    const score = (o: RescueOpportunity) => (o.simulation === 'ok' ? 2 : 0) + (o.amountRaw > 0n ? 1 : 0);
    return score(b) - score(a);
  });
  return results;
}

/* --------------------------------------------------------------------------
 * Ejecutar rescate (1 clic) — devuelve el ABI listo para writeContract
 * ------------------------------------------------------------------------ */
export function rescueAbiFor(fn: RescueFn) {
  return parseAbi([`function ${fn.sig}`] as never);
}

export function formatRescueAmount(op: RescueOpportunity): string {
  const dec = op.decimals ?? 18;
  const n = Number(formatUnits(op.amountRaw, dec));
  const txt = n.toLocaleString('es-ES', { maximumFractionDigits: n < 1 ? 6 : 4 });
  const sym = op.symbol ?? (op.kind === 'farm' ? `LP${op.pid !== null ? ` #${op.pid}` : ''}` : 'acciones');
  return `${txt} ${sym}`;
}
