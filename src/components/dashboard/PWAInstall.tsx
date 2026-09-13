'use client';

/**
 * BOTÓN DE INSTALACIÓN PWA — beforeinstallprompt + instrucciones iOS.
 * Captura del evento a nivel de módulo (no se pierde aunque el componente
 * aún no esté montado) + suscripción reactiva vía useSyncExternalStore.
 */

import { useState, useSyncExternalStore } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';
import { Download, Share2, PlusSquare } from 'lucide-react';

interface BIPEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/* --- Estado module-level sincronizado con eventos del navegador --- */
let deferredPrompt: BIPEvent | null = null;
let appInstalled = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    appInstalled = true;
    emit();
  });
}

const emptySubscribe = () => () => {};

export function PWAInstallButton() {
  const { t } = useI18n();
  const [iosOpen, setIosOpen] = useState(false);

  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt, () => null);
  const installed = useSyncExternalStore(subscribe, () => appInstalled, () => false);

  const standalone =
    mounted &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true);
  const isIOS = mounted && /iphone|ipad|ipod/i.test(navigator.userAgent);

  if (!mounted || installed || standalone) return null;

  // iOS: sin beforeinstallprompt → mostrar instrucciones al click
  if (isIOS) {
    return (
      <>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('header.install')}
          title={t('header.install')}
          onClick={() => setIosOpen(true)}
          className="hidden h-8 w-8 rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.07] hover:text-white sm:h-9 sm:w-9 lg:flex"
        >
          <Download className="h-4 w-4" />
        </Button>
        <Dialog open={iosOpen} onOpenChange={setIosOpen}>
          <DialogContent className="border-white/10 bg-[#0c0b16]/95 text-zinc-100 backdrop-blur-2xl sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Share2 className="h-5 w-5 text-violet-400" /> {t('install.iosTitle')}
              </DialogTitle>
              <DialogDescription>{t('install.desc')}</DialogDescription>
            </DialogHeader>
            <ol className="grid gap-2 py-2 text-sm text-zinc-300">
              <li className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"><Share2 className="h-4 w-4 text-violet-400" /> {t('install.ios1')}</li>
              <li className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"><PlusSquare className="h-4 w-4 text-violet-400" /> {t('install.ios2')}</li>
              <li className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2"><Download className="h-4 w-4 text-violet-400" /> {t('install.ios3')}</li>
            </ol>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!prompt) return null;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        try {
          await prompt.prompt();
          const choice = await prompt.userChoice;
          if (choice.outcome === 'accepted') appInstalled = true;
        } catch { /* noop */ }
        deferredPrompt = null;
        emit();
      }}
      className="hidden h-8 gap-1.5 rounded-xl border border-champagne/30 bg-champagne/10 px-2.5 text-xs font-semibold text-champagne hover:bg-champagne/20 sm:h-9 sm:px-3 lg:flex"
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden xl:inline">{t('install.button')}</span>
    </Button>
  );
}
