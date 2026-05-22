import { describe, expect, it } from 'vitest';
import { parseSinfoOverview, isAvailableState, parseGpuCount } from './parse';

// New format: one line per node, whitespace-separated columns:
//   Partition  StateLong  CPUsState(A/I/O/T)  Gres  GresUsed
describe('parseSinfoOverview', () => {
  it('returns [] on empty input', () => {
    expect(parseSinfoOverview('')).toEqual([]);
  });

  it('computes free GPUs as total - used over available nodes', () => {
    const stdout = [
      'dgx-b200 idle      0/224/0/224   gpu:B200:8(S:0-1) gpu:B200:0(IDX:N/A)',
      'dgx-b200 allocated 224/0/0/224   gpu:B200:8(S:0-1) gpu:B200:8(IDX:0-7)',
      'dgx-b200 mixed     142/82/0/224  gpu:B200:8(S:0-1) gpu:B200:5(IDX:0,2,4-5,7)',
    ].join('\n');
    const [p] = parseSinfoOverview(stdout);
    expect(p.partition).toBe('dgx-b200');
    expect(p.nodesIdle).toBe(1);
    expect(p.nodesTotal).toBe(3);
    // free = (8-0) + (8-8) + (8-5) = 11
    expect(p.gpusIdle).toBe(11);
    expect(p.gpusTotal).toBe(24);
    expect(p.cpusTotal).toBe(672);
    expect(p.cpusIdle).toBe(306);
  });

  it('counts free MIG slices on a mixed node (the bug fix)', () => {
    // One physical card sliced 32 ways, 13 in use → 19 free, even though the
    // node is "mixed" (the old parser would have reported 0).
    const stdout =
      'b200-mig45 mixed 56/168/0/224 gpu:45gb:32(S:0-1) gpu:45gb:13(IDX:0-1,3-5,16-23)';
    const [row] = parseSinfoOverview(stdout);
    expect(row.gpusTotal).toBe(32);
    expect(row.gpusIdle).toBe(19);
  });

  it('does NOT count GPUs on drained/maint/reserved nodes as free', () => {
    const stdout = [
      'dgx-b200 drained* 0/0/224/224 gpu:B200:8(S:0-1) gpu:B200:0(IDX:N/A)',
      'dgx-b200 maint    0/224/0/224 gpu:B200:8(S:0-1) gpu:B200:0(IDX:N/A)',
      'dgx-b200 reserved 0/224/0/224 gpu:B200:8(S:0-1) gpu:B200:0(IDX:N/A)',
    ].join('\n');
    const [row] = parseSinfoOverview(stdout);
    expect(row.gpusTotal).toBe(24); // still counted in total
    expect(row.gpusIdle).toBe(0); // but none are available
  });

  it('handles (null) GRES for CPU-only partitions', () => {
    const stdout = 'genoa-std-mem* mixed 51/13/0/64 (null) (null)';
    const [row] = parseSinfoOverview(stdout);
    expect(row.partition).toBe('genoa-std-mem');
    expect(row.gpusTotal).toBe(0);
    expect(row.gpusIdle).toBe(0);
    expect(row.cpusIdle).toBe(13);
  });

  it('skips malformed rows but keeps good ones', () => {
    const stdout = [
      'garbage',
      'dgx-b200 idle 0/224/0/224 gpu:B200:8(S:0-1) gpu:B200:0(IDX:N/A)',
    ].join('\n');
    const rows = parseSinfoOverview(stdout);
    expect(rows).toHaveLength(1);
    expect(rows[0].partition).toBe('dgx-b200');
  });

  it('sorts partitions alphabetically', () => {
    const stdout = [
      'zzz idle 0/1/0/1 gpu:a:1(S:0) gpu:a:0(IDX:N/A)',
      'aaa idle 0/1/0/1 gpu:a:1(S:0) gpu:a:0(IDX:N/A)',
    ].join('\n');
    expect(parseSinfoOverview(stdout).map((r) => r.partition)).toEqual(['aaa', 'zzz']);
  });
});

describe('isAvailableState', () => {
  it('treats idle/mix/alloc as available', () => {
    expect(isAvailableState('idle')).toBe(true);
    expect(isAvailableState('mixed')).toBe(true);
    expect(isAvailableState('allocated')).toBe(true);
  });
  it('treats drain/down/maint/resv as unavailable', () => {
    expect(isAvailableState('drained')).toBe(false);
    expect(isAvailableState('down')).toBe(false);
    expect(isAvailableState('maint')).toBe(false);
    expect(isAvailableState('reserved')).toBe(false);
  });
});

describe('parseGpuCount', () => {
  it('extracts counts from typed GRES tokens', () => {
    expect(parseGpuCount('gpu:B200:8(S:0-1)')).toBe(8);
    expect(parseGpuCount('gpu:45gb:32(S:0-1)')).toBe(32);
    expect(parseGpuCount('gpu:B200:0(IDX:N/A)')).toBe(0);
  });
  it('returns 0 for null / non-GPU GRES', () => {
    expect(parseGpuCount('(null)')).toBe(0);
    expect(parseGpuCount('')).toBe(0);
  });
});
