'use client';

/** Notificaciones del navegador + feed interno */
import { toast } from 'sonner';
import { useAppStore, type AppNotification } from '@/lib/store';

export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const perm = await Notification.requestPermission();
  return perm === 'granted';
}

export function fireNotification(n: Omit<AppNotification, 'id' | 'ts' | 'read'>) {
  const store = useAppStore.getState();
  store.pushNotification(n);

  // Toast in-app siempre
  const fn =
    n.type === 'price' ? toast.info : n.type === 'tx' ? toast.success : toast.message;
  fn(n.title, { description: n.body });

  // Notificación de escritorio si está permitida y activada
  if (store.settings.desktopNotifications && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(n.title, { body: n.body, icon: '/icons/icon-192.png', tag: n.id });
    } catch {
      // algunos navegadores requieren service worker; ignora silenciosamente
    }
  }
}
