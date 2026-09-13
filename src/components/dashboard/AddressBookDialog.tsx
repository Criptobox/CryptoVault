'use client';

/**
 * AGENDA DE CARTERAS — multi-dirección y modo lectura.
 * Vigila cualquier dirección sin conectarla: portafolio, NFTs, airdrops
 * y aprobaciones. Permite cambiar la dirección activa con 1 clic.
 */

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppStore } from '@/lib/store';
import { useActiveAddress } from '@/hooks/useActiveAddress';
import { isAddressValid, shortAddress } from '@/lib/format';
import { useI18n } from '@/lib/i18n';
import { toast } from 'sonner';
import { BookUser, Plus, Trash2, Eye, Link2, Layers } from 'lucide-react';

export function AddressBookDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const watched = useAppStore((s) => s.watchedAddresses);
  const addWatched = useAppStore((s) => s.addWatchedAddress);
  const removeWatched = useAppStore((s) => s.removeWatchedAddress);
  const setActive = useAppStore((s) => s.setActiveAddress);
  const aggregateMode = useAppStore((s) => s.aggregateMode);
  const setAggregateMode = useAppStore((s) => s.setAggregateMode);
  const { address: active, source } = useActiveAddress();

  const [label, setLabel] = useState('');
  const [addr, setAddr] = useState('');

  // Abrir también por evento global
  useEffect(() => {
    const h = () => onOpenChange(true);
    window.addEventListener('cv-open-addressbook', h);
    return () => window.removeEventListener('cv-open-addressbook', h);
  }, [onOpenChange]);

  const handleAdd = () => {
    if (!isAddressValid(addr)) {
      toast.error(t('connect.invalid'));
      return;
    }
    if (watched.some((w) => w.address.toLowerCase() === addr.toLowerCase())) {
      toast.error(t('book.duplicate'));
      return;
    }
    addWatchedAddressSafe(addWatched, addr, label);
    setActive(addr);
    toast.success(t('book.added'));
    setLabel('');
    setAddr('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display">
            <BookUser className="h-5 w-5 text-violet-400" /> {t('book.title')}
          </DialogTitle>
          <DialogDescription>{t('book.desc')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-1">
          {/* Formulario de alta */}
          <div className="grid gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Plus className="h-3.5 w-3.5 text-violet-400" /> {t('book.add')}
            </p>
            <div className="grid grid-cols-[1fr_1.4fr] gap-2">
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('connect.labelPlaceholder')} className="h-9 border-white/[0.09] bg-white/[0.03] text-xs" />
              <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t('connect.addressPlaceholder')} className="h-9 border-white/[0.09] bg-white/[0.03] font-mono text-xs" />
            </div>
            <Button onClick={handleAdd} size="sm" className="btn-aurora w-full rounded-xl text-white">{t('settings.addAddress')}</Button>
          </div>

          {/* Cartera conectada */}
          <button
            onClick={() => { setActive(null); toast.success(t('book.useConnected')); }}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
              source === 'connected'
                ? 'border-emerald-500/40 bg-emerald-500/[0.07]'
                : 'border-white/[0.07] bg-white/[0.025] hover:border-white/[0.14]'
            }`}
          >
            <Link2 className={`h-5 w-5 shrink-0 ${source === 'connected' ? 'text-emerald-400' : 'text-zinc-500'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-zinc-100">{t('book.connected')}</p>
              <p className="truncate font-mono text-xs text-zinc-500">{shortAddress(active ?? '', 6)}</p>
            </div>
            {source === 'connected' && <Badge className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-300">{t('book.active')}</Badge>}
          </button>

          {/* Lista de vigiladas */}
          <ScrollArea className="max-h-56">
            {watched.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-600">{t('book.empty')}</p>
            ) : (
              <div className="grid gap-2">
                {watched.map((w) => {
                  const isActive = source === 'watched' && active?.toLowerCase() === w.address.toLowerCase();
                  return (
                    <div
                      key={w.address}
                      className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
                        isActive ? 'border-violet-500/40 bg-violet-500/[0.07]' : 'border-white/[0.07] bg-white/[0.025]'
                      }`}
                    >
                      <Eye className={`h-4 w-4 shrink-0 ${isActive ? 'text-violet-300' : 'text-zinc-500'}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-zinc-100">{w.label || shortAddress(w.address, 6)}</p>
                        <p className="truncate font-mono text-[11px] text-zinc-500">{w.label ? shortAddress(w.address, 6) : ''}</p>
                      </div>
                      {isActive && <Badge className="border-violet-500/40 bg-violet-500/15 text-[10px] text-violet-300">{t('book.active')}</Badge>}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg border-white/[0.1] bg-white/[0.04] text-[11px]"
                        onClick={() => { setActive(w.address); toast.success(`${w.label || shortAddress(w.address, 6)} · ${t('book.activate')}`); }}
                      >
                        {t('book.activate')}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={t('settings.removeAddress')}
                        className="h-7 w-7 text-zinc-600 hover:text-red-400"
                        onClick={() => removeWatched(w.address)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Agregar todas */}
          {watched.length >= 2 && (
            <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <p className="flex items-center gap-2 text-sm text-zinc-300">
                <Layers className="h-4 w-4 text-cyan-400" /> {t('book.aggregate')}
              </p>
              <Switch checked={aggregateMode} onCheckedChange={setAggregateMode} />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function addWatchedAddressSafe(
  add: (a: { address: string; label: string }) => void,
  addr: string,
  label: string,
) {
  add({ address: addr, label: label.trim() });
}
