/**
 * Route-handler tests for /api/cluster/sprio.
 *
 * Mocks @/agent/cluster/ssh so no real SSH connection happens, and uses
 * BETTY_SSH_USER env manipulation to exercise the user-validation path.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runRemoteParseable = vi.fn();

vi.mock('@/agent/cluster/ssh', () => ({
  runRemoteParseable: (cmd: string) => runRemoteParseable(cmd),
}));

import { GET } from './route';

const HAPPY = readFileSync(
  join(__dirname, '..', '__fixtures__', 'sprio', 'happy.txt'),
  'utf8',
);

const ORIG_USER = process.env.BETTY_SSH_USER;

beforeEach(() => {
  runRemoteParseable.mockReset();
  process.env.BETTY_SSH_USER = 'jvadala';
});

afterEach(() => {
  if (ORIG_USER === undefined) delete process.env.BETTY_SSH_USER;
  else process.env.BETTY_SSH_USER = ORIG_USER;
});

describe('GET /api/cluster/sprio', () => {
  it('returns ok:true and parsed jobs on happy stdout', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: HAPPY, stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jobs.length).toBeGreaterThan(0);
    expect(body.jobs[0].jobId).toBeTruthy();
    expect(typeof body.jobs[0].priority).toBe('number');
  });

  it('returns ok:true + empty list when sprio has no rows', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: '', stderr: '', exit: 0 });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.jobs).toEqual([]);
  });

  it('interpolates the validated user into the sprio command', async () => {
    runRemoteParseable.mockResolvedValue({ stdout: '', stderr: '', exit: 0 });
    process.env.BETTY_SSH_USER = 'service_user';
    await GET();
    expect(runRemoteParseable).toHaveBeenCalledTimes(1);
    const cmd = runRemoteParseable.mock.calls[0][0] as string;
    // -l was dropped (sprio rejects it alongside -o); -h still suppresses the header.
    expect(cmd.startsWith('sprio -h -u service_user ')).toBe(true);
    expect(cmd).toContain('%i|%a|%Y|%A|%F|%J|%P|%Q|%T|%c|%r');
  });

  it('rejects an invalid BETTY_SSH_USER without calling ssh', async () => {
    process.env.BETTY_SSH_USER = 'bad;user';
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid BETTY_SSH_USER/);
    expect(body.jobs).toEqual([]);
    expect(runRemoteParseable).not.toHaveBeenCalled();
  });

  it('returns ok:false with the stderr message when exit != 0', async () => {
    runRemoteParseable.mockResolvedValue({
      stdout: '',
      stderr: 'sprio: invalid option',
      exit: 1,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/invalid option/);
    expect(body.jobs).toEqual([]);
  });

  it('returns ok:false on a thrown network error', async () => {
    runRemoteParseable.mockRejectedValue(new Error('ssh: tunnel closed'));
    const res = await GET();
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/tunnel closed/);
    expect(body.jobs).toEqual([]);
  });
});
