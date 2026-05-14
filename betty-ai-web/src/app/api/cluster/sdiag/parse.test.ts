import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseSdiag } from './parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '..', '__fixtures__', 'sdiag');
const HAPPY = readFileSync(path.join(FIX, 'happy.txt'), 'utf8');
const DEGRADED = readFileSync(path.join(FIX, 'degraded.txt'), 'utf8');
const EMPTY = readFileSync(path.join(FIX, 'empty.txt'), 'utf8');

describe('parseSdiag', () => {
  it('returns a fully-null shape on empty input without throwing', () => {
    const out = parseSdiag(EMPTY);
    expect(out.scheduler.serverThreadCount).toBeNull();
    expect(out.scheduler.lastCycleMs).toBeNull();
    expect(out.backfill.totalBackfilledJobs).toBeNull();
    expect(out.rpc).toEqual([]);
    expect(out.generatedAt).toBeNull();
    expect(out.raw_sections).toEqual([]);
  });

  it('parses the header timestamp from happy.txt', () => {
    const out = parseSdiag(HAPPY);
    expect(out.generatedAt).toBe('Mon Apr 27 14:32:09 2026');
  });

  it('extracts top-level scheduler fields', () => {
    const out = parseSdiag(HAPPY);
    expect(out.scheduler.serverThreadCount).toBe(6);
    expect(out.scheduler.agentQueueSize).toBe(0);
    expect(out.scheduler.dbdAgentQueueSize).toBe(0);
  });

  it('converts microsecond cycle times into milliseconds', () => {
    const out = parseSdiag(HAPPY);
    // Last cycle: 13412 us -> 13.41 ms
    expect(out.scheduler.lastCycleMs).toBe(13.41);
    // Mean cycle: 3922 us -> 3.92 ms
    expect(out.scheduler.meanCycleMs).toBe(3.92);
    // Max cycle: 498731 us -> 498.73 ms
    expect(out.scheduler.maxCycleMs).toBe(498.73);
  });

  it('extracts backfill stats with parenthesized labels', () => {
    const out = parseSdiag(HAPPY);
    expect(out.backfill.lastCycleMs).toBe(882.13);
    expect(out.backfill.meanCycleMs).toBe(461.92);
    expect(out.backfill.maxCycleMs).toBe(4781.23);
    expect(out.backfill.lastDepthTried).toBe(412);
    expect(out.backfill.lastDepthTriedSched).toBe(218);
    expect(out.backfill.totalBackfilledJobs).toBe(411);
  });

  it('parses the RPC table into typed rows', () => {
    const out = parseSdiag(HAPPY);
    expect(out.rpc.length).toBeGreaterThanOrEqual(3);
    const nodeInfo = out.rpc.find((r) => r.name === 'REQUEST_NODE_INFO');
    expect(nodeInfo).toBeDefined();
    expect(nodeInfo!.count).toBe(14523);
    // total_time: 6112483 us -> 6112.48 ms
    expect(nodeInfo!.totalTimeMs).toBe(6112.48);
  });

  it('records section headers seen', () => {
    const out = parseSdiag(HAPPY);
    expect(out.raw_sections).toContain('Main schedule statistics (microseconds):');
    expect(out.raw_sections).toContain('Backfilling stats');
    expect(out.raw_sections).toContain('Remote Procedure Call statistics by message type');
  });

  it('returns nulls for unparseable fields in degraded input, not a crash', () => {
    const out = parseSdiag(DEGRADED);
    expect(out.scheduler.serverThreadCount).toBe(6);
    // "CORRUPTED" is not numeric -> null
    expect(out.scheduler.agentQueueSize).toBeNull();
    // Mean cycle "???" -> null
    expect(out.scheduler.meanCycleMs).toBeNull();
    // Last cycle still present
    expect(out.scheduler.lastCycleMs).toBe(13.41);
  });

  it('drops malformed RPC lines but keeps valid ones in degraded input', () => {
    const out = parseSdiag(DEGRADED);
    // REQUEST_NODE_INFO row has total_time:GARBLED — should be dropped.
    // No valid RPC rows in the degraded fixture -> rpc is empty.
    expect(out.rpc).toEqual([]);
  });

  it('never throws on a partial sdiag missing whole sections', () => {
    const partial = 'Server thread count:  4\n';
    expect(() => parseSdiag(partial)).not.toThrow();
    const out = parseSdiag(partial);
    expect(out.scheduler.serverThreadCount).toBe(4);
    expect(out.backfill.totalBackfilledJobs).toBeNull();
  });

  it('survives Windows-style CRLF line endings', () => {
    const crlf = HAPPY.replace(/\n/g, '\r\n');
    const out = parseSdiag(crlf);
    expect(out.scheduler.serverThreadCount).toBe(6);
    expect(out.backfill.totalBackfilledJobs).toBe(411);
  });
});
