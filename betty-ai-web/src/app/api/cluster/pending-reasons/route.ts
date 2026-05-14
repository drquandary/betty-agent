/**
 * GET /api/cluster/pending-reasons - cluster-wide pending-reason breakdown.
 *
 * Runs squeue with -t PD and the format string from the Wave 1A parser
 * contract. The %u column is intentionally included because the parser uses
 * it for an internal privacy assertion - it is dropped before the parser
 * returns, and the response never contains any per-user identifiers. We
 * re-assert that boundary in the route test.
 *
 * Emits ringbuffer metrics: slurm.pending.total plus slurm.pending.reason.X
 * (sanitized) for each reason in byReason.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { safeAppend, sanitizeSeriesPart } from '../_shared/metrics';
import { parsePendingReasons, type PendingReasonsSummary } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SQUEUE_COLS = ['%r', '%P', '%u'];
const SQUEUE_FORMAT = SQUEUE_COLS.join('|');

function emitMetrics(summary: PendingReasonsSummary): void {
  const ts = Date.now();
  const points: Array<{ ts: number; series: string; value: number }> = [];
  points.push({ ts, series: 'slurm.pending.total', value: summary.total });
  for (const r of summary.byReason) {
    const sanitized = sanitizeSeriesPart(r.reason, 32);
    points.push({ ts, series: `slurm.pending.reason.${sanitized}`, value: r.count });
  }
  safeAppend(points);
}

export async function GET() {
  try {
    const res = await runRemoteParseable(`squeue -h -t PD -o "${SQUEUE_FORMAT}"`);
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `squeue exit ${res.exit}`,
          data: null,
        },
        { status: 200 },
      );
    }
    const summary = parsePendingReasons(res.stdout);
    emitMetrics(summary);
    return NextResponse.json({ ok: true, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, data: null }, { status: 200 });
  }
}
