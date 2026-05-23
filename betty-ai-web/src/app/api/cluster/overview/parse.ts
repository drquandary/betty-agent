/**
 * Parser for `parcc_sfree.py --json` — PARCC's authoritative free-resource
 * tool. Using it (rather than hand-rolled sinfo parsing) keeps the dashboard's
 * notion of "available" identical to what users see from the CLI, and it
 * already separates DOWN resources from merely-allocated ones.
 *
 * JSON is an array of per-partition objects:
 *   { partition, nodes, cpu_free, cpu_total, mem_free_gb, mem_total_gb,
 *     gpu_free, gpu_total, down_cpu, down_mem_gb, down_gpu }
 *
 * Kept in a sibling module (not route.ts) because Next.js 15 rejects any
 * non-route export from a `route.ts` file during build.
 */

export interface PartitionSummary {
  partition: string;
  nodesTotal: number;
  /** Free GPUs/slices (parcc_sfree gpu_free). Excludes DOWN GPUs. */
  gpusIdle: number;
  gpusTotal: number;
  cpusAlloc: number;
  /** Free CPUs (parcc_sfree cpu_free). */
  cpusIdle: number;
  /** DOWN/unavailable CPUs. */
  cpusOther: number;
  cpusTotal: number;
  /** Free memory in GB. */
  memFreeGb: number;
  memTotalGb: number;
  /** GPUs in a DOWN/drained/maint state — present but not allocatable. */
  downGpu: number;
}

interface SfreeRow {
  partition?: unknown;
  nodes?: unknown;
  cpu_free?: unknown;
  cpu_total?: unknown;
  mem_free_gb?: unknown;
  mem_total_gb?: unknown;
  gpu_free?: unknown;
  gpu_total?: unknown;
  down_cpu?: unknown;
  down_gpu?: unknown;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extract the JSON array from raw stdout, tolerant of any leading shell/MOTD
 * noise: slice from the first `[` to the last `]`.
 */
export function extractJsonArray(stdout: string): string | null {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) return null;
  return stdout.slice(start, end + 1);
}

export function parseSfree(stdout: string): PartitionSummary[] {
  const json = extractJsonArray(stdout);
  if (!json) return [];
  let rows: SfreeRow[];
  try {
    const parsed = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    rows = parsed as SfreeRow[];
  } catch {
    return [];
  }

  const out: PartitionSummary[] = [];
  for (const r of rows) {
    const partition = String(r.partition ?? '').trim();
    // Skip the "(no-partition)" bucket — orphan nodes not in any partition.
    if (!partition || partition === '(no-partition)') continue;

    const cpuFree = num(r.cpu_free);
    const cpuTotal = num(r.cpu_total);
    const downCpu = num(r.down_cpu);
    out.push({
      partition,
      nodesTotal: num(r.nodes),
      gpusIdle: num(r.gpu_free),
      gpusTotal: num(r.gpu_total),
      cpusIdle: cpuFree,
      cpusTotal: cpuTotal,
      cpusOther: downCpu,
      cpusAlloc: Math.max(0, cpuTotal - cpuFree - downCpu),
      memFreeGb: num(r.mem_free_gb),
      memTotalGb: num(r.mem_total_gb),
      downGpu: num(r.down_gpu),
    });
  }
  return out.sort((a, b) => a.partition.localeCompare(b.partition));
}
