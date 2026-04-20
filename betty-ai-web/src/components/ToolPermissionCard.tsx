'use client';

/**
 * ToolPermissionCard — renders a `tool_permission` SSE frame as a
 * human-in-the-loop Approve/Deny card.
 *
 * Server contract (see src/app/api/chat/route.ts):
 *   SSE frame: { type: 'tool_permission', id, toolName, tier, summary?, input }
 *   Decision:  PUT /api/chat with { id, decision: 'allow' | 'deny',
 *                                    message?, updatedInput? }
 *
 * If the user disconnects / aborts while a request is pending we treat that
 * as an implicit deny (fail closed — D4 Tier 2 contract).
 */

import { useCallback, useState } from 'react';

export interface ToolPermissionRequest {
  id: string;
  toolName: string;
  tier?: 0 | 1 | 2;
  input: unknown;
  summary?: string;
}

export type ToolPermissionDecision = 'allow' | 'deny';

export interface ToolPermissionCardProps {
  request: ToolPermissionRequest;
  /** Injected for tests. Defaults to window.fetch. */
  fetchImpl?: typeof fetch;
  /** Called after the server acks the decision (or after a fail-closed deny). */
  onResolved?: (decision: ToolPermissionDecision) => void;
  /** Endpoint the PUT hits. Defaults to /api/chat. */
  endpoint?: string;
}

function formatArgs(input: unknown): string {
  if (input == null) return '(no arguments)';
  if (typeof input === 'string') return input;
  try {
    return JSON.stringify(input, null, 2);
  } catch {
    return String(input);
  }
}

export function ToolPermissionCard({
  request,
  fetchImpl,
  onResolved,
  endpoint = '/api/chat',
}: ToolPermissionCardProps) {
  const [resolved, setResolved] = useState<ToolPermissionDecision | null>(null);
  const [pending, setPending] = useState<ToolPermissionDecision | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doFetch = fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);

  const send = useCallback(
    async (decision: ToolPermissionDecision) => {
      if (resolved || pending) return;
      setPending(decision);
      setError(null);

      // Fail-closed: if the page unloads or the request aborts before the
      // server acks, record a local deny so the UI never hangs in an
      // "approved but not confirmed" state.
      const controller = new AbortController();
      const onUnload = () => controller.abort();
      if (typeof window !== 'undefined') {
        window.addEventListener('beforeunload', onUnload);
      }

      try {
        if (!doFetch) throw new Error('fetch unavailable');
        const res = await doFetch(endpoint, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: request.id, decision }),
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`permission PUT failed: ${res.status}`);
        }
        setResolved(decision);
        onResolved?.(decision);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setResolved('deny');
        onResolved?.('deny');
      } finally {
        setPending(null);
        if (typeof window !== 'undefined') {
          window.removeEventListener('beforeunload', onUnload);
        }
      }
    },
    [doFetch, endpoint, onResolved, pending, request.id, resolved],
  );

  const argsText = formatArgs(request.input);

  return (
    <div
      data-testid="tool-permission-card"
      data-request-id={request.id}
      className="rounded-xl border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-sm text-amber-100 shadow"
      role="dialog"
      aria-label={`Approve tool ${request.toolName}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-amber-200">
          Betty wants to run{' '}
          <code className="rounded bg-amber-900/50 px-1.5 py-0.5 text-amber-100">
            {request.toolName}
          </code>
        </div>
        {resolved && (
          <span
            data-testid="tool-permission-status"
            className={
              resolved === 'allow'
                ? 'text-xs font-semibold uppercase tracking-wide text-emerald-300'
                : 'text-xs font-semibold uppercase tracking-wide text-rose-300'
            }
          >
            {resolved === 'allow' ? 'approved' : 'denied'}
          </span>
        )}
      </div>

      {request.summary && (
        <p className="mt-2 text-amber-100/90" data-testid="tool-permission-summary">
          {request.summary}
        </p>
      )}

      <pre
        data-testid="tool-permission-args"
        className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-black/40 p-2 text-xs text-amber-100/90"
      >
        {argsText}
      </pre>

      {error && (
        <p
          data-testid="tool-permission-error"
          className="mt-2 text-xs text-rose-300"
        >
          {error} — failed closed (denied)
        </p>
      )}

      {!resolved && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="tool-permission-approve"
            disabled={pending !== null}
            onClick={() => void send('allow')}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'allow' ? 'Approving…' : 'Approve'}
          </button>
          <button
            type="button"
            data-testid="tool-permission-deny"
            disabled={pending !== null}
            onClick={() => void send('deny')}
            className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100 shadow transition hover:bg-slate-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending === 'deny' ? 'Denying…' : 'Deny'}
          </button>
        </div>
      )}
    </div>
  );
}
