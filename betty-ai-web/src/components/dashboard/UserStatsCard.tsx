'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CostAccount {
  account: string;
  spentPc: number;
  allocatedPc: number;
  usedPct: number;
}

interface QuotaRow {
  filesystem: string;
  used: string;
  quota: string;
  usedPct: number;
}

interface SqueueJob {
  jobId: string;
  partition: string;
  name: string;
  state: string;
  elapsed: string;
  timeLeft: string;
  reasonOrNode: string;
}

interface UserStats {
  cost: { ok: boolean; accounts: CostAccount[]; error?: string };
  quota: { ok: boolean; rows: QuotaRow[]; error?: string };
  jobs: { ok: boolean; jobs: SqueueJob[]; error?: string };
}

const POLL_MS = 60_000;

function pctBar(pct: number): string {
  if (pct >= 90) return 'bg-red-400/70';
  if (pct >= 60) return 'bg-amber-400/70';
  return 'bg-emerald-400/70';
}

function pctText(pct: number): string {
  if (pct >= 90) return 'text-red-300';
  if (pct >= 60) return 'text-amber-300';
  return 'text-emerald-300';
}

interface Props {
  fetcher?: typeof fetch;
}

export function UserStatsCard({ fetcher }: Props = {}) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    const grab = async <T,>(path: string, fallback: T): Promise<T> => {
      try {
        const res = await f(path, { cache: 'no-store' });
        return (await res.json()) as T;
      } catch {
        return fallback;
      }
    };
    const [cost, quota, jobs] = await Promise.all([
      grab<UserStats['cost']>('/api/cluster/cost', { ok: false, accounts: [], error: 'fetch failed' }),
      grab<UserStats['quota']>('/api/cluster/quota', { ok: false, rows: [], error: 'fetch failed' }),
      grab<UserStats['jobs']>('/api/cluster/jobs', { ok: false, jobs: [], error: 'fetch failed' }),
    ]);
    setStats({ cost, quota, jobs });
    setLoading(false);
  }, [fetcher]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const primaryCost = stats?.cost.accounts[0];
  const primaryQuota = stats?.quota.rows[0];
  const runningJobs = stats?.jobs.jobs.filter((j) => j.state === 'RUNNING').length ?? 0;
  const pendingJobs = stats?.jobs.jobs.filter((j) => j.state === 'PENDING').length ?? 0;
  const totalJobs = stats?.jobs.jobs.length ?? 0;

  return (
    <section
      data-testid="user-stats-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
          Your Stats
        </h2>
        <p className="mt-0.5 text-[10.5px] text-zinc-500">Compute budget, storage, and queue</p>
      </header>

      {loading ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">loading your usage…</div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
          {/* Compute budget */}
          <Tile title="Compute budget" hint={primaryCost ? primaryCost.account : 'no allocation found'}>
            {primaryCost ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-xl font-semibold tabular-nums', pctText(primaryCost.usedPct))}>
                    {primaryCost.usedPct}%
                  </span>
                  <span className="text-[10.5px] text-zinc-500">
                    PC {primaryCost.spentPc.toFixed(0)} / {primaryCost.allocatedPc.toFixed(0)}
                  </span>
                </div>
                <Bar pct={primaryCost.usedPct} />
              </>
            ) : (
              <Unavailable error={stats?.cost.error} />
            )}
          </Tile>

          {/* Storage quota */}
          <Tile title="Storage" hint={primaryQuota ? primaryQuota.filesystem : 'no quota data'}>
            {primaryQuota ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-xl font-semibold tabular-nums', pctText(primaryQuota.usedPct))}>
                    {primaryQuota.usedPct.toFixed(0)}%
                  </span>
                  <span className="text-[10.5px] text-zinc-500">
                    {primaryQuota.used} / {primaryQuota.quota}
                  </span>
                </div>
                <Bar pct={primaryQuota.usedPct} />
              </>
            ) : (
              <Unavailable error={stats?.quota.error} />
            )}
          </Tile>

          {/* Jobs */}
          <Tile title="Active jobs" hint="squeue -u">
            {stats?.jobs.ok ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xl font-semibold tabular-nums text-zinc-100">
                    {totalJobs}
                  </span>
                  <span className="text-[10.5px] text-zinc-500">
                    <span className="text-emerald-300">{runningJobs}R</span>{' '}
                    <span className="text-amber-300">{pendingJobs}P</span>
                  </span>
                </div>
                <p className="mt-1 text-[10.5px] text-zinc-500">
                  {totalJobs === 0 ? 'queue is empty' : 'see Workspace → Your Jobs'}
                </p>
              </>
            ) : (
              <Unavailable error={stats?.jobs.error} />
            )}
          </Tile>
        </div>
      )}
    </section>
  );
}

function Tile({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
          {title}
        </span>
        <span className="truncate pl-2 text-[10px] text-zinc-600" title={hint}>
          {hint}
        </span>
      </div>
      {children}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cn('h-full transition-all', pctBar(clamped))}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function Unavailable({ error }: { error?: string }) {
  return (
    <div className="text-[11px] text-zinc-500">
      <span className="font-medium text-zinc-400">unavailable</span>
      {error && <span className="ml-1 text-zinc-600">· {error.slice(0, 80)}</span>}
    </div>
  );
}
