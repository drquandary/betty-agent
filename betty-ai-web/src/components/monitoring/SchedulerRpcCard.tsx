'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CHART_PALETTE } from '@/components/charts/palette';
import type { SdiagSnapshot, SdiagRpcRow } from '@/app/api/cluster/sdiag/parse';

interface SdiagPayload {
  ok: boolean;
  error?: string;
  data: SdiagSnapshot | null;
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

const POLL_MS = 60_000;
const TOP_N = 5;

function fmtMs(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}s`;
  if (Number.isInteger(value)) return `${value}ms`;
  return `${value.toFixed(1)}ms`;
}

function fmtCount(value: number): string {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}k`;
  return Math.round(value).toString();
}

export function SchedulerRpcCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<SdiagPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/sdiag', { cache: 'no-store' });
      const json = (await res.json()) as SdiagPayload;
      setPayload(json);
      setLastUpdated(new Date());
    } catch (err) {
      setPayload({
        ok: false,
        error: err instanceof Error ? err.message : 'fetch failed',
        data: null,
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

  const rpc = payload?.data?.rpc ?? [];
  const top: SdiagRpcRow[] = useMemo(
    () => [...rpc].sort((a, b) => b.totalTimeMs - a.totalTimeMs).slice(0, TOP_N),
    [rpc],
  );
  const maxMean = useMemo(() => {
    let m = 0;
    for (const r of top) {
      const mean = r.count > 0 ? r.totalTimeMs / r.count : 0;
      if (mean > m) m = mean;
    }
    return m || 1;
  }, [top]);

  const isEmpty = payload?.ok && (payload.data == null || top.length === 0);

  return (
    <section
      data-testid="scheduler-rpc-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Scheduler RPC
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Top {TOP_N} RPCs by cumulative wallclock.
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
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking sdiag...</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          sdiag reported no RPC traffic.
        </div>
      ) : (
        <div className="scroll-custom -mx-1 overflow-x-auto">
          <table data-testid="scheduler-rpc-table" className="w-full text-[11.5px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="px-1 pb-2 text-left font-medium">RPC</th>
                <th className="px-1 pb-2 text-right font-medium">count</th>
                <th className="px-1 pb-2 text-right font-medium">total</th>
                <th className="px-1 pb-2 text-left font-medium">mean</th>
              </tr>
            </thead>
            <tbody>
              {top.map((r) => {
                const mean = r.count > 0 ? r.totalTimeMs / r.count : 0;
                const widthPct = Math.round((mean / maxMean) * 100);
                return (
                  <tr key={r.name} className="border-t border-white/5">
                    <td className="px-1 py-1.5 font-mono text-zinc-200">{r.name}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-zinc-300">
                      {fmtCount(r.count)}
                    </td>
                    <td className="px-1 py-1.5 text-right tabular-nums text-zinc-300">
                      {fmtMs(r.totalTimeMs)}
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="h-full transition-all"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: CHART_PALETTE.alloc,
                              opacity: 0.7,
                            }}
                          />
                        </div>
                        <span className="text-[10.5px] tabular-nums text-zinc-400">
                          {fmtMs(mean)}
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
