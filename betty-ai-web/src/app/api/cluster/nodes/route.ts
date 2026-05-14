/**
 * GET /api/cluster/nodes - per-node Slurm view for the monitoring tab.
 *
 * Runs sinfo with the Wave 1A node-format string and returns parsed NodeRow
 * entries. Emits per-partition + cluster-wide state counts to the ringbuffer
 * so the monitoring tab can render state-over-time sparklines.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { safeAppend, sanitizeSeriesPart } from '../_shared/metrics';
import { parseSinfoNodes, type NodeRow } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SINFO_COLS = ['%N', '%P', '%T', '%G', '%C', '%m', '%O', '%E'];
const SINFO_FORMAT = SINFO_COLS.join('|');

function emitMetrics(nodes: NodeRow[]): void {
  if (nodes.length === 0) return;
  const ts = Date.now();
  // Two rollups: per-partition and cluster-wide totals.
  const perPart = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  for (const n of nodes) {
    const part = sanitizeSeriesPart(n.partition, 32);
    let inner = perPart.get(part);
    if (!inner) {
      inner = new Map<string, number>();
      perPart.set(part, inner);
    }
    inner.set(n.state, (inner.get(n.state) ?? 0) + 1);
    totals.set(n.state, (totals.get(n.state) ?? 0) + 1);
  }
  const points: Array<{ ts: number; series: string; value: number }> = [];
  for (const [part, inner] of perPart) {
    for (const [state, count] of inner) {
      if (count <= 0) continue;
      points.push({
        ts,
        series: `slurm.nodes.${part}.${sanitizeSeriesPart(state, 16)}`,
        value: count,
      });
    }
  }
  for (const [state, count] of totals) {
    if (count <= 0) continue;
    points.push({
      ts,
      series: `slurm.nodes.total.${sanitizeSeriesPart(state, 16)}`,
      value: count,
    });
  }
  safeAppend(points);
}

export async function GET() {
  try {
    const res = await runRemoteParseable(`sinfo -h -N -o "${SINFO_FORMAT}"`);
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `sinfo exit ${res.exit}`,
          nodes: [],
        },
        { status: 200 },
      );
    }
    const nodes = parseSinfoNodes(res.stdout);
    emitMetrics(nodes);
    return NextResponse.json({ ok: true, nodes });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, nodes: [] }, { status: 200 });
  }
}
