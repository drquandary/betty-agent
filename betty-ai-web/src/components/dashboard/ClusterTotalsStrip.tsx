'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Cluster-wide rollup that sits above the per-partition Cluster Overview.
 *
 * Reuses /api/cluster/overview (no new backend) and aggregates the same data
 * the table below it shows in detail. The goal is one glance at "is Betty
 * busy or free right now?" before diving into the partition rows.
 *
 * Color thresholds match ClusterOverviewCard / UserStatsCard:
 *   <60% used → emerald (idle), <90% → amber (busy), ≥90% → red (saturated)
 */

import type { PartitionSummary } from './ClusterOverviewCard';

interface OverviewPayload {
  ok: boolean;
  error?: string;
  partitions: PartitionSummary[];
}

export interface Rollup {
  partitions: number;
  gpusFree: number;
  gpusTotal: number;
  gpusDown: number;
  nodesTotal: number;
  cpusFree: number;
  cpusTotal: number;
  /** Partitions where GPU saturation is ≥ 90% (and they actually have GPUs). */
  saturatedGpuPartitions: string[];
  /** Partitions reporting DOWN/unavailable GPUs. */
  downPartitions: string[];
}

export function rollup(parts: PartitionSummary[]): Rollup {
  const r: Rollup = {
    partitions: parts.length,
    gpusFree: 0,
    gpusTotal: 0,
    gpusDown: 0,
    nodesTotal: 0,
    cpusFree: 0,
    cpusTotal: 0,
    saturatedGpuPartitions: [],
    downPartitions: [],
  };
  for (const p of parts) {
    r.gpusFree += p.gpusIdle;
    r.gpusTotal += p.gpusTotal;
    r.gpusDown += p.downGpu;
    r.nodesTotal += p.nodesTotal;
    r.cpusFree += p.cpusIdle;
    r.cpusTotal += p.cpusTotal;
    if (p.gpusTotal > 0 && p.gpusIdle === 0) r.saturatedGpuPartitions.push(p.partition);
    if (p.downGpu > 0) r.downPartitions.push(p.partition);
  }
  return r;
}

const POLL_MS = 30_000;

function pctText(usedPct: number): string {
  if (usedPct >= 90) return 'text-red-300';
  if (usedPct >= 60) return 'text-amber-300';
  return 'text-emerald-300';
}

function pctBar(usedPct: number): string {
  if (usedPct >= 90) return 'bg-red-400/70';
  if (usedPct >= 60) return 'bg-amber-400/70';
  return 'bg-emerald-400/70';
}

interface Props {
  fetcher?: typeof fetch;
}

export function ClusterTotalsStrip({ fetcher }: Props = {}) {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/overview', { cache: 'no-store' });
      const payload = (await res.json()) as OverviewPayload;
      setData(payload);
    } catch (err) {
      setData({
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

  if (loading) {
    return (
      <section
        data-testid="cluster-totals-strip"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.015] px-4 py-3 backdrop-blur-sm"
      >
        <div className="text-[11.5px] text-zinc-600">rolling up cluster totals…</div>
      </section>
    );
  }
  if (!data?.ok || data.partitions.length === 0) {
    return (
      <section
        data-testid="cluster-totals-strip"
        className="rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 backdrop-blur-sm"
      >
        <span className="text-[11.5px] font-semibold text-amber-200">Cluster totals unavailable.</span>
        {data?.error && (
          <span className="ml-2 text-[11.5px] text-amber-200/70">{data.error.slice(0, 220)}</span>
        )}
      </section>
    );
  }

  const r = rollup(data.partitions);
  const gpuUsedPct = r.gpusTotal > 0 ? Math.round(((r.gpusTotal - r.gpusFree) / r.gpusTotal) * 100) : 0;
  const cpuUsedPct = r.cpusTotal > 0 ? Math.round(((r.cpusTotal - r.cpusFree) / r.cpusTotal) * 100) : 0;
  const downPct = r.gpusTotal > 0 ? Math.round((r.gpusDown / r.gpusTotal) * 100) : 0;

  return (
    <section
      data-testid="cluster-totals-strip"
      className="rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.025] to-white/[0.005] p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
          Cluster · at a glance
        </h2>
        <span className="text-[10.5px] text-zinc-500">{r.partitions} partitions</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric
          label="GPUs free"
          big={`${r.gpusFree}`}
          unit={`/ ${r.gpusTotal}`}
          usedPct={gpuUsedPct}
          subline={`${gpuUsedPct}% allocated`}
        />
        <Metric
          label="GPUs down"
          big={`${r.gpusDown}`}
          unit={`/ ${r.gpusTotal}`}
          usedPct={downPct === 0 ? 0 : Math.max(60, downPct)}
          subline={r.gpusDown === 0 ? 'none down' : `${downPct}% unavailable`}
        />
        <Metric
          label="CPUs free"
          big={`${r.cpusFree.toLocaleString()}`}
          unit={`/ ${r.cpusTotal.toLocaleString()}`}
          usedPct={cpuUsedPct}
          subline={`${cpuUsedPct}% allocated`}
        />
        <AlertsTile rollup={r} />
      </div>
    </section>
  );
}

function Metric({
  label,
  big,
  unit,
  usedPct,
  subline,
}: {
  label: string;
  big: string;
  unit: string;
  usedPct: number;
  subline: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn('text-2xl font-semibold tabular-nums', pctText(usedPct))}>{big}</span>
        <span className="text-[11px] text-zinc-500">{unit}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn('h-full transition-all', pctBar(usedPct))}
          style={{ width: `${Math.max(0, Math.min(100, usedPct))}%` }}
        />
      </div>
      <div className="mt-1.5 text-[10.5px] text-zinc-500">{subline}</div>
    </div>
  );
}

function AlertsTile({ rollup: r }: { rollup: Rollup }) {
  const items: Array<{ tone: 'red' | 'amber' | 'orange'; label: string; parts: string[] }> = [];
  if (r.saturatedGpuPartitions.length > 0) {
    items.push({ tone: 'red', label: 'GPU-saturated', parts: r.saturatedGpuPartitions });
  }
  if (r.downPartitions.length > 0) {
    items.push({ tone: 'orange', label: 'GPUs down', parts: r.downPartitions });
  }
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
        Alerts
      </div>
      {items.length === 0 ? (
        <div className="text-[11.5px] text-emerald-300">all partitions healthy</div>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li key={it.label} className="text-[11px] leading-snug">
              <span
                className={cn(
                  'mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle',
                  it.tone === 'red' && 'bg-red-400',
                  it.tone === 'amber' && 'bg-amber-400',
                  it.tone === 'orange' && 'bg-orange-400',
                )}
              />
              <span className="font-semibold text-zinc-200">{it.label}</span>{' '}
              <span className="text-zinc-500" title={it.parts.join(', ')}>
                · {it.parts.length === 1 ? it.parts[0] : `${it.parts.length} partitions`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
