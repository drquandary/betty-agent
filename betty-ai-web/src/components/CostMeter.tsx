'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AccountUsage {
  account: string;
  spentPc: number;
  allocatedPc: number;
  usedPct: number;
}

interface CostPayload {
  ok: boolean;
  error?: string;
  accounts: AccountUsage[];
}

const POLL_MS = 120_000;

export function CostMeter() {
  const [data, setData] = useState<CostPayload | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const res = await fetch('/api/cluster/cost', { cache: 'no-store' });
        const payload = (await res.json()) as CostPayload;
        if (!cancelled) setData(payload);
      } catch {
        if (!cancelled) setData({ ok: false, error: 'fetch failed', accounts: [] });
      }
    };
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (!data || !data.ok || data.accounts.length === 0) {
    return (
      <span className="text-slate-500">
        Cost <span className="ml-1 text-slate-600">—</span>
      </span>
    );
  }
  const primary = data.accounts[0];
  const color =
    primary.usedPct >= 75
      ? 'text-red-300'
      : primary.usedPct >= 50
        ? 'text-amber-300'
        : 'text-emerald-300';
  const tooltip = data.accounts
    .map((a) => `${a.account}: PC ${a.spentPc.toFixed(1)} / ${a.allocatedPc.toFixed(0)} (${a.usedPct}%)`)
    .join('\n');
  return (
    <span title={tooltip} className="text-slate-500">
      Cost{' '}
      <span className={cn('ml-1 font-semibold', color)}>
        {primary.usedPct}%
      </span>
      <span className="ml-1 text-slate-600">
        ({primary.spentPc.toFixed(0)}/{primary.allocatedPc.toFixed(0)})
      </span>
    </span>
  );
}
