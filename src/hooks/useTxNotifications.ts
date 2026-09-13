'use client';

import { waitForTransactionReceipt, type Config } from '@wagmi/core';
import { useConfig } from 'wagmi';
import { fireNotification } from '@/lib/notifications';
import { getChain } from '@/config/chains';
import { toast } from 'sonner';

/**
 * Envía una transacción y notifica al usuario durante todo su ciclo:
 * envío → confirmación/error. Devuelve el hash.
 */
export async function sendTxWithNotifications(
  config: Config,
  opts: {
    chainId: number;
    hashPromise: Promise<`0x${string}`>;
    title: string;
    explorerBase?: string;
  },
): Promise<`0x${string}` | null> {
  try {
    const hash = await opts.hashPromise;
    toast.info(opts.title, {
      description: `Transacción enviada. Esperando confirmación…`,
      action: opts.explorerBase
        ? { label: 'Ver', onClick: () => window.open(`${opts.explorerBase}/tx/${hash}`, '_blank') }
        : undefined,
    });
    fireNotification({
      type: 'info',
      title: `⏳ ${opts.title}`,
      body: 'Transacción enviada, esperando confirmación…',
    });

    void waitForTransactionReceipt(config, { hash, chainId: opts.chainId })
      .then((receipt) => {
        const chain = getChain(opts.chainId);
        if (receipt.status === 'success') {
          toast.success(`${opts.title} confirmada`, {
            description: chain ? `en ${chain.name}` : '',
            action: chain
              ? { label: 'Ver', onClick: () => window.open(`${chain.explorer}/tx/${hash}`, '_blank') }
              : undefined,
          });
          fireNotification({
            type: 'tx',
            title: `✅ ${opts.title}`,
            body: `Confirmada en ${chain?.name ?? 'blockchain'}`,
          });
        } else {
          toast.error(`${opts.title} falló`);
          fireNotification({ type: 'tx', title: `❌ ${opts.title}`, body: 'La transacción falló on-chain' });
        }
      })
      .catch(() => {
        toast.error(`${opts.title} falló`);
        fireNotification({ type: 'tx', title: `❌ ${opts.title}`, body: 'Error esperando la confirmación' });
      });

    return hash;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error desconocido';
    if (msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('denied')) {
      toast.error('Transacción rechazada en la cartera');
    } else {
      toast.error('Error al enviar la transacción', { description: msg.slice(0, 140) });
    }
    return null;
  }
}
