/**
 * GET /api/cluster/cost — allocation usage from parcc_sreport.py.
 *
 * These routes assume single-tenant localhost deployment; no per-request auth
 * check. Bind to 127.0.0.1 if exposing publicly.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { getValidatedSshUser } from '../_shared/user';
import { parseSreport } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  // Validate BETTY_SSH_USER against a strict whitelist before it lands in a
  // shell command — otherwise a malformed env value could inject metachars.
  const validated = getValidatedSshUser();
  if (!validated.ok) {
    return NextResponse.json({ ok: false, error: validated.error, accounts: [] }, { status: 200 });
  }
  const { user } = validated;
  try {
    const res = await runRemoteParseable(`parcc_sreport.py --user ${user}`);
    if (res.exit !== 0) {
      return NextResponse.json(
        { ok: false, error: res.stderr.trim() || 'parcc_sreport failed', accounts: [] },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, accounts: parseSreport(res.stdout) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, accounts: [] }, { status: 200 });
  }
}
