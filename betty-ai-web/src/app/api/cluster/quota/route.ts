/**
 * GET /api/cluster/quota — storage quota usage parsed from `parcc_quota.py`.
 *
 * The helper prints a small table the user already sees on login. We pass it
 * through verbatim (so the UI can render the raw text as a tooltip) and
 * best-effort parse rows of the shape
 *
 *   <filesystem>  <used>  <quota>  <percent>%
 *
 * Resilient to format drift: rows we can't parse are dropped, never raise.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { parseParccQuota } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await runRemoteParseable('parcc_quota.py');
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `parcc_quota exit ${res.exit}`,
          rows: [],
          raw: res.stdout,
        },
        { status: 200 },
      );
    }
    return NextResponse.json({
      ok: true,
      rows: parseParccQuota(res.stdout),
      raw: res.stdout,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, rows: [], raw: '' }, { status: 200 });
  }
}
