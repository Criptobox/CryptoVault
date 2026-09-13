'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApprovalsPanel } from '@/components/dashboard/rescue/ApprovalsPanel';
import { OldContractsPanel } from '@/components/dashboard/rescue/OldContractsPanel';
import { DustSweeper } from '@/components/dashboard/rescue/DustSweeper';
import { KeyRound, Landmark, BrushCleaning, Gem } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

export function RescuePanel({ selectedChains }: { selectedChains: number[] }) {
  const { t } = useI18n();
  return (
    <div className="glass-card relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #f0b90b, transparent 70%)' }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between border-b border-white/[0.06] p-3.5">
        <h2 className="flex items-center gap-2.5 font-display text-sm font-bold tracking-tight text-zinc-100">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-yellow-600/20 text-champagne shadow-inner">
            <Landmark className="h-4 w-4" />
          </span>
          {t('rescue.title')}
        </h2>
        <span className="flex items-center gap-1 rounded-full border border-champagne/30 bg-champagne/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-champagne">
          <Gem className="h-2.5 w-2.5" /> {t('rescue.oneClick')}
        </span>
      </div>
      <Tabs defaultValue="approvals" className="relative p-3">
        <TabsList className="mb-3 grid w-full grid-cols-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-1 backdrop-blur">
          <TabsTrigger value="approvals" className="gap-1 rounded-xl px-1 text-[11px] font-semibold text-zinc-500 transition data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600/30 data-[state=active]:to-cyan-600/20 data-[state=active]:text-zinc-100 data-[state=active]:shadow-inner sm:text-xs">
            <KeyRound className="hidden h-3.5 w-3.5 sm:block" /> {t('rescue.tabApprovals')}
          </TabsTrigger>
          <TabsTrigger value="contracts" className="gap-1 rounded-xl px-1 text-[11px] font-semibold text-zinc-500 transition data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600/30 data-[state=active]:to-cyan-600/20 data-[state=active]:text-zinc-100 data-[state=active]:shadow-inner sm:text-xs">
            <Landmark className="hidden h-3.5 w-3.5 sm:block" /> {t('rescue.tabContracts')}
          </TabsTrigger>
          <TabsTrigger value="dust" className="gap-1 rounded-xl px-1 text-[11px] font-semibold text-zinc-500 transition data-[state=active]:bg-gradient-to-br data-[state=active]:from-violet-600/30 data-[state=active]:to-cyan-600/20 data-[state=active]:text-zinc-100 data-[state=active]:shadow-inner sm:text-xs">
            <BrushCleaning className="hidden h-3.5 w-3.5 sm:block" /> {t('rescue.tabMassive')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="approvals">
          <ApprovalsPanel selectedChains={selectedChains} />
        </TabsContent>
        <TabsContent value="contracts">
          <OldContractsPanel selectedChains={selectedChains} />
        </TabsContent>
        <TabsContent value="dust">
          <DustSweeper selectedChains={selectedChains} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
