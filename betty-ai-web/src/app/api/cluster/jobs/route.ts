/**
 * GET /api/cluster/jobs — the user's live Slurm queue.
 *
 * Calls `squeue -u jvadala -h -o "%i|%P|%j|%T|%M|%L|%R"` over the shared
 * ControlMaster socket. Cheap enough to poll every 15s from the sidebar.
 */

import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SqueueJob {
  jobId: string;
  partition: string;
  name: string;
  state: string;
  elapsed: string;
  timeLeft: string;
  reasonOrNode: string;
}

export function parseSqueue(stdout: string): SqueueJob[] {
  return stdout
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && l.includes('|'))
    .map((line) => {
      const [jobId = '', partition = '', name = '', state = '', elapsed = '', timeLeft = '', reasonOrNode = ''] =
        line.split('|');
      return { jobId, partition, name, state, elapsed, timeLeft, reasonOrNode };
    });
}

export async function GET() {
  const user = process.env.BETTY_SSH_USER || 'jvadala';
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
