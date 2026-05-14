/**
 * Route-handler tests for /api/cluster/pending-reasons.
 *
 * Mocks @/agent/cluster/ssh and @/lib/metrics-store. Verifies happy path,
 * exit-error path, and a re-assertion of the parser's privacy contract at
 * the route boundary - the serialized response MUST NOT contain any of the
 * usernames present in the fixture's %u column.
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
  join(__dirname, '..', '__fixtures__', 'pending-reasons', 'happy.txt'),
  'utf8',
);

// Usernames appearing in the fixture's %u column - the route must not leak
// any of them in its serialized response.
const FIXTURE_USERNAMES = [
  'jvadala',
  'jcombar1',
  'ryb',
  'otheruser',
  'someoneelse',
  'grad-student',
  'admin',
];

beforeEach(() => {
  runRemoteParseable.mockReset();
  appendMetrics.mockReset();
});

describe('GET /api/cluster/pending-reasons', () => {
  it('returns ok:true and a parsed summary on happy stdout', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.total).toBeGreaterThan(0);
    expect(body.data.byReason.length).toBeGreaterThan(0);
    expect(body.data.privacy_posture).toBe('squeue-aggregated-no-user-or-jobid');
  });

  it('serialized response must NOT contain any fixture usernames', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    const serialized = JSON.stringify(body);
    for (const u of FIXTURE_USERNAMES) {
      expect(serialized).not.toContain(u);
    }
  });

  it('keeps the %u column in the squeue command (parser privacy contract)', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET();
    const cmd = runRemoteParseable.mock.calls[0][0] as string;
    expect(cmd).toContain('%u');
    expect(cmd).toContain('-t PD');
  });

  it('emits slurm.pending.total + per-reason metrics on success', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET();
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    const points = appendMetrics.mock.calls[0][0] as Array<{ series: string; value: number }>;
    const series = points.map((p) => p.series);
    expect(series).toContain('slurm.pending.total');
    expect(series.some((s) => s.startsWith('slurm.pending.reason.'))).toBe(true);
    // Every series must match the metrics-store regex
    const re = /^[a-zA-Z0-9._-]+$/;
    for (const s of series) expect(re.test(s)).toBe(true);
  });

  it('returns ok:false on exit != 0', async () => {
    runRemoteParseable.mockResolvedValue({
      stdout: '',
      stderr: 'squeue: error',
      exit: 1,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toMatch(/squeue: error/);
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('returns ok:false on thrown network error', async () => {
    runRemoteParseable.mockRejectedValue(new Error('ssh: tunnel closed'));
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/tunnel closed/);
  });

  it('does NOT fail the response when ringbuffer write throws', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    appendMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
