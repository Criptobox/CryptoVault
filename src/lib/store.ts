'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type CurrencyCode = 'usd' | 'eur' | 'mxn' | 'ars' | 'cop';
export type Lang = 'es' | 'en';

export interface AppNotification {
  id: string;
  type: 'price' | 'tx' | 'info' | 'security';
  title: string;
  body: string;
  ts: number;
  read: boolean;
}

export interface PriceAlert {
  id: string;
  chainId: number;
  tokenSymbol: string;
  /** dirección del token o 'native' */
  tokenKey: string;
  targetPrice: number;
  direction: 'above' | 'below';
  /** moneda en la que se definió el objetivo */
  currency: CurrencyCode;
  createdAt: number;
  triggeredAt?: number;
}

export interface Settings {
  etherscanApiKey: string;
  walletConnectProjectId: string;
  refreshIntervalSec: number;
  currency: CurrencyCode;
  lang: Lang;
  desktopNotifications: boolean;
  /** ocultar tokens/NFTs sospechosos de spam (heurística) */
  hideSpam: boolean;
  /** avisar cuando el gas está bajo en Ethereum */
  gasAlerts: boolean;
}

export interface WatchedAddress {
  address: string;
  label: string;
  addedAt: number;
}

export interface CustomAirdropEntry {
  id: string;
  chainId: number;
  address: string;
  name: string;
  addedAt: number;
  lastCheck?: {
    ts: number;
    claimableRaw: string | null; // bigint serializado
    decimals: number;
    claimFn: string | null; // firma sin argumentos lista para reclamar
    simulation: 'ok' | 'revert' | 'unknown';
    revertReason?: string;
    claimableVia?: string | null;
    isClaimed?: boolean | null;
    contractNative?: string | null;
  };
}

interface AppState {
  settings: Settings;
  notifications: AppNotification[];
  priceAlerts: PriceAlert[];
  customAirdrops: CustomAirdropEntry[];
  /** carteras vigiladas en modo lectura */
  watchedAddresses: WatchedAddress[];
  /** dirección activa (modo lectura) — null = usar la cartera conectada */
  activeAddressOverride: string | null;
  /** sumar el total de todas las carteras vigiladas */
  aggregateMode: boolean;
  /** tokens marcados manualmente como spam: "chainId:address" en minúsculas */
  spamTokens: string[];
  setSettings: (s: Partial<Settings>) => void;
  pushNotification: (n: Omit<AppNotification, 'id' | 'ts' | 'read'>) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
  addPriceAlert: (a: Omit<PriceAlert, 'id' | 'createdAt'>) => void;
  removePriceAlert: (id: string) => void;
  triggerPriceAlert: (id: string) => void;
  addCustomAirdrop: (a: CustomAirdropEntry) => void;
  removeCustomAirdrop: (id: string) => void;
  updateCustomAirdropCheck: (id: string, check: CustomAirdropEntry['lastCheck']) => void;
  addWatchedAddress: (a: Omit<WatchedAddress, 'addedAt'>) => void;
  removeWatchedAddress: (address: string) => void;
  setActiveAddress: (address: string | null) => void;
  setAggregateMode: (v: boolean) => void;
  addSpamToken: (key: string) => void;
  removeSpamToken: (key: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      settings: {
        etherscanApiKey: '',
        walletConnectProjectId: '',
        refreshIntervalSec: 90,
        currency: 'usd',
        lang: 'es',
        desktopNotifications: false,
        hideSpam: true,
        gasAlerts: true,
      },
      notifications: [],
      priceAlerts: [],
      customAirdrops: [],
      watchedAddresses: [],
      activeAddressOverride: null,
      aggregateMode: false,
      spamTokens: [],
      setSettings: (s) => set((st) => ({ settings: { ...st.settings, ...s } })),
      pushNotification: (n) =>
        set((st) => ({
          notifications: [
            { ...n, id: crypto.randomUUID(), ts: Date.now(), read: false },
            ...st.notifications,
          ].slice(0, 100),
        })),
      markAllRead: () =>
        set((st) => ({ notifications: st.notifications.map((n) => ({ ...n, read: true })) })),
      clearNotifications: () => set({ notifications: [] }),
      addPriceAlert: (a) =>
        set((st) => ({
          priceAlerts: [
            ...st.priceAlerts,
            { ...a, id: crypto.randomUUID(), createdAt: Date.now() },
          ],
        })),
      removePriceAlert: (id) =>
        set((st) => ({ priceAlerts: st.priceAlerts.filter((a) => a.id !== id) })),
      triggerPriceAlert: (id) =>
        set((st) => ({
          priceAlerts: st.priceAlerts.map((a) =>
            a.id === id ? { ...a, triggeredAt: Date.now() } : a,
          ),
        })),
      addCustomAirdrop: (a) =>
        set((st) => ({
          customAirdrops: [a, ...st.customAirdrops.filter((x) => x.address.toLowerCase() !== a.address.toLowerCase() || x.chainId !== a.chainId)].slice(0, 30),
        })),
      removeCustomAirdrop: (id) =>
        set((st) => ({ customAirdrops: st.customAirdrops.filter((a) => a.id !== id) })),
      updateCustomAirdropCheck: (id, check) =>
        set((st) => ({
          customAirdrops: st.customAirdrops.map((a) => (a.id === id ? { ...a, lastCheck: check } : a)),
        })),
      addWatchedAddress: (a) =>
        set((st) => {
          const next = [
            { ...a, address: a.address.toLowerCase(), addedAt: Date.now() },
            ...st.watchedAddresses.filter((x) => x.address.toLowerCase() !== a.address.toLowerCase()),
          ].slice(0, 12);
          return { watchedAddresses: next };
        }),
      removeWatchedAddress: (address) =>
        set((st) => ({
          watchedAddresses: st.watchedAddresses.filter((x) => x.address.toLowerCase() !== address.toLowerCase()),
          activeAddressOverride:
            st.activeAddressOverride?.toLowerCase() === address.toLowerCase() ? null : st.activeAddressOverride,
        })),
      setActiveAddress: (address) =>
        set({ activeAddressOverride: address ? address.toLowerCase() : null }),
      setAggregateMode: (v) => set({ aggregateMode: v }),
      addSpamToken: (key) =>
        set((st) => ({ spamTokens: [...new Set([key.toLowerCase(), ...st.spamTokens])].slice(0, 500) })),
      removeSpamToken: (key) =>
        set((st) => ({ spamTokens: st.spamTokens.filter((k) => k !== key.toLowerCase()) })),
    }),
    {
      name: 'cryptovault-store',
      version: 2,
      // v1 → v2: conservar datos y rellenar las claves nuevas con defaults
      migrate: (persisted) => persisted as never,
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>;
        return {
          ...current,
          ...p,
          settings: { ...current.settings, ...(p.settings ?? {}) },
          watchedAddresses: p.watchedAddresses ?? current.watchedAddresses,
          activeAddressOverride: p.activeAddressOverride ?? null,
          aggregateMode: p.aggregateMode ?? false,
          spamTokens: p.spamTokens ?? [],
          priceAlerts: (p.priceAlerts ?? []).map((a) => ({ currency: 'usd' as const, ...a })),
        };
      },
    },
  ),
);
