/**
 * Parser for the per-node sinfo query:
 *   sinfo -h -N -O "Partition:25,StateLong:15,CPUsState:20,Gres:35,GresUsed:35"
 *
 * One line per node, whitespace-separated (none of the five fields contains an
 * internal space). Example line:
 *   b200-mig45  mixed  56/168/0/224  gpu:45gb:32(S:0-1)  gpu:45gb:9(IDX:0-1,...)
 *
 * Crucial fix over the old `%G`-only query: GresUsed lets us count *free GPU
 * slices* as (total − used) per node, instead of the old heuristic that only
 * counted GPUs on fully-`idle` nodes. MIG nodes are essentially always `mixed`
 * (one physical card sliced many ways), so the old logic reported 0 free even
 * when most slices were open. CPUsState (A/I/O/T) preserves the CPU breakdown.
 *
 * Kept in a sibling module (not route.ts) because Next.js 15 rejects any
 * non-route export from a `route.ts` file during build.
 */

export interface PartitionSummary {
  partition: string;
  nodesIdle: number;
  nodesTotal: number;
  /** Free GPUs/slices = sum of (total − used) over *available* nodes. */
  gpusIdle: number;
  gpusTotal: number;
  cpusAlloc: number;
  cpusIdle: number;
  cpusOther: number;
  cpusTotal: number;
}

/**
 * Whether a node in this base state can actually accept work. Nodes that are
 * draining, down, under maintenance, or reserved may report 0 GPUs used, but
 * those GPUs are NOT available — so we must not count them as free.
 */
export function isAvailableState(baseState: string): boolean {
  return (
    baseState.startsWith('idle') ||
    baseState.startsWith('mix') ||
    baseState.startsWith('alloc')
  );
}

/** Pull the integer count out of a GRES token like `gpu:B200:8(S:0-1)` or
 *  `gpu:45gb:9(IDX:...)`. Returns 0 for `(null)` / no GPUs. */
export function parseGpuCount(gres: string): number {
  if (!gres || gres === '(null)') return 0;
  const m = gres.match(/gpu(?::[a-z0-9_-]+)?:(\d+)/i);
  if (!m) return 0;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : 0;
}

export function parseSinfoOverview(stdout: string): PartitionSummary[] {
  const by: Record<string, PartitionSummary> = {};
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    // Split on any run of whitespace into the 5 fixed columns.
    const cols = line.split(/\s+/);
    if (cols.length < 5) continue;

    const partition = cols[0].replace(/\*$/, '');
    // StateLong may carry a trailing flag char (mixed-, drained*, idle~ …).
    const baseState = cols[1].toLowerCase().replace(/[^a-z].*$/, '');
    const cstate = cols[2] ?? '';
    const gres = cols[3] ?? '';
    const gresUsed = cols[4] ?? '';
    if (!partition) continue;

    const row =
      by[partition] ??
      (by[partition] = {
        partition,
        nodesIdle: 0,
        nodesTotal: 0,
        gpusIdle: 0,
        gpusTotal: 0,
        cpusAlloc: 0,
        cpusIdle: 0,
        cpusOther: 0,
        cpusTotal: 0,
      });

    row.nodesTotal += 1;
    if (baseState.startsWith('idle')) row.nodesIdle += 1;

    const gpuTotal = parseGpuCount(gres);
    const gpuUsed = parseGpuCount(gresUsed);
    row.gpusTotal += gpuTotal;
    if (isAvailableState(baseState)) {
      row.gpusIdle += Math.max(0, gpuTotal - gpuUsed);
    }

    const m = cstate.match(/^(\d+)\/(\d+)\/(\d+)\/(\d+)/);
    if (m) {
      row.cpusAlloc += Number(m[1]);
      row.cpusIdle += Number(m[2]);
      row.cpusOther += Number(m[3]);
      row.cpusTotal += Number(m[4]);
    }
  }
  return Object.values(by).sort((a, b) => a.partition.localeCompare(b.partition));
}
