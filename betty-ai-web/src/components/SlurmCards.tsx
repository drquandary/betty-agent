'use client';

/**
 * Rich renderers for the slurm_* tools' output.
 *
 * Convention: each tool returns a fenced markdown block tagged
 * `betty-slurm-<kind>` whose body is the JSON payload. ChatMessage's `code`
 * renderer keys on the language tag and swaps in one of these components.
 *
 * Kinds:
 *   - check     → SlurmCheckCard
 *   - recommend → SlurmRecommendCard
 *   - diagnose  → SlurmDiagnoseCard
 *   - calendar  → SlurmCalendarCard
 *
 * If the JSON fails to parse or the `kind` is unknown, the fallback is a
 * plain code block — the user still sees something useful.
 */

import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types — kept local so the component file doesn't depend on the agent code.
// ---------------------------------------------------------------------------

interface CheckIssue {
  severity: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  suggestion?: string | null;
  field?: string | null;
}

interface CheckPayload {
  status: 'ok' | 'revise' | 'block';
  summary: string;
  issues: CheckIssue[];
  parsed: Record<string, unknown>;
  suggested_sbatch?: string | null;
}

interface RecommendPayload {
  intent: Record<string, unknown>;
  result: {
    feasible: boolean;
    partition?: string | null;
    qos?: string | null;
    nodes: number;
    gpus_per_node: number;
    cpus_per_task: number;
    mem_gb: number;
    time_seconds: number;
    billing_score: number;
    backend: string;
    explanation: string[];
    sbatch_block: string;
    rejected?: Array<[string, string]>;
  };
  sbatch_block: string;
  notes?: string[];
  fairshare?: {
    rows: Array<Record<string, string>>;
    source: string | null;
    raw_stdout_excerpt?: string;
    dropped_count?: number;
    dropped_samples?: string[];
  };
  vram_constraint?: {
    enforced: boolean;
    min_vram_per_gpu_gb: number | null;
    message: string;
  };
}

interface DiagnosePayload {
  job_id: string;
  state: string;
  reason?: string | null;
  request: Record<string, unknown>;
  likely_causes: string[];
  suggested_actions: string[];
  priority_factors?: Record<string, number>;
  priority_dominant_positive?: string | null;
  priority_dominant_negative?: string | null;
}

interface CalendarSlot {
  start: string;
  end: string;
  start_local: string;
  partition: string;
  gpus: number;
  score: number;
  reasons: string[];
}

interface CalendarPayload {
  gpus: number;
  hours: number;
  partition?: string | null;
  slots: CalendarSlot[];
  sources?: string[];
  score_formula?: string;
  load_curve_kind?: 'historical' | 'synthetic';
}

// ---------------------------------------------------------------------------
// Card primitives
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: CheckPayload['status'] }) {
  const classes = {
    ok: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30',
    revise: 'bg-amber-500/15 text-amber-200 ring-amber-400/30',
    block: 'bg-rose-500/15 text-rose-200 ring-rose-400/30',
  }[status];
  const label = { ok: 'OK', revise: 'Revise', block: 'Block' }[status];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset',
        classes,
      )}
    >
      {label}
    </span>
  );
}

function SeverityDot({ severity }: { severity: CheckIssue['severity'] }) {
  const color =
    severity === 'error'
      ? 'bg-rose-400'
      : severity === 'warn'
      ? 'bg-amber-400'
      : 'bg-sky-400';
  return <span className={cn('mt-1.5 inline-block h-2 w-2 rounded-full', color)} />;
}

function CardShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="not-prose my-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-wide text-zinc-300">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-xs text-zinc-400">{subtitle}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1) sbatch check report
// ---------------------------------------------------------------------------

export function SlurmCheckCard({ payload }: { payload: CheckPayload }) {
  return (
    <CardShell
      title="Sbatch check"
      subtitle={payload.summary}
      right={<StatusPill status={payload.status} />}
    >
      {payload.issues.length > 0 && (
        <ul className="space-y-2">
          {payload.issues.map((iss, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <SeverityDot severity={iss.severity} />
              <div className="flex-1">
                <div className="text-zinc-200">{iss.message}</div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-500">
                  {iss.code}
                  {iss.field ? ` · ${iss.field}` : ''}
                </div>
                {iss.suggestion && (
                  <pre className="mt-1.5 overflow-x-auto rounded bg-black/40 px-2 py-1 text-xs text-emerald-200">
                    <code>{iss.suggestion}</code>
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {payload.suggested_sbatch && (
        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Suggested sbatch
          </div>
          <pre className="overflow-x-auto rounded-lg bg-black/50 p-3 text-xs leading-relaxed text-zinc-100 ring-1 ring-white/5">
            <code>{payload.suggested_sbatch}</code>
          </pre>
        </div>
      )}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// 2) recommendation card
// ---------------------------------------------------------------------------

function fmtSeconds(s: number): string {
  if (s <= 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function SlurmRecommendCard({ payload }: { payload: RecommendPayload }) {
  const r = payload.result;
  if (!r.feasible) {
    return (
      <CardShell
        title="Recommendation"
        subtitle="No feasible shape found."
        right={<StatusPill status="block" />}
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-300">
          {r.explanation.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </CardShell>
    );
  }
  return (
    <CardShell
      title="Recommended shape"
      subtitle={`Solver: ${r.backend} · billing score ${Math.round(r.billing_score).toLocaleString()}`}
      right={<StatusPill status="ok" />}
    >
      {/*
        VRAM disclaimer — Ryan's correctness concern. Always shown, color-coded
        green when enforced, amber when not. Without this, a 70B fine-tune
        request with no VRAM floor could be silently routed to a 45 GB MIG.
      */}
      {payload.vram_constraint && (
        <div
          className={cn(
            'mb-3 rounded-md px-3 py-2 text-xs ring-1 ring-inset',
            payload.vram_constraint.enforced
              ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30'
              : 'bg-amber-500/10 text-amber-200 ring-amber-400/30',
          )}
        >
          <span className="font-semibold uppercase tracking-wide">
            {payload.vram_constraint.enforced ? 'VRAM enforced' : 'VRAM not constrained'}
          </span>
          <span className="ml-2">{payload.vram_constraint.message}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
        <div><div className="text-[11px] uppercase text-zinc-500">Partition</div><div className="text-zinc-100">{r.partition}</div></div>
        <div><div className="text-[11px] uppercase text-zinc-500">QOS</div><div className="text-zinc-100">{r.qos ?? '—'}</div></div>
        <div><div className="text-[11px] uppercase text-zinc-500">Nodes × GPUs</div><div className="text-zinc-100">{r.nodes} × {r.gpus_per_node}</div></div>
        <div><div className="text-[11px] uppercase text-zinc-500">CPUs/task</div><div className="text-zinc-100">{r.cpus_per_task}</div></div>
        <div><div className="text-[11px] uppercase text-zinc-500">Memory</div><div className="text-zinc-100">{r.mem_gb} GB</div></div>
        <div><div className="text-[11px] uppercase text-zinc-500">Walltime</div><div className="text-zinc-100">{fmtSeconds(r.time_seconds)}</div></div>
      </div>
      {r.rejected && r.rejected.length > 0 && (
        <div className="mt-3 text-[11px] text-zinc-500">
          <span className="font-semibold uppercase tracking-wide text-zinc-400">
            Excluded partitions:
          </span>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {r.rejected.map(([name, why], i) => (
              <li key={i}>
                <span className="text-zinc-300">{name}</span> — {why}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.explanation.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-zinc-400">
          {r.explanation.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
      <pre className="mt-3 overflow-x-auto rounded-lg bg-black/50 p-3 text-xs leading-relaxed text-zinc-100 ring-1 ring-white/5">
        <code>{payload.sbatch_block}</code>
      </pre>
      {payload.fairshare && (payload.fairshare.rows?.length || payload.fairshare.raw_stdout_excerpt) && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Account fairshare (live, sshare)
          </div>
          {payload.fairshare.rows && payload.fairshare.rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
                    <th className="py-0.5 pr-3">Account</th>
                    <th className="py-0.5 pr-3">User</th>
                    <th className="py-0.5 pr-3">RawUsage</th>
                    <th className="py-0.5 pr-3">EffectvUsage</th>
                    <th className="py-0.5 pr-3">FairShare</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.fairshare.rows.map((row, i) => (
                    <tr key={i} className="border-t border-white/5">
                      <td className="py-0.5 pr-3 text-zinc-200">{row.Account}</td>
                      <td className="py-0.5 pr-3 text-zinc-300">{row.User}</td>
                      <td className="py-0.5 pr-3 text-zinc-300">{row.RawUsage}</td>
                      <td className="py-0.5 pr-3 text-zinc-300">{row.EffectvUsage}</td>
                      <td className="py-0.5 pr-3 text-zinc-300">{row.FairShare}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {payload.fairshare.dropped_count != null && payload.fairshare.dropped_count > 0 && (
            <div className="mt-2 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-200 ring-1 ring-inset ring-amber-400/30">
              <span className="font-semibold">
                {payload.fairshare.dropped_count} suspicious row{payload.fairshare.dropped_count === 1 ? '' : 's'} dropped
              </span>{' '}
              by the defensive parser (likely header rows or MOTD junk).
              {payload.fairshare.dropped_samples && payload.fairshare.dropped_samples.length > 0 && (
                <details className="mt-1">
                  <summary className="cursor-pointer hover:text-amber-100">
                    show samples
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px] leading-relaxed">
                    <code>{payload.fairshare.dropped_samples.join('\n')}</code>
                  </pre>
                </details>
              )}
            </div>
          )}
          {payload.fairshare.raw_stdout_excerpt && (
            <details className="mt-2 text-[11px] text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-300">
                raw sshare stdout (first 800 chars) — for debugging the parser
              </summary>
              <pre className="mt-2 overflow-x-auto rounded bg-black/40 p-2 text-[10px] leading-relaxed">
                <code>{payload.fairshare.raw_stdout_excerpt}</code>
              </pre>
            </details>
          )}
        </div>
      )}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// 3) pending-job diagnosis
// ---------------------------------------------------------------------------

export function SlurmDiagnoseCard({ payload }: { payload: DiagnosePayload }) {
  return (
    <CardShell
      title={`Job ${payload.job_id} diagnosis`}
      subtitle={`State: ${payload.state}${payload.reason ? ` · Reason: ${payload.reason}` : ''}`}
    >
      {payload.likely_causes.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Likely causes
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-200">
            {payload.likely_causes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
      {payload.suggested_actions.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Suggested actions
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-emerald-200">
            {payload.suggested_actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}
      {payload.priority_factors && Object.keys(payload.priority_factors).length > 0 && (
        <div className="mt-3 rounded-lg border border-white/10 bg-white/[0.02] p-3">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            Priority decomposition (sprio)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-zinc-500">
                  <th className="py-0.5 pr-3">Factor</th>
                  <th className="py-0.5 pr-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(payload.priority_factors)
                  .sort(([, a], [, b]) => b - a)
                  .map(([factor, value]) => {
                    const isBottleneck = factor === payload.priority_dominant_negative;
                    const isHelper = factor === payload.priority_dominant_positive;
                    return (
                      <tr
                        key={factor}
                        className={cn(
                          'border-t border-white/5',
                          isBottleneck && 'bg-rose-500/10',
                          isHelper && 'bg-emerald-500/10',
                        )}
                      >
                        <td className="py-0.5 pr-3 text-zinc-200">
                          {factor}
                          {isBottleneck && (
                            <span className="ml-2 text-[10px] uppercase text-rose-300">
                              bottleneck
                            </span>
                          )}
                          {isHelper && !isBottleneck && (
                            <span className="ml-2 text-[10px] uppercase text-emerald-300">
                              helping
                            </span>
                          )}
                        </td>
                        <td className="py-0.5 pr-3 font-mono text-zinc-300">
                          {(value / 1_000_000).toFixed(6)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            Higher = more contribution to your priority. The bottleneck row is what's holding the job back.
          </div>
        </div>
      )}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// 4) calendar of candidate slots
// ---------------------------------------------------------------------------

export function SlurmCalendarCard({ payload }: { payload: CalendarPayload }) {
  const slots = payload.slots ?? [];
  const isSynthetic = payload.load_curve_kind === 'synthetic';
  return (
    <CardShell
      title="Candidate time-slots"
      subtitle={`${payload.gpus} GPU${payload.gpus !== 1 ? 's' : ''} × ${payload.hours}h on ${payload.partition ?? '—'} (best first)`}
    >
      {/*
        Pre-validation banner — Ryan's #2 ask. When the load curve is the
        hand-coded synthetic one (the nightly sacct→features pipeline hasn't
        run yet for this partition), the time-of-day component of the score
        is "Karpathy's intuition", not Betty's. We label that loudly in red
        so researchers don't take the slot ranking as gospel.
      */}
      {isSynthetic && (
        <div className="mb-3 rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-200 ring-1 ring-inset ring-rose-400/40">
          <span className="font-semibold uppercase tracking-wide">Pre-validation:</span>{' '}
          load curve is synthetic (hand-coded hour-of-day intuition, not real Betty
          history). Slot ranking is heuristic only. The historical curve will replace
          this when the nightly <code className="rounded bg-black/30 px-1">scheduling/features.py</code>{' '}
          pipeline runs and writes <code className="rounded bg-black/30 px-1">data/features/partitions/&lt;p&gt;.json</code>.
        </div>
      )}
      {slots.length === 0 ? (
        <div className="text-sm text-zinc-400">
          No matching slots in the requested window.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="py-1.5 pr-3 font-semibold">When (local)</th>
                <th className="py-1.5 pr-3 font-semibold">Score</th>
                <th className="py-1.5 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody>
              {slots.map((s, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-2 pr-3 align-top text-zinc-100">{s.start_local}</td>
                  <td className="py-2 pr-3 align-top text-zinc-300">{s.score.toFixed(2)}</td>
                  <td className="py-2 align-top text-xs text-zinc-400">
                    {s.reasons.join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-3 space-y-1 text-[11px] text-zinc-500">
        <div>Higher score is better.</div>
        {payload.score_formula && (
          <div>
            <span className="text-zinc-400">Formula:</span>{' '}
            <code className="rounded bg-black/30 px-1 text-zinc-300">{payload.score_formula}</code>
          </div>
        )}
        {payload.sources?.includes('squeue --start') && (
          <div className="text-zinc-500">
            <span className="text-zinc-400">Note on est. start times:</span> SLURM's
            backfill simulator runs at <code className="rounded bg-black/30 px-1">bf_resolution</code>{' '}
            intervals and looks up to <code className="rounded bg-black/30 px-1">bf_window</code>{' '}
            ahead (typically 1 day). Estimates beyond that window are <code>N/A</code>;
            estimates within it are an <em>upper bound</em>, not a commitment — a
            higher-priority job arriving can push your start later.
          </div>
        )}
        {(payload.sources?.length || payload.load_curve_kind) && (
          <div>
            <span className="text-zinc-400">Sources:</span>{' '}
            {payload.sources?.join(', ') || '(none — score uses synthetic curve only)'}
            {payload.load_curve_kind && (
              <span className="ml-1">
                · load curve:{' '}
                <span
                  className={
                    payload.load_curve_kind === 'historical'
                      ? 'text-emerald-300'
                      : 'text-rose-300 font-semibold'
                  }
                >
                  {payload.load_curve_kind}
                  {payload.load_curve_kind === 'synthetic' && ' (pre-validation)'}
                </span>
              </span>
            )}
          </div>
        )}
      </div>
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function SlurmCard({ kind, body }: { kind: string; body: string }) {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return (
      <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs">
        <code>{body}</code>
      </pre>
    );
  }
  switch (kind) {
    case 'check':
      return <SlurmCheckCard payload={payload as CheckPayload} />;
    case 'recommend':
      return <SlurmRecommendCard payload={payload as RecommendPayload} />;
    case 'diagnose':
      return <SlurmDiagnoseCard payload={payload as DiagnosePayload} />;
    case 'calendar':
      return <SlurmCalendarCard payload={payload as CalendarPayload} />;
    default:
      return (
        <pre className="overflow-x-auto rounded bg-black/40 p-3 text-xs">
          <code>{body}</code>
        </pre>
      );
  }
}
