'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StackedBar } from '@/components/charts/StackedBar';
import type { SacctSummary } from '@/app/api/cluster/sacct-summary/parse';

interface SacctPayload {
  ok: boolean;
  error?: string;
  hours?: number;
  data: SacctSummary | null;
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

const POLL_MS = 60_000;

// Per-outcome colors (emerald / red / orange / zinc / violet per the wave spec).
const OUTCOME_COLORS: Record<
  'completed' | 'failed' | 'timeout' | 'cancelled' | 'other',
  string
> = {
  completed: '#10b981', // emerald-500
  failed: '#ef4444', // red-500
  timeout: '#f97316', // orange-500
  cancelled: '#71717a', // zinc-500
  other: '#a855f7', // violet-500
};

const OUTCOME_ORDER: Array<'completed' | 'failed' | 'timeout' | 'cancelled' | 'other'> = [
  'completed',
  'failed',
  'timeout',
  'cancelled',
  'other',
];

function fmtHour(hour: string): string {
  // hour like `2026-04-27T14:00:00` -> `14:00`
  const m = /T(\d{2}):(\d{2}):/.exec(hour);
  return m ? `${m[1]}:${m[2]}` : hour;
}

export function JobOutcomeCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<SacctPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/sacct-summary?hours=24', { cache: 'no-store' });
      const json = (await res.json()) as SacctPayload;
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
  const buckets = summary?.buckets ?? [];

  const groups = useMemo(
    () =>
      buckets.map((b) => ({
        label: fmtHour(b.hour),
        segments: OUTCOME_ORDER.map((k) => ({
          key: k,
          value: b[k],
          color: OUTCOME_COLORS[k],
        })).filter((s) => s.value > 0),
      })),
    [buckets],
  );

  const totals = summary?.totals;
  const isEmpty = payload?.ok && (summary == null || buckets.length === 0);

  return (
    <section
      data-testid="job-outcome-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Job outcomes (24h)
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Completed vs failed vs cancelled, hourly.
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
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking sacct...</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          sacct returned no completions in the last 24h.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <StackedBar
            groups={groups}
            legend
            height={Math.max(120, 18 * groups.length + 26)}
            ariaLabel="Job outcomes per hour"
          />
          {totals && (
            <div className="grid grid-cols-5 gap-2 border-t border-white/5 pt-2">
              {OUTCOME_ORDER.map((k) => (
                <div
                  key={k}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block h-2 w-2 rounded-sm"
                      style={{ backgroundColor: OUTCOME_COLORS[k] }}
                    />
                    <span className="text-[9.5px] uppercase tracking-wider text-zinc-500">
                      {k}
                    </span>
                  </div>
                  <div className="text-[13px] font-semibold text-zinc-100 tabular-nums">
                    {totals[k]}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
