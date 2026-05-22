import { describe, expect, it } from 'vitest';
import { parseSfree, extractJsonArray } from './parse';

function sfreeJson(rows: Array<Record<string, unknown>>): string {
  // Simulate real stdout: shell/MOTD noise before the JSON array.
  return `Lmod reloaded modules\nsome motd line\n${JSON.stringify(rows)}\n`;
}

describe('extractJsonArray', () => {
  it('slices the JSON array out of noisy stdout', () => {
    expect(extractJsonArray('garbage\n[1,2,3]\ntrailer')).toBe('[1,2,3]');
  });
  it('returns null when no array present', () => {
    expect(extractJsonArray('no json here')).toBeNull();
  });
});

describe('parseSfree', () => {
  it('returns [] on empty / non-JSON input', () => {
    expect(parseSfree('')).toEqual([]);
    expect(parseSfree('not json')).toEqual([]);
  });

  it('maps parcc_sfree fields to PartitionSummary', () => {
    const stdout = sfreeJson([
      {
        partition: 'dgx-b200',
        nodes: 27,
        cpu_free: 2302,
        cpu_total: 6048,
        mem_free_gb: 19576,
        mem_total_gb: 55725,
        gpu_free: 32,
        gpu_total: 216,
        down_cpu: 1120,
        down_mem_gb: 10319,
        down_gpu: 40,
      },
    ]);
    const [p] = parseSfree(stdout);
    expect(p.partition).toBe('dgx-b200');
    expect(p.nodesTotal).toBe(27);
    expect(p.gpusIdle).toBe(32);
    expect(p.gpusTotal).toBe(216);
    expect(p.downGpu).toBe(40);
    expect(p.cpusIdle).toBe(2302);
    expect(p.cpusTotal).toBe(6048);
    expect(p.cpusOther).toBe(1120); // down cpus
    expect(p.cpusAlloc).toBe(6048 - 2302 - 1120);
    expect(p.memFreeGb).toBe(19576);
    expect(p.memTotalGb).toBe(55725);
  });

  it('counts free MIG slices directly from gpu_free (the bug fix)', () => {
    const stdout = sfreeJson([
      { partition: 'b200-mig90', nodes: 1, gpu_free: 15, gpu_total: 16, cpu_free: 210, cpu_total: 224 },
    ]);
    const [row] = parseSfree(stdout);
    expect(row.gpusIdle).toBe(15);
    expect(row.gpusTotal).toBe(16);
  });

  it('drops the (no-partition) bucket', () => {
    const stdout = sfreeJson([
      { partition: '(no-partition)', nodes: 2, gpu_free: 0, gpu_total: 0 },
      { partition: 'dgx-b200', nodes: 27, gpu_free: 32, gpu_total: 216 },
    ]);
    expect(parseSfree(stdout).map((r) => r.partition)).toEqual(['dgx-b200']);
  });

  it('sorts partitions alphabetically and defaults missing fields to 0', () => {
    const stdout = sfreeJson([
      { partition: 'zzz' },
      { partition: 'aaa' },
    ]);
    const rows = parseSfree(stdout);
    expect(rows.map((r) => r.partition)).toEqual(['aaa', 'zzz']);
    expect(rows[0].gpusTotal).toBe(0);
    expect(rows[0].memFreeGb).toBe(0);
  });
});
