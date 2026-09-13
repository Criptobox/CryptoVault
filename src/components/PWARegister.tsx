'use client';

import { useEffect } from 'react';

/**
 * Registra el Service Worker para que la app funcione como PWA
 * (instalable en Windows/Android/iOS + modo offline básico).
 */
export function PWARegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    // Solo en producción (en dev el SW interfiere con HMR)
    if (window.location.hostname === 'localhost' && window.location.port === '3000') return;
    const t = setTimeout(() => {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
