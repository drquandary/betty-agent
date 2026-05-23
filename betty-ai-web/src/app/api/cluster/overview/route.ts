/**
 * GET /api/cluster/overview — partition-level snapshot of Betty.
 *
 * Runs `parcc_sfree.py --json` over the shared ControlMaster socket — PARCC's
 * authoritative free-resource tool — so the dashboard's "available" numbers
 * match what users see from the CLI (including correct MIG-slice counts and a
 * separate DOWN breakdown). The dashboard's cluster card polls this every 30s.
 *
 * Read-only. Returns ok:false with an error string (and empty partitions
 * array) when SSH is unavailable so the UI can render a stale-data hint
 * without crashing.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { parseSfree } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await runRemoteParseable('parcc_sfree.py --json');
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `parcc_sfree.py exit ${res.exit}`,
          partitions: [],
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, partitions: parseSfree(res.stdout) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, partitions: [] }, { status: 200 });
  }
}
