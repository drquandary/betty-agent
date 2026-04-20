'use client';

import { useEffect, useMemo, useState } from 'react';
import type { TerminalSessionStatus } from '@/lib/terminal-protocol';
import { TERMINAL_STATUS_EVENT, type TerminalStatusDetail } from '@/lib/terminal-status';
import { cn } from '@/lib/utils';

/**
 * Phase 1: static placeholder chips. Phase 2+ will wire these to:
 *   - Kerberos: `klist` exit + expiry parse
 *   - Quota: `parcc_quota.py` SSH'd over PTY
 *   - Jobs: `squeue -u jvadala --json`
 *   - GPU avail: `parcc_sfree.py --json`
 */

interface Chip {
  label: string;
  value: string;
  state: 'ok' | 'warn' | 'bad' | 'muted';
  tooltip?: string;
}

const CHIPS: Chip[] = [
  { label: 'Quota', value: '—', state: 'muted' },
  { label: 'Jobs', value: '—', state: 'muted' },
  { label: 'GPUs avail', value: '—', state: 'muted' },
];

export function StatusBar() {
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatusDetail>({
    status: 'connecting',
    detail: 'Terminal bridge starting',
  });

  useEffect(() => {
    const onStatus = (event: Event) => {
      setTerminalStatus((event as CustomEvent<TerminalStatusDetail>).detail);
    };
    window.addEventListener(TERMINAL_STATUS_EVENT, onStatus);
    return () => window.removeEventListener(TERMINAL_STATUS_EVENT, onStatus);
  }, []);

  const terminalChip = useMemo(() => terminalStatusToChip(terminalStatus), [terminalStatus]);

  return (
    <footer className="flex items-center justify-between border-t border-slate-800 bg-slate-950/80 px-4 py-2 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">Betty AI</span>
        <span className="text-[10px] text-slate-600">v0.2 • Phase 2</span>
      </div>
      <div className="flex items-center gap-2">
        {[terminalChip, ...CHIPS].map((c) => (
          <div
            key={c.label}
            title={c.tooltip}
            className={cn(
              'flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px]',
              c.state === 'ok' && 'border-emerald-800/60 bg-emerald-950/30 text-emerald-300',
              c.state === 'warn' && 'border-amber-800/60 bg-amber-950/30 text-amber-300',
              c.state === 'bad' && 'border-rose-800/60 bg-rose-950/30 text-rose-300',
              c.state === 'muted' && 'border-slate-800 bg-slate-900/50 text-slate-500',
            )}
          >
            <span className="font-medium">{c.label}</span>
            <span className="text-slate-400">{c.value}</span>
          </div>
        ))}
      </div>
    </footer>
  );
}

function terminalStatusToChip(status: TerminalStatusDetail): Chip {
  if (status.status === 'connected-local') {
    return { label: 'Terminal', value: 'local', state: 'ok', tooltip: status.detail };
  }
  if (status.status === 'connected-betty') {
    return { label: 'Terminal', value: 'Betty', state: 'ok', tooltip: status.detail };
  }
  if (status.status === 'connecting') {
    return { label: 'Terminal', value: 'connecting', state: 'warn', tooltip: status.detail };
  }
  if (status.status === 'error') {
    return { label: 'Terminal', value: 'error', state: 'bad', tooltip: status.detail };
  }
  return { label: 'Terminal', value: 'off', state: 'muted', tooltip: status.detail };
}
