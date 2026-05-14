/**
 * Route-handler tests for /api/cluster/nodes.
 *
 * Mocks @/agent/cluster/ssh and @/lib/metrics-store. Verifies happy path
 * across multiple partitions, empty stdout, exit-error, and ringbuffer
 * write failure safety.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runRemoteParseable = vi.fn();
const appendMetrics = vi.fn();

vi.mock('@/agent/cluster/ssh', () => ({
  runRemoteParseable: (cmd: string) => runRemoteParseable(cmd),
}));

vi.mock('@/lib/metrics-store', () => ({
  appendMetrics: (...args: unknown[]) => appendMetrics(...args),
}));

import { GET } from './route';

const HAPPY = readFileSync(
  join(__dirname, '..', '__fixtures__', 'nodes', 'happy.txt'),
  'utf8',
);

beforeEach(() => {
  runRemoteParseable.mockReset();
  appendMetrics.mockReset();
});

describe('GET /api/cluster/nodes', () => {
  it('returns ok:true + parsed nodes on happy stdout', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.nodes.length).toBeGreaterThan(0);
    // Fixture has multiple partitions
    const parts = new Set(body.nodes.map((n: { partition: string }) => n.partition));
    expect(parts.size).toBeGreaterThanOrEqual(2);
  });

  it('returns ok:true + empty list when sinfo has no rows', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: '', stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.nodes).toEqual([]);
    // No metrics for an empty cluster
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('emits per-partition + cluster-total state counts', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET();
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    const points = appendMetrics.mock.calls[0][0] as Array<{ series: string; value: number }>;
    const series = points.map((p) => p.series);
    // Per-partition series for dgx-b200 and compute
    expect(series.some((s) => s.startsWith('slurm.nodes.dgx-b200.'))).toBe(true);
    expect(series.some((s) => s.startsWith('slurm.nodes.compute.'))).toBe(true);
    // Cluster-wide rollup
    expect(series.some((s) => s.startsWith('slurm.nodes.total.'))).toBe(true);
    // All values are positive
    for (const p of points) expect(p.value).toBeGreaterThan(0);
    // All series match the metrics-store regex
    const re = /^[a-zA-Z0-9._-]+$/;
    for (const s of series) expect(re.test(s)).toBe(true);
  });

  it('returns ok:false with stderr message on exit != 0', async () => {
    runRemoteParseable.mockResolvedValue({
      stdout: '',
      stderr: 'sinfo: error',
      exit: 1,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.nodes).toEqual([]);
    expect(body.error).toMatch(/sinfo: error/);
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('returns ok:false on thrown network error', async () => {
    runRemoteParseable.mockRejectedValue(new Error('ssh: tunnel closed'));
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/tunnel closed/);
    expect(body.nodes).toEqual([]);
  });

  it('does NOT fail the response when the ringbuffer write throws', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    appendMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.nodes.length).toBeGreaterThan(0);
  });
});
