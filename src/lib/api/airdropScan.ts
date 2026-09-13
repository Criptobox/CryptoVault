'use client';

/* ============================================================================
 * ESCÁNER DE ACTIVIDAD ON-CHAIN PARA EL RADAR DE AIRDROPS
 *
 * 1. Recoge estadísticas reales de la cartera SIN necesidad de API key:
 *    - Blockscout V2 público (counters + muestra de transacciones)
 *    - Fallback: Etherscan V2 si el usuario configuró su API key
 * 2. Verificador de airdrops personalizados: sondea contratos de claim
 *    arbitrarios (claimable(address), isClaimed, simulación de claim…)
 *    directamente contra el RPC de la red.
 * ==========================================================================*/

import { createPublicClient, keccak256, toHex, pad, formatUnits, type Chain } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { getChain } from '@/config/chains';
import { PROTOCOL_CONTRACTS, type WalletStats, type ChainStats } from '@/config/airdrops';

/* --------------------------------------------------------------------------
 * Hosts Blockscout V2 públicos (sin API key, CORS abierto)
 * ------------------------------------------------------------------------ */
const BLOCKSCOUT: Record<number, string> = {
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

function explorerKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = localStorage.getItem('cryptovault-store');
    return raw ? (JSON.parse(raw)?.state?.settings?.etherscanApiKey ?? '') : '';
  } catch {
    return '';
  }
}

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T | null> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/* --------------------------------------------------------------------------
 * Etherscan V2 (fallback con API key del usuario)
 * ------------------------------------------------------------------------ */
interface EsTx { timeStamp: string; to: string; isError?: string }

async function esTxs(chainId: number, address: string, sort: 'asc' | 'desc', offset: number): Promise<EsTx[]> {
  const key = explorerKey();
  const chain = getChain(chainId);
  if (!key || !chain) return [];
  const qs = new URLSearchParams({
    chainid: String(chain.explorerChainId),
    module: 'account',
    action: 'txlist',
    address,
    page: '1',
    offset: String(offset),
    sort,
    apikey: key,
  });
  const json = await fetchJson<{ status: string; result: EsTx[] }>(`https://api.etherscan.io/v2/api?${qs}`);
  if (!json || json.status === '0' || !Array.isArray(json.result)) return [];
  return json.result;
}

/* --------------------------------------------------------------------------
 * Actividad por cadena — Blockscout primero, Etherscan como respaldo
 * ------------------------------------------------------------------------ */
interface BsTx { hash: string; to: { hash: string } | null }

async function fetchChainStats(chainId: number, address: string): Promise<ChainStats | null> {
  const host = BLOCKSCOUT[chainId];
  const lower = address.toLowerCase();

  if (host) {
    const counters = await fetchJson<{ transactions_count: string }>(
      `${host}/api/v2/addresses/${address}/counters`,
    );
    const txsPage = await fetchJson<{ items: BsTx[] }>(
      `${host}/api/v2/addresses/${address}/transactions?limit=50`,
    );
    const txCount = counters ? parseInt(counters.transactions_count ?? '0', 10) : 0;
    const sample = (txsPage?.items ?? [])
      .map((t) => t.to?.hash?.toLowerCase())
      .filter((h): h is string => !!h);
    if (txCount > 0 || sample.length > 0) {
      return { txs: txCount || sample.length, firstTxTs: null, sampleContracts: [...new Set(sample)] };
    }
    // Blockscout respondió pero sin actividad → probablemente 0 txs
    if (counters) return { txs: 0, firstTxTs: null, sampleContracts: [] };
  }

  // Fallback Etherscan V2 (requiere API key)
  const key = explorerKey();
  if (key) {
    const recent = await esTxs(chainId, address, 'desc', 50);
    const sample = [...new Set(recent.filter((t) => !t.isError || t.isError === '0').map((t) => (t.to ?? '').toLowerCase()).filter(Boolean))];
    const first = await esTxs(chainId, address, 'asc', 1);
    const firstTxTs = first[0] ? parseInt(first[0].timeStamp, 10) * 1000 : null;
    if (recent.length > 0 || firstTxTs) {
      return { txs: recent.length >= 50 ? 50 : recent.length, firstTxTs, sampleContracts: sample };
    }
    void lower;
  }

  // Último recurso SIN explorador: nonce RPC = nº de txs salientes.
  // Así TODAS las redes soportadas aportan actividad al radar, incluso sin
  // Blockscout ni API key.
  const chain = getChain(chainId);
  if (chain) {
    try {
      const client = createPublicClient({ chain: chain.viemChain as Chain, transport: publicClientTransport(chainId) });
      const nonce = await client.getTransactionCount({ address: address as `0x${string}` });
      return { txs: nonce, firstTxTs: null, sampleContracts: [] };
    } catch {
      return null;
    }
  }
  return null;
}

/** Antigüedad de la cartera: primera tx conocida en mainnet (aprox global) */
async function fetchWalletAge(address: string): Promise<number | null> {
  const key = explorerKey();
  if (key) {
    const first = await esTxs(1, address, 'asc', 1);
    if (first[0]) {
      const ts = parseInt(first[0].timeStamp, 10) * 1000;
      return Math.floor((Date.now() - ts) / 86_400_000);
    }
  }
  const host = BLOCKSCOUT[1];
  if (host) {
    // Blockscout no permite sort asc; obtenemos la última página conocida vía contadores no sirve. Sin edad exacta.
    return null;
  }
  return null;
}

/** Recopila estadísticas globales de la cartera para el radar */
export async function collectWalletStats(address: string, chainIds: number[]): Promise<WalletStats> {
  const stats: WalletStats = {
    address,
    ageDays: null,
    chains: {},
    protocolHits: {},
    chainsActive: 0,
    partial: false,
  };

  const CONCURRENCY = 4;
  const queue = [...chainIds];
  let idx = 0;
  async function worker() {
    while (idx < queue.length) {
      const chainId = queue[idx++];
      const s = await fetchChainStats(chainId, address).catch(() => null);
      if (s) {
        stats.chains[chainId] = s;
        if (s.txs > 0) stats.chainsActive += 1;
        for (const c of s.sampleContracts) {
          for (const p of PROTOCOL_CONTRACTS) {
            if (p.addresses.includes(c)) {
              stats.protocolHits[p.name] = (stats.protocolHits[p.name] ?? 0) + 1;
            }
          }
        }
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  stats.ageDays = await fetchWalletAge(address);
  stats.partial = stats.ageDays === null;
  return stats;
}

/* --------------------------------------------------------------------------
 * Verificador de airdrops personalizados (cualquier contrato de claim)
 * ------------------------------------------------------------------------ */
export interface ClaimProbe {
  /** Monto reclamable legible vía view (bigint crudo) */
  claimableRaw: bigint | null;
  claimableVia: string | null;
  /** ¿Ya reclamó el usuario? (null = no se pudo saber) */
  isClaimed: boolean | null;
  claimedVia: string | null;
  /** Función de claim sin argumentos detectada y simulada con éxito */
  zeroArgFn: string | null;
  simulation: 'ok' | 'revert' | 'unknown';
  revertReason: string | null;
  /** Saldo nativo retenido por el contrato */
  contractNative: string | null;
  /** ABI verificado en el explorador (si hay API key) */
  sourceVerified: boolean | null;
}

const READ_UINT = [
  'claimable(address)',
  'withdrawable(address)',
  'checkClaim(address)',
  'claimableAmount(address)',
  'amounts(address)',
  'allocations(address)',
  'dropped(address)',
  'merkleDrops(address)',
];
const READ_BOOL = ['isClaimed(address)', 'hasClaimed(address)', 'alreadyClaimed(address)', 'redeemed(address)'];
const ZERO_ARG_WRITES = ['claim()', 'claimRewards()', 'getReward()', 'harvest()', 'withdraw()'];

export function extractRevertReason(err: unknown): string | null {
  const short = (err as { shortMessage?: string })?.shortMessage ?? '';
  const msg = err instanceof Error ? `${short} ${err.message}` : String(err);
  const m =
    msg.match(/reverted with reason string ['"]([^'"]+)['"]/i) ??
    msg.match(/execution reverted(?::\s*([^.]+))?/i) ??
    msg.match(/revert:\s*([^.]+)/i);
  if (!m) return null;
  return (m[1] ?? 'sin razón explícita').trim().slice(0, 120);
}

/* Selector de función de 4 bytes + padding de dirección (calldata manual) */
const selector = (sig: string): `0x${string}` => keccak256(toHex(sig)).slice(0, 10) as `0x${string}`;
const padAddress = (addr: string) => pad(addr as `0x${string}`, { size: 32 }).slice(2);

async function tryReadUint(client: ReturnType<typeof createPublicClient>, contract: `0x${string}`, owner: `0x${string}`, sig: string): Promise<bigint | null> {
  try {
    const data = `${selector(sig)}${padAddress(owner)}` as `0x${string}`;
    const res = await client.call({ to: contract, data });
    if (!res.data || res.data.length < 66) return null;
    const val = BigInt(res.data);
    return val >= 0n ? val : null;
  } catch {
    return null;
  }
}

async function tryReadBool(client: ReturnType<typeof createPublicClient>, contract: `0x${string}`, owner: `0x${string}`, sig: string): Promise<boolean | null> {
  try {
    const data = `${selector(sig)}${padAddress(owner)}` as `0x${string}`;
    const res = await client.call({ to: contract, data });
    if (!res.data || res.data.length < 66) return null;
    return BigInt(res.data) === 1n;
  } catch {
    return null;
  }
}

async function trySimulate(client: ReturnType<typeof createPublicClient>, contract: `0x${string}`, owner: `0x${string}`, sig: string): Promise<{ ok: boolean; reason: string | null }> {
  try {
    await client.call({ account: owner, to: contract, data: selector(sig) });
    return { ok: true, reason: null };
  } catch (e) {
    return { ok: false, reason: extractRevertReason(e) };
  }
}

/**
 * Sondea un contrato de airdrop arbitrario: funciones view de monto,
 * flags de ya-reclamado, saldo del contrato y simulación del claim.
 * Todo es LECTURA — ninguna transacción se firma aquí.
 */
export async function probeClaimContract(chainId: number, contract: string, owner: string): Promise<ClaimProbe> {
  const chain = getChain(chainId);
  if (!chain) throw new Error('Cadena no soportada');
  const client = createPublicClient({ chain: chain.viemChain as Chain, transport: publicClientTransport(chainId) });
  const c = contract as `0x${string}`;
  const o = owner as `0x${string}`;

  const probe: ClaimProbe = {
    claimableRaw: null,
    claimableVia: null,
    isClaimed: null,
    claimedVia: null,
    zeroArgFn: null,
    simulation: 'unknown',
    revertReason: null,
    contractNative: null,
    sourceVerified: null,
  };

  // 1. Monto reclamable vía view
  for (const sig of READ_UINT) {
    const raw = await tryReadUint(client, c, o, sig);
    if (raw !== null && raw > 0n) {
      probe.claimableRaw = raw;
      probe.claimableVia = sig;
      break;
    }
  }

  // 2. ¿Ya reclamado?
  for (const sig of READ_BOOL) {
    const v = await tryReadBool(client, c, o, sig);
    if (v !== null) {
      probe.isClaimed = v;
      probe.claimedVia = sig;
      break;
    }
  }

  // 3. Simulación de claim sin argumentos (eternal call, nunca firma)
  for (const sig of ZERO_ARG_WRITES) {
    const sim = await trySimulate(client, c, o, sig);
    if (sim.ok) {
      probe.zeroArgFn = sig;
      probe.simulation = 'ok';
      break;
    }
    // Guardamos la primera razón de revert conocida para diagnóstico
    if (!probe.revertReason && sim.reason) {
      probe.revertReason = sim.reason;
      probe.simulation = 'revert';
    }
  }
  if (probe.zeroArgFn) probe.revertReason = null;

  // 4. Saldo nativo del contrato
  const bal = await client.getBalance({ address: c }).catch(() => null);
  probe.contractNative = bal !== null ? formatUnits(bal, 18) : null;

  return probe;
}

/** Formatea un monto crudo de claim asumiendo 18 decimales (o los dados) */
export function formatClaimAmount(raw: bigint, decimals = 18, symbol = ''): string {
  const n = Number(formatUnits(raw, decimals));
  const formatted = n.toLocaleString('es-ES', { maximumFractionDigits: n < 1 ? 6 : 4 });
  return symbol ? `${formatted} ${symbol}` : formatted;
}
