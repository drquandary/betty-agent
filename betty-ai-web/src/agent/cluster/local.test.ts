/**
 * Unit tests for the LocalTransport (direct-exec cluster commands, no SSH).
 *
 * Same fake-spawn pattern as ssh.test.ts — no real processes, no network.
 * Integration tests against a real Slurm install are gated on
 * BETTY_CLUSTER_LIVE=1 and live elsewhere.
 */

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetLocalForTests,
  __setLocalSpawnForTests,
  buildLocalArgs,
  runLocal,
  runLocalParseable,
  uploadLocal,
} from './local';

interface FakeChild extends EventEmitter {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: PassThrough;
  kill: (sig?: string) => boolean;
  pid: number;
}

function makeFakeChild(): FakeChild {
  const ee = new EventEmitter() as FakeChild;
  ee.stdout = new PassThrough();
  ee.stderr = new PassThrough();
  ee.stdin = new PassThrough();
  ee.kill = vi.fn(() => true);
  ee.pid = Math.floor(Math.random() * 100000);
  return ee;
}

interface SpawnCall {
  command: string;
  args: readonly string[];
  child: FakeChild;
}

function installFakeSpawn(): { calls: SpawnCall[]; nextChild: (c: FakeChild) => void } {
  const calls: SpawnCall[] = [];
  const queue: FakeChild[] = [];
  const nextChild = (c: FakeChild) => queue.push(c);
  __setLocalSpawnForTests(((command: string, args: readonly string[]) => {
    const child = queue.shift() ?? makeFakeChild();
    calls.push({ command, args, child });
    return child as unknown as ReturnType<typeof makeFakeChild>;
  }) as never);
  return { calls, nextChild };
}

function finishClient(
  child: FakeChild,
  opts: { stdout?: string; stderr?: string; exit?: number } = {},
): void {
  if (opts.stdout) child.stdout.write(opts.stdout);
  if (opts.stderr) child.stderr.write(opts.stderr);
  child.stdout.end();
  child.stderr.end();
  child.emit('close', opts.exit ?? 0);
}

afterEach(() => {
  __resetLocalForTests();
});

// ---------------------------------------------------------------------------
// buildLocalArgs
// ---------------------------------------------------------------------------

describe('buildLocalArgs', () => {
  it('wraps in bash -l -c to source the login profile', () => {
    const args = buildLocalArgs('squeue -u jvadala');
    expect(args).toEqual(['-l', '-c', 'squeue -u jvadala']);
  });

  it('preserves arbitrary command content verbatim (no base64, no escaping)', () => {
    const cmd = `echo "hi $USER" && printf '%s\\n' 'a b c'`;
    const args = buildLocalArgs(cmd);
    expect(args[2]).toBe(cmd);
  });
});

// ---------------------------------------------------------------------------
// runLocal
// ---------------------------------------------------------------------------

describe('runLocal', () => {
  it('spawns bash directly and returns stdout/exit=0', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocal('squeue -u jvadala');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stdout: 'JOBID PARTITION NAME\n5400001 dgx-b200 train\n', exit: 0 });

    const res = await pending;
    expect(res.exit).toBe(0);
    expect(res.stdout).toContain('JOBID');
    expect(res.stderr).toBe('');

    expect(calls.length).toBe(1);
    expect(calls[0].command).toBe('bash');
    expect(calls[0].args).toContain('-l');
    expect(calls[0].args).toContain('-c');
    expect(calls[0].args[calls[0].args.length - 1]).toBe('squeue -u jvadala');
  });

  it('does NOT invoke ssh', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocal('sinfo');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { exit: 0 });
    await pending;

    expect(calls.every((c) => c.command !== 'ssh')).toBe(true);
  });

  it('propagates non-zero exit + stderr', async () => {
    const { nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocal('sinfo -p nope');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stderr: 'sinfo: error: no such partition\n', exit: 1 });

    const res = await pending;
    expect(res.exit).toBe(1);
    expect(res.stderr).toContain('no such partition');
  });

  it('annotates a Kerberos-missing error with a kinit hint', async () => {
    const { nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocal('sacct');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stderr: 'sacct: error: No credentials cache\n', exit: 255 });

    const res = await pending;
    expect(res.stderr).toMatch(/kinit/);
  });
});

// ---------------------------------------------------------------------------
// runLocalParseable
// ---------------------------------------------------------------------------

describe('runLocalParseable', () => {
  it('strips the sentinel so banner output doesn\'t pollute the parser', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocalParseable('parcc_sreport.py');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, {
      stdout:
        'Welcome to Betty\nQuota: 10GB used\n__BETTY_OUTPUT_START__\njcombar1 PC 61\n',
      exit: 0,
    });

    const res = await pending;
    expect(res.exit).toBe(0);
    expect(res.stdout).toBe('jcombar1 PC 61\n');

    // The wrapped command includes the sentinel printf.
    const cmd = calls[0].args[calls[0].args.length - 1];
    expect(cmd).toContain('__BETTY_OUTPUT_START__');
    expect(cmd).toContain('parcc_sreport.py');
  });

  it('passes stdout through unchanged when the sentinel is missing', async () => {
    const { nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = runLocalParseable('true');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stdout: 'no sentinel here', exit: 0 });

    const res = await pending;
    expect(res.stdout).toBe('no sentinel here');
  });
});

// ---------------------------------------------------------------------------
// uploadLocal
// ---------------------------------------------------------------------------

describe('uploadLocal', () => {
  it("streams content through `cat > path` via bash -l -c", async () => {
    const { calls, nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const payload = '#!/bin/bash\necho hi\n';
    const collected: Buffer[] = [];
    child.stdin.on('data', (c) => collected.push(Buffer.from(c)));

    const pending = uploadLocal(payload, '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { exit: 0 });
    await pending;

    expect(calls.length).toBe(1);
    expect(calls[0].command).toBe('bash');
    expect(calls[0].args[calls[0].args.length - 1]).toBe(
      "cat > '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch'",
    );
    expect(Buffer.concat(collected).toString('utf8')).toBe(payload);
  });

  it('refuses remote paths containing a single quote', async () => {
    installFakeSpawn();
    await expect(uploadLocal('x', "/vast/home/j/jvadala/evil'.sh")).rejects.toThrow(/single quote/);
  });

  it('refuses remote paths with newlines or NUL bytes', async () => {
    installFakeSpawn();
    await expect(uploadLocal('x', '/vast/home/j/jvadala/a\nb')).rejects.toThrow(/newline|NUL/);
    await expect(uploadLocal('x', '/vast/home/j/jvadala/a\0b')).rejects.toThrow(/newline|NUL/);
  });

  it('throws when cat exits non-zero', async () => {
    const { nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    const pending = uploadLocal('data', '/tmp/readonly.out');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stderr: 'Permission denied\n', exit: 1 });

    await expect(pending).rejects.toThrow(/Permission denied|cat exited/);
  });
});

// ---------------------------------------------------------------------------
// Dispatch wiring — ssh.ts delegates to local.ts when BETTY_CLUSTER_MODE=local
// ---------------------------------------------------------------------------

describe('BETTY_CLUSTER_MODE dispatch', () => {
  beforeEach(() => {
    process.env.BETTY_CLUSTER_MODE = 'local';
  });
  afterEach(() => {
    delete process.env.BETTY_CLUSTER_MODE;
  });

  it('ssh.runRemote delegates to runLocal when mode=local', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const child = makeFakeChild();
    nextChild(child);

    // Import the ssh module fresh each test — the conditional uses a
    // dynamic import so the env check happens on every call.
    const { runRemote } = await import('./ssh');
    const pending = runRemote('hostname');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(child, { stdout: 'dgx-mig45-07\n', exit: 0 });

    const res = await pending;
    expect(res.stdout).toBe('dgx-mig45-07\n');
    // Local path was taken — first (and only) spawn is bash, not ssh.
    expect(calls[0].command).toBe('bash');
  });
});
