'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

export interface PartitionSummary {
  partition: string;
  nodesTotal: number;
  gpusIdle: number;
  gpusTotal: number;
  cpusAlloc: number;
  cpusIdle: number;
  cpusOther: number;
  cpusTotal: number;
  memFreeGb: number;
  memTotalGb: number;
  downGpu: number;
}

interface OverviewPayload {
  ok: boolean;
  error?: string;
  partitions: PartitionSummary[];
}

const POLL_MS = 30_000;

function pctColor(used: number): string {
  if (used >= 90) return 'text-red-300';
  if (used >= 60) return 'text-amber-300';
  return 'text-emerald-300';
}

function pctBar(used: number): string {
  if (used >= 90) return 'bg-red-400/70';
  if (used >= 60) return 'bg-amber-400/70';
  return 'bg-emerald-400/70';
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

export function ClusterOverviewCard({ fetcher }: Props = {}) {
  const [data, setData] = useState<OverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/overview', { cache: 'no-store' });
      const payload = (await res.json()) as OverviewPayload;
      setData(payload);
      setLastUpdated(new Date());
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

  return (
    <section
      data-testid="cluster-overview-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Cluster Overview
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Live partitions, GPU + node availability
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-zinc-600">
              {lastUpdated.toLocaleTimeString()}
            </span>
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
      ) : data && !data.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{data.error?.slice(0, 220)}</span>
        </div>
      ) : data && data.partitions.length === 0 ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          No partitions reported.
        </div>
      ) : (
        <div className="scroll-custom -mx-1 overflow-x-auto">
          <table className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-1 pb-2 text-left font-medium">Partition</th>
                <th className="px-1 pb-2 text-right font-medium">GPUs free</th>
                <th className="px-1 pb-2 text-right font-medium">Mem free (GB)</th>
                <th className="px-1 pb-2 text-right font-medium">CPUs free</th>
                <th className="px-1 pb-2 text-left font-medium">Saturation</th>
              </tr>
            </thead>
            <tbody>
              {data?.partitions.map((p) => {
                const gpuUsedPct = p.gpusTotal > 0
                  ? Math.round(((p.gpusTotal - p.gpusIdle) / p.gpusTotal) * 100)
                  : 0;
                return (
                  <tr key={p.partition} className="border-t border-white/5">
                    <td className="px-1 py-1.5 font-mono text-zinc-200">{p.partition}</td>
                    <td className={cn('px-1 py-1.5 text-right font-semibold', pctColor(gpuUsedPct))}>
                      {p.gpusIdle}
                      <span className="ml-0.5 text-zinc-600">/{p.gpusTotal}</span>
                      {p.downGpu > 0 && (
                        <span
                          className="ml-1 text-orange-300"
                          title={`${p.downGpu} GPU${p.downGpu === 1 ? '' : 's'} down/unavailable`}
                        >
                          ↓{p.downGpu}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-1.5 text-right text-zinc-300">
                      {p.memFreeGb.toLocaleString()}
                      <span className="ml-0.5 text-zinc-600">/{p.memTotalGb.toLocaleString()}</span>
                    </td>
                    <td className="px-1 py-1.5 text-right text-zinc-300">
                      {p.cpusIdle}
                      <span className="ml-0.5 text-zinc-600">/{p.cpusTotal}</span>
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className={cn('h-full transition-all', pctBar(gpuUsedPct))}
                            style={{ width: `${gpuUsedPct}%` }}
                          />
                        </div>
                        <span className={cn('text-[10.5px] font-medium', pctColor(gpuUsedPct))}>
                          {gpuUsedPct}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
