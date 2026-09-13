'use client';

/**
 * Filtro anti-spam heurístico para tokens y NFTs.
 * Detecta los patrones más comunes de airdrop scam: enlaces en el nombre,
 * "claim", "visit", "reward", símbolos raros, etc.
 */

const STRONG_PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\.[a-z0-9-]+\.(com|net|io|xyz|org|cc|site|online|vip|me|app)/i,
  /\b(visit|claim\s*at|claim\s*now|go\s*to|check\s*|verify\s*at)\b/i,
  /\.(com|xyz|io|cc|site|online|vip|app|link)\b/i,
];

const WEAK_PATTERNS: RegExp[] = [
  /\b(airdrop|reward|gift|prize|bonus|cash|free|win|winner|claim)\b/i,
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u, // emojis en el nombre
];

const STABLE_SYMBOLS = new Set([
  'USDT', 'USDC', 'DAI', 'BUSD', 'TUSD', 'FDUSD', 'USDP', 'USDE', 'PYUSD', 'USDS',
  'WETH', 'WMATIC', 'WAVAX', 'WFTM', 'WBNB', 'WBTC', 'STETH', 'WSTETH', 'RETH', 'CBETH',
]);

export interface SpamCandidate {
  symbol?: string;
  name?: string;
  collection?: string;
  price?: number | null;
  usdValue?: number | null;
}

export function isSpamTextStrong(s: string): boolean {
  if (!s) return false;
  return STRONG_PATTERNS.some((re) => re.test(s));
}

function isSpamTextWeak(s: string): boolean {
  if (!s) return false;
  return WEAK_PATTERNS.some((re) => re.test(s));
}

/** Token ERC-20: heurística combinada. Los estables/wraps conocidos nunca son spam. */
export function isSpamToken(t: SpamCandidate): boolean {
  const symbol = (t.symbol ?? '').trim();
  const name = (t.name ?? '').trim();
  if (!symbol && !name) return true;
  if (STABLE_SYMBOLS.has(symbol.toUpperCase())) return false;

  // Señales fuertes: URL o llamadas a "visitar/afirmar" — spam casi seguro
  if (isSpamTextStrong(symbol) || isSpamTextStrong(name)) return true;

  const noValue = (t.usdValue ?? 0) < 0.5 && (t.price == null || t.price < 0.005);
  // Señales débiles solo si además no tiene valor (tokens regaleados por scammers)
  if (noValue && (isSpamTextWeak(symbol) || isSpamTextWeak(name))) return true;

  // Símbolo larguísimo con mezcla rara de mayúsculas/dígitos
  if (noValue && symbol.length >= 16 && /[A-Z]/.test(symbol) && /\d/.test(symbol)) return true;

  return false;
}

/** NFT: colecciones con enlaces o nombres vacíos sin valor claro */
export function isSpamNft(n: { name?: string; collection?: string; symbol?: string }): boolean {
  const name = (n.name ?? '').trim();
  const collection = (n.collection ?? '').trim();
  if (isSpamTextStrong(name) || isSpamTextStrong(collection)) return true;
  if (!name && !collection) return true;
  if (isSpamTextWeak(collection) && !name) return true;
  return false;
}
