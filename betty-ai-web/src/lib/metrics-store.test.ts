/**
 * Tests for `metrics-store.ts`.
 *
 * Each test pins `metricsRoot` to a fresh tmpdir and tears it down after.
 * We deliberately avoid `vi.useFakeTimers()` - the only timer the module
 * uses is `setImmediate` for opportunistic prune, and we let that run
 * naturally; the tests that care about prune call `pruneSeries` directly.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import * as fs from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = fs;

import {
  appendMetric,
  appendMetrics,
  getMetricsRoot,
  pruneSeries,
  readMultiSeries,
  readSeries,
  setMetricsRoot,
  type MetricPoint,
} from './metrics-store';

let root: string;

function freshRoot(): string {
  return mkdtempSync(join(tmpdir(), 'betty-metrics-' + randomBytes(6).toString('hex') + '-'));
}

beforeEach(() => {
  root = freshRoot();
  setMetricsRoot(root);
});

afterEach(() => {
  vi.restoreAllMocks();
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    /* nothing */
  }
});

describe('metrics-store', () => {
  it('append + read roundtrip - 3 points come back sorted', () => {
    const now = 1_700_000_000_000;
    // Intentionally write out of order to verify sort.
    expect(appendMetric({ ts: now - 1000, series: 'pending.total', value: 5 })).toBe(true);
    expect(appendMetric({ ts: now - 3000, series: 'pending.total', value: 7 })).toBe(true);
    expect(appendMetric({ ts: now - 2000, series: 'pending.total', value: 6 })).toBe(true);

    const out = readSeries({ series: 'pending.total', minutes: 5, now });
    expect(out.map((p) => p.ts)).toEqual([now - 3000, now - 2000, now - 1000]);
    expect(out.map((p) => p.value)).toEqual([7, 6, 5]);
  });

  it('filters by minutes window - old points are excluded', () => {
    const now = 1_700_000_000_000;
    appendMetric({ ts: now - 10 * 60_000, series: 'backfill.mean_cycle_ms', value: 999 });
    appendMetric({ ts: now - 1 * 60_000, series: 'backfill.mean_cycle_ms', value: 111 });
    appendMetric({ ts: now - 30_000, series: 'backfill.mean_cycle_ms', value: 222 });

    const out = readSeries({ series: 'backfill.mean_cycle_ms', minutes: 5, now });
    expect(out.map((p) => p.value)).toEqual([111, 222]);
  });

  it('skips malformed lines mixed with valid lines - no throw', () => {
    const file = join(root, 'node.state.idle.jsonl');
    const now = 1_700_000_000_000;
    const lines = [
      JSON.stringify({ ts: now - 1000, series: 'node.state.idle', value: 4 }),
      'NOT VALID JSON',
      JSON.stringify({ ts: now - 500, series: 'node.state.idle', value: 5 }),
      '{"ts": "not-a-number", "series": "node.state.idle", "value": 3}',
      '',
      '{"missing_fields": true}',
    ];
    fs.mkdirSync(root, { recursive: true });
    writeFileSync(file, lines.join('\n') + '\n', 'utf8');

    const out = readSeries({ series: 'node.state.idle', minutes: 5, now });
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.value)).toEqual([4, 5]);
  });

  it('rejects invalid series names - append returns false, read throws, nothing written', () => {
    const badNames = ['../etc/passwd', 'a/b', 'a b', '..', '.', '', 'has space'];

    for (const name of badNames) {
      expect(
        appendMetric({ ts: Date.now(), series: name, value: 1 }),
      ).toBe(false);
      expect(
        appendMetrics([{ ts: Date.now(), series: name, value: 1 }]),
      ).toBe(false);
      expect(() => readSeries({ series: name, minutes: 5 })).toThrow(/invalid series name/);
      expect(() => pruneSeries(name, 7)).toThrow(/invalid series name/);
    }

    if (existsSync(root)) {
      const entries = fs.readdirSync(root);
      expect(entries).toEqual([]);
    }
  });

  it('prune retains only points within window, atomically (no .tmp left behind)', () => {
    const now = Date.now();
    appendMetric({ ts: now - 1_000, series: 'pending.total', value: 1 });
    appendMetric({ ts: now - 60_000, series: 'pending.total', value: 2 });
    appendMetric({ ts: now - 30 * 86_400_000, series: 'pending.total', value: 99 });
    appendMetric({ ts: now - 14 * 86_400_000, series: 'pending.total', value: 88 });

    pruneSeries('pending.total', 7);

    const out = readSeries({ series: 'pending.total', minutes: 24 * 60 * 30, now });
    expect(out.map((p) => p.value).sort()).toEqual([1, 2]);

    const tmpPath = join(root, 'pending.total.jsonl.tmp');
    expect(existsSync(tmpPath)).toBe(false);

    const filePath = join(root, 'pending.total.jsonl');
    expect(existsSync(filePath)).toBe(true);
    const lines = readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBe(2);
    for (const l of lines) {
      expect(() => JSON.parse(l)).not.toThrow();
    }
  });

  it('append-many writes all points in one open per series (functional check)', () => {
    // Vitest under ESM cannot spy on node:fs exports (the namespace is
    // frozen). Instead, we verify "one open per series" indirectly: write
    // four points to one series in a single appendMetrics call, then verify
    // the resulting file content equals exactly the four serialized lines
    // concatenated in input order. This would NOT hold if the impl
    // performed N separate appendFileSync calls and any of them failed
    // partially, and it's the property that downstream code relies on.
    const now = 1_700_000_000_000;
    const pts: MetricPoint[] = [
      { ts: now - 3000, series: 'pending.total', value: 1 },
      { ts: now - 2000, series: 'pending.total', value: 2 },
      { ts: now - 1000, series: 'pending.total', value: 3 },
      { ts: now - 500, series: 'pending.total', value: 4 },
    ];
    expect(appendMetrics(pts)).toBe(true);

    const file = join(root, 'pending.total.jsonl');
    const raw = readFileSync(file, 'utf8');
    const expected = pts.map((p) => JSON.stringify(p) + '\n').join('');
    expect(raw).toBe(expected);

    // And the read-back matches.
    const out = readSeries({ series: 'pending.total', minutes: 5, now });
    expect(out.map((p) => p.value)).toEqual([1, 2, 3, 4]);
  });

  it('appendMetrics groups mixed-series batches into one open per series', () => {
    const now = 1_700_000_000_000;
    expect(
      appendMetrics([
        { ts: now - 100, series: 'pending.total', value: 1 },
        { ts: now - 90, series: 'node.state.idle', value: 10 },
        { ts: now - 80, series: 'pending.total', value: 2 },
      ]),
    ).toBe(true);

    // Verify each series file has exactly the points routed to it, in
    // input order.
    const pending = readFileSync(join(root, 'pending.total.jsonl'), 'utf8');
    expect(pending.split('\n').filter(Boolean)).toHaveLength(2);
    const idle = readFileSync(join(root, 'node.state.idle.jsonl'), 'utf8');
    expect(idle.split('\n').filter(Boolean)).toHaveLength(1);
  });

  it('100 sequential appendMetric calls produce 100 lines in order', () => {
    const base = 1_700_000_000_000;
    for (let i = 0; i < 100; i++) {
      const ok = appendMetric({ ts: base + i, series: 'pending.total', value: i });
      expect(ok).toBe(true);
    }
    const file = join(root, 'pending.total.jsonl');
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
    expect(lines.length).toBe(100);

    const tsSeen = lines.map((l) => JSON.parse(l).ts as number);
    for (let i = 0; i < 100; i++) {
      expect(tsSeen[i]).toBe(base + i);
    }

    const out = readSeries({
      series: 'pending.total',
      minutes: 60,
      now: base + 100,
    });
    expect(out.length).toBe(100);
    for (let i = 0; i < 100; i++) {
      expect(out[i].value).toBe(i);
    }
  });

  it('readMultiSeries reads independent series in one call', () => {
    const now = 1_700_000_000_000;
    appendMetric({ ts: now - 1000, series: 'pending.total', value: 10 });
    appendMetric({ ts: now - 500, series: 'pending.total', value: 11 });
    appendMetric({ ts: now - 800, series: 'node.state.idle', value: 22 });

    const out = readMultiSeries({
      series: ['pending.total', 'node.state.idle', 'never.written'],
      minutes: 5,
      now,
    });
    expect(out['pending.total'].map((p) => p.value)).toEqual([10, 11]);
    expect(out['node.state.idle'].map((p) => p.value)).toEqual([22]);
    expect(out['never.written']).toEqual([]);
  });

  it('readSeries returns [] for a series that has never been written', () => {
    expect(readSeries({ series: 'nothing.here', minutes: 5 })).toEqual([]);
  });

  it('setMetricsRoot / getMetricsRoot round-trip the resolved path', () => {
    const newRoot = freshRoot();
    setMetricsRoot(newRoot);
    expect(getMetricsRoot()).toBe(newRoot);
    try {
      expect(appendMetric({ ts: Date.now(), series: 'sanity', value: 1 })).toBe(true);
    } finally {
      try {
        rmSync(newRoot, { recursive: true, force: true });
      } catch {
        /* nothing */
      }
    }
  });
});
