/**
 * GET /api/status/connection — surface Kerberos + SSH ControlMaster health
 * to the UI so the user sees stale state *before* the agent's next tool call
 * fails. Cheap: runs `klist -s` and `ssh -O check <host>`, both local, both
 * non-interactive, each with a short timeout.
 */

import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_HOST = 'jvadala@login.betty.parcc.upenn.edu';

function runOnce(cmd: string, args: string[], timeoutMs: number): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr?.on('data', (c) => (stderr += c.toString('utf8')));
    const t = setTimeout(() => child.kill('SIGTERM'), timeoutMs);
    child.once('close', (code) => {
      clearTimeout(t);
      resolve({ code: code ?? -1, stderr });
    });
    child.once('error', () => {
      clearTimeout(t);
      resolve({ code: -1, stderr });
    });
  });
}

async function kerberosExpiry(): Promise<string | undefined> {
  // `klist` default output includes an "Expires" column; we grep the krbtgt
  // line. Best-effort — if format differs on a future macOS release, we just
  // omit the timestamp; the ok/not-ok signal comes from `klist -s`.
  return new Promise((resolve) => {
    const child = spawn('klist', [], { stdio: ['ignore', 'pipe', 'ignore'] });
    let stdout = '';
    child.stdout?.on('data', (c) => (stdout += c.toString('utf8')));
    const t = setTimeout(() => child.kill('SIGTERM'), 2000);
    child.once('close', () => {
      clearTimeout(t);
      const line = stdout.split('\n').find((l) => l.includes('krbtgt'));
      const match = line?.match(/\s(\w{3}\s+\d+\s+[\d:]+\s+\d{4})\s+krbtgt/);
      resolve(match?.[1]);
    });
    child.once('error', () => {
      clearTimeout(t);
      resolve(undefined);
    });
  });
}

export async function GET() {
  const host = process.env.BETTY_SSH_HOST ?? DEFAULT_HOST;

  // Under OOD (BETTY_CLUSTER_MODE=local), the app IS on the compute
  // node. There's no ControlMaster to check; Kerberos was established
  // by pam_slurm_adopt when the Slurm job started, and runs natively.
  // Running `ssh -O check` here would always return "not running" and
  // make the header badge show a misleading red.
  if (process.env.BETTY_CLUSTER_MODE === 'local') {
    const [kerberos, expiresAt] = await Promise.all([
      runOnce('klist', ['-s'], 2000),
      kerberosExpiry(),
    ]);
    return NextResponse.json({
      kerberos: { ok: kerberos.code === 0, expiresAt },
      controlmaster: {
        ok: true,
        detail: 'N/A — running on compute node (BETTY_CLUSTER_MODE=local)',
      },
      host: 'local',
      mode: 'local',
    });
  }

  const [kerberos, controlmaster, expiresAt] = await Promise.all([
    runOnce('klist', ['-s'], 2000),
    runOnce('ssh', ['-O', 'check', host], 3000),
    kerberosExpiry(),
  ]);
  return NextResponse.json({
    kerberos: {
      ok: kerberos.code === 0,
      expiresAt,
    },
    controlmaster: {
      ok: controlmaster.code === 0,
      // `ssh -O check` prints "Master running (pid=NNNN)" on stderr; we keep
      // the raw message for debugging but clients only need `ok`.
      detail: controlmaster.stderr.trim().slice(0, 200),
    },
    host,
    mode: 'ssh',
  });
}
