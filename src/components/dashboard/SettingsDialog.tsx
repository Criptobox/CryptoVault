'use client';

import { useAppStore, type CurrencyCode } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useState } from 'react';
import { requestNotificationPermission } from '@/lib/notifications';
import { useI18n, CURRENCIES } from '@/lib/i18n';
import { toast } from 'sonner';
import { KeyRound, BellRing, RefreshCw, Coins, Languages, ShieldAlert, Fuel, BookUser, Trash2, RotateCcw } from 'lucide-react';

export function SettingsDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  const watched = useAppStore((s) => s.watchedAddresses);
  const removeWatched = useAppStore((s) => s.removeWatchedAddress);
  const [etherscanKey, setEtherscanKey] = useState(settings.etherscanApiKey);
  const [wcId, setWcId] = useState(settings.walletConnectProjectId);
  const [interval, setIntervalSec] = useState(settings.refreshIntervalSec);
  const { t } = useI18n();

  const handleSave = async () => {
    const desktopChanged = settings.desktopNotifications !== true;
    setSettings({
      etherscanApiKey: etherscanKey.trim(),
      walletConnectProjectId: wcId.trim(),
      refreshIntervalSec: Math.max(30, Number(interval) || 90),
    });
    if (desktopChanged) {
      const granted = await requestNotificationPermission();
      setSettings({ desktopNotifications: granted });
      if (!granted) {
        toast.info(t('settings.noPerm'));
      }
    }
    toast.success(t('settings.saved'));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-emerald-500" /> {t('settings.title')}
          </DialogTitle>
          <DialogDescription
            className="text-zinc-400 [&_b]:text-zinc-200"
            dangerouslySetInnerHTML={{ __html: t('settings.desc') }}
          />
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid gap-2">
            <Label htmlFor="etherscan" className="flex items-center gap-2">
              {t('settings.etherscan')}
              <span className="rounded bg-emerald-950 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">{t('settings.keyBadge')}</span>
            </Label>
            <Input
              id="etherscan"
              type="password"
              placeholder={t('settings.etherscanPh')}
              value={etherscanKey}
              onChange={(e) => setEtherscanKey(e.target.value)}
              className="bg-zinc-950 border-zinc-800"
            />
            <p
              className="text-xs text-zinc-500 [&_a]:text-emerald-500 [&_a]:underline [&_b]:text-zinc-300"
              dangerouslySetInnerHTML={{
                __html: t('settings.etherscanHelp').replace(
                  'etherscan.io/apis',
                  '<a href="https://etherscan.io/apis" target="_blank" rel="noreferrer">etherscan.io/apis</a>',
                ),
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wc">{t('settings.wc')}</Label>
            <Input
              id="wc"
              type="password"
              placeholder={t('settings.wcPh')}
              value={wcId}
              onChange={(e) => setWcId(e.target.value)}
              className="bg-zinc-950 border-zinc-800"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="interval" className="flex items-center gap-2">
                <RefreshCw className="h-3.5 w-3.5" /> {t('settings.interval')}
              </Label>
              <Input
                id="interval"
                type="number"
                min={30}
                max={600}
                value={interval}
                onChange={(e) => setIntervalSec(Number(e.target.value))}
                className="bg-zinc-950 border-zinc-800 w-full"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Coins className="h-3.5 w-3.5 text-champagne" /> {t('settings.currency')}
              </Label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({ currency: e.target.value as CurrencyCode })}
                className="h-9 rounded-md border border-zinc-800 bg-zinc-950 px-3 text-sm text-zinc-200 outline-none"
              >
                {(Object.keys(CURRENCIES) as CurrencyCode[]).map((c) => (
                  <option key={c} value={c}>{CURRENCIES[c].label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-2">
              <Languages className="h-3.5 w-3.5 text-cyan-400" /> {t('settings.language')}
            </Label>
            <div className="flex gap-2">
              {(['es', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setSettings({ lang: l })}
                  className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    settings.lang === l
                      ? 'border-violet-500/50 bg-violet-500/[0.12] text-violet-200'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {l === 'es' ? '🇪🇸 Español' : '🇺🇸 English'}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> {t('settings.hideSpam')}
              </p>
              <p className="text-xs text-zinc-500">{t('settings.hideSpamHelp')}</p>
            </div>
            <Switch
              checked={settings.hideSpam}
              onCheckedChange={(v) => setSettings({ hideSpam: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Fuel className="h-4 w-4 text-emerald-500" /> {t('settings.gasAlerts')}
              </p>
              <p className="text-xs text-zinc-500">{t('settings.gasAlertsHelp')}</p>
            </div>
            <Switch
              checked={settings.gasAlerts}
              onCheckedChange={(v) => setSettings({ gasAlerts: v })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <BellRing className="h-4 w-4 text-emerald-500" /> {t('settings.desktop')}
              </p>
              <p className="text-xs text-zinc-500">{t('settings.desktopHelp')}</p>
            </div>
            <Switch
              checked={settings.desktopNotifications}
              onCheckedChange={async (v) => {
                if (v) {
                  const granted = await requestNotificationPermission();
                  setSettings({ desktopNotifications: granted });
                  if (!granted) toast.error(t('settings.denied'));
                } else {
                  setSettings({ desktopNotifications: false });
                }
              }}
            />
          </div>

          {/* Carteras vigiladas */}
          <div className="grid gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <BookUser className="h-4 w-4 text-violet-400" /> {t('settings.addresses')}
            </p>
            {watched.length === 0 ? (
              <p className="text-xs text-zinc-500">{t('settings.addressesEmpty')}</p>
            ) : (
              <div className="grid gap-1.5">
                {watched.map((w) => (
                  <div key={w.address} className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/60 px-2.5 py-1.5">
                    <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                      {w.label ? `${w.label} · ` : ''}<span className="font-mono text-zinc-500">{w.address.slice(0, 10)}…{w.address.slice(-6)}</span>
                    </span>
                    <button
                      onClick={() => removeWatched(w.address)}
                      aria-label={t('settings.removeAddress')}
                      className="text-zinc-600 transition hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-zinc-800 bg-zinc-900 text-xs"
              onClick={() => window.dispatchEvent(new CustomEvent('cv-open-addressbook'))}
            >
              <BookUser className="h-3.5 w-3.5" /> {t('settings.addAddress')}
            </Button>
          </div>

          {/* Zona de reset */}
          <div className="flex items-center justify-between rounded-lg border border-red-900/40 bg-red-950/20 p-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-red-300">
                <RotateCcw className="h-4 w-4" /> {t('settings.dangerZone')}
              </p>
              <p className="text-xs text-zinc-500">{t('settings.reset')}</p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                try {
                  localStorage.removeItem('cryptovault-store');
                  localStorage.removeItem('cryptovault-custom-tokens');
                  localStorage.removeItem('cv-airdrop-snapshot');
                  localStorage.removeItem('cv-portfolio-history-cache');
                } catch { /* noop */ }
                toast.success(t('settings.resetDone'));
                setTimeout(() => window.location.reload(), 700);
              }}
            >
              {t('settings.reset')}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={handleSave} className="btn-aurora text-white">
            {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
