'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConnectionStatus {
  kerberos: { ok: boolean; expiresAt?: string };
  controlmaster: { ok: boolean; detail?: string };
  host: string;
}

const POLL_INTERVAL_MS = 30_000;

async function fetchStatus(): Promise<ConnectionStatus | null> {
  try {
    const res = await fetch('/api/status/connection', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as ConnectionStatus;
  } catch {
    return null;
  }
}

export function ConnectionBadge() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const next = await fetchStatus();
      if (!cancelled) {
        setStatus(next);
        setLoading(false);
      }
    };
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-500">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600" />
        checking Betty…
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        status unavailable
      </div>
    );
  }

  const kerbOk = status.kerberos.ok;
  const cmOk = status.controlmaster.ok;
  const allOk = kerbOk && cmOk;
  const dotColor = allOk
    ? 'bg-emerald-400'
    : !kerbOk
      ? 'bg-red-400'
      : 'bg-amber-400';
  const label = allOk
    ? 'Betty ready'
    : !kerbOk
      ? 'kinit needed'
      : 'ssh stale';
  const tooltip = [
    `Kerberos: ${kerbOk ? 'valid' : 'missing/expired — run `kinit jvadala@UPENN.EDU`'}`,
    status.kerberos.expiresAt ? `  expires ${status.kerberos.expiresAt}` : '',
    `ControlMaster: ${cmOk ? 'alive' : 'stale/missing — run `ssh ' + status.host + '` in a terminal'}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div
      title={tooltip}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
        allOk
          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
          : !kerbOk
            ? 'border-red-400/25 bg-red-400/10 text-red-300'
            : 'border-amber-400/25 bg-amber-400/10 text-amber-300',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          dotColor,
          allOk && 'shadow-[0_0_6px_currentColor]',
        )}
      />
      {label}
    </div>
  );
}
