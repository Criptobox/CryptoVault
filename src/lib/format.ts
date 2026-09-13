/** Utilidades de formato (multi-moneda) */
import type { CurrencyCode } from '@/lib/store';

export const CURRENCIES: Record<
  CurrencyCode,
  { label: string; symbol: string; intl: string; locale: string }
> = {
  usd: { label: 'USD · Dólar', symbol: '$', intl: 'USD', locale: 'en-US' },
  eur: { label: 'EUR · Euro', symbol: '€', intl: 'EUR', locale: 'es-ES' },
  mxn: { label: 'MXN · Peso mexicano', symbol: 'MX$', intl: 'MXN', locale: 'es-MX' },
  ars: { label: 'ARS · Peso argentino', symbol: 'AR$', intl: 'ARS', locale: 'es-AR' },
  cop: { label: 'COP · Peso colombiano', symbol: 'CO$', intl: 'COP', locale: 'es-CO' },
};

/** Formatea un valor monetario en la moneda indicada */
export function fmtMoney(
  value: number | null | undefined,
  currency: CurrencyCode = 'usd',
  maxFrac = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const c = CURRENCIES[currency] ?? CURRENCIES.usd;
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return `${c.symbol}${value.toExponential(2)}`;
  return value.toLocaleString(c.locale, {
    style: 'currency',
    currency: c.intl,
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: abs >= 1000 ? 0 : 2,
  });
}

/** Legado: formato USD (usado por componentes aún no migrados) */
export function fmtUsd(value: number | null | undefined, maxFrac = 2): string {
  return fmtMoney(value, 'usd', maxFrac);
}

export function fmtTokenAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const abs = Math.abs(value);
  if (abs === 0) return '0';
  if (abs < 0.0001) return value.toExponential(2);
  if (abs < 1) return value.toPrecision(4);
  if (abs < 1000) return value.toLocaleString('es-ES', { maximumFractionDigits: 4 });
  if (abs < 1_000_000) return value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
  return `${(value / 1_000_000).toLocaleString('es-ES', { maximumFractionDigits: 2 })}M`;
}

export function shortAddress(addr: string, size = 4): string {
  if (!addr) return '';
  return `${addr.slice(0, size + 2)}…${addr.slice(-size)}`;
}

export function timeAgo(ts: number, lang: 'es' | 'en' = 'es'): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (lang === 'en') {
    if (m < 1) return 'now';
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} h ago`;
    return `${Math.floor(h / 24)} d ago`;
  }
  if (m < 1) return 'ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export function isAddressValid(addr: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(addr);
}
