'use client';

import { useQuery } from '@tanstack/react-query';
import { createPublicClient, erc721Abi } from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { getChain, type ChainConfig } from '@/config/chains';
import { fetchNftTransfers, type NftTransfer } from '@/lib/api/explorer';
import { useAppStore } from '@/lib/store';
import { useActiveAddress } from '@/hooks/useActiveAddress';

export interface NftItem {
  chainId: number;
  contract: string;
  tokenId: string;
  name: string;
  collection: string;
  symbol: string;
  imageUrl: string | null;
  lastAcquired?: number;
}

interface NftsResult {
  items: NftItem[];
  loading: boolean;
  error?: string;
  needsKey: boolean;
}

const IPFS_GATEWAY = 'https://ipfs.io/ipfs/';

function normalizeUri(uri: string): string {
  if (uri.startsWith('ipfs://')) return IPFS_GATEWAY + uri.replace('ipfs://', '').replace(/^ipfs\//, '');
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.replace('ar://', '')}`;
  return uri;
}

interface NftMeta {
  name?: string;
  image?: string;
  image_url?: string;
  properties?: { name?: string };
}

async function fetchMetadata(uri: string): Promise<NftMeta | null> {
  try {
    const url = normalizeUri(uri);
    if (url.startsWith('data:application/json;base64,')) {
      const b64 = url.split(',')[1];
      return JSON.parse(atob(b64)) as NftMeta;
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return (await res.json()) as NftMeta;
  } catch {
    return null;
  }
}

/** tokenURI del ERC721 con fallback a uri() de ERC1155 */
async function getTokenUris(
  chain: ChainConfig,
  calls: { contract: `0x${string}`; tokenId: bigint }[],
): Promise<(string | null)[]> {
  const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chain.id) });
  const BATCH = 25;
  const out: (string | null)[] = new Array(calls.length).fill(null);
  for (let i = 0; i < calls.length; i += BATCH) {
    const batch = calls.slice(i, i + BATCH);
    const results = await client
      .multicall({
        contracts: batch.map((c) => ({ address: c.contract, abi: erc721Abi, functionName: 'tokenURI', args: [c.tokenId] }) as const),
        allowFailure: true,
      })
      .catch(() => []);
    results.forEach((r, idx) => {
      if (r && r.status === 'success') out[i + idx] = r.result as string;
    });
  }
  return out;
}

async function fetchChainNfts(chain: ChainConfig, address: string): Promise<NftItem[]> {
  const transfers: NftTransfer[] = await fetchNftTransfers(chain.id, address);
  if (!transfers.length) return [];

  // Ingresos (to=user) menos salidas (from=user) por (contrato, tokenId)
  const lower = address.toLowerCase();
  const held = new Map<string, { contract: string; tokenId: string; symbol: string; ts: number }>();
  const key = (c: string, t: string) => `${c.toLowerCase()}:${t}`;
  for (const tx of transfers) {
    const k = key(tx.contractAddress, tx.tokenID);
    if (tx.to?.toLowerCase() === lower) {
      held.set(k, {
        contract: tx.contractAddress,
        tokenId: tx.tokenID,
        symbol: tx.tokenSymbol ?? '',
        ts: parseInt(tx.timeStamp, 10) * 1000,
      });
    } else if (tx.from?.toLowerCase() === lower && held.has(k)) {
      held.delete(k);
    }
  }
  const list = [...held.values()].slice(0, 80);
  if (!list.length) return [];

  // Verificar propiedad actual con ownerOf
  const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chain.id) });
  const ownership = await client
    .multicall({
      contracts: list.map(
        (n) =>
          ({
            address: n.contract as `0x${string}`,
            abi: erc721Abi,
            functionName: 'ownerOf',
            args: [BigInt(n.tokenId)],
          }) as const,
      ),
      allowFailure: true,
    })
    .catch(() => []);

  const owned = list.filter((_, i) => {
    const r = ownership[i];
    return r?.status === 'success' && (r.result as string)?.toLowerCase() === lower;
  });

  // Metadata
  const uris = await getTokenUris(
    chain,
    owned.map((n) => ({ contract: n.contract as `0x${string}`, tokenId: BigInt(n.tokenId) })),
  );

  const items: NftItem[] = [];
  for (let i = 0; i < owned.length; i++) {
    const n = owned[i];
    const meta = uris[i] ? await fetchMetadata(uris[i]!) : null;
    const collectionName = meta?.name && !meta.name.includes('#') && uris[i] ? meta.name : n.symbol || 'Colección';
    // Heurística: si el meta.name es igual al nombre de colección, usa tokenId
    const displayName = meta?.name ?? `${n.symbol || 'NFT'} #${shortenId(n.tokenId)}`;
    items.push({
      chainId: chain.id,
      contract: n.contract,
      tokenId: n.tokenId,
      name: displayName === collectionName ? `${collectionName} #${shortenId(n.tokenId)}` : displayName,
      collection: collectionName,
      symbol: n.symbol,
      imageUrl: meta?.image ?? meta?.image_url ?? null,
      lastAcquired: n.ts,
    });
  }
  return items;
}

function shortenId(id: string): string {
  return id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}

export function useNfts(enabledChains?: number[]): NftsResult {
  const { address } = useActiveAddress();
  const apiKey = useAppStore((s) => s.settings.etherscanApiKey);
  const chainsToScan = enabledChains && enabledChains.length ? enabledChains : undefined;

  const query = useQuery({
    queryKey: ['nfts', address, chainsToScan?.join(','), !!apiKey],
    enabled: !!address && !!apiKey,
    queryFn: async (): Promise<NftItem[]> => {
      if (!address) return [];
      const chains = (chainsToScan ?? undefined)
        ? (chainsToScan!.map((id) => getChain(id)).filter(Boolean) as ChainConfig[])
        : (await import('@/config/chains')).CHAINS;
      const results: NftItem[] = [];
      const CONCURRENCY = 4;
      let idx = 0;
      async function worker() {
        while (idx < chains.length) {
          const c = chains[idx++];
          const items = await fetchChainNfts(c, address).catch(() => [] as NftItem[]);
          results.push(...items);
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return results;
    },
    staleTime: 5 * 60_000,
  });

  return {
    items: query.data ?? [],
    loading: query.isLoading,
    error: query.error?.message,
    needsKey: !apiKey,
  };
}
