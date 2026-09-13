'use client';

/**
 * Vigila los precios de las alertas activas y dispara notificaciones
 * cuando se cruza el umbral. Se ejecuta mientras la app esté abierta.
 * Multi-moneda: cada alerta guarda la moneda en la que se definió y los
 * precios se consultan agrupados por moneda (USD/EUR/MXN/ARS/COP).
 */

import { useEffect, useRef } from 'react';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { fireNotification } from '@/lib/notifications';
import { fetchNativePrices, fetchTokenPrices } from '@/lib/api/coingecko';
import { getChain } from '@/config/chains';
import { CURRENCIES } from '@/lib/format';

export function usePriceAlertWatcher() {
  const priceAlerts = useAppStore((s) => s.priceAlerts);
  const triggerPriceAlert = useAppStore((s) => s.triggerPriceAlert);
  const refreshIntervalSec = useAppStore((s) => s.settings.refreshIntervalSec);
  const lastCheck = useRef<number>(0);

  useEffect(() => {
    const active = priceAlerts.filter((a) => !a.triggeredAt);
    if (!active.length) return;

    async function check() {
      const activeNow = useAppStore.getState().priceAlerts.filter((a) => !a.triggeredAt);
      if (!activeNow.length) return;

      // Agrupar alertas por moneda → cada grupo se consulta en su moneda
      const byCurrency = new Map<CurrencyCode, typeof activeNow>();
      for (const a of activeNow) {
        const cur = (a.currency ?? 'usd') as CurrencyCode;
        const arr = byCurrency.get(cur) ?? [];
        arr.push(a);
        byCurrency.set(cur, arr);
      }

      for (const [cur, alerts] of byCurrency) {
        const nativeIds = new Set<string>();
        const meta = new Map<string, typeof alerts>();
        for (const a of alerts) {
          const chain = getChain(a.chainId);
          if (!chain) continue;
          if (a.tokenKey === 'native') {
            nativeIds.add(chain.nativeCgId);
            const k = `native:${chain.nativeCgId}`;
            const arr = meta.get(k) ?? [];
            arr.push(a);
            meta.set(k, arr);
          } else if (chain.cgPlatform) {
            const k = `tok:${chain.cgPlatform}:${a.tokenKey}`;
            const arr = meta.get(k) ?? [];
            arr.push(a);
            meta.set(k, arr);
          }
        }

        const nativePrices = await fetchNativePrices([...nativeIds], cur);
        for (const [k, group] of meta) {
          let price: number | undefined;
          if (k.startsWith('native:')) {
            price = nativePrices[k.split(':')[1]]?.price;
          } else {
            const [, platform, contract] = k.split(':');
            const prices = await fetchTokenPrices(platform, [contract], cur);
            price = prices[contract.toLowerCase()]?.price;
          }
          if (price === undefined) continue;
          const symbol = CURRENCIES[cur]?.symbol ?? '$';
          for (const a of group) {
            const hit = a.direction === 'above' ? price >= a.targetPrice : price <= a.targetPrice;
            if (hit) {
              triggerPriceAlert(a.id);
              fireNotification({
                type: 'price',
                title: `🔔 Alerta de precio: ${a.tokenSymbol}`,
                body: `${a.tokenSymbol} está a ${symbol}${price} (objetivo ${a.direction === 'above' ? '≥' : '≤'} ${symbol}${a.targetPrice})`,
              });
            }
          }
        }
      }
    }

    const intervalMs = Math.max(45, refreshIntervalSec) * 1000;
    const t = setInterval(() => {
      // respetar mínimo 45s entre comprobaciones
      if (Date.now() - lastCheck.current < 45_000) return;
      lastCheck.current = Date.now();
      void check();
    }, intervalMs);
    // Primera comprobación tras 3s
    const first = setTimeout(() => {
      lastCheck.current = Date.now();
      void check();
    }, 3000);
    return () => {
      clearInterval(t);
      clearTimeout(first);
    };
  }, [priceAlerts, triggerPriceAlert, refreshIntervalSec]);
}
