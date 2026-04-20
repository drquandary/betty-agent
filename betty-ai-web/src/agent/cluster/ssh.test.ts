/**
 * Unit tests for the SSH transport.
 *
 * We never hit a real SSH server here — `__setSpawnForTests` replaces
 * `child_process.spawn` with a fake that returns an EventEmitter-based stand-in.
 * Integration tests that do hit the cluster are gated on `BETTY_SSH_OK=1` and
 * live elsewhere.
 */

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetForTests,
  __setSpawnForTests,
  buildClientArgs,
  buildMasterArgs,
  closeConnection,
  DEFAULT_SSH_HOST,
  runRemote,
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
  let queue: FakeChild[] = [];
  const nextChild = (c: FakeChild) => queue.push(c);
  __setSpawnForTests(((command: string, args: readonly string[]) => {
    const child = queue.shift() ?? makeFakeChild();
    calls.push({ command, args, child });
    return child as unknown as ReturnType<typeof makeFakeChild>;
  }) as never);
  return { calls, nextChild };
}

beforeEach(() => {
  delete process.env.BETTY_SSH_HOST;
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
  it('multiplexes over the master socket (ControlMaster=no)', () => {
    const args = buildClientArgs('/tmp/sock', 'user@host', 'squeue');
    expect(args[0]).toBe('-S');
    expect(args[1]).toBe('/tmp/sock');
    expect(args).toContain('ControlMaster=no');
    expect(args[args.length - 2]).toBe('user@host');
    expect(args[args.length - 1]).toBe('squeue');
  });
});

describe('runRemote', () => {
  it('opens a ControlMaster, then a client, and returns stdout/exit=0', async () => {
    const { calls, nextChild } = installFakeSpawn();

    const master = makeFakeChild();
    const client = makeFakeChild();
    nextChild(master);
    nextChild(client);

    const pending = runRemote('squeue -u jvadala');

    // Let the master stay alive (no exit) — the transport considers it ready
    // after a short debounce. Then drive the client to completion.
    await new Promise((r) => setTimeout(r, 260));
    client.stdout.write('JOBID PARTITION NAME USER ST TIME NODES NODELIST\n');
    client.stderr.write('');
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 0);

    const res = await pending;
    expect(res.exit).toBe(0);
    expect(res.stdout).toContain('JOBID');
    expect(res.stderr).toBe('');

    // First spawn was the master with -M
    expect(calls[0].command).toBe('ssh');
    expect(calls[0].args).toContain('-M');
    // Second spawn was the client with the remote command as the final arg
    expect(calls[1].command).toBe('ssh');
    expect(calls[1].args[calls[1].args.length - 1]).toBe('squeue -u jvadala');
    // Uses the default host when BETTY_SSH_HOST is unset
    expect(calls[0].args[calls[0].args.length - 1]).toBe(DEFAULT_SSH_HOST);
  });

  it('respects BETTY_SSH_HOST override', async () => {
    process.env.BETTY_SSH_HOST = 'alt@otherhost';
    const { calls, nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client = makeFakeChild();
    nextChild(master);
    nextChild(client);

    const pending = runRemote('sinfo');
    await new Promise((r) => setTimeout(r, 260));
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 0);
    await pending;

    expect(calls[0].args[calls[0].args.length - 1]).toBe('alt@otherhost');
  });

  it('reuses the master across two runRemote calls', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client1 = makeFakeChild();
    const client2 = makeFakeChild();
    nextChild(master);
    nextChild(client1);
    nextChild(client2);

    const p1 = runRemote('squeue');
    await new Promise((r) => setTimeout(r, 260));
    client1.stdout.end();
    client1.stderr.end();
    client1.emit('close', 0);
    await p1;

    const p2 = runRemote('sinfo');
    // Yield so ensureConnection awaits + client2 spawn + collectOutput listeners
    // attach before we drive events on client2.
    await new Promise((r) => setTimeout(r, 0));
    client2.stdout.end();
    client2.stderr.end();
    client2.emit('close', 0);
    await p2;

    // master + 2 clients = 3 spawns, master is spawn #0 only.
    expect(calls.length).toBe(3);
    expect(calls.filter((c) => c.args.includes('-M')).length).toBe(1);
  });

  it('auto-reconnects when the master dies between calls', async () => {
    const { calls, nextChild } = installFakeSpawn();
    const master1 = makeFakeChild();
    const client1 = makeFakeChild();
    const master2 = makeFakeChild();
    const client2 = makeFakeChild();
    nextChild(master1);
    nextChild(client1);
    nextChild(master2);
    nextChild(client2);

    const p1 = runRemote('squeue');
    await new Promise((r) => setTimeout(r, 260));
    client1.stdout.end();
    client1.stderr.end();
    client1.emit('close', 0);
    await p1;

    // Simulate master dying.
    master1.emit('exit', 255, null);

    const p2 = runRemote('sinfo');
    await new Promise((r) => setTimeout(r, 260));
    client2.stdout.end();
    client2.stderr.end();
    client2.emit('close', 0);
    await p2;

    // Two masters should have been spawned (-M appears twice).
    expect(calls.filter((c) => c.args.includes('-M')).length).toBe(2);
  });

  it('propagates non-zero exit codes and stderr', async () => {
    const { nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client = makeFakeChild();
    nextChild(master);
    nextChild(client);

    const pending = runRemote('sinfo -p nope');
    await new Promise((r) => setTimeout(r, 260));
    client.stderr.write('sinfo: error: no such partition\n');
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 1);

    const res = await pending;
    expect(res.exit).toBe(1);
    expect(res.stderr).toContain('no such partition');
  });

  it('rejects (after retry) when the master fails to open', async () => {
    const { nextChild } = installFakeSpawn();
    const master1 = makeFakeChild();
    const master2 = makeFakeChild();
    nextChild(master1);
    nextChild(master2);

    // Both masters die immediately => both ready-promises reject.
    const pending = runRemote('squeue');
    // Yield so openConnection has run, the master1 spawn returned, and the
    // `exit` listener is attached before we emit.
    await new Promise((r) => setTimeout(r, 0));
    master1.emit('exit', 255, null);
    // First attempt rejects; runRemote catches, closes the connection, and
    // retries. Give it a tick to open master2 and attach the new listener.
    await new Promise((r) => setTimeout(r, 0));
    master2.emit('exit', 255, null);

    await expect(pending).rejects.toThrow(/failed after reconnect/);
  });
});

describe('uploadFile', () => {
  it("streams content through ssh ... 'cat > path' on the master socket", async () => {
    const { calls, nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client = makeFakeChild();
    nextChild(master);
    nextChild(client);

    const payload = '#!/bin/bash\necho hi\n';
    const collected: Buffer[] = [];
    client.stdin.on('data', (c) => collected.push(Buffer.from(c)));

    const pending = uploadFile(payload, '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch');
    await new Promise((r) => setTimeout(r, 260));
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 0);
    await pending;

    const clientCall = calls[1];
    expect(clientCall.args[clientCall.args.length - 1]).toBe(
      "cat > '/vast/home/j/jvadala/.betty-ai/scripts/x.sbatch'",
    );
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

  it('throws when remote cat exits non-zero', async () => {
    const { nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client = makeFakeChild();
    const master2 = makeFakeChild();
    const client2 = makeFakeChild();
    nextChild(master);
    nextChild(client);
    // Retry path also spawns a new master+client; make those fail too.
    nextChild(master2);
    nextChild(client2);

    const pending = uploadFile('data', '/vast/home/j/jvadala/readonly.out');
    await new Promise((r) => setTimeout(r, 260));
    client.stderr.write('Permission denied\n');
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 1);

    // Second attempt also fails.
    setTimeout(() => {
      client2.stderr.write('Permission denied\n');
      client2.stdout.end();
      client2.stderr.end();
      client2.emit('close', 1);
    }, 300);

    await expect(pending).rejects.toThrow(/Permission denied|failed after reconnect/);
  });
});

describe('closeConnection', () => {
  it('kills the master and resets state', async () => {
    const { nextChild } = installFakeSpawn();
    const master = makeFakeChild();
    const client = makeFakeChild();
    nextChild(master);
    nextChild(client);

    const p = runRemote('squeue');
    await new Promise((r) => setTimeout(r, 260));
    client.stdout.end();
    client.stderr.end();
    client.emit('close', 0);
    await p;

    closeConnection();
    expect(master.kill).toHaveBeenCalled();
  });
});
