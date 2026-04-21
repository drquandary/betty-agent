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
 * Mirror a run into the visible terminal pane so the user sees what Betty AI
 * did. Fire-and-forget — failures are swallowed because the real result has
 * already been returned to the caller, and the mirror is display-only.
 */
function mirrorToTerminal(command: string, result: RemoteResult): void {
  const host = process.env.BETTY_TERMINAL_WS_HOST || '127.0.0.1';
  const port = Number(process.env.BETTY_TERMINAL_WS_PORT ?? 3001);
  // Dim gray framing + tag so it's visually distinct from the user's typing.
  const tag = '\x1b[2m\x1b[36m[betty-agent]\x1b[0m';
  const header = `\r\n${tag} \x1b[2m$ ${command}\x1b[0m\r\n`;
  const bodyText = (result.stdout || '') + (result.stderr ? `\x1b[31m${result.stderr}\x1b[0m` : '');
  const normalized = bodyText.replace(/\r?\n/g, '\r\n');
  const footer = `${tag} \x1b[2mexit ${result.exit}\x1b[0m\r\n`;
  const text = header + normalized + (normalized.endsWith('\r\n') ? '' : '\r\n') + footer;

  const payload = JSON.stringify({ text });
  const secret = process.env.BETTY_MIRROR_SECRET?.trim();
  if (!secret) return; // mirror disabled when no shared secret
  fetch(`http://${host}:${port}/mirror`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-mirror-secret': secret },
    body: payload,
  }).catch(() => {
    /* best-effort: terminal server may not be running */
  });
}

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

/**
 * Build argv that relies on the user's ~/.ssh/config (ControlMaster already
 * established by the user, typically for Duo). We deliberately pass no `-S`
 * / `-M` / `-o` flags so OpenSSH reads the user's config and reuses whatever
 * multiplex socket is there. This is the path that actually works on Betty
 * because Duo has already been approved in a real TTY.
 */
export function buildUserConfigClientArgs(host: string, remoteCommand: string): string[] {
  // Wrap in a remote login shell so ~/.bash_profile is sourced (module init
  // puts slurm, parcc_* helpers, etc. on PATH). Base64-encode the command so
  // we don't have to reason about quoting in the user's command string.
  const b64 = Buffer.from(remoteCommand, 'utf8').toString('base64');
  const wrapped = `bash -l -c "$(echo ${b64} | base64 -d)"`;
  return ['-o', 'BatchMode=yes', host, wrapped];
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
/**
 * Detect common ssh/krb auth failures and append an actionable hint to the
 * stderr so the agent surfaces a useful message instead of a bare
 * "Permission denied". Matches Duo/Kerberos patterns on Betty specifically.
 */
export function annotateAuthError(result: RemoteResult): RemoteResult {
  if (result.exit === 0) return result;
  const s = result.stderr;
  let hint: string | undefined;
  if (/No credentials cache|Credentials cache|No Kerberos credentials|gss_acquire_cred|ticket expired/i.test(s)) {
    hint = 'Kerberos ticket missing or expired — run `kinit jvadala@UPENN.EDU` in a local terminal.';
  } else if (/Permission denied \(publickey,gssapi-with-mic\)/.test(s)) {
    hint = 'SSH rejected GSSAPI auth — run `kinit jvadala@UPENN.EDU`, then check for a valid ticket with `klist`.';
  } else if (/Permission denied \(publickey,keyboard-interactive\)/.test(s)) {
    hint = 'Betty requires Duo on this auth path. Open a normal terminal, run `ssh login.betty.parcc.upenn.edu`, approve Duo, then retry. Your ControlMaster socket will be reused for the next 8h.';
  } else if (/Control socket connect.*No such file/i.test(s) || /mux_client_.* failed/.test(s)) {
    hint = 'SSH ControlMaster socket is stale. Run `ssh login.betty.parcc.upenn.edu` in a terminal to reopen it.';
  }
  if (!hint) return result;
  return { ...result, stderr: `${s}\n[betty-hint] ${hint}` };
}

const OUTPUT_SENTINEL = '__BETTY_OUTPUT_START__';

/**
 * Run a command and return ONLY the output produced by the command itself,
 * stripping Betty's login-shell banner (storage quotas, module reloads, etc.).
 * Use this for machine-parseable commands (squeue, parcc_sreport, etc.) where
 * the banner would corrupt the parser. The sentinel is printed immediately
 * before the real command so anything before it is banner noise.
 *
 * These calls are typically background polls (jobs widget, cost meter) and
 * should NOT mirror to the visible terminal — otherwise the user sees
 * constant scrolling noise. We bypass mirrorToTerminal here.
 */
export async function runRemoteParseable(command: string): Promise<RemoteResult> {
  const wrapped = `printf '%s\\n' '${OUTPUT_SENTINEL}'; ${command}`;
  const host = getHost();
  const child = spawnImpl('ssh', buildUserConfigClientArgs(host, wrapped), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const raw = annotateAuthError(await collectOutput(child));
  const idx = raw.stdout.indexOf(OUTPUT_SENTINEL);
  if (idx === -1) return raw;
  const after = raw.stdout.slice(idx + OUTPUT_SENTINEL.length).replace(/^\r?\n/, '');
  return { ...raw, stdout: after };
}

export async function runRemote(command: string): Promise<RemoteResult> {
  const attempt = async (): Promise<RemoteResult> => {
    // Prefer the user's ~/.ssh/config ControlMaster (Duo-authenticated in a
    // real TTY). Fall back to our own internal master only if the user hasn't
    // set one up.
    const host = getHost();
    const child = spawnImpl('ssh', buildUserConfigClientArgs(host, command), {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const raw = await collectOutput(child);
    const result = annotateAuthError(raw);
    mirrorToTerminal(command, result);
    return result;
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
    const host = getHost();
    const remoteCmd = `cat > '${remotePath}'`;
    const child = spawnImpl('ssh', buildUserConfigClientArgs(host, remoteCmd), {
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
