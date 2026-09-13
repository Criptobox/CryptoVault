'use client';

import { useMemo, useState } from 'react';
import { useNfts } from '@/hooks/useNfts';
import { usePortfolio } from '@/hooks/usePortfolio';
import { getChain } from '@/config/chains';
import { ChainLogo } from '@/components/ChainLogo';
import { PanelInfo } from '@/components/dashboard/rescue/ApprovalsPanel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Image as ImageIcon, Store, ExternalLink, KeyRound, Camera, ShieldAlert, EyeOff, X } from 'lucide-react';
import { shortAddress } from '@/lib/format';
import { isSpamNft } from '@/lib/spam';
import { useI18n } from '@/lib/i18n';
import { useAppStore } from '@/lib/store';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { toast } from 'sonner';

/**
 * Galería de NFTs (ERC-721) en todas las redes, con enlaces directos a
 * OpenSea / Blur / Magic Eden / OKX / Element para ver precios y vender.
 * Incluye filtro anti-spam para NFTs regaleados.
 */
export function NFTGallery({ selectedChains }: { selectedChains: number[] }) {
  const { address, isWatchOnly } = useActiveAddress();
  const { items, loading, needsKey, error } = useNfts(selectedChains);
  const { chains } = usePortfolio(selectedChains);
  const [filter, setFilter] = useState<number | 'all'>('all');
  const [showSpam, setShowSpam] = useState(false);
  const spamTokens = useAppStore((s) => s.spamTokens);
  const addSpamToken = useAppStore((s) => s.addSpamToken);
  const hideSpamSetting = useAppStore((s) => s.settings.hideSpam);
  const { t } = useI18n();

  const { filtered, spamCount } = useMemo(() => {
    let count = 0;
    const list = items.filter((n) => {
      const spam =
        hideSpamSetting &&
        (spamTokens.includes(`${n.chainId}:${n.contract.toLowerCase()}`) ||
          isSpamNft({ name: n.name, collection: n.collection, symbol: n.symbol }));
      if (spam && !showSpam) {
        count++;
        return false;
      }
      return true;
    });
    return { filtered: list, spamCount: count };
  }, [items, hideSpamSetting, showSpam, spamTokens]);

  const viewed = filtered.filter((n) => filter === 'all' || n.chainId === filter);
  const nftChains = [...new Set(items.map((n) => n.chainId))];

  if (!address) {
    return <PanelInfo icon={ImageIcon} message={t('nft.connect')} />;
  }
  if (needsKey) {
    return (
      <PanelInfo
        icon={KeyRound}
        title={t('nft.needKeyTitle')}
        message={t('nft.needKey')}
        action={
          <Badge variant="secondary" className="border-white/[0.08] bg-white/[0.06] text-zinc-300">{t('nft.keyPath')}</Badge>
        }
      />
    );
  }

  return (
    <div className="glass-card overflow-hidden" id="nft-gallery">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] p-3.5">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-violet-500/20 text-fuchsia-300 shadow-inner">
            <Camera className="h-4 w-4" />
          </span>
          <h2 className="font-display text-sm font-bold tracking-tight text-zinc-100">{t('nft.title')}</h2>
          <Badge variant="secondary" className="nums border-white/[0.08] bg-white/[0.06] text-zinc-300">{items.length}</Badge>
          {isWatchOnly && (
            <Badge variant="secondary" className="border-cyan-500/30 bg-cyan-500/10 text-[9px] font-bold text-cyan-300">👁 {t('hero.watchMode')}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {spamCount > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowSpam((v) => !v)}
              className="h-7 gap-1 rounded-full border border-amber-500/25 bg-amber-500/[0.07] px-2.5 text-[11px] text-amber-300 hover:bg-amber-500/15"
            >
              <ShieldAlert className="h-3 w-3" />
              {showSpam ? <EyeOff className="h-3 w-3" /> : null}
              {t('nft.spamHidden', { n: spamCount })}
            </Button>
          )}
          {nftChains.length > 1 && (
            <div className="flex gap-1 overflow-x-auto">
              <button
                onClick={() => setFilter('all')}
                className={`rounded-full px-2.5 py-1 text-xs transition ${filter === 'all' ? 'bg-violet-500/[0.15] text-violet-200 shadow-[0_0_12px_-4px_rgba(139,92,246,0.5)]' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                {t('nft.all')}
              </button>
              {nftChains.map((id) => (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs transition ${filter === id ? 'bg-violet-500/[0.15] text-violet-200' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <ChainLogo chainId={id} className="h-4 w-4" /> {getChain(id)?.shortName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="max-h-[520px]">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-square animate-pulse rounded-2xl bg-white/[0.04]" />
            ))}
          </div>
        ) : error ? (
          <p className="p-8 text-center text-sm text-zinc-500">{t('common.error')}: {error}</p>
        ) : viewed.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">{t('nft.empty')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {viewed.map((nft) => {
              const chain = getChain(nft.chainId);
              const img = nft.imageUrl
                ? nft.imageUrl.startsWith('ipfs://')
                  ? `https://ipfs.io/ipfs/${nft.imageUrl.replace('ipfs://', '')}`
                  : nft.imageUrl
                : null;
              return (
                <div
                  key={`${nft.chainId}-${nft.contract}-${nft.tokenId}`}
                  className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-500/40 hover:shadow-[0_14px_36px_-14px_rgba(139,92,246,0.4)]"
                >
                  <div className="relative aspect-square overflow-hidden bg-black/40">
                    {img ? (
                      <img
                        src={img}
                        alt={nft.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
                        onError={(e) => {
                          (e.currentTarget.parentElement?.querySelector('.nft-fallback') as HTMLElement)?.classList.remove('hidden');
                          e.currentTarget.classList.add('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`nft-fallback ${img ? 'hidden' : ''} absolute inset-0 flex flex-col items-center justify-center gap-1 text-zinc-700`}>
                      <ImageIcon className="h-8 w-8" />
                      <span className="text-[10px]">{t('nft.noImage')}</span>
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    <ChainLogo chainId={nft.chainId} className="absolute left-2 top-2 h-6 w-6 shadow-lg shadow-black/60" />
                    <button
                      aria-label={t('tokens.markSpam')}
                      title={t('tokens.markSpam')}
                      onClick={() => {
                        addSpamToken(`${nft.chainId}:${nft.contract}`);
                        toast.success(t('tokens.spamMarked'));
                      }}
                      className="absolute right-1.5 top-1.5 hidden h-6 w-6 items-center justify-center rounded-lg bg-black/60 text-zinc-300 backdrop-blur transition hover:text-red-400 group-hover:flex"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="p-2.5">
                    <p className="truncate text-xs font-semibold text-zinc-100" title={nft.name}>{nft.name}</p>
                    <p className="truncate text-[11px] text-zinc-500" title={nft.collection}>{nft.collection}</p>
                    {chain && chain.marketplaces.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {chain.marketplaces.slice(0, 3).map((m) => (
                          <a
                            key={m.name}
                            href={m.url(nft.contract, nft.tokenId)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-0.5 rounded-md border border-white/[0.08] bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-zinc-300 transition hover:border-violet-500/50 hover:bg-violet-500/10 hover:text-violet-300"
                            onClick={() => toast.info(t('nft.openIn', { name: nft.name, market: m.name }))}
                          >
                            <Store className="h-2.5 w-2.5" />
                            {m.name}
                          </a>
                        ))}
                      </div>
                    )}
                    <p className="mt-1.5 truncate font-mono text-[10px] text-zinc-600" title={nft.contract}>
                      {shortAddress(nft.contract, 4)} · #{nft.tokenId.length > 8 ? `${nft.tokenId.slice(0, 6)}…` : nft.tokenId}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="flex items-center justify-between border-t border-white/[0.06] p-3 text-[11px] text-zinc-600">
        <span>{t('nft.marketNote')}</span>
        <span className="flex items-center gap-1">
          <ExternalLink className="h-3 w-3" /> OpenSea · Blur · Magic Eden · OKX · Element
        </span>
      </div>
    </div>
  );
}
