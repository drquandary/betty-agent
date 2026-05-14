'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ConnectionStatus {
  kerberos: { ok: boolean; expiresAt?: string };
  controlmaster: { ok: boolean; detail?: string };
  host: string;
}

const POLL_INTERVAL_MS = 30_000;
const KINIT_CMD = 'kinit jvadala@UPENN.EDU';

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
  const [open, setOpen] = useState(false);
  const [rechecking, setRechecking] = useState(false);

  const refresh = useCallback(async () => {
    const next = await fetchStatus();
    setStatus(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const next = await fetchStatus();
      if (!cancelled) {
        setStatus(next);
        setLoading(false);
      }
    };
    tick();
    const id = setInterval(tick, POLL_INTERVAL_MS);
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
      <button
        type="button"
        onClick={() => void refresh()}
        className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-white/20 hover:text-zinc-100"
        title="Click to retry status check"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
        status unavailable
      </button>
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
  const label = allOk ? 'Betty ready' : !kerbOk ? 'kinit needed' : 'ssh stale';

  const handleRecheck = async () => {
    setRechecking(true);
    await refresh();
    setRechecking(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition',
          allOk
            ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/15'
            : !kerbOk
              ? 'border-red-400/25 bg-red-400/10 text-red-300 hover:bg-red-400/15'
              : 'border-amber-400/25 bg-amber-400/10 text-amber-300 hover:bg-amber-400/15',
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Click for connection details and fix steps"
      >
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            dotColor,
            allOk && 'shadow-[0_0_6px_currentColor]',
          )}
        />
        {label}
      </button>

      {open && (
        <ConnectModal
          status={status}
          onClose={() => setOpen(false)}
          onRecheck={handleRecheck}
          rechecking={rechecking}
        />
      )}
    </>
  );
}

function ConnectModal({
  status,
  onClose,
  onRecheck,
  rechecking,
}: {
  status: ConnectionStatus;
  onClose: () => void;
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const kerbOk = status.kerberos.ok;
  const cmOk = status.controlmaster.ok;
  const sshCmd = `ssh ${status.host}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="surface-elevated scroll-custom max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl p-5 text-zinc-100"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold tracking-tight">Connect to Betty</h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">{status.host}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[11px] text-zinc-500 hover:text-zinc-100"
          >
            Close
          </button>
        </div>

        <div className="space-y-3">
          <StepRow
            ok={kerbOk}
            label="Kerberos ticket"
            okDetail={
              status.kerberos.expiresAt
                ? `valid · expires ${status.kerberos.expiresAt}`
                : 'valid'
            }
            badDetail="Missing or expired. Run this in your terminal — it will prompt for your PennKey password and Duo 2FA."
            cmd={!kerbOk ? KINIT_CMD : undefined}
          />
          <StepRow
            ok={cmOk}
            label="SSH ControlMaster"
            okDetail="connection alive"
            badDetail={
              !kerbOk
                ? 'Needs Kerberos first. After kinit succeeds, open an SSH session to start the shared connection.'
                : 'Stale or missing. Open an SSH session to (re)start the shared connection.'
            }
            cmd={kerbOk && !cmOk ? sshCmd : undefined}
          />
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/[0.06] pt-3">
          <p className="text-[10.5px] text-zinc-500">
            Browsers can&apos;t run interactive auth — these commands have to run in a real terminal.
          </p>
          <button
            type="button"
            onClick={onRecheck}
            disabled={rechecking}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06] disabled:opacity-50"
          >
            {rechecking ? 'Re-checking…' : 'Re-check'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StepRow({
  ok,
  label,
  okDetail,
  badDetail,
  cmd,
}: {
  ok: boolean;
  label: string;
  okDetail: string;
  badDetail: string;
  cmd?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3',
        ok
          ? 'border-emerald-400/20 bg-emerald-400/[0.04]'
          : 'border-white/[0.08] bg-white/[0.02]',
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            ok ? 'bg-emerald-400 shadow-[0_0_6px_currentColor]' : 'bg-amber-400',
          )}
        />
        <p className="text-[12px] font-medium text-zinc-100">{label}</p>
        <span
          className={cn(
            'ml-auto text-[10.5px] font-medium',
            ok ? 'text-emerald-300' : 'text-amber-300',
          )}
        >
          {ok ? 'OK' : 'Action needed'}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">
        {ok ? okDetail : badDetail}
      </p>
      {cmd && <CommandRow cmd={cmd} />}
    </div>
  );
}

function CommandRow({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };
  return (
    <div className="mt-2 flex items-center gap-2 rounded-md border border-white/[0.08] bg-[var(--surface-canvas)] px-2.5 py-1.5">
      <code className="flex-1 truncate font-mono text-[11.5px] text-zinc-100">{cmd}</code>
      <button
        type="button"
        onClick={onCopy}
        className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.06]"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
