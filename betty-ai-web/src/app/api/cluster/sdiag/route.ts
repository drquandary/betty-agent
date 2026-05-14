/**
 * GET /api/cluster/sdiag - Slurm scheduler diagnostics snapshot.
 *
 * Runs `sdiag` over the shared ControlMaster socket and returns the parsed
 * SdiagSnapshot for the monitoring tab. On every successful parse we ALSO
 * append the headline scheduler / backfill numbers to the local metrics-store
 * ringbuffer so the dashboard can render sparklines without re-polling the
 * cluster.
 *
 * Always returns 200 - on error we surface `{ok:false, error, data:null}`
 * so the UI can render a stale-data hint without crashing.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { safeAppend } from '../_shared/metrics';
import { parseSdiag, type SdiagSnapshot } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function emitMetrics(snap: SdiagSnapshot): void {
  const ts = Date.now();
  const candidates: Array<{ series: string; value: number | null }> = [
    { series: 'slurm.sched.last_cycle_ms', value: snap.scheduler.lastCycleMs },
    { series: 'slurm.sched.mean_cycle_ms', value: snap.scheduler.meanCycleMs },
    { series: 'slurm.backfill.last_cycle_ms', value: snap.backfill.lastCycleMs },
    { series: 'slurm.backfill.mean_cycle_ms', value: snap.backfill.meanCycleMs },
    { series: 'slurm.backfill.depth_tried', value: snap.backfill.lastDepthTried },
    { series: 'slurm.backfill.total_jobs', value: snap.backfill.totalBackfilledJobs },
  ];
  const points = candidates
    .filter((c): c is { series: string; value: number } => typeof c.value === 'number')
    .map((c) => ({ ts, series: c.series, value: c.value }));
  safeAppend(points);
}

export async function GET() {
  try {
    const res = await runRemoteParseable('sdiag');
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `sdiag exit ${res.exit}`,
          data: null,
        },
        { status: 200 },
      );
    }
    const snap = parseSdiag(res.stdout);
    emitMetrics(snap);
    return NextResponse.json({ ok: true, data: snap });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, data: null }, { status: 200 });
  }
}
