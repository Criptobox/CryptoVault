'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, erc20Abi, formatUnits, parseAbi } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { CHAINS, getChain, MULTICALL3, type ChainConfig } from '@/config/chains';
import { findKnownToken } from '@/config/tokens';
import { getSpenderName } from '@/config/spenders';
import { fetchApprovalLogs } from '@/lib/api/explorer';
import { useAppStore } from '@/lib/store';
import { useActiveAddress } from '@/hooks/useActiveAddress';

export interface ActiveApproval {
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  decimals: number;
  spender: string;
  spenderName: string | null;
  spenderRisk: 'high' | 'medium' | 'low';
  allowanceRaw: bigint;
  allowanceFormatted: string;
  isUnlimited: boolean;
  txHash?: string;
}

interface ApprovalsResult {
  approvals: ActiveApproval[];
  loading: boolean;
  error?: string;
  needsKey: boolean;
}

/** Límite de aprobaciones a verificar por cadena (evita multicalls gigantes) */
const MAX_CHECKS_PER_CHAIN = 60;

async function fetchChainApprovals(chain: ChainConfig, address: string): Promise<ActiveApproval[]> {
  const logs = await fetchApprovalLogs(chain.id, address);
  if (!logs.length) return [];

  // Deduplicar (token, spender) — nos quedamos con el log más reciente
  const seen = new Map<string, { token: string; spender: string; hash?: string }>();
  for (const log of logs) {
    if (!log.topics || log.topics.length < 3) continue;
    const token = log.address;
    const spender = `0x${log.topics[2]?.slice(26)}`;
    if (!spender || spender === '0x0000000000000000000000000000000000000000') continue;
    seen.set(`${token.toLowerCase()}:${spender.toLowerCase()}`, { token, spender, hash: undefined });
  }

  const pairs = [...seen.values()].slice(0, MAX_CHECKS_PER_CHAIN);

  // Verificar allowance vigente por multicall + decimales del token
  const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chain.id) });
  const owner = address as `0x${string}`;

  const decimalsCalls = await client
    .multicall({
      contracts: pairs.map((p) => ({ address: p.token as `0x${string}`, abi: erc20Abi, functionName: 'decimals' }) as const),
      multicallAddress: MULTICALL3,
      allowFailure: true,
    })
    .catch(() => []);

  const allowanceCalls = await client
    .multicall({
      contracts: pairs.map(
        (p) =>
          ({
            address: p.token as `0x${string}`,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, p.spender as `0x${string}`],
          }) as const,
      ),
      multicallAddress: MULTICALL3,
      allowFailure: true,
    })
    .catch(() => []);

  const symbolCalls = await client
    .multicall({
      contracts: pairs.map((p) => ({ address: p.token as `0x${string}`, abi: erc20Abi, functionName: 'symbol' }) as const),
      multicallAddress: MULTICALL3,
      allowFailure: true,
    })
    .catch(() => []);

  const out: ActiveApproval[] = [];
  pairs.forEach((p, i) => {
    const allowanceRaw = allowanceCalls[i]?.status === 'success' ? (allowanceCalls[i].result as bigint) : null;
    if (!allowanceRaw || allowanceRaw === 0n) return;
    const decRes = decimalsCalls[i];
    const symRes = symbolCalls[i];
    const known = findKnownToken(chain.id, p.token);
    const decimals = known?.decimals ?? (decRes?.status === 'success' ? (decRes.result as number) : 18);
    const symbol = known?.symbol ?? (symRes?.status === 'success' ? (symRes.result as string) : 'TOKEN');
    const spenderInfo = getSpenderName(p.spender);
    const unlimited = allowanceRaw >= 2n ** 255n;
    out.push({
      chainId: chain.id,
      tokenAddress: p.token,
      tokenSymbol: symbol,
      tokenName: known?.name ?? 'Token',
      decimals,
      spender: p.spender,
      spenderName: spenderInfo?.name ?? null,
      spenderRisk: spenderInfo?.risk ?? 'medium',
      allowanceRaw,
      allowanceFormatted: unlimited ? '∞' : formatUnits(allowanceRaw, decimals),
      isUnlimited: unlimited,
    });
  });
  return out;
}

export function useApprovals(enabledChains?: number[]): ApprovalsResult {
  const { address } = useActiveAddress();
  const apiKey = useAppStore((s) => s.settings.etherscanApiKey);
  const chainsToScan = enabledChains && enabledChains.length ? enabledChains : undefined;

  const query = useQuery({
    queryKey: ['approvals', address, chainsToScan?.join(','), !!apiKey],
    enabled: !!address && !!apiKey,
    queryFn: async (): Promise<ActiveApproval[]> => {
      if (!address) return [];
      const chains = chainsToScan?.length
        ? (chainsToScan.map((id) => getChain(id)).filter(Boolean) as ChainConfig[])
        : CHAINS;
      const results: ActiveApproval[] = [];
      const CONCURRENCY = 4;
      let idx = 0;
      async function worker() {
        while (idx < chains.length) {
          const c = chains[idx++];
          const found = await fetchChainApprovals(c, address).catch(() => [] as ActiveApproval[]);
          results.push(...found);
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return results;
    },
    staleTime: 2 * 60_000,
  });

  return {
    approvals: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message,
    needsKey: !apiKey,
  };
}

/** Revoca una aprobación (approve(spender, 0)) */
export async function revokeApproval(
  chainId: number,
  tokenAddress: string,
  spender: string,
  writeContractAsync: (args: {
    address: `0x${string}`;
    abi: typeof erc20Abi;
    functionName: 'approve';
    args: [`0x${string}`, bigint];
  }) => Promise<unknown>,
) {
  return writeContractAsync({
    address: tokenAddress as `0x${string}`,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender as `0x${string}`, 0n],
  });
}

export const revokeAbi = parseAbi(['function approve(address spender, uint256 amount) returns (bool)']);
