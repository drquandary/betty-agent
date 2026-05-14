import { describe, expect, it } from 'vitest';
import { parseSinfoOverview } from './parse';

describe('parseSinfoOverview', () => {
  it('returns [] on empty input', () => {
    expect(parseSinfoOverview('')).toEqual([]);
  });

  it('aggregates idle / total GPUs across nodes', () => {
    const stdout = [
      'dgx-b200|2|idle|gpu:b200:8|0/192/0/192',
      'dgx-b200|3|allocated|gpu:b200:8|288/0/0/288',
    ].join('\n');
    const rows = parseSinfoOverview(stdout);
    expect(rows).toHaveLength(1);
    const p = rows[0];
    expect(p.partition).toBe('dgx-b200');
    expect(p.nodesIdle).toBe(2);
    expect(p.nodesTotal).toBe(5);
    expect(p.gpusIdle).toBe(16); // 2 idle nodes * 8 GPUs
    expect(p.gpusTotal).toBe(40); // 5 nodes * 8 GPUs
    expect(p.cpusAlloc).toBe(288);
    expect(p.cpusIdle).toBe(192);
    expect(p.cpusTotal).toBe(480);
  });

  it('parses MIG GRES strings', () => {
    const stdout = 'dgx-b200-mig|1|idle|gpu:b200_mig45_g:32|0/256/0/256';
    const [row] = parseSinfoOverview(stdout);
    expect(row.gpusIdle).toBe(32);
    expect(row.gpusTotal).toBe(32);
  });

  it('strips trailing * from default partition marker', () => {
    const stdout = 'compute*|4|idle|(null)|0/96/0/96';
    const [row] = parseSinfoOverview(stdout);
    expect(row.partition).toBe('compute');
    expect(row.gpusTotal).toBe(0);
  });

  it('skips malformed rows but keeps good ones', () => {
    const stdout = [
      'garbage line',
      'dgx-b200|1|idle|gpu:b200:8|0/192/0/192',
      '|||',
    ].join('\n');
    const rows = parseSinfoOverview(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].partition).toBe('dgx-b200');
  });

  it('sorts partitions alphabetically', () => {
    const stdout = [
      'zzz|1|idle|gpu:a:1|0/1/0/1',
      'aaa|1|idle|gpu:a:1|0/1/0/1',
    ].join('\n');
    expect(parseSinfoOverview(stdout).map((r) => r.partition)).toEqual(['aaa', 'zzz']);
  });

  it('counts a "mix" node toward total but not idle GPUs', () => {
    const stdout = 'compute|1|mix|gpu:a:4|2/2/0/4';
    const [row] = parseSinfoOverview(stdout);
    expect(row.nodesTotal).toBe(1);
    expect(row.nodesIdle).toBe(0);
    expect(row.gpusTotal).toBe(4);
    expect(row.gpusIdle).toBe(0);
  });
});
