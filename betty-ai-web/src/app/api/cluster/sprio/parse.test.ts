import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSprio } from './parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '..', '__fixtures__', 'sprio');
const HAPPY = readFileSync(path.join(FIX, 'happy.txt'), 'utf8');
const DEGRADED = readFileSync(path.join(FIX, 'degraded.txt'), 'utf8');
const EMPTY = readFileSync(path.join(FIX, 'empty.txt'), 'utf8');

describe('parseSprio', () => {
  it('returns [] on empty input', () => {
    expect(parseSprio(EMPTY)).toEqual([]);
  });

  it('returns [] on whitespace-only input', () => {
    expect(parseSprio('   \n\n\t\n')).toEqual([]);
  });

  it('parses 3 rows from the happy fixture', () => {
    const rows = parseSprio(HAPPY);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.jobId)).toEqual(['12345', '12346', '12347']);
  });

  it('extracts each priority factor as a number', () => {
    const [row] = parseSprio(HAPPY);
    expect(row.account).toBe('jvadala-personal');
    expect(row.priority).toBe(1234567);
    expect(row.age).toBe(10000);
    expect(row.fairshare).toBe(450000);
    expect(row.jobSize).toBe(320000);
    expect(row.partition).toBe('dgx-b200');
    expect(row.qos).toBe(50000);
  });

  it('preserves the TRES column verbatim', () => {
    const rows = parseSprio(HAPPY);
    const r2 = rows[1];
    expect(r2.tres).toBe('cpu=16,mem=64G,gres/gpu=2');
  });

  it('parses normalized priority when the %r column is present', () => {
    const rows = parseSprio(HAPPY);
    expect(rows[0].normalized).toBeCloseTo(0.1234, 4);
    expect(rows[1].normalized).toBeCloseTo(0.0987, 4);
    expect(rows[2].normalized).toBeCloseTo(0.2345, 4);
  });

  it('skips a header row if one sneaks in (sprio -h normally suppresses it)', () => {
    const withHeader = 'JOBID|ACCOUNT|PRIORITY|AGE|FAIRSHARE|JOBSIZE|PARTITION|QOS|TRES|CLUSTER|NORMALIZED\n' + HAPPY;
    const rows = parseSprio(withHeader);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.jobId)).toEqual(['12345', '12346', '12347']);
  });

  it('drops rows with too few columns', () => {
    const rows = parseSprio(DEGRADED);
    // Row 1 has 7 cols, row 2 has 2 cols, row 3 has 11 cols but the numeric
    // factor columns are "notanumber" -> dropped.
    expect(rows).toEqual([]);
  });

  it('drops a row whose required numeric columns are non-numeric', () => {
    const line = '99999|acct|notanumber|notanumber|notanumber|notanumber|partA|notanumber|cpu=8|cluster|0.5';
    expect(parseSprio(line)).toEqual([]);
  });

  it('keeps a row even if %r (normalized) is missing — backwards-compat', () => {
    const noNorm = '11111|acct|500000|1000|2000|3000|dgx-b200|0|cpu=4,mem=16G|cluster';
    const rows = parseSprio(noNorm);
    expect(rows).toHaveLength(1);
    expect(rows[0].normalized).toBeUndefined();
    expect(rows[0].priority).toBe(500000);
  });

  it('keeps a row with only the 9 required cols (no cluster, no normalized)', () => {
    const minimal = '22222|acct|500000|1000|2000|3000|dgx-b200|0|cpu=4,mem=16G';
    const rows = parseSprio(minimal);
    expect(rows).toHaveLength(1);
    expect(rows[0].jobId).toBe('22222');
    expect(rows[0].normalized).toBeUndefined();
  });

  it('does not throw on a stray non-pipe line in the middle of data', () => {
    const mixed = [
      '12345|acct|100|10|20|30|dgx-b200|0|cpu=8|cluster|0.1',
      'random garbage with no pipes',
      '12346|acct|200|20|40|60|dgx-b200|0|cpu=8|cluster|0.2',
    ].join('\n');
    const rows = parseSprio(mixed);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.jobId)).toEqual(['12345', '12346']);
  });

  it('surfaces the dominating factor — fairshare > age for the second row', () => {
    const rows = parseSprio(HAPPY);
    const r2 = rows[1];
    // Component ranking is what the dashboard renders; we just verify the
    // raw numbers are exposed so the UI can rank.
    expect(r2.fairshare).toBeGreaterThan(r2.age);
    expect(r2.fairshare).toBeGreaterThan(r2.jobSize);
  });
});
