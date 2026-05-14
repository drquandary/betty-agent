'use client';

import { useCallback, useEffect, useState } from 'react';
import { Donut } from '@/components/charts/Donut';
import { StackedBar } from '@/components/charts/StackedBar';
import { paletteColor } from '@/components/charts/palette';
import type { PendingReasonsSummary } from '@/app/api/cluster/pending-reasons/parse';

interface PendingReasonsPayload {
  ok: boolean;
  error?: string;
  data: PendingReasonsSummary | null;
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

const POLL_MS = 60_000;
const TOP_SLICES = 7;

export function PendingReasonsCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<PendingReasonsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showPartitions, setShowPartitions] = useState(false);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/pending-reasons', { cache: 'no-store' });
      const json = (await res.json()) as PendingReasonsPayload;
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

  const summary = payload?.data ?? null;
  const byReason = summary?.byReason ?? [];
  const top = byReason.slice(0, TOP_SLICES);
  const overflow = byReason.slice(TOP_SLICES);
  const overflowSum = overflow.reduce((acc, r) => acc + r.count, 0);
  const slices = top.map((r, i) => ({
    label: r.reason,
    value: r.count,
    color: paletteColor(i),
  }));
  if (overflowSum > 0) {
    slices.push({
      label: 'other',
      value: overflowSum,
      color: paletteColor(TOP_SLICES),
    });
  }

  const partitionGroups =
    summary?.byPartition.map((p) => ({
      label: p.partition,
      segments: p.reasons.map((r, i) => ({
        key: r.reason,
        value: r.count,
        color: paletteColor(i),
      })),
    })) ?? [];

  const isEmpty = payload?.ok && (summary == null || summary.total === 0);

  return (
    <section
      data-testid="pending-reasons-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Pending reasons
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Why jobs are waiting - Priority, Resources, AssocGrp, etc.
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
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking squeue...</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          No pending jobs reported.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <Donut slices={slices} size={120} ariaLabel="Pending reasons donut" />
            <div className="flex flex-col gap-1 text-[11px]">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                Total pending
              </span>
              <span className="text-base font-semibold text-zinc-100 tabular-nums">
                {summary?.total ?? 0}
              </span>
              <ul className="mt-1 space-y-0.5">
                {top.slice(0, 5).map((r, i) => (
                  <li
                    key={r.reason}
                    className="flex items-center gap-2 text-[10.5px] text-zinc-400"
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: paletteColor(i) }}
                    />
                    <span className="font-mono">{r.reason}</span>
                    <span className="tabular-nums text-zinc-500">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {partitionGroups.length > 0 && (
            <div className="border-t border-white/5 pt-2">
              <button
                type="button"
                onClick={() => setShowPartitions((v) => !v)}
                className="text-[10.5px] uppercase tracking-wider text-zinc-500 transition hover:text-zinc-300"
              >
                {showPartitions ? 'v' : '>'} By partition
              </button>
              {showPartitions && (
                <div className="mt-2">
                  <StackedBar
                    groups={partitionGroups}
                    legend
                    height={Math.max(80, 22 * partitionGroups.length + 26)}
                    ariaLabel="Pending reasons by partition"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
