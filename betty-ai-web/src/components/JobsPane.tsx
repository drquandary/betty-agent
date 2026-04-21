'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SqueueJob {
  jobId: string;
  partition: string;
  name: string;
  state: string;
  elapsed: string;
  timeLeft: string;
  reasonOrNode: string;
}

interface JobsPayload {
  ok: boolean;
  error?: string;
  jobs: SqueueJob[];
}

const POLL_MS = 15_000;

const STATE_COLOR: Record<string, string> = {
  RUNNING: 'text-emerald-300',
  PENDING: 'text-amber-300',
  COMPLETED: 'text-slate-400',
  CANCELLED: 'text-slate-500',
  FAILED: 'text-red-300',
};

export function JobsPane() {
  const [data, setData] = useState<JobsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/cluster/jobs', { cache: 'no-store' });
        const payload = (await res.json()) as JobsPayload;
        if (!cancelled) {
          setData(payload);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setData({ ok: false, error: 'fetch failed', jobs: [] });
          setLoading(false);
        }
      }
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="scroll-custom border-b border-white/[0.06] bg-white/[0.015] px-4 py-2.5 backdrop-blur-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-400">
          Your Jobs
          {data?.jobs?.length ? (
            <span className="rounded-full border border-indigo-400/20 bg-indigo-400/10 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
              {data.jobs.length}
            </span>
          ) : null}
        </div>
        <span className="text-[10px] text-zinc-600">polls 15s</span>
      </div>
      {loading ? (
        <div className="py-2 text-[11px] text-zinc-600">checking squeue…</div>
      ) : data?.error ? (
        <div className="py-1 text-[11px] text-red-400">{data.error.slice(0, 200)}</div>
      ) : data?.jobs.length === 0 ? (
        <div className="py-1 text-[11px] text-zinc-600">No jobs in queue.</div>
      ) : (
        <div className="scroll-custom max-h-48 overflow-y-auto">
          <table className="w-full text-[11px]">
            <thead className="text-[10px] uppercase text-zinc-600">
              <tr>
                <th className="pb-1.5 text-left font-medium tracking-wider">JobID</th>
                <th className="pb-1.5 text-left font-medium tracking-wider">Name</th>
                <th className="pb-1.5 text-left font-medium tracking-wider">Part</th>
                <th className="pb-1.5 text-left font-medium tracking-wider">State</th>
                <th className="pb-1.5 text-left font-medium tracking-wider">Elapsed</th>
                <th className="pb-1.5 text-left font-medium tracking-wider">Reason/Node</th>
              </tr>
            </thead>
            <tbody>
              {data?.jobs.map((j) => (
                <tr key={j.jobId} className="border-t border-white/5 text-zinc-300 transition hover:bg-white/[0.025]">
                  <td className="py-1 font-mono text-zinc-400">{j.jobId}</td>
                  <td className="py-1 max-w-[120px] truncate" title={j.name}>
                    {j.name}
                  </td>
                  <td className="py-1 text-zinc-400">{j.partition}</td>
                  <td className={cn('py-1 font-semibold', STATE_COLOR[j.state] ?? 'text-zinc-400')}>
                    {j.state}
                  </td>
                  <td className="py-1 font-mono text-zinc-400">{j.elapsed}</td>
                  <td className="py-1 max-w-[120px] truncate text-zinc-500" title={j.reasonOrNode}>
                    {j.reasonOrNode}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
