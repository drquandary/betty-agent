/**
 * Route-handler tests for /api/cluster/sacct-summary.
 *
 * Mocks @/agent/cluster/ssh and @/lib/metrics-store. Verifies happy path,
 * the ?hours= query string, clamp policy (reject with ok:false), invalid
 * user, and ringbuffer write failure safety.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  join(__dirname, '..', '__fixtures__', 'sacct-summary', 'happy.txt'),
  'utf8',
);

const ORIG_USER = process.env.BETTY_SSH_USER;

function mkReq(query: string): NextRequest {
  return new NextRequest(new URL('http://localhost/api/cluster/sacct-summary' + query));
}

beforeEach(() => {
  runRemoteParseable.mockReset();
  appendMetrics.mockReset();
  process.env.BETTY_SSH_USER = 'jvadala';
});

afterEach(() => {
  if (ORIG_USER === undefined) delete process.env.BETTY_SSH_USER;
  else process.env.BETTY_SSH_USER = ORIG_USER;
});

describe('GET /api/cluster/sacct-summary', () => {
  it('returns ok:true and a parsed summary with default 24h', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET(mkReq(''));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.hours).toBe(24);
    expect(body.data).toBeTruthy();
    expect(body.data.totals.completed).toBeGreaterThan(0);
    expect(body.data.sampleCount).toBeGreaterThan(0);
    // Command shape: 24-hour window
    const cmd = runRemoteParseable.mock.calls[0][0] as string;
    expect(cmd).toContain('-S now-24hours');
    expect(cmd).toContain('-u jvadala');
  });

  it('uses ?hours=72 when provided', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET(mkReq('?hours=72'));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.hours).toBe(72);
    const cmd = runRemoteParseable.mock.calls[0][0] as string;
    expect(cmd).toContain('-S now-72hours');
  });

  it('rejects ?hours=999 with ok:false and 200 status', async () => {
    const res = await GET(mkReq('?hours=999'));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.data).toBeNull();
    expect(body.error).toMatch(/between 1 and 168/);
    expect(runRemoteParseable).not.toHaveBeenCalled();
  });

  it('rejects ?hours=0 with ok:false', async () => {
    const res = await GET(mkReq('?hours=0'));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(runRemoteParseable).not.toHaveBeenCalled();
  });

  it('rejects non-numeric ?hours= with ok:false', async () => {
    const res = await GET(mkReq('?hours=abc'));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/integer/);
    expect(runRemoteParseable).not.toHaveBeenCalled();
  });

  it('rejects an invalid BETTY_SSH_USER without calling ssh', async () => {
    process.env.BETTY_SSH_USER = 'BAD;USER';
    const res = await GET(mkReq(''));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid BETTY_SSH_USER/);
    expect(body.data).toBeNull();
    expect(runRemoteParseable).not.toHaveBeenCalled();
  });

  it('returns ok:false with stderr message on exit != 0', async () => {
    runRemoteParseable.mockResolvedValue({
      stdout: '',
      stderr: 'sacct: error: unable to contact slurmdbd',
      exit: 1,
    });
    const res = await GET(mkReq(''));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/slurmdbd/);
    expect(appendMetrics).not.toHaveBeenCalled();
  });

  it('emits per-hour-bucket metrics on success', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    await GET(mkReq(''));
    expect(appendMetrics).toHaveBeenCalledTimes(1);
    const points = appendMetrics.mock.calls[0][0] as Array<{ series: string; value: number }>;
    expect(points.length).toBeGreaterThan(0);
    const series = new Set(points.map((p) => p.series));
    expect(series.has('slurm.jobs.completed')).toBe(true);
    // No empty buckets emitted
    for (const p of points) expect(p.value).toBeGreaterThan(0);
  });

  it('does NOT fail the response when the ringbuffer write throws', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    appendMetrics.mockImplementation(() => {
      throw new Error('disk full');
    });
    const res = await GET(mkReq(''));
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
