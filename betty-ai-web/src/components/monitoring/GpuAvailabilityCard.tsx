'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CHART_PALETTE } from '@/components/charts/palette';
import type { PartitionSummary } from '@/components/dashboard/ClusterOverviewCard';

/**
 * Per-GPU/slice availability card.
 *
 * Motivation: the NodeHeatmap renders one square per *node*, so MIG partitions
 * (one physical B200 sliced into 32 mig45 or 16 mig90 GPUs) look like one
 * tiny square — visually misleading. This card renders one cell per GPU
 * (or per MIG slice), so saturation and availability match the actual
 * scheduling unit users ask for in `--gres=gpu:N`.
 *
 * Data comes from /api/cluster/overview (gpusIdle/gpusTotal per partition);
 * no new backend.
 */

interface OverviewPayload {
  ok: boolean;
  error?: string;
  partitions: PartitionSummary[];
}

interface Props {
  fetcher?: typeof fetch;
}

const POLL_MS = 30_000;

/** MIG partitions live as `*-mig*` or expose a known slice GRES type. */
export function isMigPartition(name: string): boolean {
  return /mig/i.test(name);
}

export function sortPartitions(parts: PartitionSummary[]): PartitionSummary[] {
  return parts
    .filter((p) => p.gpusTotal > 0)
    .slice()
    .sort((a, b) => {
      // MIG partitions last so the eye lands on real GPU partitions first.
      const am = isMigPartition(a.partition) ? 1 : 0;
      const bm = isMigPartition(b.partition) ? 1 : 0;
      if (am !== bm) return am - bm;
      return a.partition.localeCompare(b.partition);
    });
}

export function GpuAvailabilityCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/overview', { cache: 'no-store' });
      const json = (await res.json()) as OverviewPayload;
      setPayload(json);
      setLastUpdated(new Date());
    } catch (err) {
      setPayload({
        ok: false,
        error: err instanceof Error ? err.message : 'fetch failed',
        partitions: [],
      });
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const gpuPartitions = useMemo(
    () => sortPartitions(payload?.partitions ?? []),
    [payload?.partitions],
  );

  const totals = useMemo(() => {
    let free = 0;
    let total = 0;
    for (const p of gpuPartitions) {
      free += p.gpusIdle;
      total += p.gpusTotal;
    }
    return { free, total, usedPct: total > 0 ? Math.round(((total - free) / total) * 100) : 0 };
  }, [gpuPartitions]);

  return (
    <section
      data-testid="gpu-availability-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            GPU availability
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            One cell per GPU. MIG partitions show one cell per slice — what
            <code className="mx-1 rounded bg-white/[0.06] px-1 text-zinc-400">--gres=gpu:N</code>
            actually asks for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-zinc-600">{lastUpdated.toLocaleTimeString()}</span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-zinc-300 transition hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking sinfo…</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : gpuPartitions.length === 0 ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          No GPU partitions reported by sinfo.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Cluster-wide GPU totals */}
          <div className="flex items-baseline justify-between rounded-md border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="flex items-baseline gap-2">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Cluster GPUs free
              </span>
              <span
                className={cn(
                  'text-xl font-semibold tabular-nums',
                  totals.usedPct >= 90
                    ? 'text-red-300'
                    : totals.usedPct >= 60
                      ? 'text-amber-300'
                      : 'text-emerald-300',
                )}
              >
                {totals.free}
              </span>
              <span className="text-[11px] text-zinc-500">/ {totals.total}</span>
            </div>
            <span className="text-[10.5px] text-zinc-500">{totals.usedPct}% allocated</span>
          </div>

          {/* Per-partition cell grids */}
          <div className="flex flex-col gap-2.5">
            {gpuPartitions.map((p) => (
              <PartitionRow key={p.partition} part={p} />
            ))}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-2 text-[10.5px] text-zinc-400">
            <span className="text-[9.5px] uppercase tracking-wider text-zinc-500">Legend</span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-white/10"
                style={{ backgroundColor: CHART_PALETTE.idle }}
              />
              free
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5 rounded-sm ring-1 ring-white/10"
                style={{ backgroundColor: CHART_PALETTE.alloc }}
              />
              allocated
            </span>
            <span className="text-zinc-500">
              · MIG partitions render slices, not physical cards
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function PartitionRow({ part }: { part: PartitionSummary }) {
  const mig = isMigPartition(part.partition);
  const unit = mig ? 'slice' : 'GPU';
  const usedPct = part.gpusTotal > 0 ? Math.round(((part.gpusTotal - part.gpusIdle) / part.gpusTotal) * 100) : 0;
  const cells: Array<'free' | 'busy'> = [];
  for (let i = 0; i < part.gpusIdle; i++) cells.push('free');
  for (let i = part.gpusIdle; i < part.gpusTotal; i++) cells.push('busy');

  return (
    <div className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-mono text-[12px] font-semibold text-zinc-100">
            {part.partition}
          </span>
          {mig && (
            <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-200 ring-1 ring-inset ring-violet-400/30">
              MIG
            </span>
          )}
          <span className="text-[10.5px] text-zinc-500">
            {part.gpusIdle} / {part.gpusTotal} {unit}
            {part.gpusTotal === 1 ? '' : 's'} free
          </span>
        </div>
        <span
          className={cn(
            'text-[10.5px] font-medium tabular-nums',
            usedPct >= 90 ? 'text-red-300' : usedPct >= 60 ? 'text-amber-300' : 'text-emerald-300',
          )}
        >
          {usedPct}%
        </span>
      </div>
      <CellGrid cells={cells} />
      {part.nodesTotal > 0 && (
        <div className="mt-1 text-[10px] text-zinc-600">
          {part.nodesTotal} {part.nodesTotal === 1 ? 'node' : 'nodes'}
          {mig &&
            part.nodesTotal > 0 &&
            ` · ${Math.round(part.gpusTotal / part.nodesTotal)} slices/node`}
        </div>
      )}
    </div>
  );
}

function CellGrid({ cells }: { cells: Array<'free' | 'busy'> }) {
  if (cells.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-[3px]">
      {cells.map((c, i) => (
        <span
          key={i}
          title={c === 'free' ? 'free' : 'allocated'}
          aria-label={c === 'free' ? 'free GPU/slice' : 'allocated GPU/slice'}
          className="block h-3 w-3 rounded-[2px] ring-1 ring-white/5"
          style={{ backgroundColor: c === 'free' ? CHART_PALETTE.idle : CHART_PALETTE.alloc }}
        />
      ))}
    </div>
  );
}
