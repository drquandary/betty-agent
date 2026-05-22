import { describe, expect, it } from 'vitest';
import { rollup } from './ClusterTotalsStrip';
import type { PartitionSummary } from './ClusterOverviewCard';

function p(over: Partial<PartitionSummary>): PartitionSummary {
  return {
    partition: 'dgx-b200',
    nodesIdle: 0,
    nodesTotal: 0,
    gpusIdle: 0,
    gpusTotal: 0,
    cpusAlloc: 0,
    cpusIdle: 0,
    cpusOther: 0,
    cpusTotal: 0,
    ...over,
  };
}

describe('rollup', () => {
  it('sums GPUs, nodes, and CPUs across partitions', () => {
    const r = rollup([
      p({ partition: 'a', gpusIdle: 10, gpusTotal: 20, nodesIdle: 1, nodesTotal: 4, cpusIdle: 96, cpusTotal: 384 }),
      p({ partition: 'b', gpusIdle: 4, gpusTotal: 16, nodesIdle: 2, nodesTotal: 5, cpusIdle: 32, cpusTotal: 160 }),
    ]);
    expect(r.partitions).toBe(2);
    expect(r.gpusFree).toBe(14);
    expect(r.gpusTotal).toBe(36);
    expect(r.nodesIdle).toBe(3);
    expect(r.nodesTotal).toBe(9);
    expect(r.cpusFree).toBe(128);
    expect(r.cpusTotal).toBe(544);
  });

  it('flags partitions with zero idle GPUs as saturated (only when they have GPUs)', () => {
    const r = rollup([
      p({ partition: 'gpu-full', gpusIdle: 0, gpusTotal: 16 }),
      p({ partition: 'gpu-some', gpusIdle: 4, gpusTotal: 16 }),
      p({ partition: 'cpu-only', gpusIdle: 0, gpusTotal: 0 }),
    ]);
    expect(r.saturatedGpuPartitions).toEqual(['gpu-full']);
  });

  it('flags partitions with zero idle nodes as full', () => {
    const r = rollup([
      p({ partition: 'a', nodesIdle: 0, nodesTotal: 4 }),
      p({ partition: 'b', nodesIdle: 2, nodesTotal: 4 }),
      p({ partition: 'empty', nodesIdle: 0, nodesTotal: 0 }),
    ]);
    expect(r.fullPartitions).toEqual(['a']);
  });

  it('flags partitions with cpusOther > 0 as having drained/down nodes', () => {
    const r = rollup([
      p({ partition: 'healthy', cpusOther: 0 }),
      p({ partition: 'has-drain', cpusOther: 32 }),
    ]);
    expect(r.drainedPartitions).toEqual(['has-drain']);
  });

  it('returns zero rollup for empty input without crashing', () => {
    const r = rollup([]);
    expect(r.partitions).toBe(0);
    expect(r.gpusFree).toBe(0);
    expect(r.gpusTotal).toBe(0);
    expect(r.saturatedGpuPartitions).toEqual([]);
  });
});
