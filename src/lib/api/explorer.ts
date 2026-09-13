'use client';

/**
 * Cliente Etherscan V2 — UNA sola API key sirve para TODAS las cadenas EVM
 * vía el parámetro chainid. Obtenla gratis en https://etherscan.io/apis
 */

import { getChain } from '@/config/chains';

const V2 = 'https://api.etherscan.io/v2/api';

function getKey(): string {
  if (typeof window === 'undefined') return '';
  const raw = localStorage.getItem('cryptovault-store');
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return parsed?.state?.settings?.etherscanApiKey ?? '';
  } catch {
    return '';
  }
}

export function hasExplorerKey(): boolean {
  return getKey().length > 10;
}

export interface ExplorerResult<T> {
  ok: boolean;
  data: T | null;
  error?: string;
}

async function call<T>(chainId: number, params: Record<string, string>): Promise<ExplorerResult<T>> {
  const key = getKey();
  if (!key) return { ok: false, data: null, error: 'Sin API key de explorador' };
  const chain = getChain(chainId);
  if (!chain) return { ok: false, data: null, error: 'Cadena no soportada' };
  const qs = new URLSearchParams({
    chainid: String(chain.explorerChainId),
    apikey: key,
    ...params,
  });
  try {
    const res = await fetch(`${V2}?${qs.toString()}`);
    if (!res.ok) return { ok: false, data: null, error: `HTTP ${res.status}` };
    const json = (await res.json()) as { status: string; message: string; result: T };
    if (json.status === '0' && json.message !== 'No transactions found' && json.message !== 'No token transfers found') {
      // algunos exploradores devuelven status 0 con resultados vacíos válidos
      const r = json.result as unknown;
      if (Array.isArray(r) && r.length === 0) return { ok: true, data: json.result };
      return { ok: false, data: null, error: json.result ? String(json.result) : json.message };
    }
    return { ok: true, data: json.result };
  } catch (e) {
    return { ok: false, data: null, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

export interface TokenTx {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
}

/** Todos los transfers de tokens (ERC20) de una dirección → descubre TODOS los tokens */
export async function fetchTokenTransfers(chainId: number, address: string): Promise<TokenTx[]> {
  const r = await call<TokenTx[]>(chainId, {
    module: 'account',
    action: 'tokentx',
    address,
    page: '1',
    offset: '10000',
    sort: 'desc',
  });
  return r.data ?? [];
}

export interface NftTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  from: string;
  contractAddress: string;
  to: string;
  tokenID: string;
  tokenName: string;
  tokenSymbol: string;
}

/** Transfers ERC-721 de una dirección → descubre NFTs poseídos */
export async function fetchNftTransfers(chainId: number, address: string): Promise<NftTransfer[]> {
  const r = await call<NftTransfer[]>(chainId, {
    module: 'account',
    action: 'tokennfttx',
    address,
    page: '1',
    offset: '5000',
    sort: 'desc',
  });
  return r.data ?? [];
}

export interface ApprovalLog {
  address: string; // contrato del token
  topics: string[];
  data: string;
  blockNumber: string;
  timeStamp: string;
}

/**
 * Escanea eventos Approval(owner=user) en TODA la red para descubrir
 * aprobaciones ERC20 activas. topic1 = owner (indexado), topic2 = spender.
 */
export async function fetchApprovalLogs(
  chainId: number,
  ownerAddress: string,
): Promise<ApprovalLog[]> {
  const ownerTopic = `0x000000000000000000000000${ownerAddress.replace(/^0x/i, '').toLowerCase()}`;
  // keccak256("Approval(address,address,uint256)") = 0x8c5be1...c3b925
  const approvalTopic = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
  const r = await call<ApprovalLog[]>(chainId, {
    module: 'logs',
    action: 'getLogs',
    fromBlock: '0',
    toBlock: 'latest',
    topic0: approvalTopic,
    topic1: ownerTopic,
  });
  return r.data ?? [];
}

export interface ContractABIResult {
  abi: string;
  implementation?: string;
}

/** ABI de un contrato verificado */
export async function fetchContractAbi(chainId: number, address: string): Promise<ExplorerResult<string>> {
  return call<string>(chainId, {
    module: 'contract',
    action: 'getabi',
    address,
  });
}

export interface SimpleTx {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  gasUsed: string;
  functionName?: string;
  isError?: string;
}

/** Últimas transacciones de una dirección (para detectar contratos viejos) */
export async function fetchRecentTxs(chainId: number, address: string, limit = 100): Promise<SimpleTx[]> {
  const r = await call<SimpleTx[]>(chainId, {
    module: 'account',
    action: 'txlist',
    address,
    page: '1',
    offset: String(limit),
    sort: 'desc',
  });
  return r.data ?? [];
}
