import { NextResponse } from 'next/server';
import { runRemoteParseable } from '@/agent/cluster/ssh';
import { getValidatedSshUser } from '../_shared/user';
import { parseSprio } from './parse';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SPRIO_COLS = ['%i', '%a', '%Y', '%A', '%F', '%J', '%P', '%Q', '%T', '%c', '%r'];
const SPRIO_FORMAT = SPRIO_COLS.join('|');

export async function GET() {
  const validated = getValidatedSshUser();
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error, jobs: [] },
      { status: 200 },
    );
  }
  const { user } = validated;
  try {
    const res = await runRemoteParseable(
      `sprio -hl -u ${user} -o "${SPRIO_FORMAT}"`,
    );
    if (res.exit !== 0) {
      return NextResponse.json(
        {
          ok: false,
          error: res.stderr.trim().slice(0, 400) || `sprio exit ${res.exit}`,
          jobs: [],
        },
        { status: 200 },
      );
    }
    return NextResponse.json({ ok: true, jobs: parseSprio(res.stdout) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message, jobs: [] }, { status: 200 });
  }
}
