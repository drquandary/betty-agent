/**
 * Metrics store — append-only JSONL time series for the Slurm monitoring tab.
 *
 * Wave 1C of the Datadog-style cluster view. Lives intentionally simple:
 * one JSONL file per series under `betty-ai/data/metrics/`. Each line is one
 * `MetricPoint` object. Writes are best-effort; reads ignore malformed lines.
 *
 * Why on-disk JSONL and not sqlite/Redis: we want zero new deps, the data
 * volume is tiny (a few series, a point every ~30s), and append-only JSONL
 * mirrors the `slurm-tool-calls.jsonl` pattern already in use by
 * `slurm-shared.logToolUsage`. If the dataset ever outgrows this, swap the
 * backend — the API surface here is deliberately small.
 *
 * Retention: each series is opportunistically pruned to the last 7 days on
 * the FIRST append per series per process lifetime. Pruning is scheduled via
 * `setImmediate` so it does not block the request that triggered the append.
 *
 * Atomicity: appends use `appendFileSync` with the `a` flag, writing a
 * single pre-concatenated buffer per call so a partial JSON line cannot
 * appear on disk under POSIX semantics for small writes. Prune rewrites are
 * atomic via a temp file plus rename.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import { paths } from '../agent/knowledge/loader';

// ───────────────────────────── types ────────────────────────────────

export interface MetricPoint<T = Record<string, unknown>> {
  /** Unix milliseconds. */
  ts: number;
  /** Logical series name, e.g. `backfill.mean_cycle_ms`. */
  series: string;
  /** Numeric value. */
  value: number;
  /** Optional metadata bag. */
  meta?: T;
}

// ───────────────────────── root directory ───────────────────────────

const DEFAULT_METRICS_ROOT = join(paths.bettyAi, 'data', 'metrics');
let metricsRoot: string = DEFAULT_METRICS_ROOT;

/**
 * Override the on-disk metrics root. Pure setter — does not create the
 * directory; the next append/prune will lazily mkdir as needed. Tests use
 * this to point at a fresh tmpdir.
 */
export function setMetricsRoot(dir: string): void {
  metricsRoot = resolve(dir);
  // A new root means a new mkdir cache state and a new prune cache state.
  // Reset both so tests do not leak state across tmpdirs.
  rootEnsured = false;
  prunedThisProcess.clear();
}

export function getMetricsRoot(): string {
  return metricsRoot;
}

// ─────────────────── series-name validation ─────────────────────────

// Only ASCII alphanumerics, dot, underscore, and hyphen. Rejects path
// separators, double-dot, null bytes, and anything else that could traverse
// out of metricsRoot.
const SERIES_NAME_RE = /^[a-zA-Z0-9._-]+$/;

function isValidSeriesName(name: string): boolean {
  if (typeof name !== 'string' || name.length === 0 || name.length > 200) return false;
  if (name === '.' || name === '..') return false;
  return SERIES_NAME_RE.test(name);
}

function seriesPath(series: string): string {
  // The regex above already rejects path separators, but the spec describes
  // a hypothetical where forward-slashes might one day be allowed and
  // rewritten to a double-underscore. Keep the rewrite for defense-in-depth
  // in case the regex is ever loosened.
  const safe = series.replace(/\//g, '__');
  return join(metricsRoot, safe + '.jsonl');
}

// ─────────────────── lazy mkdir + prune cache ───────────────────────

let rootEnsured = false;
const prunedThisProcess = new Set<string>();

function ensureRoot(): boolean {
  if (rootEnsured) return true;
  try {
    mkdirSync(metricsRoot, { recursive: true });
    rootEnsured = true;
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────── append ─────────────────────────────────

function serializeLine(point: MetricPoint): string {
  return JSON.stringify(point) + '\n';
}

/**
 * Append a single metric point. Best-effort — returns false on any failure
 * (invalid name, mkdir failure, write failure) and never throws.
 *
 * On the first successful append to a given series per process lifetime,
 * schedule an opportunistic 7-day prune via setImmediate.
 */
export function appendMetric(point: MetricPoint): boolean {
  if (!isValidSeriesName(point.series)) return false;
  if (!ensureRoot()) return false;
  const file = seriesPath(point.series);
  try {
    appendFileSync(file, serializeLine(point), 'utf8');
  } catch {
    return false;
  }
  schedulePruneOnce(point.series);
  return true;
}

/**
 * Append many points in one fsync per series (one file open per distinct
 * series). Returns false if any point has an invalid series name OR if any
 * write fails.
 *
 * Mixed-series batches are supported — callers can hand us a flat array and
 * we group internally — but the contract for a SINGLE-series batch is "one
 * open, one write." That is what the test spy verifies.
 */
export function appendMetrics(points: MetricPoint[]): boolean {
  if (!Array.isArray(points) || points.length === 0) return false;
  const groups = new Map<string, MetricPoint[]>();
  for (const p of points) {
    if (!isValidSeriesName(p.series)) return false;
    const arr = groups.get(p.series);
    if (arr) arr.push(p);
    else groups.set(p.series, [p]);
  }
  if (!ensureRoot()) return false;
  let allOk = true;
  for (const [series, pts] of groups) {
    const buf = pts.map(serializeLine).join('');
    try {
      appendFileSync(seriesPath(series), buf, 'utf8');
      schedulePruneOnce(series);
    } catch {
      allOk = false;
    }
  }
  return allOk;
}

function schedulePruneOnce(series: string): void {
  if (prunedThisProcess.has(series)) return;
  prunedThisProcess.add(series);
  // Defer so the prune does not block the request that triggered the append.
  setImmediate(() => {
    try {
      pruneSeries(series, 7);
    } catch {
      /* prune is best-effort */
    }
  });
}

// ──────────────────────────── read ──────────────────────────────────

function parseLines(raw: string): MetricPoint[] {
  const out: MetricPoint[] = [];
  // Split on newlines to tolerate files written with or without trailing
  // newline. Skip empty lines and lines that do not parse as JSON objects
  // with the required shape.
  for (const line of raw.split('\n')) {
    if (line.length === 0) continue;
    try {
      const obj = JSON.parse(line) as unknown;
      if (
        obj &&
        typeof obj === 'object' &&
        typeof (obj as MetricPoint).ts === 'number' &&
        typeof (obj as MetricPoint).series === 'string' &&
        typeof (obj as MetricPoint).value === 'number'
      ) {
        out.push(obj as MetricPoint);
      }
    } catch {
      // Skip malformed line — by design.
    }
  }
  return out;
}

/**
 * Read the last `minutes` of a series. Returns [] if the file is missing or
 * unreadable. Throws if `series` is not a valid name (catches obvious caller
 * bugs early). `now` is injectable for tests.
 */
export function readSeries(opts: {
  series: string;
  minutes: number;
  now?: number;
}): MetricPoint[] {
  if (!isValidSeriesName(opts.series)) {
    throw new Error('invalid series name');
  }
  const file = seriesPath(opts.series);
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return [];
  }
  const now = opts.now ?? Date.now();
  const cutoff = now - opts.minutes * 60_000;
  const points = parseLines(raw).filter((p) => p.ts >= cutoff);
  points.sort((a, b) => a.ts - b.ts);
  return points;
}

/**
 * Read multiple series in one pass. Returns a map keyed by series name with
 * each entry filtered + sorted by `readSeries` semantics. Invalid names
 * throw (same contract as `readSeries`).
 */
export function readMultiSeries(opts: {
  series: string[];
  minutes: number;
  now?: number;
}): Record<string, MetricPoint[]> {
  const out: Record<string, MetricPoint[]> = {};
  for (const s of opts.series) {
    out[s] = readSeries({ series: s, minutes: opts.minutes, now: opts.now });
  }
  return out;
}

// ──────────────────────────── prune ─────────────────────────────────

/**
 * Trim a series file to points within the last `days` days. Atomic via temp
 * file plus rename. Best-effort: any I/O failure leaves the source file
 * untouched (we only `rename` AFTER `writeFileSync` succeeds, and we
 * `unlink` the temp on partial failure).
 */
export function pruneSeries(series: string, days: number): void {
  if (!isValidSeriesName(series)) {
    throw new Error('invalid series name');
  }
  const file = seriesPath(series);
  if (!existsSync(file)) return;
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  const cutoff = Date.now() - days * 86_400_000;
  const kept = parseLines(raw).filter((p) => p.ts >= cutoff);
  // Sort so the rewritten file is also time-ordered; this is a free win
  // since we already parsed every line.
  kept.sort((a, b) => a.ts - b.ts);
  const body = kept.map(serializeLine).join('');
  const tmp = file + '.tmp';
  try {
    writeFileSync(tmp, body, 'utf8');
    renameSync(tmp, file);
  } catch {
    // Clean up a stale temp file if rename failed.
    try {
      if (existsSync(tmp)) unlinkSync(tmp);
    } catch {
      /* nothing more we can do */
    }
  }
}
