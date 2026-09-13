'use client';

/**
 * Simulación de transacciones antes de firmar.
 * 1) Decodifica calldata estándar (approve/transfer/transferFrom) a lenguaje humano
 * 2) Simula la llamada on-chain con eth_call (viem client.call)
 * 3) Estima el gas y su costo
 * 4) Genera advertencias de seguridad
 */

import {
  createPublicClient,
  decodeFunctionData,
  erc20Abi,
  formatEther,
  formatUnits,
  type Address,
} from 'viem';
import { publicClientTransport } from '@/lib/wagmi';
import { getChain } from '@/config/chains';
import { getSpenderName } from '@/config/spenders';
import { findKnownToken } from '@/config/tokens';
import { fetchNativePrices } from '@/lib/api/coingecko';
import { shortAddress } from '@/lib/format';
import type { CurrencyCode } from '@/lib/store';

export interface TxSpec {
  chainId: number;
  to: string;
  data?: string;
  value?: bigint;
  /** cuenta que firma (para simular con su estado real) */
  from?: string;
  /** líneas humanas alternativas cuando el caller ya decodificó la llamada */
  fallbackLines?: string[];
}

export interface TxPreview {
  lines: string[];
  warnings: string[];
  simulated: 'ok' | 'revert' | 'unknown';
  revertReason?: string;
  gasCostNative: number | null;
  gasCostFiat: number | null;
  nativeSymbol: string;
}

const SELECTORS = {
  approve: '0x095ea7b3',
  transfer: '0xa9059cbb',
  transferFrom: '0x23b872dd',
};

async function tokenSymbol(chainId: number, token: string): Promise<string> {
  const known = findKnownToken(chainId, token);
  if (known) return known.symbol;
  try {
    const chain = getChain(chainId);
    if (!chain) return 'TOKEN';
    const client = createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(chainId) });
    const res = await client.readContract({
      address: token as Address,
      abi: erc20Abi,
      functionName: 'symbol',
    });
    return String(res);
  } catch {
    return 'TOKEN';
  }
}

function isSameAddr(a?: string, b?: string): boolean {
  return !!a && !!b && a.toLowerCase() === b.toLowerCase();
}

export async function simulateTx(spec: TxSpec, currency: CurrencyCode = 'usd'): Promise<TxPreview> {
  const chain = getChain(spec.chainId);
  const warnings: string[] = [];
  const lines: string[] = [];
  const nativeSymbol = chain?.symbol ?? 'ETH';

  let simulated: TxPreview['simulated'] = 'unknown';
  let revertReason: string | undefined;
  let gasCostNative: number | null = null;
  let gasCostFiat: number | null = null;

  const client = chain
    ? createPublicClient({ chain: chain.viemChain, transport: publicClientTransport(spec.chainId) })
    : null;

  // ---------- Decodificación humana ----------
  let decoded: ReturnType<typeof decodeFunctionData<typeof erc20Abi>> | null = null;
  if (spec.data && spec.data.toLowerCase().startsWith('0x') && spec.data.length >= 10) {
    try {
      decoded = decodeFunctionData({ abi: erc20Abi, data: spec.data as `0x${string}` });
    } catch {
      decoded = null;
    }
  }

  if (decoded?.functionName === 'approve') {
    const [spender, amount] = decoded.args as [string, bigint];
    const symbol = await tokenSymbol(spec.chainId, spec.to);
    const spenderInfo = getSpenderName(spender);
    const unlimited = amount >= 2n ** 255n;
    lines.push(
      unlimited
        ? `Aprueba a ${spenderInfo?.name ?? shortAddress(spender, 6)} gastar TODOS tus ${symbol} (aprobación ilimitada)`
        : `Aprueba a ${spenderInfo?.name ?? shortAddress(spender, 6)} gastar ${formatUnits(amount, 18) === '0' ? '0' : 'una cantidad de'} ${symbol}`,
    );
    if (unlimited) warnings.push('Es una aprobación ILIMITADA: el contrato podría gastar todos tus tokens en cualquier momento. Revócala si no reconoces al spender.');
    if (!spenderInfo) warnings.push('Spender no reconocido en nuestra base de contratos conocidos — verifica que sea legítimo antes de firmar.');
  } else if (decoded?.functionName === 'transfer') {
    const [recipient, amount] = decoded.args as [string, bigint];
    const symbol = await tokenSymbol(spec.chainId, spec.to);
    const known = findKnownToken(spec.chainId, spec.to);
    lines.push(`Envía ${formatUnits(amount, known?.decimals ?? 18)} ${symbol} a ${shortAddress(recipient, 6)}`);
    if (isSameAddr(recipient, spec.from)) warnings.push('Estás enviando tokens a tu propia dirección.');
  } else if (decoded?.functionName === 'transferFrom') {
    const [sender, recipient, amount] = decoded.args as [string, string, bigint];
    const symbol = await tokenSymbol(spec.chainId, spec.to);
    lines.push(`Mueve ${formatUnits(amount, 18)} ${symbol} de ${shortAddress(sender, 4)} → ${shortAddress(recipient, 4)}`);
  } else if (spec.fallbackLines?.length) {
    lines.push(...spec.fallbackLines);
  } else {
    lines.push(`Interactúa con el contrato ${shortAddress(spec.to, 6)}${chain ? ` en ${chain.name}` : ''}`);
    if (spec.data && spec.data !== '0x') warnings.push('Llamada a contrato arbitrario: revisa bien lo que firmas en tu cartera.');
  }

  // ---------- Advertencias estructurales ----------
  if (chain && client) {
    const bytecode = await client.getBytecode({ address: spec.to as Address }).catch(() => undefined);
    if (bytecode === '0x' || bytecode === null) {
      if (spec.data && spec.data !== '0x') warnings.push('El destino no es un contrato (sin bytecode) pero se envían datos — posible error.');
    }
    if (isSameAddr(spec.to, spec.from)) warnings.push('El destino es tu propia dirección.');
  }

  // ---------- Simulación eth_call + estimación de gas ----------
  if (client) {
    const account = (spec.from ?? undefined) as Address | undefined;
    if (spec.data || spec.value) {
      const callResult = await client
        .call({
          account,
          to: spec.to as Address,
          data: (spec.data ?? '0x') as `0x${string}`,
          value: spec.value,
        })
        .then(() => 'ok' as const)
        .catch((err: Error & { shortMessage?: string }) => {
          const raw = err.shortMessage || err.message || 'revert';
          revertReason = raw.replace(/\s+/g, ' ').slice(0, 220);
          return 'revert' as const;
        });
      simulated = callResult;
    }
    if (account) {
      const [gas, gasPrice, nativePrices] = await Promise.all([
        client.estimateGas({ account, to: spec.to as Address, data: (spec.data ?? '0x') as `0x${string}`, value: spec.value }).catch(() => null),
        client.getGasPrice().catch(() => null),
        chain ? fetchNativePrices([chain.nativeCgId], currency) : Promise.resolve({} as never),
      ]);
      if (gas && gasPrice) {
        const wei = gas * gasPrice;
        gasCostNative = Number(formatEther(wei));
        const np = nativePrices[chain!.nativeCgId];
        gasCostFiat = np ? gasCostNative * np.price : null;
      }
    }
  }

  if (simulated === 'unknown' && !spec.data && !spec.value) {
    // transferencia vacía rara — nada que simular
    simulated = 'unknown';
  }

  return { lines, warnings, simulated, revertReason, gasCostNative, gasCostFiat, nativeSymbol };
}
