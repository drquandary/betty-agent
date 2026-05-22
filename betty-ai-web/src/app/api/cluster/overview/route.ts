/**
 * GET /api/cluster/overview — partition-level snapshot of Betty.
 *
 * Runs a per-node `sinfo -h -N -O "..."` over the shared ControlMaster socket
 * and aggregates per partition: idle/total nodes, free/total GPUs (computed
 * from GresUsed so MIG slices count correctly), allocated/idle CPUs. The
 * dashboard's cluster card polls this every 30s.
 *
 * Cheap (<200ms typical) and read-only. Returns ok:false with an error string
 * (and empty partitions array) when SSH is unavailable so the UI can render a
 * stale-data hint without crashing.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { parseSinfoOverview } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await runRemoteParseable(
      'sinfo -h -N -O "Partition:25,StateLong:15,CPUsState:20,Gres:35,GresUsed:35"',
    );
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `sinfo exit ${res.exit}`,
          partitions: [],
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, partitions: parseSinfoOverview(res.stdout) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, partitions: [] }, { status: 200 });
  }
}
