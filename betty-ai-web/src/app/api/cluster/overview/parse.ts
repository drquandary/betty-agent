/**
 * Parser for `sinfo -h -o "%P|%D|%T|%G|%C"`.
 *
 * Kept in a sibling module (not route.ts) because Next.js 15 rejects any
 * non-route export from a `route.ts` file during build.
 */

export interface PartitionSummary {
  partition: string;
  nodesIdle: number;
  nodesTotal: number;
  gpusIdle: number;
  gpusTotal: number;
  cpusAlloc: number;
  cpusIdle: number;
  cpusOther: number;
  cpusTotal: number;
}

export function parseSinfoOverview(stdout: string): PartitionSummary[] {
  const by: Record<string, PartitionSummary> = {};
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split('|');
    if (cols.length < 4) continue;
    const partition = cols[0].replace(/\*$/, '');
    const nodes = Number(cols[1]);
    const state = cols[2].toLowerCase();
    const gres = cols[3] ?? '';
    const cstate = cols[4] ?? '';
    if (!partition || !Number.isFinite(nodes)) continue;

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

    row.nodesTotal += nodes;
    if (state.startsWith('idle')) {
      row.nodesIdle += nodes;
    }

    const gpu = gres.match(/gpu(?::[a-z0-9_-]+)?:(\d+)/i);
    if (gpu) {
      const perNode = Number(gpu[1]);
      if (Number.isFinite(perNode)) {
        row.gpusTotal += nodes * perNode;
        if (state.startsWith('idle')) row.gpusIdle += nodes * perNode;
      }
    }

    if (cstate) {
      const m = cstate.match(/^(\d+)\/(\d+)\/(\d+)\/(\d+)/);
      if (m) {
        row.cpusAlloc += Number(m[1]);
        row.cpusIdle += Number(m[2]);
        row.cpusOther += Number(m[3]);
        row.cpusTotal += Number(m[4]);
      }
    }
  }
  return Object.values(by).sort((a, b) => a.partition.localeCompare(b.partition));
}
