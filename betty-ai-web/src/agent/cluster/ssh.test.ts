/**
 * Unit tests for the SSH transport.
 *
 * We never hit a real SSH server here — `__setSpawnForTests` replaces
 * `child_process.spawn` with a fake that returns an EventEmitter-based stand-in.
 * Integration tests that do hit the cluster are gated on `BETTY_SSH_OK=1` and
 * live elsewhere.
 *
 * As of Phase 2.5, `runRemote` / `uploadFile` rely on the USER'S
 * `~/.ssh/config` ControlMaster (Duo-authenticated in a real TTY) and do NOT
 * spawn their own master. So every call = one spawn (the ssh client). The
 * old two-spawn (master + client) tests were replaced to reflect this.
 */

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetForTests,
  __setSpawnForTests,
  annotateAuthError,
  buildClientArgs,
  buildMasterArgs,
  buildUserConfigClientArgs,
  closeConnection,
  DEFAULT_SSH_HOST,
  runRemote,
  runRemoteParseable,
  uploadFile,
} from './ssh';

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
  __setSpawnForTests(((command: string, args: readonly string[]) => {
    const child = queue.shift() ?? makeFakeChild();
    calls.push({ command, args, child });
    return child as unknown as ReturnType<typeof makeFakeChild>;
  }) as never);
  return { calls, nextChild };
}

/**
 * The user-config path base64-encodes the remote command. Test helper to
 * pull it back out of the wrapped argv so assertions are readable.
 */
function decodeRemoteCommand(wrappedArg: string): string {
  // wrapped is: bash -l -c "$(echo <b64> | base64 -d)"
  const m = wrappedArg.match(/echo ([A-Za-z0-9+/=]+) \| base64 -d/);
  if (!m) throw new Error(`could not extract base64 payload from: ${wrappedArg}`);
  return Buffer.from(m[1], 'base64').toString('utf8');
}

function finishClient(child: FakeChild, opts: { stdout?: string; stderr?: string; exit?: number } = {}): void {
  if (opts.stdout) child.stdout.write(opts.stdout);
  if (opts.stderr) child.stderr.write(opts.stderr);
  child.stdout.end();
  child.stderr.end();
  child.emit('close', opts.exit ?? 0);
}

beforeEach(() => {
  delete process.env.BETTY_SSH_HOST;
  // Default mirror-secret off so runRemote's fire-and-forget fetch is a no-op
  // (it returns early when the secret is unset — see mirrorToTerminal).
  delete process.env.BETTY_MIRROR_SECRET;
});

afterEach(() => {
  __resetForTests();
});

describe('buildMasterArgs', () => {
  it('uses ControlMaster (-M) with a UNIX socket and keepalives', () => {
    const args = buildMasterArgs('/tmp/sock', 'user@host');
    expect(args).toContain('-M');
    expect(args).toContain('-N');
    expect(args).toContain('-S');
    expect(args[args.indexOf('-S') + 1]).toBe('/tmp/sock');
    expect(args).toContain('ServerAliveInterval=30');
    expect(args).toContain('ControlPersist=60s');
    expect(args).toContain('GSSAPIAuthentication=yes');
    expect(args[args.length - 1]).toBe('user@host');
  });
});

describe('buildClientArgs', () => {
  it('multiplexes over an explicit master socket (ControlMaster=no)', () => {
    const args = buildClientArgs('/tmp/sock', 'user@host', 'squeue');
    expect(args[0]).toBe('-S');
    expect(args[1]).toBe('/tmp/sock');
    expect(args).toContain('ControlMaster=no');
    expect(args[args.length - 2]).toBe('user@host');
    expect(args[args.length - 1]).toBe('squeue');
  });
});

describe('buildUserConfigClientArgs', () => {
  it('passes host + wrapped bash -l -c command, no -M / -S', () => {
    const args = buildUserConfigClientArgs('user@host', 'squeue -u jvadala');
    expect(args).toContain('-o');
    expect(args).toContain('BatchMode=yes');
    expect(args).toContain('user@host');
    expect(args).not.toContain('-M');
    expect(args).not.toContain('-S');
    const wrapped = args[args.length - 1];
    expect(wrapped.startsWith('bash -l -c')).toBe(true);
    expect(decodeRemoteCommand(wrapped)).toBe('squeue -u jvadala');
  });

  it('preserves single/double quotes and special characters via base64', () => {
    const cmd = `echo "hello $USER" && printf '%s\\n' 'a b c'`;
    const args = buildUserConfigClientArgs('user@host', cmd);
    expect(decodeRemoteCommand(args[args.length - 1])).toBe(cmd);
  });
});

describe('runRemote', () => {
  it('spawns a single ssh client via user-config and returns stdout/exit=0', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const pending = runRemote('squeue -u jvadala');
    // yield to let spawn + collectOutput listeners attach
    await new Promise((r) => setTimeout(r, 0));
    finishClient(client, { stdout: 'JOBID PARTITION NAME USER ST TIME NODES NODELIST\n', exit: 0 });

    const res = await pending;
    expect(res.exit).toBe(0);
    expect(res.stdout).toContain('JOBID');
    expect(res.stderr).toBe('');

    // Exactly one spawn: the client. No -M.
    expect(calls.length).toBe(1);
    expect(calls[0].command).toBe('ssh');
    expect(calls[0].args).not.toContain('-M');
    expect(calls[0].args).toContain(DEFAULT_SSH_HOST);
    expect(decodeRemoteCommand(calls[0].args[calls[0].args.length - 1])).toBe('squeue -u jvadala');
  });

  it('respects BETTY_SSH_HOST override', async () => {
    process.env.BETTY_SSH_HOST = 'alt@otherhost';
    const { calls, nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const pending = runRemote('sinfo');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(client, { exit: 0 });
    await pending;

    expect(calls[0].args).toContain('alt@otherhost');
    expect(calls[0].args).not.toContain(DEFAULT_SSH_HOST);
  });

  it('two sequential calls produce two independent spawns, neither with -M', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const c1 = makeFakeChild();
    const c2 = makeFakeChild();
    nextChild(c1);
    nextChild(c2);

    const p1 = runRemote('squeue');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(c1, { exit: 0 });
    await p1;

    const p2 = runRemote('sinfo');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(c2, { exit: 0 });
    await p2;

    expect(calls.length).toBe(2);
    expect(calls.filter((c) => c.args.includes('-M')).length).toBe(0);
  });

  it('propagates non-zero exit codes and stderr', async () => {
    const { nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const pending = runRemote('sinfo -p nope');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(client, { stderr: 'sinfo: error: no such partition\n', exit: 1 });

    const res = await pending;
    expect(res.exit).toBe(1);
    expect(res.stderr).toContain('no such partition');
  });

  it('retries once on failure then gives up with "failed after reconnect"', async () => {
    const { nextChild, calls } = installFakeSpawn();
    const c1 = makeFakeChild();
    const c2 = makeFakeChild();
    nextChild(c1);
    nextChild(c2);

    const pending = runRemote('squeue');
    // Drive attempt 1: emit an error on the child so collectOutput rejects.
    await new Promise((r) => setTimeout(r, 0));
    c1.emit('error', new Error('spawn ENOENT'));
    // Drive attempt 2: also errors.
    await new Promise((r) => setTimeout(r, 0));
    c2.emit('error', new Error('spawn ENOENT'));

    await expect(pending).rejects.toThrow(/failed after reconnect/);
    expect(calls.length).toBe(2);
  });
});

describe('runRemoteParseable', () => {
  it('strips the output sentinel and returns only the command output', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const pending = runRemoteParseable('parcc_sreport.py');
    await new Promise((r) => setTimeout(r, 0));
    // Simulate the login-shell banner, then the sentinel, then real output.
    finishClient(client, {
      stdout: 'Welcome to Betty\nQuota: 10GB used\n__BETTY_OUTPUT_START__\njcombar1 PC 61\n',
      exit: 0,
    });

    const res = await pending;
    expect(res.exit).toBe(0);
    expect(res.stdout).toBe('jcombar1 PC 61\n');
    // Verify the wrapped command includes the sentinel printf
    const remoteCmd = decodeRemoteCommand(calls[0].args[calls[0].args.length - 1]);
    expect(remoteCmd).toContain('__BETTY_OUTPUT_START__');
    expect(remoteCmd).toContain('parcc_sreport.py');
  });

  it('passes through unchanged when the sentinel is missing', async () => {
    const { nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const pending = runRemoteParseable('true');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(client, { stdout: 'no sentinel here', exit: 0 });

    const res = await pending;
    expect(res.stdout).toBe('no sentinel here');
  });
});

describe('annotateAuthError', () => {
  it('leaves exit=0 results untouched', () => {
    const r = { stdout: 'ok', stderr: '', exit: 0 };
    expect(annotateAuthError(r)).toBe(r);
  });

  it('adds a kinit hint when stderr mentions missing Kerberos credentials', () => {
    const r = { stdout: '', stderr: 'No credentials cache found\n', exit: 255 };
    expect(annotateAuthError(r).stderr).toMatch(/kinit/);
  });

  it('adds a Duo hint when stderr is keyboard-interactive permission denied', () => {
    const r = { stdout: '', stderr: 'Permission denied (publickey,keyboard-interactive).', exit: 255 };
    expect(annotateAuthError(r).stderr).toMatch(/Duo/);
  });

  it('adds a ControlMaster hint when socket is stale', () => {
    const r = { stdout: '', stderr: 'Control socket connect(/tmp/cm): No such file or directory', exit: 255 };
    expect(annotateAuthError(r).stderr).toMatch(/ControlMaster/);
  });

  it('leaves results unchanged when no known pattern matches', () => {
    const r = { stdout: '', stderr: 'unrelated error', exit: 2 };
    expect(annotateAuthError(r)).toBe(r);
  });
});

describe('uploadFile', () => {
  it("streams content through ssh ... 'cat > path' via the user-config client", async () => {
    const { calls, nextChild } = installFakeSpawn();
    const client = makeFakeChild();
    nextChild(client);

    const payload = '#!/bin/bash\necho hi\n';
    const collected: Buffer[] = [];
    client.stdin.on('data', (c) => collected.push(Buffer.from(c)));

    const pending = uploadFile(payload, '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(client, { exit: 0 });
    await pending;

    expect(calls.length).toBe(1);
    expect(calls[0].command).toBe('ssh');
    const remoteCmd = decodeRemoteCommand(calls[0].args[calls[0].args.length - 1]);
    expect(remoteCmd).toBe("cat > '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch'");
    expect(Buffer.concat(collected).toString('utf8')).toBe(payload);
  });

  it('refuses remote paths containing a single quote', async () => {
    installFakeSpawn();
    await expect(uploadFile('x', "/vast/home/j/jvadala/evil'.sh")).rejects.toThrow(/single quote/);
  });

  it('refuses remote paths with newlines or NUL bytes', async () => {
    installFakeSpawn();
    await expect(uploadFile('x', '/vast/home/j/jvadala/a\nb')).rejects.toThrow(/newline|NUL/);
    await expect(uploadFile('x', '/vast/home/j/jvadala/a\0b')).rejects.toThrow(/newline|NUL/);
  });

  it('throws when remote cat exits non-zero (after retry)', async () => {
    const { nextChild } = installFakeSpawn();
    const c1 = makeFakeChild();
    const c2 = makeFakeChild();
    nextChild(c1);
    nextChild(c2);

    const pending = uploadFile('data', '/vast/home/j/jvadala/readonly.out');
    await new Promise((r) => setTimeout(r, 0));
    finishClient(c1, { stderr: 'Permission denied\n', exit: 1 });
    // Give the retry time to spawn the second child, then also fail.
    await new Promise((r) => setTimeout(r, 0));
    finishClient(c2, { stderr: 'Permission denied\n', exit: 1 });

    await expect(pending).rejects.toThrow(/Permission denied|failed after reconnect/);
  });
});

describe('closeConnection', () => {
  it('is a no-op when no internal master is open', () => {
    // runRemote no longer opens an internal master; closeConnection is still
    // called defensively in retry paths. Assert it doesn't throw.
    expect(() => closeConnection()).not.toThrow();
  });
});
