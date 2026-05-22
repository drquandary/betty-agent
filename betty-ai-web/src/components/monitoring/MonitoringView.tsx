'use client';

import { PendingReasonsCard } from './PendingReasonsCard';
import { BackfillCard } from './BackfillCard';
import { SchedulerRpcCard } from './SchedulerRpcCard';
import { NodeHeatmapCard } from './NodeHeatmapCard';
import { GpuAvailabilityCard } from './GpuAvailabilityCard';
import { JobOutcomeCard } from './JobOutcomeCard';
import { FairshareCard } from './FairshareCard';

/**
 * Wave 2E wiring.
 *
 * Six monitoring cards bound to their Wave 2D endpoints:
 *   - PendingReasonsCard  -> /api/cluster/pending-reasons
 *   - BackfillCard        -> /api/cluster/sdiag (backfill section)
 *   - SchedulerRpcCard    -> /api/cluster/sdiag (rpc section)
 *   - NodeHeatmapCard     -> /api/cluster/nodes
 *   - JobOutcomeCard      -> /api/cluster/sacct-summary?hours=24
 *   - FairshareCard       -> /api/cluster/sprio  (per-job priority decomposition)
 *
 * Each card has its own card-level data-testid; the wrapper divs preserve the
 * Wave 1B slot testids so selector tests at either layer continue to work.
 */

export function MonitoringView() {
  return (
    <main
      data-testid="monitoring-view"
      className="scroll-custom flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/10 via-transparent to-transparent px-4 py-4 md:px-6 md:py-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
            Monitoring
          </h1>
          <p className="text-[11px] text-zinc-500">
            Live Slurm health + history. 60s polling per card.
          </p>
        </header>
        {/* GPU availability and Node states span full-width — both render
            one cell per scheduling unit, so the 2-col layout forced
            horizontal scrolling on wide partitions like dgx-b200 (27 nodes). */}
        <div data-testid="monitoring-gpu-availability">
          <GpuAvailabilityCard />
        </div>
        <div data-testid="monitoring-node-states">
          <NodeHeatmapCard />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div data-testid="monitoring-pending-reasons">
            <PendingReasonsCard />
          </div>
          <div data-testid="monitoring-backfill-health">
            <BackfillCard />
          </div>
          <div data-testid="monitoring-scheduler-rpc">
            <SchedulerRpcCard />
          </div>
          <div data-testid="monitoring-job-outcomes">
            <JobOutcomeCard />
          </div>
          <div data-testid="monitoring-fairshare">
            <FairshareCard />
          </div>
        </div>
      </div>
    </main>
  );
}
