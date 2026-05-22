'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { StackedBar } from '@/components/charts/StackedBar';
import { CHART_PALETTE } from '@/components/charts/palette';
import type { SprioJob } from '@/app/api/cluster/sprio/parse';

interface SprioPayload {
  ok: boolean;
  error?: string;
  jobs: SprioJob[];
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

const POLL_MS = 60_000;

// Decomposition keys -> palette tokens. partitionFactor is folded into 'other'
// when sprio doesn't expose it as its own field on SprioJob (it currently
// surfaces `partition` as a name only — the factor is rolled into the priority
// composite).
const FACTOR_COLORS: Record<string, string> = {
  age: CHART_PALETTE.idle,
  fairshare: CHART_PALETTE.alloc,
  jobSize: CHART_PALETTE.mix,
  qos: CHART_PALETTE.resv,
  other: CHART_PALETTE.other,
};

const FACTOR_ORDER: Array<'age' | 'fairshare' | 'jobSize' | 'qos' | 'other'> = [
  'age',
  'fairshare',
  'jobSize',
  'qos',
  'other',
];

interface DecomposedJob {
  jobId: string;
  partition: string;
  priority: number;
  segments: Array<{ key: string; value: number; color: string }>;
}

function decompose(j: SprioJob): DecomposedJob {
  // We don't know if SprioJob carries a partition-factor field — TypeScript
  // says it doesn't, so we fold the residual (priority - sum of known factors)
  // into 'other'. This also catches TRES contributions when sprio's TRES is
  // non-numeric.
  const known = j.age + j.fairshare + j.jobSize + j.qos;
  const residual = Math.max(0, j.priority - known);
  const segments = [
    { key: 'age', value: Math.max(0, j.age), color: FACTOR_COLORS.age },
    { key: 'fairshare', value: Math.max(0, j.fairshare), color: FACTOR_COLORS.fairshare },
    { key: 'jobSize', value: Math.max(0, j.jobSize), color: FACTOR_COLORS.jobSize },
    { key: 'qos', value: Math.max(0, j.qos), color: FACTOR_COLORS.qos },
    { key: 'other', value: residual, color: FACTOR_COLORS.other },
  ].filter((s) => s.value > 0);
  return {
    jobId: j.jobId,
    partition: j.partition,
    priority: j.priority,
    segments,
  };
}

export function FairshareCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<SprioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/sprio', { cache: 'no-store' });
      const json = (await res.json()) as SprioPayload;
      setPayload(json);
      setLastUpdated(new Date());
    } catch (err) {
      setPayload({
        ok: false,
        error: err instanceof Error ? err.message : 'fetch failed',
        jobs: [],
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

  const jobs = payload?.jobs ?? [];
  const decomposed = useMemo(() => jobs.map(decompose), [jobs]);
  const groups = useMemo(
    () =>
      decomposed.map((d) => ({
        label: d.jobId,
        segments: d.segments,
      })),
    [decomposed],
  );

  const isEmpty = payload?.ok && jobs.length === 0;

  return (
    <section
      data-testid="fairshare-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Fairshare
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Priority decomposition for your pending jobs.
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

      {/*
        Factor legend rendered above the chart so it's visible even when
        there are no pending jobs to show. Users learn what the colors mean
        before they ever see the stacked bar.
      */}
      <FactorKey />

      {loading ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking sprio...</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-500">
          no pending jobs - you&apos;re either running or queued past sprio&apos;s horizon.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <StackedBar
            groups={groups}
            legend={false}
            height={Math.max(120, 22 * groups.length + 26)}
            ariaLabel="Priority decomposition per pending job"
          />
        </div>
      )}
    </section>
  );
}

/**
 * Always-visible factor legend. Shown above the chart so users see what each
 * color means even when there are no pending jobs.
 */
function FactorKey() {
  const meanings: Record<typeof FACTOR_ORDER[number], string> = {
    age: 'time waited',
    fairshare: 'account usage',
    jobSize: 'requested size',
    qos: 'QOS priority',
    other: 'leftover',
  };
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10.5px]">
      <span className="text-[9.5px] uppercase tracking-wider text-zinc-500">Legend</span>
      {FACTOR_ORDER.map((k) => (
        <span key={k} className="flex items-center gap-1.5 text-zinc-300">
          <span
            className="inline-block h-2 w-2 rounded-sm ring-1 ring-white/10"
            style={{ backgroundColor: FACTOR_COLORS[k] }}
          />
          <span className="font-medium">{k}</span>
          <span className="text-zinc-500">· {meanings[k]}</span>
        </span>
      ))}
    </div>
  );
}
