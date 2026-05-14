import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSacctSummary } from './parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '..', '__fixtures__', 'sacct-summary');
const HAPPY = readFileSync(path.join(FIX, 'happy.txt'), 'utf8');
const DEGRADED = readFileSync(path.join(FIX, 'degraded.txt'), 'utf8');
const EMPTY = readFileSync(path.join(FIX, 'empty.txt'), 'utf8');

describe('parseSacctSummary', () => {
  it('returns zeros on empty input', () => {
    const out = parseSacctSummary(EMPTY);
    expect(out.buckets).toEqual([]);
    expect(out.totals).toEqual({ completed: 0, failed: 0, timeout: 0, cancelled: 0, other: 0 });
    expect(out.sampleCount).toBe(0);
  });

  it('dedupes .batch and .extern step rows to a single parent JobID', () => {
    // Fixture has 12300, 12300.batch, 12300.extern — all COMPLETED.
    const out = parseSacctSummary(HAPPY);
    // Total unique parents in fixture: 12300, 12301, 12302, 12303, 12304, 12305, 12306, 12307 -> 8.
    expect(out.sampleCount).toBe(8);
    expect(out.totals.completed).toBe(4); // 12300, 12304, 12306, 12307
  });

  it('classifies failed / timeout / cancelled / failed-node states', () => {
    const out = parseSacctSummary(HAPPY);
    expect(out.totals.failed).toBe(2); // 12301 FAILED + 12305 NODE_FAIL
    expect(out.totals.timeout).toBe(1); // 12302 TIMEOUT
    expect(out.totals.cancelled).toBe(1); // 12303 CANCELLED by 12345
    expect(out.totals.other).toBe(0);
  });

  it('buckets jobs by the End-time hour', () => {
    const out = parseSacctSummary(HAPPY);
    // 12300 ended at 08:14 -> bucket 2026-04-27T08:00:00
    const eight = out.buckets.find((b) => b.hour === '2026-04-27T08:00:00');
    expect(eight).toBeDefined();
    // Two jobs (12300 COMPLETED + 12301 FAILED) end in the 08:00 hour.
    expect(eight!.completed).toBe(1);
    expect(eight!.failed).toBe(1);
  });

  it('returns buckets sorted ascending by hour', () => {
    const out = parseSacctSummary(HAPPY);
    const hours = out.buckets.map((b) => b.hour);
    const sorted = [...hours].sort();
    expect(hours).toEqual(sorted);
  });

  it('drops rows whose End is empty or unparseable', () => {
    const stdout = [
      '12300|COMPLETED|2026-04-27T08:14:22|01:23:45|dgx-b200|cpu=8',
      '12301|FAILED||00:02:08|dgx-b200|cpu=8',
      '12302|FAILED|Unknown|00:05:00|compute|cpu=4',
    ].join('\n');
    const out = parseSacctSummary(stdout);
    expect(out.sampleCount).toBe(1);
    expect(out.totals.completed).toBe(1);
    expect(out.totals.failed).toBe(0);
  });

  it('does not throw on degraded input and still buckets the valid row', () => {
    const out = parseSacctSummary(DEGRADED);
    // Only 12300 (COMPLETED) has a usable End. 12301 has empty End. 12302's
    // state UNKNOWNSTATE -> 'other'. Both 12301 and "no_pipes_here" drop.
    expect(out.sampleCount).toBeGreaterThanOrEqual(1);
    expect(out.totals.completed).toBe(1);
    // 12302 has a valid End and bucket -> 'other'.
    expect(out.totals.other).toBe(1);
  });

  it('handles "CANCELLED by <uid>" by taking the leading token', () => {
    const stdout = '99999|CANCELLED by 12345|2026-04-27T09:30:00|00:15:00|dgx-b200|cpu=8';
    const out = parseSacctSummary(stdout);
    expect(out.totals.cancelled).toBe(1);
  });

  it('skips a header row if one sneaks in', () => {
    const withHeader = 'JobID|State|End|Elapsed|Partition|ReqTRES\n' + HAPPY;
    const out = parseSacctSummary(withHeader);
    expect(out.sampleCount).toBe(8);
  });

  it('survives CRLF line endings', () => {
    const crlf = HAPPY.replace(/\n/g, '\r\n');
    const out = parseSacctSummary(crlf);
    expect(out.sampleCount).toBe(8);
  });

  it('does not double-count when .batch precedes the parent in the stream', () => {
    const stdout = [
      '12300.batch|COMPLETED|2026-04-27T08:14:22|01:23:45|dgx-b200|cpu=8',
      '12300|COMPLETED|2026-04-27T08:14:22|01:23:45|dgx-b200|cpu=8',
    ].join('\n');
    const out = parseSacctSummary(stdout);
    expect(out.sampleCount).toBe(1);
    expect(out.totals.completed).toBe(1);
  });
});
