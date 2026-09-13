'use client';

/**
 * i18n ligero ES/EN — sin rutas ni provider pesado.
 * - `useI18n()` en componentes React
 * - `t()` module-level para hooks/funciones fuera de React
 */

import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useAppStore } from '@/lib/store';
import { DICT } from '@/lib/i18n-dict';
import { CURRENCIES, fmtMoney as money } from '@/lib/format';

export type { Lang } from '@/lib/store';

let currentLang: 'es' | 'en' = 'es';

/** Traducción con interpolación: reemplaza {n} en la cadena por el valor dado. */
function translate(key: string, params?: Record<string, string | number>, lang?: 'es' | 'en'): string {
  const l = lang ?? currentLang;
  const raw = DICT[l]?.[key] ?? DICT.es[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

/** Traducción fuera de React (hooks, utils) */
export function t(key: string, params?: Record<string, string | number>): string {
  return translate(key, params);
}

interface I18nCtx {
  lang: 'es' | 'en';
  t: (key: string, params?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx>({ lang: 'es', t: translate });

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useAppStore((s) => s.settings.lang);

  useEffect(() => {
    // sincroniza la variable module-level para t() fuera de React (hooks/utils)
    currentLang = lang;
    document.documentElement.lang = lang;
  }, [lang]);

  return <Ctx.Provider value={{ lang, t: (key: string, params?: Record<string, string | number>) => translate(key, params, lang) }}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  return useContext(Ctx);
}

/** Hook de formato monetario ligado a la moneda de Ajustes */
export function useFmt() {
  const currency = useAppStore((s) => s.settings.currency);
  const lang = useAppStore((s) => s.settings.lang);
  return {
    currency,
    lang,
    money: (v: number | null | undefined, maxFrac = 2) => money(v, currency, maxFrac),
  };
}

export { CURRENCIES };
