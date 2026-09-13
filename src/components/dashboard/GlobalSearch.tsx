'use client';

/**
 * BUSCADOR GLOBAL (Ctrl/⌘+K) — tokens, airdrops, redes, carteras y acciones.
 * Navega mediante CustomEvents que los paneles ya escuchan.
 */

import { useEffect, useMemo, useState } from 'react';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/lib/i18n';
import { CHAINS, getChain } from '@/config/chains';
import { usePortfolio } from '@/hooks/usePortfolio';
import { useNfts } from '@/hooks/useNfts';
import { useAirdrops } from '@/hooks/useAirdrops';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { useAppStore } from '@/lib/store';
import { ChainLogo, TokenIcon } from '@/components/ChainLogo';
import { fmtMoney } from '@/lib/format';
import { downloadCsv } from '@/lib/exportCsv';
import {
  Coins, Radar, Globe, BookUser, Settings, Download, SunMedium, Search, Gem, Image as ImageIcon, Plus,
} from 'lucide-react';

export function GlobalSearch({ selectedChains }: { selectedChains: number[] }) {
  const { t } = useI18n();
  const { address } = useActiveAddress();
  const { chains } = usePortfolio(selectedChains);
  const { items: nfts } = useNfts(selectedChains);
  const { results: airdropResults, refetch: refetchAirdrops } = useAirdrops(selectedChains);
  const watched = useAppStore((s) => s.watchedAddresses);
  const currency = useAppStore((s) => s.settings.currency);

  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('cv-open-search', onOpen);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('cv-open-search', onOpen);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // Aplanar tokens
  const tokens = useMemo(() => {
    const out: { key: string; symbol: string; name: string; chainId: number; value: number | null; address: string }[] = [];
    for (const c of chains) {
      if (c.native.balance > 0) {
        const ch = getChain(c.chainId);
        out.push({
          key: `${c.chainId}-native`, symbol: ch?.symbol ?? 'ETH', name: ch?.name ?? '', chainId: c.chainId,
          value: c.native.usd, address: 'native',
        });
      }
      for (const tk of c.tokens) {
        out.push({
          key: `${c.chainId}-${tk.address}`, symbol: tk.symbol, name: tk.name, chainId: c.chainId,
          value: tk.usdValue, address: tk.address,
        });
      }
    }
    return out.sort((a, b) => (b.value ?? 0) - (a.value ?? 0)).slice(0, 40);
  }, [chains]);

  const run = (fn: () => void) => {
    setOpen(false);
    setTimeout(fn, 120);
  };

  const exportCsv = () =>
    run(() => {
      const rows: (string | number | null)[][] = [
        ['Symbol', 'Name', 'Chain', 'Balance', 'Price', 'Value'],
        ...tokens.map((tk) => {
          const c = chains.find((x) => x.chainId === tk.chainId);
          const native = tk.address === 'native';
          const balance = native
            ? (c?.native.balance ?? 0)
            : (c?.tokens.find((x) => x.address.toLowerCase() === tk.address.toLowerCase())?.balance ?? null);
          const price = native ? (c?.native.price ?? null) : (c?.tokens.find((x) => x.address.toLowerCase() === tk.address.toLowerCase())?.price ?? null);
          return [tk.symbol, tk.name, getChain(tk.chainId)?.name ?? '', balance, price, tk.value];
        }),
      ];
      downloadCsv('cryptovault-portfolio.csv', rows);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-white/10 bg-[#0c0b16]/95 p-0 text-zinc-100 backdrop-blur-2xl sm:max-w-lg">
        <DialogHeader className="sr-only">
          <DialogTitle>{t('header.search')}</DialogTitle>
          <DialogDescription>{t('search.placeholder')}</DialogDescription>
        </DialogHeader>
        <Command className="bg-transparent">
          <CommandInput
            autoFocus
            placeholder={t('search.placeholder')}
            className="h-12 w-full border-b border-white/[0.07] bg-transparent px-4 text-sm outline-none placeholder:text-zinc-600"
          />
          <CommandList className="max-h-[360px] overflow-y-auto p-2">
            <CommandEmpty className="py-6 text-center text-sm text-zinc-500">{t('search.empty')}</CommandEmpty>

            {address && tokens.length > 0 && (
              <CommandGroup heading={<GroupLabel icon={<Coins className="h-3 w-3" />} text={t('search.groupTokens')} />}>
                {tokens.slice(0, 8).map((tk) => (
                  <CommandItem
                    key={`tok-${tk.key}`}
                    value={`token ${tk.symbol} ${tk.name}`}
                    onSelect={() =>
                      run(() => window.dispatchEvent(new CustomEvent('cv-focus-token', { detail: { chainId: tk.chainId, address: tk.address, symbol: tk.symbol } })))
                    }
                    className="gap-2.5 rounded-xl px-3 py-2"
                  >
                    <TokenIcon symbol={tk.symbol} className="h-5 w-5" />
                    <span className="text-sm font-semibold">{tk.symbol}</span>
                    <span className="truncate text-xs text-zinc-500">{tk.name}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {tk.value != null && <span className="nums text-xs text-zinc-300">{fmtMoney(tk.value, currency)}</span>}
                      <ChainLogo chainId={tk.chainId} className="h-4 w-4" />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {nfts.length > 0 && (
              <CommandGroup heading={<GroupLabel icon={<ImageIcon className="h-3 w-3" />} text={t('nft.title')} />}>
                {nfts.slice(0, 5).map((n) => (
                  <CommandItem
                    key={`nft-${n.chainId}-${n.contract}-${n.tokenId}`}
                    value={`nft ${n.name} ${n.collection}`}
                    onSelect={() => run(() => document.getElementById('nft-gallery')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))}
                    className="gap-2.5 rounded-xl px-3 py-2"
                  >
                    {n.imageUrl ? (
                      <img src={n.imageUrl.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${n.imageUrl.replace('ipfs://', '')}` : n.imageUrl} alt="" className="h-5 w-5 rounded object-cover" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-zinc-600" />
                    )}
                    <span className="truncate text-sm">{n.name || `#${n.tokenId}`}</span>
                    <span className="ml-auto truncate text-xs text-zinc-500">{n.collection}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {airdropResults.length > 0 && (
              <CommandGroup heading={<GroupLabel icon={<Radar className="h-3 w-3" />} text={t('search.groupAirdrops')} />}>
                {airdropResults.slice(0, 8).map((r) => (
                  <CommandItem
                    key={`air-${r.def.id}`}
                    value={`airdrop ${r.def.name} ${r.def.token ?? ''}`}
                    onSelect={() => run(() => window.dispatchEvent(new CustomEvent('cv-open-airdrop', { detail: { id: r.def.id } })))}
                    className="gap-2.5 rounded-xl px-3 py-2"
                  >
                    <Gem className="h-4 w-4 text-champagne" />
                    <span className="text-sm font-semibold">{r.def.name}</span>
                    <span className="nums ml-auto text-xs text-zinc-500">{Math.round(r.progress * 100)}%</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading={<GroupLabel icon={<Globe className="h-3 w-3" />} text={t('search.groupChains')} />}>
              {CHAINS.map((c) => (
                <CommandItem
                  key={`ch-${c.id}`}
                  value={`red chain ${c.name} ${c.shortName} ${c.symbol}`}
                  onSelect={() => run(() => window.dispatchEvent(new CustomEvent('cv-toggle-chain', { detail: { chainId: c.id } })))}
                  className="gap-2.5 rounded-xl px-3 py-2"
                >
                  <ChainLogo chainId={c.id} className="h-5 w-5" />
                  <span className="text-sm">{c.name}</span>
                  <span className="ml-auto text-xs text-zinc-500">{c.symbol}</span>
                </CommandItem>
              ))}
            </CommandGroup>

            {(watched.length > 0 || address) && (
              <CommandGroup heading={<GroupLabel icon={<BookUser className="h-3 w-3" />} text={t('search.groupAddresses')} />}>
                {address && (
                  <CommandItem
                    value="cartera conectada connected wallet"
                    onSelect={() => run(() => useAppStore.getState().setActiveAddress(null))}
                    className="gap-2.5 rounded-xl px-3 py-2"
                  >
                    <BookUser className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm">{t('book.useConnected')}</span>
                  </CommandItem>
                )}
                {watched.map((w) => (
                  <CommandItem
                    key={`watch-${w.address}`}
                    value={`wallet ${w.label} ${w.address}`}
                    onSelect={() => run(() => useAppStore.getState().setActiveAddress(w.address))}
                    className="gap-2.5 rounded-xl px-3 py-2"
                  >
                    <BookUser className="h-4 w-4 text-violet-400" />
                    <span className="text-sm">{w.label}</span>
                    <span className="ml-auto font-mono text-xs text-zinc-500">{w.address.slice(0, 8)}…</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandGroup heading={<GroupLabel icon={<Settings className="h-3 w-3" />} text={t('search.groupActions')} />}>
              <CommandItem value="ajustes settings" onSelect={() => run(() => window.dispatchEvent(new CustomEvent('open-settings')))} className="gap-2.5 rounded-xl px-3 py-2">
                <Settings className="h-4 w-4 text-zinc-400" /> {t('search.actionSettings')}
              </CommandItem>
              {address && (
                <CommandItem value="exportar csv export" onSelect={exportCsv} className="gap-2.5 rounded-xl px-3 py-2">
                  <Download className="h-4 w-4 text-zinc-400" /> {t('search.actionExport')}
                </CommandItem>
              )}
              <CommandItem value="tema theme claro oscuro" onSelect={() => run(() => window.dispatchEvent(new CustomEvent('cv-toggle-theme')))} className="gap-2.5 rounded-xl px-3 py-2">
                <SunMedium className="h-4 w-4 text-zinc-400" /> {t('search.actionTheme')}
              </CommandItem>
              {address && (
                <CommandItem value="escanear airdrops scan" onSelect={() => run(() => { refetchAirdrops(); document.getElementById('airdrop-radar')?.scrollIntoView({ behavior: 'smooth' }); })} className="gap-2.5 rounded-xl px-3 py-2">
                  <Radar className="h-4 w-4 text-zinc-400" /> {t('search.actionScan')}
                </CommandItem>
              )}
              <CommandItem value="vigilar direccion watch add" onSelect={() => run(() => window.dispatchEvent(new CustomEvent('cv-open-addressbook')))} className="gap-2.5 rounded-xl px-3 py-2">
                <Plus className="h-4 w-4 text-zinc-400" /> {t('search.actionAdd')}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function GroupLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-zinc-600">
      {icon} {text}
    </span>
  );
}
