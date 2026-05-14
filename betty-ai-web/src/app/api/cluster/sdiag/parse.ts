/**
 * Parser for `sdiag` (Slurm scheduler diagnostics).
 *
 * `sdiag` output is a free-form, multi-section human-readable text dump with
 * sections like "Main schedule statistics", "Backfilling stats", and a
 * tabular "Remote Procedure Call statistics by message type". Field names
 * are stable across Slurm versions but the layout is intentionally
 * loose — keep this parser permissive: missing fields surface as `null`
 * rather than throwing, so a partial-degraded sdiag still yields a usable
 * dashboard card.
 *
 * Source command:
 *   sdiag
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export
 * from a route module during build-time type validation.
 */

export interface SdiagSchedulerStats {
  /** Server thread count (controller workers). */
  serverThreadCount: number | null;
  /** Slurmctld agent queue size. */
  agentQueueSize: number | null;
  /** DBD agent queue size (slurmdbd ← slurmctld backlog). */
  dbdAgentQueueSize: number | null;
  /** Most recent main-schedule cycle wallclock, milliseconds. */
  lastCycleMs: number | null;
  /** Mean main-schedule cycle wallclock, milliseconds. */
  meanCycleMs: number | null;
  /** Max main-schedule cycle wallclock since stats reset, milliseconds. */
  maxCycleMs: number | null;
}

export interface SdiagBackfillStats {
  /** Most recent backfill cycle wallclock, milliseconds. */
  lastCycleMs: number | null;
  /** Mean backfill cycle wallclock, milliseconds. */
  meanCycleMs: number | null;
  /** Max backfill cycle wallclock, milliseconds. */
  maxCycleMs: number | null;
  /** Number of jobs the last backfill cycle attempted to place. */
  lastDepthTried: number | null;
  /** Number of jobs the last backfill cycle scheduled. */
  lastDepthTriedSched: number | null;
  /** Cumulative count of jobs backfilled since the last slurmctld boot. */
  totalBackfilledJobs: number | null;
}

export interface SdiagRpcRow {
  /** RPC message-type name (e.g. REQUEST_JOB_INFO). */
  name: string;
  /** How many times this RPC fired in the stats window. */
  count: number;
  /** Cumulative wallclock spent serving this RPC, milliseconds. */
  totalTimeMs: number;
}

export interface SdiagSnapshot {
  scheduler: SdiagSchedulerStats;
  backfill: SdiagBackfillStats;
  rpc: SdiagRpcRow[];
  /** Header timestamp ("Mon Apr 27 14:32:09 2026"), null if missing. */
  generatedAt: string | null;
  /** Section headers we saw, kept for debugging "where did N come from?". */
  raw_sections: string[];
}

/** Convert microsecond integer to a millisecond float, two-decimal precision. */
function usToMs(us: number | null): number | null {
  if (us == null || !Number.isFinite(us)) return null;
  return Math.round((us / 1000) * 100) / 100;
}

function parseIntOrNull(s: string | undefined): number | null {
  if (s == null) return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

/** Match a label literally including any regex metachars in sdiag labels. */
function escapeForRegex(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Extract `^<label>:\s*<value>` from a slice (sdiag uses leading tabs). */
function findIntField(lines: string[], label: string): number | null {
  const re = new RegExp(`^\\s*${escapeForRegex(label)}\\s*:\\s*(-?\\d+)`);
  for (const line of lines) {
    const m = re.exec(line);
    if (m) return parseIntOrNull(m[1]);
  }
  return null;
}

const SECTION_TITLES = [
  'Main schedule statistics',
  'Backfilling stats',
  'Remote Procedure Call statistics by message type',
  'Remote Procedure Call statistics by user',
  'Backfill exit',
  'Main scheduler exit',
];

function isSectionTitle(trimmed: string): boolean {
  return SECTION_TITLES.some((t) => trimmed.startsWith(t));
}

export function parseSdiag(stdout: string): SdiagSnapshot {
  const lines = stdout.split(/\r?\n/);

  // Header timestamp: `sdiag output at Mon Apr 27 14:32:09 2026 (1745780329)`
  let generatedAt: string | null = null;
  for (const line of lines) {
    const m = /^sdiag output at\s+(.+?)\s+\(\d+\)\s*$/.exec(line);
    if (m) {
      generatedAt = m[1];
      break;
    }
  }

  const raw_sections: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (isSectionTitle(trimmed)) raw_sections.push(trimmed);
  }

  // Sectioned slice: lines after a header up to the next blank line OR the
  // next known header. sdiag separates sections with blank lines usually.
  function sectionSlice(title: string): string[] {
    const startIdx = lines.findIndex((l) => l.trim().startsWith(title));
    if (startIdx < 0) return [];
    const out: string[] = [];
    for (let i = startIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed) break;
      if (isSectionTitle(trimmed)) break;
      out.push(line);
    }
    return out;
  }

  // Top-level fields like "Server thread count" appear above the first section.
  const headerSlice: string[] = [];
  for (const line of lines) {
    if (isSectionTitle(line.trim())) break;
    headerSlice.push(line);
  }

  const mainSlice = sectionSlice('Main schedule statistics');
  const bfSlice = sectionSlice('Backfilling stats');

  // Main scheduler cycle times in sdiag are microseconds.
  const scheduler: SdiagSchedulerStats = {
    serverThreadCount: findIntField(headerSlice, 'Server thread count'),
    agentQueueSize: findIntField(headerSlice, 'Agent queue size'),
    dbdAgentQueueSize: findIntField(headerSlice, 'DBD Agent queue size'),
    lastCycleMs: usToMs(findIntField(mainSlice, 'Last cycle')),
    meanCycleMs: usToMs(findIntField(mainSlice, 'Mean cycle')),
    maxCycleMs: usToMs(findIntField(mainSlice, 'Max cycle')),
  };

  const backfill: SdiagBackfillStats = {
    lastCycleMs: usToMs(findIntField(bfSlice, 'Last cycle')),
    meanCycleMs: usToMs(findIntField(bfSlice, 'Mean cycle')),
    maxCycleMs: usToMs(findIntField(bfSlice, 'Max cycle')),
    lastDepthTried: findIntField(bfSlice, 'Last depth cycle'),
    lastDepthTriedSched: findIntField(bfSlice, 'Last depth cycle (try sched)'),
    totalBackfilledJobs: findIntField(bfSlice, 'Total backfilled jobs (since last slurm start)'),
  };

  // RPC rows:
  //   REQUEST_NODE_INFO              ( 2007) count:14523 ave_time:421    total_time:6112483
  // total_time is microseconds; surface as milliseconds.
  const rpcSlice = sectionSlice('Remote Procedure Call statistics by message type');
  const rpc: SdiagRpcRow[] = [];
  for (const line of rpcSlice) {
    const m = /^\s*([A-Z][A-Z0-9_]+)\s+\(\s*\d+\s*\)\s+count:(\d+)\s+ave_time:\d+\s+total_time:(\d+)/.exec(
      line,
    );
    if (!m) continue;
    const count = parseInt(m[2], 10);
    const totalUs = parseInt(m[3], 10);
    if (!Number.isFinite(count) || !Number.isFinite(totalUs)) continue;
    rpc.push({
      name: m[1],
      count,
      totalTimeMs: Math.round((totalUs / 1000) * 100) / 100,
    });
  }

  return { scheduler, backfill, rpc, generatedAt, raw_sections };
}
