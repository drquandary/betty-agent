/**
 * GET /api/cluster/sacct-summary - per-hour completion-rate buckets for the
 * monitoring tab's "your last 24h" sparkline.
 *
 * Runs sacct -P -X -S now-Nhours -E now -u <user> over the shared
 * ControlMaster socket. The ?hours query parameter defaults to 24 and is
 * clamped to [1, 168]. Out-of-range or non-numeric values are rejected with
 * ok:false (status 200) for symmetry with the other monitoring routes.
 *
 * On every successful parse we append per-hour-bucket counts to the
 * ringbuffer so the dashboard's series view has a longer history than any
 * single sacct query. Empty buckets are skipped.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { getValidatedSshUser } from '../_shared/user';
import { safeAppend } from '../_shared/metrics';
import { parseSacctSummary, type SacctSummary } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MIN_HOURS = 1;
const MAX_HOURS = 168;
const DEFAULT_HOURS = 24;

function resolveHours(raw: string | null): { ok: true; hours: number } | { ok: false; error: string } {
  if (raw == null || raw === '') return { ok: true, hours: DEFAULT_HOURS };
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || String(n) !== raw.trim()) {
    return { ok: false, error: 'hours must be an integer' };
  }
  if (n < MIN_HOURS || n > MAX_HOURS) {
    return { ok: false, error: `hours must be between ${MIN_HOURS} and ${MAX_HOURS}` };
  }
  return { ok: true, hours: n };
}

function emitMetrics(summary: SacctSummary): void {
  const points: Array<{ ts: number; series: string; value: number }> = [];
  for (const b of summary.buckets) {
    // ISO-8601 "YYYY-MM-DDTHH:00:00" - Date.parse interprets as UTC when no
    // offset is given, which is fine for ordering even if the sparkline
    // labels later add the user's timezone.
    const ts = Date.parse(b.hour + 'Z');
    if (!Number.isFinite(ts)) continue;
    if (b.completed > 0) points.push({ ts, series: 'slurm.jobs.completed', value: b.completed });
    if (b.failed > 0) points.push({ ts, series: 'slurm.jobs.failed', value: b.failed });
    if (b.timeout > 0) points.push({ ts, series: 'slurm.jobs.timeout', value: b.timeout });
    if (b.cancelled > 0) points.push({ ts, series: 'slurm.jobs.cancelled', value: b.cancelled });
    if (b.other > 0) points.push({ ts, series: 'slurm.jobs.other', value: b.other });
  }
  safeAppend(points);
}

export async function GET(req: NextRequest) {
  const validated = getValidatedSshUser();
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error, hours: DEFAULT_HOURS, data: null },
      { status: 200 },
    );
  }
  const hoursParam = req.nextUrl.searchParams.get('hours');
  const resolved = resolveHours(hoursParam);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, error: resolved.error, hours: DEFAULT_HOURS, data: null },
      { status: 200 },
    );
  }
  const { hours } = resolved;
  const { user } = validated;
  try {
    const cmd = `sacct -P -X -S now-${hours}hours -E now -u ${user} -o "JobID|State|End|Elapsed|Partition|ReqTRES"`;
    const res = await runRemoteParseable(cmd);
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `sacct exit ${res.exit}`,
          hours,
          data: null,
        },
        { status: 200 },
      );
    }
    const summary = parseSacctSummary(res.stdout);
    emitMetrics(summary);
    return NextResponse.json({ ok: true, hours, data: summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, hours, data: null }, { status: 200 });
  }
}
