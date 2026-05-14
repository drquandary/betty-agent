/**
 * Parser for `sprio -hl -o "%i|%a|%Y|%A|%F|%J|%P|%Q|%T|%c|%r"`.
 *
 * Field order (per the dashboard's wave 1A command spec):
 *   %i JobID
 *   %a Account
 *   %Y Priority (raw)
 *   %A Age priority component
 *   %F Fairshare priority component
 *   %J Job-size priority component
 *   %P Partition priority component
 *   %Q QOS priority component
 *   %T TRES priority component (combined / summary)
 *   %c Cluster
 *   %r Normalized priority (0..1 float)
 *
 * sprio's `-l` (long) format emits integer factor scores, NOT the un-weighted
 * factor (which is `-n`). We render whatever it emits and let the dashboard
 * decide what to highlight. Rows missing required columns are dropped silently
 * — the goal is to never crash the dashboard on a partial output.
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export from
 * a route module during build-time type validation.
 */

export interface SprioJob {
  jobId: string;
  account: string;
  /** Raw composite priority (the same number squeue surfaces as PRIORITY). */
  priority: number;
  /** Age factor contribution to priority. */
  age: number;
  /** Fairshare factor contribution. */
  fairshare: number;
  /** Job-size factor contribution. */
  jobSize: number;
  /** Partition (`%P` is the partition NAME under -l, NOT a factor weight). */
  partition: string;
  /** QOS factor contribution. */
  qos: number;
  /** TRES factor contribution (string — sprio renders TRES as `cpu=...`). */
  tres: string;
  /** Normalized priority on 0..1 scale. Undefined when sprio drops the column. */
  normalized?: number;
}

function parseIntOrNaN(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : NaN;
}

export function parseSprio(stdout: string): SprioJob[] {
  const out: SprioJob[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes('|')) continue;
    // sprio -h suppresses the header; defend anyway by skipping a row whose
    // first cell is the literal label "JOBID".
    const cols = line.split('|');
    // We require at least the 9 priority-related columns. The cluster (%c) and
    // normalized (%r) columns are optional — sprio in slurm < 23.02 lacks %r.
    if (cols.length < 9) continue;
    const jobId = cols[0].trim();
    if (!jobId || jobId.toUpperCase() === 'JOBID') continue;
    const account = cols[1].trim();
    const priority = parseIntOrNaN(cols[2]);
    const age = parseIntOrNaN(cols[3]);
    const fairshare = parseIntOrNaN(cols[4]);
    const jobSize = parseIntOrNaN(cols[5]);
    const partition = cols[6].trim();
    const qos = parseIntOrNaN(cols[7]);
    const tres = cols[8].trim();
    // Skip rows whose required numeric columns failed to parse — sprio
    // doesn't emit "(null)" the way scontrol does, so any non-numeric is a
    // signal that we're looking at a header or a malformed line.
    if (
      !Number.isFinite(priority) ||
      !Number.isFinite(age) ||
      !Number.isFinite(fairshare) ||
      !Number.isFinite(jobSize) ||
      !Number.isFinite(qos)
    ) {
      continue;
    }
    const row: SprioJob = {
      jobId,
      account,
      priority,
      age,
      fairshare,
      jobSize,
      partition,
      qos,
      tres,
    };
    // Cluster (%c) is cols[9]; we don't surface it (the dashboard already
    // knows it's Betty). Normalized (%r) is cols[10] if present.
    if (cols.length >= 11) {
      const norm = parseFloat(cols[10]);
      if (Number.isFinite(norm)) row.normalized = norm;
    }
    out.push(row);
  }
  return out;
}
