'use client';

/**
 * Consolidated color-coding key for everything on the dashboard, monitoring,
 * and the SlurmCards rendered inside chat. When a new colored surface is
 * added anywhere in the app, add its entry here so users have one place to
 * decode what a tint means.
 *
 * Chart-section colors source from charts/palette so this card stays in sync
 * with what Donut / StackedBar / Heatmap actually paint. Threshold colors
 * (60/90% from ClusterOverviewCard + UserStatsCard) are encoded inline since
 * they live in pctColor/pctBar helpers, not in a shared module.
 */

import { CHART_PALETTE } from '../charts/palette';
import { cn } from '@/lib/utils';

interface Entry {
  /** Either a tailwind background class OR a hex color string. */
  swatch: string;
  /** True if `swatch` is a hex color (gets inlined as background-color). */
  hex?: boolean;
  label: string;
  meaning: string;
}

interface Section {
  title: string;
  source: string;
  entries: Entry[];
}

const SECTIONS: Section[] = [
  {
    title: 'Saturation (used % of capacity)',
    source: 'Dashboard · Cluster Overview, Your Stats, Cluster · at a glance',
    entries: [
      { swatch: 'bg-emerald-400/70', label: '< 60% used', meaning: 'Plenty of headroom — jobs likely start fast.' },
      { swatch: 'bg-amber-400/70', label: '60 – 89% used', meaning: 'Busy. Expect short queue waits.' },
      { swatch: 'bg-red-400/70', label: '≥ 90% used', meaning: 'Saturated. Plan for longer waits or try another partition.' },
    ],
  },
  {
    title: 'Job state (squeue)',
    source: 'Workspace · Your Jobs · UserStatsCard',
    entries: [
      { swatch: 'bg-emerald-300', label: 'RUNNING', meaning: 'Executing on its allocated node(s).' },
      { swatch: 'bg-amber-300', label: 'PENDING', meaning: 'In queue waiting on resources, priority, or dependencies.' },
      { swatch: 'bg-slate-400', label: 'COMPLETED', meaning: 'Finished with exit code 0.' },
      { swatch: 'bg-slate-500', label: 'CANCELLED', meaning: 'Killed by user or admin (scancel).' },
      { swatch: 'bg-red-300', label: 'FAILED', meaning: 'Non-zero exit. Check slurm-<jobid>.out or ask Betty to diagnose.' },
    ],
  },
  {
    title: 'Slurm node state',
    source: 'Monitoring · charts (Donut, StackedBar, Heatmap)',
    entries: [
      { swatch: CHART_PALETTE.idle, hex: true, label: 'idle', meaning: 'Partition has spare capacity.' },
      { swatch: CHART_PALETTE.mix, hex: true, label: 'mix', meaning: 'Node is partially allocated.' },
      { swatch: CHART_PALETTE.alloc, hex: true, label: 'alloc', meaning: 'Fully allocated.' },
      { swatch: CHART_PALETTE.drain, hex: true, label: 'drain', meaning: 'Administratively draining — no new jobs accepted.' },
      { swatch: CHART_PALETTE.down, hex: true, label: 'down', meaning: 'Unavailable or failed.' },
      { swatch: CHART_PALETTE.maint, hex: true, label: 'maint', meaning: 'Under maintenance.' },
      { swatch: CHART_PALETTE.resv, hex: true, label: 'resv', meaning: 'Reserved for a specific job/user.' },
      { swatch: CHART_PALETTE.other, hex: true, label: 'other', meaning: 'Uncategorized state.' },
    ],
  },
  {
    title: 'Alerts (cluster strip)',
    source: 'Dashboard · Cluster · at a glance',
    entries: [
      { swatch: 'bg-red-400', label: 'GPU-saturated', meaning: 'Partition has 0 idle GPUs of its total.' },
      { swatch: 'bg-amber-400', label: 'No idle nodes', meaning: 'Every node is mixed or allocated — no fresh starts.' },
      { swatch: 'bg-orange-400', label: 'Has drained/down', meaning: 'CPUs are in non-running state — capacity is reduced.' },
    ],
  },
  {
    title: 'Sbatch check verdict',
    source: 'Chat · Sbatch check card',
    entries: [
      { swatch: 'bg-emerald-500', label: 'OK', meaning: 'No blocking issues — ready to submit.' },
      { swatch: 'bg-amber-500', label: 'Revise', meaning: 'Will submit but likely suboptimal. Apply suggestions first.' },
      { swatch: 'bg-rose-500', label: 'Block', meaning: 'Will reject or run unsafely. Fix listed issues.' },
    ],
  },
  {
    title: 'Issue severity',
    source: 'Chat · Sbatch check card',
    entries: [
      { swatch: 'bg-rose-400', label: 'Error', meaning: 'Blocking — will not run as written.' },
      { swatch: 'bg-amber-400', label: 'Warn', meaning: 'Will run but is wasteful, slow, or fragile.' },
      { swatch: 'bg-sky-400', label: 'Info', meaning: 'Heads-up only. No action required.' },
    ],
  },
  {
    title: 'VRAM constraint',
    source: 'Chat · Recommend card',
    entries: [
      { swatch: 'bg-emerald-500', label: 'VRAM enforced', meaning: 'Min VRAM/GPU is set; small GPUs excluded.' },
      { swatch: 'bg-amber-500', label: 'VRAM not constrained', meaning: 'No floor — a 70B request could land on a small MIG. Set min-VRAM.' },
    ],
  },
  {
    title: 'Slot confidence',
    source: 'Chat · Calendar card',
    entries: [
      { swatch: 'bg-emerald-500', label: 'High', meaning: 'Backfill estimate within bf_window. Treat as upper bound.' },
      { swatch: 'bg-amber-500', label: 'Medium', meaning: 'Ranked by historical load curve.' },
      { swatch: 'bg-rose-500', label: 'Low (heuristic)', meaning: 'Synthetic load curve — guessed pattern, not Betty history.' },
    ],
  },
  {
    title: 'Priority decomposition (sprio)',
    source: 'Chat · Diagnose card',
    entries: [
      { swatch: 'bg-rose-500/40', label: 'Bottleneck row tint', meaning: 'Factor holding your priority down the most.' },
      { swatch: 'bg-emerald-500/40', label: 'Helping row tint', meaning: 'Factor pushing your priority up the most.' },
    ],
  },
];

function Swatch({ entry }: { entry: Entry }) {
  return (
    <span
      className={cn(
        'inline-block h-3 w-3 shrink-0 rounded-sm ring-1 ring-white/10',
        entry.hex ? '' : entry.swatch,
      )}
      style={entry.hex ? { backgroundColor: entry.swatch } : undefined}
    />
  );
}

export function LegendCard() {
  return (
    <section
      data-testid="legend-card"
      className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Color key
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Every color used across the dashboard, monitoring tab, and chat cards.
          </p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((sec) => (
          <div key={sec.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="mb-1.5">
              <h3 className="text-[11px] font-semibold tracking-wide text-zinc-200">{sec.title}</h3>
              <div className="text-[9.5px] uppercase tracking-wider text-zinc-500">{sec.source}</div>
            </div>
            <ul className="space-y-1.5">
              {sec.entries.map((e) => (
                <li key={e.label} className="flex items-start gap-2 text-[11px] leading-snug">
                  <span className="mt-0.5">
                    <Swatch entry={e} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-zinc-200">{e.label}</span>
                    <span className="ml-1.5 text-zinc-400">— {e.meaning}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
