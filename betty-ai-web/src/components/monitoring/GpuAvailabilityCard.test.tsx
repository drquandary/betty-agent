import { describe, expect, it } from 'vitest';
import { isMigPartition, sortPartitions } from './GpuAvailabilityCard';
import type { PartitionSummary } from '@/components/dashboard/ClusterOverviewCard';

function mk(over: Partial<PartitionSummary>): PartitionSummary {
  return {
    partition: 'dgx-b200',
    nodesTotal: 0,
    gpusIdle: 0,
    gpusTotal: 0,
    cpusAlloc: 0,
    cpusIdle: 0,
    cpusOther: 0,
    cpusTotal: 0,
    memFreeGb: 0,
    memTotalGb: 0,
    downGpu: 0,
    ...over,
  };
}

describe('isMigPartition', () => {
  it('detects MIG partitions by name', () => {
    expect(isMigPartition('b200-mig45')).toBe(true);
    expect(isMigPartition('b200-mig90')).toBe(true);
    expect(isMigPartition('MIG-something')).toBe(true);
  });
  it('rejects non-MIG partitions', () => {
    expect(isMigPartition('dgx-b200')).toBe(false);
    expect(isMigPartition('genoa-lrg-mem')).toBe(false);
  });
});

describe('sortPartitions', () => {
  it('drops partitions with zero GPUs', () => {
    const out = sortPartitions([
      mk({ partition: 'cpu-only', gpusTotal: 0 }),
      mk({ partition: 'dgx-b200', gpusTotal: 216 }),
    ]);
    expect(out.map((p) => p.partition)).toEqual(['dgx-b200']);
  });

  it('puts MIG partitions after non-MIG ones', () => {
    const out = sortPartitions([
      mk({ partition: 'b200-mig45', gpusTotal: 32 }),
      mk({ partition: 'dgx-b200', gpusTotal: 216 }),
      mk({ partition: 'b200-mig90', gpusTotal: 16 }),
    ]);
    expect(out.map((p) => p.partition)).toEqual(['dgx-b200', 'b200-mig45', 'b200-mig90']);
  });

  it('sorts within each group alphabetically', () => {
    const out = sortPartitions([
      mk({ partition: 'gpu-b', gpusTotal: 8 }),
      mk({ partition: 'gpu-a', gpusTotal: 8 }),
    ]);
    expect(out.map((p) => p.partition)).toEqual(['gpu-a', 'gpu-b']);
  });
});
