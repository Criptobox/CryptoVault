'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ShieldCheck, Link2, LogOut, Copy, Check, Eye, Plus, BookUser, QrCode, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { shortAddress, isAddressValid } from '@/lib/format';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';

/** Logo oficial (simplificado) de WalletConnect para la fila destacada */
function WalletConnectMark({ className = 'h-4 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 64" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M23.1 23.7c14-13.7 35.8-13.7 49.8 0l1.7 1.6a1.7 1.7 0 0 1 0 2.5l-6 5.9c-.3.3-.8.3-1.1 0l-2.3-2.2c-9.7-9.6-25.5-9.6-35.3 0l-2.4 2.4c-.3.3-.8.3-1.1 0l-6-6a1.7 1.7 0 0 1 0-2.5l2.7-1.7Zm61.4 11.4 5.3 5.2c.3.3.3.8 0 1.1L66 65c-.3.3-.8.3-1.1 0L47.4 47.9a.6.6 0 0 0-.8 0L29.1 65c-.3.3-.8.3-1.1 0L4.2 41.4a.8.8 0 0 1 0-1.1l5.3-5.2c.3-.3.8-.3 1.1 0L28 52.3c.2.3.6.3.8 0L46.3 35c.3-.3.8-.3 1.1 0l17.5 17.3c.2.3.6.3.8 0l17.4-17.2c.3-.3.8-.3 1.1 0Z"
      />
    </svg>
  );
}

/** Color de marca por wallet para un look reconocible */
function walletBrand(name: string): { letter: string; grad: string } {
  const n = name.toLowerCase();
  if (n.includes('metamask')) return { letter: 'M', grad: 'linear-gradient(135deg,#f6851b,#e2761b)' };
  if (n.includes('rabby')) return { letter: 'R', grad: 'linear-gradient(135deg,#8697ff,#5f6cd9)' };
  if (n.includes('trust')) return { letter: 'T', grad: 'linear-gradient(135deg,#3375bb,#0f4c9c)' };
  if (n.includes('coinbase')) return { letter: 'C', grad: 'linear-gradient(135deg,#1652f0,#0e3a99)' };
  if (n.includes('okx')) return { letter: 'O', grad: 'linear-gradient(135deg,#ffffff,#c9c9d1)' };
  if (n.includes('brave')) return { letter: 'B', grad: 'linear-gradient(135deg,#fb542b,#e0270d)' };
  if (n.includes('bitget')) return { letter: 'B', grad: 'linear-gradient(135deg,#00f0ff,#0057ff)' };
  if (n.includes('token pocket') || n.includes('tokenpocket')) return { letter: 'T', grad: 'linear-gradient(135deg,#4a8cf7,#2c5fd8)' };
  if (n.includes('frame')) return { letter: 'F', grad: 'linear-gradient(135deg,#1c1c24,#4b4b5c)' };
  if (n.includes('safe') || n.includes('gnosis')) return { letter: 'S', grad: 'linear-gradient(135deg,#12ff80,#00b34d)' };
  if (n.includes('zerion')) return { letter: 'Z', grad: 'linear-gradient(135deg,#356df1,#1c3fa8)' };
  if (n.includes('phantom')) return { letter: 'P', grad: 'linear-gradient(135deg,#ab9ff2,#5f56c9)' };
  if (n.includes('walletconnect') || n.includes('wallet connect')) return { letter: 'W', grad: 'linear-gradient(135deg,#3b99fc,#0d6fd8)' };
  return { letter: name.charAt(0).toUpperCase() || 'W', grad: 'linear-gradient(135deg,#8b5cf6,#06b6d4)' };
}

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, pendingConnector } = useConnect();
  const { disconnect } = useDisconnect();
  // El estado del diálogo vive en el store: sobrevive al remontaje de WagmiProvider
  // (que ocurre justo después de guardar el WalletConnect Project ID por primera vez).
  const open = useAppStore((s) => s.connectModalOpen);
  const setOpen = useAppStore((s) => s.setConnectModalOpen);
  const wcAutoConnect = useAppStore((s) => s.wcAutoConnect);
  const setWcAutoConnect = useAppStore((s) => s.setWcAutoConnect);
  const [copied, setCopied] = useState(false);
  const [wcSetupOpen, setWcSetupOpen] = useState(false);
  const { t } = useI18n();
  const watched = useAppStore((s) => s.watchedAddresses);
  const activeOverride = useAppStore((s) => s.activeAddressOverride);
  const setActive = useAppStore((s) => s.setActiveAddress);

  // Filtrar duplicados por nombre (EIP-6963 puede exponer varias entradas de la misma wallet)
  const uniqueConnectors = connectors.filter((c) => {
    if (c.id === 'injected' || c.id === 'injected-shim-disconnect') return false;
    if (c.type === 'injected' && typeof window !== 'undefined' && !c.name.toLowerCase().includes('detected')) return true;
    return c.type !== 'injected';
  });
  // Mantener el inyectado genérico solo si no hay wallets con nombre específico
  const namedInjected = connectors.filter((c) => c.type === 'injected' && !['injected', 'injected-shim-disconnect'].includes(c.id));
  const finalList = namedInjected.length ? uniqueConnectors : connectors;

  /** Conector WalletConnect (QR) — presente solo si hay Project ID configurado */
  const wcConnector = finalList.find((c) => c.type === 'walletConnect') ?? null;
  const otherConnectors = finalList.filter((c) => c.type !== 'walletConnect');

  const handleConnect = (id: string) => {
    const connector = connectors.find((c) => c.uid === id || c.id === id);
    if (!connector) return;
    connect(
      { connector },
      {
        onSuccess: () => { setActive(null); setOpen(false); },
        onError: (e) => {
          const msg = (e as Error)?.message ?? '';
          toast.error(msg.length > 8 ? msg.slice(0, 140) : t('connect.error'));
        },
      },
    );
  };

  /** Clic en la fila WalletConnect: conecta por QR o abre la configuración del Project ID */
  const onWalletConnectClick = () => {
    if (wcConnector) {
      handleConnect(wcConnector.uid);
    } else {
      setWcSetupOpen(true);
    }
  };

  // Auto-conectar por QR justo después de guardar el Project ID por primera vez:
  // el provider se remonta con el conector WalletConnect y este efecto dispara el QR.
  useEffect(() => {
    if (!wcAutoConnect || !wcConnector || isConnected || isPending) return;
    setWcAutoConnect(false);
    handleConnect(wcConnector.uid);
  }, [wcAutoConnect, wcConnector, isConnected, isPending, setWcAutoConnect]);

  const copyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast.success(t('common.copied'));
  };

  useEffect(() => {
    if (!address) return;
    try {
      localStorage.setItem('cv-last-address', address);
    } catch { /* noop */ }
  }, [address]);

  if (!isConnected) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-aurora gap-1.5 rounded-xl px-3 font-semibold text-white sm:gap-2 sm:px-4">
              <span className="h-2 w-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)]" aria-hidden />
              <span className="hidden sm:inline">{t('connect.button')}</span><span className="sm:hidden">{t('connect.buttonShort')}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-lg">
                <ShieldCheck className="h-5 w-5 text-emerald-400" /> {t('connect.title')}
              </DialogTitle>
              <DialogDescription className="text-zinc-400">{t('connect.desc')}</DialogDescription>
            </DialogHeader>

            {/* WALLETCONNECT — conexión por QR con carteras móviles (fila fijada) */}
            <button
              onClick={onWalletConnectClick}
              disabled={isPending}
              className="group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-[#3b99fc]/30 bg-gradient-to-r from-[#3b99fc]/[0.14] via-[#3b99fc]/[0.06] to-transparent px-4 py-3.5 text-left transition hover:border-[#3b99fc]/60 hover:from-[#3b99fc]/25 disabled:opacity-50 min-h-14"
            >
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-lg shadow-black/40"
                style={{ background: 'linear-gradient(135deg,#3b99fc,#0d6fd8)' }}
                aria-hidden
              >
                <WalletConnectMark className="h-3.5 w-6" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold text-zinc-100">
                  WalletConnect
                  <Badge variant="secondary" className="border-white/10 bg-white/[0.08] px-1.5 py-0 text-[10px] font-bold tracking-wider text-[#5fa9fb]">
                    {t('connect.qrBadge')}
                  </Badge>
                </span>
                <span className="block truncate text-xs text-zinc-400">{t('connect.qrRowDesc')}</span>
              </span>
              {isPending && pendingConnector?.type === 'walletConnect' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#5fa9fb]" />
              ) : (
                <QrCode className="h-4.5 w-4.5 shrink-0 text-[#5fa9fb] transition group-hover:scale-110" />
              )}
            </button>

            <ScrollArea className="max-h-72 -mx-2 px-2">
              <div className="grid gap-2">
                {otherConnectors.map((c) => {
                  const brand = walletBrand(c.name);
                  return (
                    <button
                      key={c.uid}
                      onClick={() => handleConnect(c.uid)}
                      disabled={isPending}
                      className="group flex items-center justify-between rounded-2xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 text-left transition hover:border-violet-500/40 hover:bg-white/[0.06] disabled:opacity-50 min-h-12"
                    >
                      <span className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-lg shadow-black/40"
                          style={{ background: brand.grad, color: nName(c.name) }}
                          aria-hidden
                        >
                          {brand.letter}
                        </span>
                        <span className="font-medium text-zinc-100">{c.name}</span>
                        {c.type === 'safe' && <Badge variant="secondary" className="border-white/10 bg-white/[0.06] text-zinc-300">Multisig</Badge>}
                      </span>
                      {isPending && pendingConnector?.uid === c.uid ? (
                        <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                      ) : (
                        <Link2 className="h-4 w-4 text-zinc-600 transition group-hover:text-violet-400" />
                      )}
                    </button>
                  );
                })}
                {otherConnectors.length === 0 && (
                  <p className="text-sm text-zinc-500 p-4 text-center">{t('connect.none')}</p>
                )}
              </div>
            </ScrollArea>

            {/* MODO LECTURA */}
            <ReadOnlySection />

            <p className="flex items-start gap-1.5 text-xs text-zinc-500">
              <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5fa9fb]" />
              {t('connect.mobileHint')}
            </p>
          </DialogContent>
        </Dialog>

        {/* Configuración del Project ID para WalletConnect QR */}
        <WalletConnectSetup
          open={wcSetupOpen}
          onOpenChange={setWcSetupOpen}
          onSaved={() => setWcAutoConnect(true)}
        />
      </>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      {activeOverride && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActive(null)}
          className="hidden h-9 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-2.5 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 sm:flex"
          title={t('book.useConnected')}
        >
          <BookUser className="h-3.5 w-3.5" /> 👁
        </Button>
      )}
      <Button
        variant="outline"
        onClick={copyAddress}
        className="gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] font-mono text-[13px] text-zinc-200 backdrop-blur hover:border-emerald-500/40 hover:bg-white/[0.07]"
      >
        <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" aria-hidden />
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-500" />}
        {shortAddress(address ?? '', 4)}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => disconnect()}
        aria-label={t('connect.disconnect')}
        className="h-9 w-9 rounded-xl text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * Diálogo para obtener/guardar el WalletConnect Project ID (conexión por QR).
 * Se guarda en settings (localStorage) — nunca sale del dispositivo.
 */
function WalletConnectSetup({
  open, onOpenChange, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);
  // Input no controlado: Radix desmonta el contenido al cerrar, así que
  // defaultValue se refresca con el valor actual en cada apertura.
  const pidRef = useRef<HTMLInputElement>(null);

  const save = () => {
    const v = (pidRef.current?.value ?? '').trim();
    if (v.length < 16) {
      toast.error(t('connect.invalidPid'));
      return;
    }
    setSettings({ walletConnectProjectId: v });
    toast.success(t('connect.pidSaved'));
    onSaved();
    onOpenChange(false);
  };

  const steps: string[] = [t('connect.step1'), t('connect.step2'), t('connect.step3')];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#3b99fc]/25 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-lg">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white"
              style={{ background: 'linear-gradient(135deg,#3b99fc,#0d6fd8)' }}
              aria-hidden
            >
              <WalletConnectMark className="h-3 w-5" />
            </span>
            {t('connect.setupTitle')}
          </DialogTitle>
          <DialogDescription
            className="text-zinc-400 [&_b]:text-zinc-200"
            dangerouslySetInnerHTML={{ __html: t('connect.setupDesc') }}
          />
        </DialogHeader>

        <ol className="grid gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 text-xs text-zinc-300">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-[#3b99fc]/20 text-[10px] font-bold text-[#5fa9fb]">
                {i + 1}
              </span>
              <span
                className="[&_b]:text-zinc-100 [&_a]:text-[#5fa9fb] [&_a]:underline"
                dangerouslySetInnerHTML={{
                  __html: s.replace(
                    'cloud.walletconnect.com',
                    '<a href="https://cloud.walletconnect.com" target="_blank" rel="noreferrer">cloud.walletconnect.com</a>',
                  ),
                }}
              />
            </li>
          ))}
        </ol>

        <div className="grid gap-2">
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              ref={pidRef}
              defaultValue={settings.walletConnectProjectId}
              placeholder={t('connect.projectIdPh')}
              className="border-white/[0.09] bg-white/[0.03] pl-9 font-mono text-xs"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <a
            href="https://cloud.walletconnect.com/sign-up"
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold text-[#5fa9fb] hover:underline"
          >
            {t('connect.getFree')}
          </a>
        </div>

        <Button onClick={save} className="btn-aurora gap-2 rounded-xl font-semibold text-white">
          <QrCode className="h-4 w-4" /> {t('connect.saveConnect')}
        </Button>
        <p className="flex items-start gap-1.5 text-[11px] text-zinc-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
          {t('connect.pidPrivacy')}
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** Sección de modo lectura dentro del diálogo de conexión */
function ReadOnlySection() {
  const { t } = useI18n();
  const [addr, setAddr] = useState('');
  const [label, setLabel] = useState('');
  const addWatched = useAppStore((s) => s.addWatchedAddress);
  const setActive = useAppStore((s) => s.setActiveAddress);
  const watched = useAppStore((s) => s.watchedAddresses);

  const watch = () => {
    if (!isAddressValid(addr)) {
      toast.error(t('connect.invalid'));
      return;
    }
    addWatched({ address: addr, label: label.trim() || shortAddress(addr, 4) });
    setActive(addr);
    setAddr('');
    setLabel('');
    toast.success(t('book.added'));
    window.dispatchEvent(new CustomEvent('cv-open-addressbook'));
  };

  return (
    <div className="grid gap-2 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
        <Eye className="h-3.5 w-3.5" /> {t('connect.readonly')}
      </p>
      <p className="text-[11px] text-zinc-500">{t('connect.readonlyDesc')}</p>
      <div className="grid grid-cols-[1fr_1.3fr_auto] gap-1.5">
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('connect.labelPlaceholder')} className="h-9 border-white/[0.09] bg-white/[0.03] text-xs" />
        <Input value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={t('connect.addressPlaceholder')} className="h-9 border-white/[0.09] bg-white/[0.03] font-mono text-xs" />
        <Button size="sm" onClick={watch} className="h-9 rounded-lg border border-cyan-500/40 bg-cyan-500/[0.12] px-3 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25">
          <Plus className="h-3.5 w-3.5" /> {t('connect.watch')}
        </Button>
      </div>
      {watched.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {watched.slice(0, 4).map((w) => (
            <button
              key={w.address}
              onClick={() => setActive(w.address)}
              className="rounded-full border border-white/[0.09] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-zinc-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              {w.label || shortAddress(w.address, 3)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Texto legible sobre gradiente claro (OKX blanco) */
function nName(name: string): string {
  return name.toLowerCase().includes('okx') ? '#111' : '#fff';
}
