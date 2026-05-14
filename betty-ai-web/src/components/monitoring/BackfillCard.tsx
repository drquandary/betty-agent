'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkline } from '@/components/charts/Sparkline';
import { CHART_PALETTE } from '@/components/charts/palette';
import type { SdiagSnapshot } from '@/app/api/cluster/sdiag/parse';

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
const HISTORY_LEN = 60;

function fmt(value: number | null | undefined, suffix = ''): string {
  if (value == null || !Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 10_000) return `${(value / 1000).toFixed(1)}k${suffix}`;
  if (Number.isInteger(value)) return `${value}${suffix}`;
  return `${value.toFixed(1)}${suffix}`;
}

export function BackfillCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<SdiagPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const historyRef = useRef<Array<{ x: number; y: number }>>([]);
  const [history, setHistory] = useState<Array<{ x: number; y: number }>>([]);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/sdiag', { cache: 'no-store' });
      const json = (await res.json()) as SdiagPayload;
      setPayload(json);
      setLastUpdated(new Date());
      if (json.ok && json.data?.backfill.meanCycleMs != null) {
        const next = [
          ...historyRef.current,
          { x: Date.now(), y: json.data.backfill.meanCycleMs },
        ].slice(-HISTORY_LEN);
        historyRef.current = next;
        setHistory(next);
      }
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

  const bf = payload?.data?.backfill;
  const isEmpty = payload?.ok && payload.data == null;

  return (
    <section
      data-testid="backfill-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Backfill health
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Slurm backfill cycle latency + scheduled depth.
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
      ) : isEmpty || !bf ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          sdiag returned no backfill stats.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="last cycle" value={fmt(bf.lastCycleMs, 'ms')} />
            <Kpi label="mean cycle" value={fmt(bf.meanCycleMs, 'ms')} />
            <Kpi label="depth tried" value={fmt(bf.lastDepthTried)} />
            <Kpi label="total backfilled" value={fmt(bf.totalBackfilledJobs)} />
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-white/5 pt-2">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                mean cycle (last {history.length} polls)
              </span>
              <span className="text-[10.5px] text-zinc-400">
                {history.length === 0
                  ? 'collecting samples...'
                  : `${fmt(bf.meanCycleMs, ' ms')}`}
              </span>
            </div>
            <Sparkline
              points={history}
              width={180}
              height={42}
              color={CHART_PALETTE.alloc}
              ariaLabel="Backfill mean cycle ms over recent polls"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-[13px] font-semibold text-zinc-100 tabular-nums">{value}</div>
    </div>
  );
}
