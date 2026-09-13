'use client';

import { useState } from 'react';
import { getChain } from '@/config/chains';
import { cn } from '@/lib/utils';

/**
 * Logo REAL de cada red (imágenes oficiales de Trustwallet en /public/chains)
 * sobre un halo radial del color de la marca. Si una red no tiene imagen,
 * cae elegantemente a su SVG inline refinado.
 */
export function ChainLogo({ chainId, className }: { chainId: number; className?: string }) {
  const chain = getChain(chainId);
  const logoId = chain?.logo ?? 'generic';
  const color = chain?.color ?? '#888';
  const [imgFailed, setImgFailed] = useState(false);
  const hasReal = !imgFailed && REAL_LOGOS.has(logoId);

  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden logo-halo',
        className,
      )}
      style={{
        background: `radial-gradient(circle at 32% 28%, ${color}2e, ${color}14 55%, rgba(255,255,255,0.03) 100%)`,
        boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 1px rgba(255,255,255,0.14), 0 2px 10px -2px ${color}44`,
      }}
      aria-label={chain?.name ?? 'Red desconocida'}
      title={chain?.name}
    >
      {hasReal ? (
        <img
          src={`/chains/${logoId}.png`}
          alt=""
          loading="lazy"
          className="h-full w-full object-contain p-[8%]"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <ChainSvg id={logoId} color={color} />
      )}
    </span>
  );
}

/** Redes con logo oficial descargado en /public/chains */
const REAL_LOGOS = new Set([
  'eth', 'bsc', 'polygon', 'arbitrum', 'base', 'optimism', 'avalanche',
  'opbnb', 'fantom', 'zksync', 'linea', 'scroll', 'gnosis', 'mantle',
  'cronos', 'moonbeam', 'kava', 'celo', 'sei',
]);

/** SVGs refinados de respaldo (redes sin logo oficial disponible) */
function ChainSvg({ id, color }: { id: string; color: string }) {
  const size = '100%';
  switch (id) {
    case 'eth':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <path fill={color} d="M12 2L5.5 12.2 12 16l6.5-3.8L12 2z" />
          <path fill={color} opacity="0.65" d="M12 17.4L5.5 13.6 12 22l6.5-8.4-6.5 3.8z" />
        </svg>
      );
    case 'bsc':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <path fill={color} d="M12 4l2.4 2.4L12 8.8 9.6 6.4 12 4zM5.9 10L8.3 12.4 5.9 14.8 3.5 12.4 5.9 10zm12.2 0l2.4 2.4-2.4 2.4-2.4-2.4 2.4-2.4zM12 15.2l2.4 2.4L12 20l-2.4-2.4 2.4-2.4zM12 9.5l2.9 2.9-2.9 2.9-2.9-2.9 2.9-2.9z" />
        </svg>
      );
    case 'canto':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <circle cx="12" cy="12" r="9.5" fill={color} opacity="0.16" />
          <path fill={color} d="M12 4l7 8-7 8-7-8 7-8zm0 2.3L7.2 12l4.8 5.7 4.8-5.7L12 6.3z" />
        </svg>
      );
    case 'core':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <circle cx="12" cy="12" r="9.5" fill={color} opacity="0.2" />
          <circle cx="12" cy="12" r="5.5" fill="none" stroke={color} strokeWidth="2" />
          <circle cx="12" cy="12" r="1.8" fill={color} />
        </svg>
      );
    case 'unichain':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <circle cx="12" cy="12" r="9.5" fill="#F50DB4" opacity="0.2" />
          <circle cx="12" cy="12" r="7" fill="none" stroke="#F50DB4" strokeWidth="1.6" />
          <circle cx="12" cy="12" r="2.4" fill="#F50DB4" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
          <circle cx="12" cy="12" r="10" fill={color} opacity="0.3" />
          <circle cx="12" cy="12" r="4" fill={color} />
        </svg>
      );
  }
}

/** Icono de token: imagen remota con fallback premium a iniciales */
export function TokenIcon({
  imageUrl,
  symbol,
  className,
}: {
  imageUrl?: string | null;
  symbol: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative inline-flex items-center justify-center shrink-0 overflow-hidden rounded-full',
        className,
      )}
      style={{
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.09), inset 0 1px 1px rgba(255,255,255,0.12), 0 2px 8px -2px rgba(0,0,0,0.55)',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={symbol}
          loading="lazy"
          className="h-full w-full rounded-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : null}
      {!imageUrl && (
        <span
          className="flex h-full w-full items-center justify-center text-[0.6rem] font-bold text-white/95"
          style={{
            background: 'linear-gradient(135deg, rgba(139,92,246,0.85), rgba(34,211,238,0.75))',
          }}
        >
          {symbol.replace(/[^\w]/g, '').slice(0, 4).toUpperCase()}
        </span>
      )}
    </span>
  );
}
