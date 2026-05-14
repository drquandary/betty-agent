/**
 * Route-handler tests for /api/cluster/sdiag.
 *
 * Mocks @/agent/cluster/ssh and @/lib/metrics-store so no real SSH connection
 * and no disk writes happen. Verifies:
 *   - happy path returns ok:true + parsed snapshot
 *   - exit != 0 returns ok:false with stderr-derived error
 *   - network error returns ok:false
 *   - metrics-store throw does NOT break the response
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
  join(__dirname, '..', '__fixtures__', 'sdiag', 'happy.txt'),
  'utf8',
);

beforeEach(() => {
  runRemoteParseable.mockReset();
  appendMetrics.mockReset();
});

describe('GET /api/cluster/sdiag', () => {
  it('returns ok:true and a parsed snapshot on happy stdout', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
    expect(body.data.scheduler.lastCycleMs).toBeGreaterThan(0);
    expect(body.data.backfill.lastCycleMs).toBeGreaterThan(0);
    expect(body.data.rpc.length).toBeGreaterThan(0);
  });

  it('invokes sdiag with no flags', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET();
    expect(runRemoteParseable).toHaveBeenCalledWith('sdiag');
  });

  it('emits headline metrics on success', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET();
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    const points = appendMetrics.mock.calls[0][0] as Array<{ series: string; value: number }>;
    const series = points.map((p) => p.series);
    expect(series).toContain('slurm.sched.last_cycle_ms');
    expect(series).toContain('slurm.sched.mean_cycle_ms');
    expect(series).toContain('slurm.backfill.last_cycle_ms');
    expect(series).toContain('slurm.backfill.mean_cycle_ms');
    expect(series).toContain('slurm.backfill.depth_tried');
    expect(series).toContain('slurm.backfill.total_jobs');
    // Every value is finite (no null slipped through).
    for (const p of points) expect(Number.isFinite(p.value)).toBe(true);
  });

  it('returns ok:false when exit != 0', async () => {
    runRemoteParseable.mockResolvedValue({
      stdout: '',
      stderr: 'sdiag: connection refused',
      exit: 1,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toMatch(/connection refused/);
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('returns ok:false on a thrown network error', async () => {
    runRemoteParseable.mockRejectedValue(new Error('ssh: tunnel closed'));
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toMatch(/tunnel closed/);
  });

  it('does NOT fail the response when the ringbuffer write throws', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    appendMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data).toBeTruthy();
  });
});
