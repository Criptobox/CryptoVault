'use client';

import { useAppStore } from '@/lib/store';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/format';
import { useI18n } from '@/lib/i18n';

export function NotificationsPanel({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const notifications = useAppStore((s) => s.notifications);
  const clearNotifications = useAppStore((s) => s.clearNotifications);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-emerald-500" /> {t('notif.title')}
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Precios, transacciones y seguridad — en tiempo real
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-96 -mx-2 px-2">
          {notifications.length === 0 ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Todavía no hay notificaciones. Crea alertas de precio o ejecuta una transacción.
            </p>
          ) : (
            <div className="grid gap-2">
              {notifications.map((n) => (
                <div key={n.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{n.title}</p>
                    <span className="shrink-0 text-[10px] text-zinc-500">{timeAgo(n.ts)}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-zinc-400">{n.body}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => useAppStore.getState().markAllRead()}>
            <CheckCheck className="h-4 w-4" /> {t('notif.markAll')}
          </Button>
          <Button variant="ghost" size="sm" onClick={clearNotifications} className="text-zinc-400 hover:text-red-400">
            <Trash2 className="h-4 w-4" /> {t('notif.clear')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
