/**
 * Parser for `sinfo -h -N -o "%N|%P|%T|%G|%C|%m|%O|%E"`.
 *
 * Field order:
 *   %N NodeName
 *   %P PartitionName
 *   %T State (base + modifier suffix — see slurm-node-state-modifiers wiki page)
 *   %G GRES (e.g. `gpu:b200:8`, `gpu:b200_mig45_g:32`, or `(null)`)
 *   %C CPUs A/I/O/T (allocated/idle/other/total)
 *   %m Memory (MB)
 *   %O CPULoad (1-min load average; `N/A` if node unreachable)
 *   %E Reason (drain/down reason; `none` if no reason)
 *
 * State normalization: sinfo emits base states with a 1-character modifier
 * suffix (`*` not-responding, `~` powered-off, `#` powering-up, `-` planned,
 * `$` maintenance reservation, `@` pending-reboot, `^` reboot-issued,
 * `!` pending-power-down, `%` powering-down). We split the base from the
 * modifier so the dashboard can render both. Base is lowercased and mapped
 * to one of: idle, mix, alloc, drain, down, maint, resv, other.
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export
 * from a route module during build-time type validation.
 */

export type NodeBaseState = 'idle' | 'mix' | 'alloc' | 'drain' | 'down' | 'maint' | 'resv' | 'other';

export interface NodeRow {
  node: string;
  partition: string;
  /** Normalized base state. */
  state: NodeBaseState;
  /** Single-character modifier suffix (`*`, `~`, `#`, `-`, `$`, `@`, `^`, `!`, `%`), or null. */
  flag: string | null;
  gpus: {
    /** GPU type token (e.g. `b200`, `b200_mig45_g`), or null when no GPUs. */
    type: string | null;
    /** GPUs per node. 0 means no GPUs on this node. */
    total: number;
  };
  cpus: {
    alloc: number;
    idle: number;
    other: number;
    total: number;
  };
  /** Memory in megabytes, null if unparseable. */
  memMb: number | null;
  /** CPU load average; null if sinfo reported N/A. */
  cpuLoad: number | null;
  /** Drain/down reason; null when reason is "none" or "(null)". */
  reason: string | null;
}

/** Map sinfo base-state strings into the dashboard's small palette. */
function normalizeBaseState(raw: string): NodeBaseState {
  // sinfo emits a variety of base-state spellings — both 4-letter and full
  // forms — depending on flags. Normalize to a stable enum.
  const s = raw.toLowerCase();
  if (s.startsWith('idle')) return 'idle';
  if (s.startsWith('mix') || s.startsWith('mixed')) return 'mix';
  if (s.startsWith('alloc')) return 'alloc';
  if (s.startsWith('drain') || s.startsWith('drng') || s.startsWith('drnd')) return 'drain';
  if (s.startsWith('down')) return 'down';
  if (s.startsWith('maint')) return 'maint';
  if (s.startsWith('resv') || s.startsWith('reserved')) return 'resv';
  if (s.startsWith('comp')) return 'other'; // completing — render as 'other'
  if (s.startsWith('fail')) return 'down';
  return 'other';
}

const MODIFIER_SUFFIXES = new Set(['*', '~', '#', '-', '$', '@', '^', '!', '%']);

function splitStateAndFlag(token: string): { base: string; flag: string | null } {
  const t = token.trim();
  if (!t) return { base: '', flag: null };
  const last = t[t.length - 1];
  if (MODIFIER_SUFFIXES.has(last)) {
    return { base: t.slice(0, -1), flag: last };
  }
  return { base: t, flag: null };
}

function parseGres(gres: string): { type: string | null; total: number } {
  const raw = gres.trim();
  if (!raw || raw === '(null)' || raw === '-' || raw === 'null') {
    return { type: null, total: 0 };
  }
  // Match `gpu:<type>:<count>` or `gpu:<count>` (untyped GRES).
  const typed = /^gpu:([a-z0-9_-]+):(\d+)/i.exec(raw);
  if (typed) {
    const total = parseInt(typed[2], 10);
    return { type: typed[1], total: Number.isFinite(total) ? total : 0 };
  }
  const untyped = /^gpu:(\d+)/i.exec(raw);
  if (untyped) {
    const total = parseInt(untyped[1], 10);
    return { type: null, total: Number.isFinite(total) ? total : 0 };
  }
  return { type: null, total: 0 };
}

function parseCpuState(s: string): { alloc: number; idle: number; other: number; total: number } {
  const m = /^(\d+)\/(\d+)\/(\d+)\/(\d+)$/.exec(s.trim());
  if (!m) return { alloc: 0, idle: 0, other: 0, total: 0 };
  return {
    alloc: parseInt(m[1], 10),
    idle: parseInt(m[2], 10),
    other: parseInt(m[3], 10),
    total: parseInt(m[4], 10),
  };
}

function parseFloatOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === '(null)') return null;
  const n = parseFloat(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(s: string): number | null {
  const trimmed = s.trim();
  if (!trimmed || trimmed === 'N/A' || trimmed === '(null)') return null;
  const n = parseInt(trimmed, 10);
  return Number.isFinite(n) ? n : null;
}

function parseReason(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === 'none' || trimmed === '(null)' || trimmed === 'None') return null;
  return trimmed;
}

export function parseSinfoNodes(stdout: string): NodeRow[] {
  const out: NodeRow[] = [];
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes('|')) continue;
    const cols = line.split('|');
    if (cols.length < 8) continue;
    const node = cols[0].trim();
    const partition = cols[1].replace(/\*$/, '').trim();
    if (!node || !partition) continue;
    if (node.toUpperCase() === 'NODELIST' || node.toUpperCase() === 'HOSTNAMES') continue;
    const { base, flag } = splitStateAndFlag(cols[2]);
    if (!base) continue;
    out.push({
      node,
      partition,
      state: normalizeBaseState(base),
      flag,
      gpus: parseGres(cols[3]),
      cpus: parseCpuState(cols[4]),
      memMb: parseIntOrNull(cols[5]),
      cpuLoad: parseFloatOrNull(cols[6]),
      reason: parseReason(cols[7]),
    });
  }
  return out;
}
