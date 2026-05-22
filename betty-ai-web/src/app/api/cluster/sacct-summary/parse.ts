/**
 * Parser for `sacct -P -X -S <since> -E now -o "JobID|State|End|Elapsed|Partition|ReqTRES"`.
 *
 * `-P` (parsable, no trailing pipe) and `-X` (skip job step rows) usually mean
 * sacct emits one row per parent JobID — but `.batch` and `.extern` step rows
 * still slip through in some configurations, so we explicitly dedupe by the
 * parent JobID prefix.
 *
 * We bucket completed/failed/timeout/cancelled jobs by their End hour. The
 * dashboard renders this as a 24h-or-7d completion-rate sparkline.
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export from
 * a route module during build-time type validation.
 */

export type SacctOutcome = 'completed' | 'failed' | 'timeout' | 'cancelled' | 'other';

export interface SacctBucket {
  /** ISO-8601 hour bucket — `YYYY-MM-DDTHH:00:00`. */
  hour: string;
  completed: number;
  failed: number;
  timeout: number;
  cancelled: number;
  other: number;
}

export interface SacctTotals {
  completed: number;
  failed: number;
  timeout: number;
  cancelled: number;
  other: number;
}

export interface SacctSummary {
  buckets: SacctBucket[];
  totals: SacctTotals;
  /** Number of UNIQUE parent jobs (after deduping .batch / .extern steps). */
  sampleCount: number;
}

function classify(state: string): SacctOutcome {
  // sacct's State field can include free text like "CANCELLED by 12345" — we
  // normalize by taking the leading uppercase token. It can also be suffixed
  // with '+' when detail is truncated (e.g. "CANCELLED+", "TIMEOUT+"); strip
  // any trailing non-letter/underscore chars so those still bucket correctly.
  const head = (state.trim().toUpperCase().split(/\s+/)[0] ?? '').replace(/[^A-Z_].*$/, '');
  if (head === 'COMPLETED') return 'completed';
  if (head === 'FAILED' || head === 'NODE_FAIL' || head === 'BOOT_FAIL') return 'failed';
  if (head === 'TIMEOUT') return 'timeout';
  if (head === 'CANCELLED') return 'cancelled';
  return 'other';
}

function bucketHour(endRaw: string): string | null {
  const end = endRaw.trim();
  if (!end || end === 'Unknown') return null;
  // sacct's End format: `YYYY-MM-DDTHH:MM:SS`. Truncate to hour.
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):\d{2}:\d{2}/.exec(end);
  if (!m) return null;
  return `${m[1]}T${m[2]}:00:00`;
}

/** Strip `.batch` / `.extern` / `.0` step suffixes to recover the parent JobID. */
function parentJobId(jobId: string): string {
  const dot = jobId.indexOf('.');
  return dot >= 0 ? jobId.slice(0, dot) : jobId;
}

export function parseSacctSummary(stdout: string): SacctSummary {
  const seen = new Set<string>();
  const buckets = new Map<string, SacctBucket>();
  const totals: SacctTotals = { completed: 0, failed: 0, timeout: 0, cancelled: 0, other: 0 };

  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes('|')) continue;
    const cols = line.split('|');
    // Required cols: JobID, State, End, Elapsed, Partition. ReqTRES (col 5)
    // is optional from the parser's POV (we don't surface it here).
    if (cols.length < 5) continue;
    const jobIdRaw = cols[0].trim();
    if (!jobIdRaw || jobIdRaw.toUpperCase() === 'JOBID') continue;
    const parent = parentJobId(jobIdRaw);
    // Dedupe by parent JobID — `.batch` / `.extern` rows carry the same End
    // and State as the parent, so counting them would triple-count.
    if (seen.has(parent)) continue;
    const state = cols[1];
    const endRaw = cols[2];
    const hour = bucketHour(endRaw);
    if (!hour) continue;
    // Mark seen only AFTER we know the row contributes — otherwise a parent
    // whose End is unparseable would mask a sibling step that has a parseable
    // End (unlikely in practice but cheap to do right).
    seen.add(parent);
    const outcome = classify(state);
    totals[outcome] += 1;
    const bucket =
      buckets.get(hour) ??
      (() => {
        const b: SacctBucket = {
          hour,
          completed: 0,
          failed: 0,
          timeout: 0,
          cancelled: 0,
          other: 0,
        };
        buckets.set(hour, b);
        return b;
      })();
    bucket[outcome] += 1;
  }

  const sorted = Array.from(buckets.values()).sort((a, b) => a.hour.localeCompare(b.hour));
  return { buckets: sorted, totals, sampleCount: seen.size };
}
