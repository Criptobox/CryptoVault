'use client';

import { useState } from 'react';
import { useSyncExternalStore } from 'react';
import { Bell, Settings, BookUser, Sun, Moon, Search, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import { ConnectButton } from '@/components/wallet/ConnectModal';
import { SettingsDialog } from '@/components/dashboard/SettingsDialog';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';
import { PWAInstallButton } from '@/components/dashboard/PWAInstall';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { useI18n, CURRENCIES } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import { timeAgo } from '@/lib/format';

const emptySubscribe = () => () => {};

function BrandMark() {
  return (
    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl" aria-hidden>
      <span
        className="absolute inset-0 rounded-xl opacity-90 sm:rounded-2xl"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7 45%, #06b6d4)' }}
      />
      <span className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/25 to-transparent sm:rounded-2xl" />
      <svg viewBox="0 0 24 24" className="relative h-4.5 w-4.5 sm:h-5 sm:w-5 drop-shadow" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2.5 4.5 7v10L12 21.5 19.5 17V7L12 2.5z" fill="rgba(255,255,255,0.14)" />
        <path d="M4.5 7 12 11.5 19.5 7M12 11.5V21.5" />
      </svg>
    </span>
  );
}

export function Header() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const notifications = useAppStore((s) => s.notifications);
  const currency = useAppStore((s) => s.settings.currency);
  const setSettings = useAppStore((s) => s.setSettings);
  const unread = notifications.filter((n) => !n.read).length;
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();

  const iconBtn =
    'h-8 w-8 rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white sm:h-9 sm:w-9';

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#06050c]/80 backdrop-blur-2xl supports-[backdrop-filter]:bg-[#06050c]/65">
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(139,92,246,0.5), rgba(34,211,238,0.4), transparent)' }}
        aria-hidden
      />
      <div className="mx-auto flex w-full min-w-0 max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <BrandMark />
          <div className="min-w-0 leading-tight">
            <h1 className="flex items-center gap-1.5 font-display text-base font-bold tracking-tight text-zinc-50 sm:gap-2 sm:text-lg">
              <span className="truncate">CryptoVault</span>
              <span className="rounded-md border border-champagne/30 bg-champagne/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-[0.14em] text-champagne">
                Pro
              </span>
            </h1>
            <p className="hidden text-[11px] text-zinc-500 sm:block">{t('header.tagline')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
          {/* Buscador global */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('header.search')}
            title={t('header.search')}
            onClick={() => window.dispatchEvent(new CustomEvent('cv-open-search'))}
            className={iconBtn}
          >
            <Search className="h-4 w-4" />
          </Button>
          {/* Instalar app */}
          <PWAInstallButton />
          {/* Tema claro/oscuro */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('header.theme')}
            title={t('header.theme')}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className={iconBtn}
          >
            {mounted && theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          {/* Carteras vigiladas */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('header.addressBook')}
            title={t('header.addressBook')}
            onClick={() => window.dispatchEvent(new CustomEvent('cv-open-addressbook'))}
            className={iconBtn}
          >
            <BookUser className="h-4 w-4" />
          </Button>
          {/* Selector de moneda */}
          <div className="relative hidden sm:block">
            <select
              aria-label={t('settings.currency')}
              value={currency}
              onChange={(e) => setSettings({ currency: e.target.value as CurrencyCode })}
              className="h-8 cursor-pointer appearance-none rounded-xl border border-white/[0.06] bg-white/[0.03] pl-2.5 pr-6 text-xs font-semibold text-zinc-300 outline-none transition hover:bg-white/[0.07] sm:h-9"
            >
              {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                <option key={c} value={c} className="bg-[#0c0b16] text-zinc-200">
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-zinc-500">▼</span>
          </div>
          {/* Idioma */}
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('settings.language')}
            title={t('settings.language')}
            onClick={() => setSettings({ lang: lang === 'es' ? 'en' : 'es' })}
            className="hidden h-8 gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-2 text-xs font-bold text-zinc-300 hover:bg-white/[0.07] hover:text-white sm:flex sm:h-9"
          >
            <Languages className="h-3.5 w-3.5" />
            {lang.toUpperCase()}
          </Button>
          {/* Notificaciones */}
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('header.notifications')}
            onClick={() => {
              setNotifOpen(true);
              useAppStore.getState().markAllRead();
            }}
            className={`relative ${iconBtn}`}
          >
            <Bell className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-lg shadow-violet-950/50" style={{ background: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' }}>
                {unread}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t('header.settings')}
            onClick={() => setSettingsOpen(true)}
            className={iconBtn}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <ConnectButton />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pb-1.5 text-[11px] text-zinc-600">
        {notifications[0]
          ? t('header.lastEvent', { title: notifications[0].title, time: timeAgo(notifications[0].ts, lang) })
          : t('header.noEvents')}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <NotificationsPanel open={notifOpen} onOpenChange={setNotifOpen} />
    </header>
  );
}
