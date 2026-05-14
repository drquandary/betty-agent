/**
 * GET /api/cluster/jobs — the user's live Slurm queue.
 *
 * Calls `squeue -u jvadala -h -o "%i|%P|%j|%T|%M|%L|%R"` over the shared
 * ControlMaster socket. Cheap enough to poll every 15s from the sidebar.
 *
 * These routes assume single-tenant localhost deployment; no per-request auth
 * check. Bind to 127.0.0.1 if exposing publicly.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { getValidatedSshUser } from '../_shared/user';
import { parseSqueue } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Validate BETTY_SSH_USER against a strict whitelist before it lands in a
  // shell command — otherwise a malformed env value could inject metachars.
  const validated = getValidatedSshUser();
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error, jobs: [] }, { status: 200 });
  }
  const { user } = validated;
  try {
    const res = await runRemoteParseable(`squeue -u ${user} -h -o "%i|%P|%j|%T|%M|%L|%R"`);
    if (res.exit !== 0) {
      return NextResponse.json(
        { ok: false, error: res.stderr.trim() || 'squeue failed', jobs: [] },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, jobs: parseSqueue(res.stdout) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, jobs: [] }, { status: 200 });
  }
}
