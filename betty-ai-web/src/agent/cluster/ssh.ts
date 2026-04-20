/**
 * SSH transport for the Betty cluster.
 *
 * Design decisions (PLAN.md):
 * - D1: shell out to the system `ssh` CLI. This inherits the user's Kerberos
 *   ticket from their `kinit` cache on the host — no keypairs or passwords to
 *   manage. The `ssh2` npm module is deliberately NOT used.
 * - D2: pool one connection per server process via OpenSSH's ControlMaster
 *   (`-M -S <socket>`). Subsequent `runRemote` / `uploadFile` calls multiplex
 *   over the same TCP+auth session. 30s keepalive; auto-reconnect on socket
 *   failure.
 *
 * Public surface:
 *   - runRemote(command): Promise<{stdout, stderr, exit}>
 *   - uploadFile(content, remotePath): Promise<void>
 *   - closeConnection(): void
 *   - __setSpawnForTests(fn) / __resetForTests(): test hooks
 */

import { spawn as realSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface RemoteResult {
  stdout: string;
  stderr: string;
  exit: number;
}

export const DEFAULT_SSH_HOST = 'jvadala@login.betty.parcc.upenn.edu';

/**
 * Spawn injection point. Production calls node's real `spawn`; tests override
 * this with a fake so we can assert argv and simulate process lifecycles
 * without touching the network.
 */
type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: SpawnOptions,
) => ChildProcess;

let spawnImpl: SpawnFn = realSpawn as unknown as SpawnFn;

export function __setSpawnForTests(fn: SpawnFn): void {
  spawnImpl = fn;
}

export function __resetForTests(): void {
  spawnImpl = realSpawn as unknown as SpawnFn;
  closeConnection();
}

function getHost(): string {
  return process.env.BETTY_SSH_HOST ?? DEFAULT_SSH_HOST;
}

interface ConnectionState {
  socketDir: string;
  socketPath: string;
  master: ChildProcess;
  host: string;
  ready: Promise<void>;
}

let connection: ConnectionState | null = null;

/**
 * Build the ControlMaster argv used to open the shared connection.
 * Exposed so tests can assert on the exact flags we send.
 */
export function buildMasterArgs(socketPath: string, host: string): string[] {
  return [
    '-M',
    '-N',
    '-S',
    socketPath,
    '-o',
    'ControlPersist=60s',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=3',
    '-o',
    'GSSAPIAuthentication=yes',
    '-o',
    'GSSAPIDelegateCredentials=yes',
    host,
  ];
}

/**
 * Build the argv for a client command that multiplexes over the master socket.
 */
export function buildClientArgs(socketPath: string, host: string, remoteCommand: string): string[] {
  return ['-S', socketPath, '-o', 'ControlMaster=no', host, remoteCommand];
}

function openConnection(): ConnectionState {
  const socketDir = mkdtempSync(join(tmpdir(), 'betty-ssh-'));
  const socketPath = join(socketDir, 'cm.sock');
  const host = getHost();
  const master = spawnImpl('ssh', buildMasterArgs(socketPath, host), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const ready = new Promise<void>((resolve, reject) => {
    // We consider the master "ready" when it has been alive briefly without
    // exiting. OpenSSH's ControlMaster doesn't print a handshake marker, so
    // we rely on exit-or-not. If it dies, we reject and the next call will
    // transparently reopen.
    let settled = false;
    const t = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve();
      }
    }, 250);
    master.once('exit', (code, signal) => {
      if (!settled) {
        settled = true;
        clearTimeout(t);
        reject(new Error(`ssh master exited early (code=${code}, signal=${signal ?? 'none'})`));
      }
    });
    master.once('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(t);
        reject(err);
      }
    });
  });

  master.once('exit', () => {
    // If the shared master dies, drop the cached connection so the next call
    // reopens cleanly. This is the "auto-reconnect on socket failure" path.
    if (connection && connection.master === master) {
      try {
        rmSync(connection.socketDir, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
      connection = null;
    }
  });

  return { socketDir, socketPath, master, host, ready };
}

async function ensureConnection(): Promise<ConnectionState> {
  if (connection) {
    try {
      await connection.ready;
      // If master has already exited, the exit handler above cleared `connection`.
      if (connection) return connection;
    } catch {
      connection = null;
    }
  }
  connection = openConnection();
  try {
    await connection.ready;
  } catch (err) {
    connection = null;
    throw err;
  }
  return connection;
}

export function closeConnection(): void {
  if (!connection) return;
  const c = connection;
  connection = null;
  try {
    c.master.kill('SIGTERM');
  } catch {
    /* best-effort */
  }
  try {
    rmSync(c.socketDir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

function collectOutput(child: ChildProcess, stdinPayload?: string | Buffer): Promise<RemoteResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString('utf8');
    });
    child.once('error', reject);
    child.once('close', (code) => {
      resolve({ stdout, stderr, exit: code ?? -1 });
    });
    if (stdinPayload !== undefined && child.stdin) {
      child.stdin.end(stdinPayload);
    }
  });
}

/**
 * Run a command on the remote host and return its stdout/stderr/exit code.
 * Callers MUST NOT pass user-controlled strings here without whitelisting —
 * this function sends `command` to a remote shell verbatim.
 */
export async function runRemote(command: string): Promise<RemoteResult> {
  const attempt = async (): Promise<RemoteResult> => {
    const c = await ensureConnection();
    const child = spawnImpl('ssh', buildClientArgs(c.socketPath, c.host, command), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return collectOutput(child);
  };

  try {
    return await attempt();
  } catch (err) {
    // Socket vanished / master died between calls — retry once with a fresh
    // connection. This is the "auto-reconnect on socket failure" contract.
    closeConnection();
    try {
      return await attempt();
    } catch (err2) {
      throw new Error(
        `runRemote failed after reconnect: ${(err2 as Error).message} (original: ${(err as Error).message})`,
      );
    }
  }
}

/**
 * Upload a file to the remote host by streaming it through `ssh ... 'cat > path'`.
 * We prefer this over `scp` because it reuses the multiplexed ControlMaster
 * socket and avoids an extra auth handshake. The remote path is quoted with
 * single quotes; callers SHOULD pass an absolute, sanitized path (no single
 * quotes in the path string — we reject those defensively).
 */
export async function uploadFile(
  content: string | Buffer,
  remotePath: string,
): Promise<void> {
  if (remotePath.includes("'")) {
    throw new Error(`uploadFile: refusing remote path containing a single quote: ${remotePath}`);
  }
  if (remotePath.includes('\n') || remotePath.includes('\0')) {
    throw new Error(`uploadFile: refusing remote path with newline/NUL`);
  }
  const attempt = async (): Promise<void> => {
    const c = await ensureConnection();
    const remoteCmd = `cat > '${remotePath}'`;
    const child = spawnImpl('ssh', buildClientArgs(c.socketPath, c.host, remoteCmd), {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const result = await collectOutput(child, content);
    if (result.exit !== 0) {
      throw new Error(
        `uploadFile: remote cat exited ${result.exit}: ${result.stderr.trim() || '(no stderr)'}`,
      );
    }
  };

  try {
    await attempt();
  } catch (err) {
    closeConnection();
    try {
      await attempt();
    } catch (err2) {
      throw new Error(
        `uploadFile failed after reconnect: ${(err2 as Error).message} (original: ${(err as Error).message})`,
      );
    }
  }
}
