/**
 * GET /api/cluster/cost — allocation usage from parcc_sreport.py.
 *
 * Parses rows like:
 *   jcombar1-betty-testing                     PC 61.06        PC 12,000.00     0.5%
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface AccountUsage {
  account: string;
  spentPc: number;
  allocatedPc: number;
  usedPct: number;
}

const ROW_RE = /^(\S+)\s+PC\s+([\d,]+\.\d+)\s+PC\s+([\d,]+\.\d+)\s+([\d.]+)%/;

export function parseSreport(stdout: string): AccountUsage[] {
  const rows: AccountUsage[] = [];
  for (const line of stdout.split('\n')) {
    const m = ROW_RE.exec(line.trim());
    if (!m) continue;
    rows.push({
      account: m[1],
      spentPc: Number(m[2].replace(/,/g, '')),
      allocatedPc: Number(m[3].replace(/,/g, '')),
      usedPct: Number(m[4]),
    });
  }
  return rows;
}

export async function GET() {
  const user = process.env.BETTY_SSH_USER || 'jvadala';
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
