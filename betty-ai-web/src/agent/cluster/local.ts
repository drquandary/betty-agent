/**
 * LocalTransport — runs cluster commands directly via `child_process.spawn`
 * instead of through SSH. Used when Betty AI is itself running on a Betty
 * compute node (e.g. under the OOD Batch Connect app) — pam_slurm_adopt
 * already placed us in the user's Slurm allocation, and Kerberos creds
 * are forwarded, so `squeue` / `sbatch` / etc. just work.
 *
 * Toggled via `BETTY_CLUSTER_MODE=local`. The SSH transport (`ssh.ts`) is
 * the default; its public `runRemote` / `runRemoteParseable` / `uploadFile`
 * entry points dispatch into this module when the env flag is set, so
 * callers never need to know which transport is live.
 *
 * Contract match: same `RemoteResult` shape, same retry semantics, same
 * `annotateAuthError` handling. The test harness overrides `spawn` via
 * `__setSpawnForTests` the same way it does for SSH.
 */
import type { ChildProcess, SpawnOptions } from 'node:child_process';
import { spawn as nodeSpawn } from 'node:child_process';

import type { RemoteResult } from './ssh';

// Duplicate injection hook so tests for local.ts don't need to touch ssh.ts.
type SpawnFn = (
  command: string,
  args: readonly string[],
  options?: SpawnOptions,
) => ChildProcess;

let spawnImpl: SpawnFn = nodeSpawn as SpawnFn;
export function __setLocalSpawnForTests(fn: SpawnFn): void {
  spawnImpl = fn;
}
export function __resetLocalForTests(): void {
  spawnImpl = nodeSpawn as SpawnFn;
}

/**
 * Build argv for a shell-wrapped command.
 *
 * We run the command through `bash -l -c` so the user's login profile
 * is sourced (Lmod / PARCC paths / module-loaded Slurm binaries land on
 * PATH). This mirrors the SSH transport's `buildUserConfigClientArgs`
 * wrapping, so a given command string behaves the same way whether it
 * transports via SSH or executes locally.
 *
 * Unlike the SSH path we don't base64-wrap — there's no untrusted shell
 * hop. The command goes directly as an argv string to `bash -l -c`.
 */
export function buildLocalArgs(remoteCommand: string): string[] {
  return ['-l', '-c', remoteCommand];
}

function collectOutput(
  child: ChildProcess,
  stdinPayload?: string | Buffer,
): Promise<RemoteResult> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', (c) => (stdout += c.toString('utf8')));
    child.stderr?.on('data', (c) => (stderr += c.toString('utf8')));
    child.once('error', reject);
    child.once('close', (code) => resolve({ stdout, stderr, exit: code ?? -1 }));
    if (stdinPayload !== undefined && child.stdin) {
      child.stdin.end(stdinPayload);
    }
  });
}

// Shared annotation — delegates to the SSH module so hint strings stay
// in one place. A stderr like "No credentials cache" still matters locally
// (e.g. Kerberos ticket expired on the compute node).
import { annotateAuthError } from './ssh';

const OUTPUT_SENTINEL = '__BETTY_OUTPUT_START__';

/**
 * Direct-exec run — no SSH, no ControlMaster, no retry. If the command
 * fails, the caller gets the non-zero exit back and decides.
 */
export async function runLocal(command: string): Promise<RemoteResult> {
  const child = spawnImpl('bash', buildLocalArgs(command), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return annotateAuthError(await collectOutput(child));
}

/**
 * Same as runLocal but strips the login-shell banner, matching the
 * `runRemoteParseable` semantics used by /api/cluster/* routes.
 */
export async function runLocalParseable(command: string): Promise<RemoteResult> {
  const wrapped = `printf '%s\\n' '${OUTPUT_SENTINEL}'; ${command}`;
  const child = spawnImpl('bash', buildLocalArgs(wrapped), {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const raw = annotateAuthError(await collectOutput(child));
  const idx = raw.stdout.indexOf(OUTPUT_SENTINEL);
  if (idx === -1) return raw;
  const after = raw.stdout.slice(idx + OUTPUT_SENTINEL.length).replace(/^\r?\n/, '');
  return { ...raw, stdout: after };
}

/**
 * Writes `content` to `remotePath` on the local filesystem. Keeps the
 * same path-safety checks as the SSH uploader (no single quotes, no
 * newlines, no NULs) so the two transports reject the same inputs.
 */
export async function uploadLocal(
  content: string | Buffer,
  remotePath: string,
): Promise<void> {
  if (remotePath.includes("'")) {
    throw new Error(`uploadFile: refusing remote path containing a single quote: ${remotePath}`);
  }
  if (remotePath.includes('\n') || remotePath.includes('\0')) {
    throw new Error(`uploadFile: refusing remote path with newline/NUL`);
  }
  const child = spawnImpl('bash', buildLocalArgs(`cat > '${remotePath}'`), {
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  const result = await collectOutput(child, content);
  if (result.exit !== 0) {
    throw new Error(
      `uploadLocal: cat exited ${result.exit}: ${result.stderr.trim() || '(no stderr)'}`,
    );
  }
}
