'use client';

import { useMemo, useState } from 'react';
import { usePortfolio, type TokenBalance, addCustomToken, removeCustomToken, getCustomTokens } from '@/hooks/usePortfolio';
import { getChain } from '@/config/chains';
import { ChainLogo, TokenIcon } from '@/components/ChainLogo';
import { fmtMoney, fmtTokenAmount, isAddressValid } from '@/lib/format';
import { isSpamToken } from '@/lib/spam';
import { downloadCsv } from '@/lib/exportCsv';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Bell, Trash2, ExternalLink, Coins, Download, EyeOff, ShieldAlert, X } from 'lucide-react';
import { useAppStore, type CurrencyCode } from '@/lib/store';
import { useI18n, useFmt } from '@/lib/i18n';
import { toast } from 'sonner';
import { useActiveAddress } from '@/hooks/useActiveAddress';

interface FlatToken extends TokenBalance {
  isNative: boolean;
  usd: number | null;
}

export function TokenTable({ selectedChains }: { selectedChains: number[] }) {
  const { chains, loading, totalUsd } = usePortfolio(selectedChains);
  const { address, isWatchOnly } = useActiveAddress();
  const { t } = useI18n();
  const { money, currency } = useFmt();
  const [query, setQuery] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const [showSpam, setShowSpam] = useState(false);
  const addAlert = useAppStore((s) => s.addPriceAlert);
  const spamTokens = useAppStore((s) => s.spamTokens);
  const addSpamToken = useAppStore((s) => s.addSpamToken);
  const hideSpamSetting = useAppStore((s) => s.settings.hideSpam);
  const [alertTarget, setAlertTarget] = useState<FlatToken | null>(null);
  const [alertPrice, setAlertPrice] = useState('');
  const [alertDir, setAlertDir] = useState<'above' | 'below'>('above');

  const flat: FlatToken[] = useMemo(() => {
    const out: FlatToken[] = [];
    for (const c of chains) {
      if (!selectedChains.includes(c.chainId)) continue;
      const chain = getChain(c.chainId);
      if (c.native.balance > 0) {
        out.push({
          chainId: c.chainId,
          address: 'native',
          symbol: chain?.symbol ?? 'ETH',
          name: chain?.name ?? 'Nativo',
          decimals: 18,
          balance: c.native.balance,
          price: c.native.price,
          usdValue: c.native.usd,
          usd: c.native.usd,
          isNative: true,
        });
      }
      for (const tk of c.tokens) {
        out.push({ ...tk, usd: tk.usdValue, isNative: false });
      }
    }
    return out.sort((a, b) => (b.usd ?? 0) - (a.usd ?? 0));
  }, [chains, selectedChains]);

  const { filtered, spamCount } = useMemo(() => {
    let count = 0;
    const list = flat.filter((tk) => {
      const spam =
        hideSpamSetting &&
        !tk.isNative &&
        (spamTokens.includes(`${tk.chainId}:${tk.address.toLowerCase()}`) ||
          isSpamToken({ symbol: tk.symbol, name: tk.name, price: tk.price, usdValue: tk.usdValue }));
      if (spam && !showSpam) {
        count++;
        return false;
      }
      return true;
    });
    return { filtered: list, spamCount: count };
  }, [flat, hideSpamSetting, showSpam, spamTokens]);

  const searched = filtered.filter(
    (tk) =>
      !query ||
      tk.symbol.toLowerCase().includes(query.toLowerCase()) ||
      tk.name.toLowerCase().includes(query.toLowerCase()) ||
      (tk.address !== 'native' && tk.address.toLowerCase().includes(query.toLowerCase())),
  );

  const withPrice = flat.filter((tk) => tk.price !== null).length;

  const handleAddAlert = () => {
    if (!alertTarget || !alertPrice || !address) return;
    addAlert({
      chainId: alertTarget.chainId,
      tokenSymbol: alertTarget.symbol,
      tokenKey: alertTarget.isNative ? 'native' : alertTarget.address,
      targetPrice: Number(alertPrice),
      direction: alertDir,
      currency,
    });
    toast.success(
      t('tokens.alertCreated', {
        symbol: alertTarget.symbol,
        dir: alertDir === 'above' ? '≥' : '≤',
        price: `${CURRENCIES_SYMBOL[currency]}${alertPrice}`,
      }),
    );
    setAlertTarget(null);
    setAlertPrice('');
  };

  const [newAddr, setNewAddr] = useState('');
  const [newChain, setNewChain] = useState(selectedChains[0] ?? 1);
  const [newSymbol, setNewSymbol] = useState('');
  const [newDecimals, setNewDecimals] = useState('18');

  const handleAddCustom = () => {
    if (!isAddressValid(newAddr)) {
      toast.error(t('tokens.invalidAddress'));
      return;
    }
    addCustomToken({ chainId: newChain, address: newAddr, symbol: newSymbol || 'TOKEN', decimals: Number(newDecimals) || 18 });
    toast.success(t('tokens.customAdded'));
    setCustomOpen(false);
    setNewAddr('');
    setTimeout(() => window.location.reload(), 800);
  };

  const exportTokens = () => {
    downloadCsv('cryptovault-tokens.csv', [
      ['Symbol', 'Name', 'Chain', 'Balance', 'Price', 'Value'],
      ...searched.map((tk) => [tk.symbol, tk.name, getChain(tk.chainId)?.name ?? '', tk.balance, tk.price, tk.usd]),
    ]);
  };

  if (!address) {
    return <EmptyState message={t('tokens.empty')} />;
  }

  return (
    <div className="glass-card overflow-hidden" id="token-table">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 text-violet-300 shadow-inner">
            <Coins className="h-4 w-4" />
          </span>
          <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">{t('tokens.title')}</h2>
          <Badge variant="secondary" className="nums border-white/[0.08] bg-white/[0.06] text-zinc-300">{flat.length}</Badge>
          {withPrice > 0 && (
            <span className="hidden items-center gap-1 text-[11px] text-zinc-500 sm:flex">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {t('tokens.livePrice', { n: withPrice })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('tokens.search')}
              className="h-8 w-40 rounded-full border-white/[0.07] bg-white/[0.03] pl-8 text-xs focus-visible:ring-violet-500/40 sm:w-44"
            />
          </div>
          {spamCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSpam((v) => !v)}
              title={t('tokens.showSpam')}
              className="h-8 gap-1 rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-2.5 text-[11px] text-amber-300 hover:bg-amber-500/15"
            >
              <ShieldAlert className="h-3 w-3" />
              {showSpam ? <EyeOff className="h-3 w-3" /> : null}
              {t('tokens.spamHidden', { n: spamCount })}
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={exportTokens} title={t('tokens.export')} className="h-8 w-8 rounded-full border border-white/[0.09] bg-white/[0.03] p-0 text-zinc-400 hover:bg-white/[0.07] hover:text-violet-300">
            <Download className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setCustomOpen(true)} className="h-8 rounded-full border-white/[0.09] bg-white/[0.03] text-xs hover:border-violet-500/40 hover:bg-white/[0.07]">
            <Plus className="h-3.5 w-3.5" /> {t('tokens.add')}
          </Button>
        </div>
      </div>

      <ScrollArea className="max-h-[480px]">
        {loading && flat.length === 0 ? (
          <div className="grid gap-2 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : searched.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">
            {t('tokens.notFound', { q: query ? t('tokens.searching') : '' })}
            {totalUsd === null && t('tokens.keyHint')}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.045]">
            {searched.map((tk) => (
              <div
                key={`${tk.chainId}-${tk.address}`}
                data-token={`${tk.chainId}-${tk.address.toLowerCase()}`}
                data-symbol={tk.symbol}
                className="group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.035]"
              >
                <span className="relative shrink-0">
                  {tk.isNative ? (
                    <ChainLogo chainId={tk.chainId} className="h-9 w-9" />
                  ) : (
                    <TokenIcon symbol={tk.symbol} className="h-9 w-9" />
                  )}
                  <ChainLogo chainId={tk.chainId} className="absolute -bottom-0.5 -right-0.5 h-4 w-4 shadow-md shadow-black/50" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-zinc-100">{tk.symbol}</p>
                    {tk.isNative && (
                      <Badge variant="secondary" className="border-champagne/25 bg-champagne/10 px-1 py-0 text-[9px] font-bold tracking-wider text-champagne">
                        {t('tokens.native')}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500">{tk.name}</p>
                </div>
                <div className="hidden w-28 text-right sm:block">
                  <p className="nums text-sm text-zinc-300">{fmtTokenAmount(tk.balance)}</p>
                  <p className="nums text-[11px] text-zinc-500">{tk.price !== null ? fmtMoney(tk.price, currency, 6) : t('tokens.noPrice')}</p>
                </div>
                <div className="w-24 text-right">
                  <p className="nums text-sm font-semibold text-zinc-50">{fmtMoney(tk.usd, currency)}</p>
                </div>
                <div className="flex w-20 shrink-0 justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 sm:w-16">
                  {!tk.isNative && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('tokens.markSpam')}
                      title={t('tokens.markSpam')}
                      className="h-7 w-7 text-zinc-600 hover:text-amber-400"
                      onClick={() => {
                        addSpamToken(`${tk.chainId}:${tk.address}`);
                        toast.success(t('tokens.spamMarked'));
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {!tk.isNative && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('tokens.deleteToken', { symbol: tk.symbol })}
                      className="h-7 w-7 text-zinc-600 hover:text-red-400"
                      onClick={() => {
                        removeCustomToken(tk.chainId, tk.address);
                        toast.success(`${tk.symbol} ${t('tokens.hidden')}`);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('tokens.alertFor', { symbol: tk.symbol })}
                    className="h-7 w-7 text-zinc-600 hover:text-amber-400"
                    onClick={() => {
                      setAlertTarget(tk);
                      setAlertPrice(tk.price ? String(Math.round(tk.price * 100) / 100) : '');
                    }}
                  >
                    <Bell className="h-3.5 w-3.5" />
                  </Button>
                  {tk.address !== 'native' && (
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('tokens.viewExplorer')}
                      className="hidden h-7 w-7 text-zinc-600 hover:text-violet-400 sm:flex"
                      onClick={() => window.open(`${getChain(tk.chainId)?.explorer}/token/${tk.address}`, '_blank')}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Diálogo de alerta de precio */}
      <Dialog open={!!alertTarget} onOpenChange={(v) => !v && setAlertTarget(null)}>
        <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Bell className="h-4 w-4 text-amber-400" /> {t('tokens.alertTitle', { symbol: alertTarget?.symbol ?? '' })}
            </DialogTitle>
            <DialogDescription>{t('tokens.alertDesc')}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={alertDir === 'above' ? 'default' : 'outline'}
                onClick={() => setAlertDir('above')}
                className={alertDir === 'above' ? 'btn-aurora' : 'border-white/[0.09] bg-white/[0.03]'}
              >
                {t('tokens.above')}
              </Button>
              <Button
                variant={alertDir === 'below' ? 'default' : 'outline'}
                onClick={() => setAlertDir('below')}
                className={alertDir === 'below' ? 'bg-amber-600 hover:bg-amber-700' : 'border-white/[0.09] bg-white/[0.03]'}
              >
                {t('tokens.below')}
              </Button>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('tokens.target', { currency: CURRENCIES_SYMBOL[currency] })}</Label>
              <Input
                type="number"
                step="any"
                value={alertPrice}
                onChange={(e) => setAlertPrice(e.target.value)}
                className="nums border-white/[0.09] bg-white/[0.03]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddAlert} disabled={!alertPrice} className="btn-aurora text-white">
              {t('tokens.createAlert')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de token personalizado */}
      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{t('tokens.addCustom')}</DialogTitle>
            <DialogDescription>{t('tokens.addCustomDesc', { chain: getChain(newChain)?.name ?? '' })}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label>{t('old.network')}</Label>
              <select
                value={newChain}
                onChange={(e) => setNewChain(Number(e.target.value))}
                className="rounded-xl border border-white/[0.09] bg-white/[0.03] px-3 py-2 text-sm text-zinc-200 outline-none focus:border-violet-500/50"
              >
                {selectedChains.map((id) => (
                  <option key={id} value={id} className="bg-[#0c0b16]">{getChain(id)?.name}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label>{t('tokens.contract')}</Label>
              <Input value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="0x…" className="border-white/[0.09] bg-white/[0.03] font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-1.5">
                <Label>{t('tokens.symbol')}</Label>
                <Input value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)} placeholder="TOKEN" className="border-white/[0.09] bg-white/[0.03]" />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('tokens.decimals')}</Label>
                <Input type="number" value={newDecimals} onChange={(e) => setNewDecimals(e.target.value)} className="nums border-white/[0.09] bg-white/[0.03]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddCustom} className="btn-aurora text-white">{t('tokens.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CURRENCIES_SYMBOL: Record<CurrencyCode, string> = {
  usd: '$', eur: '€', mxn: 'MX$', ars: 'AR$', cop: 'CO$',
};

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="glass-card flex flex-col items-center gap-2.5 border-dashed p-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-cyan-500/15">
        <Coins className="h-5 w-5 text-violet-400/70" />
      </span>
      <p className="max-w-sm text-sm text-zinc-500">{message}</p>
    </div>
  );
}

// re-export para uso en otros módulos
export { getCustomTokens };
