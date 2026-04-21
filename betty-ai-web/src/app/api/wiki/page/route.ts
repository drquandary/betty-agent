/**
 * GET /api/wiki/page?path=entities/foo  → raw markdown for that wiki page.
 * Path is taken relative to the wiki root. Traversal is blocked.
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { paths } from '@/agent/knowledge/loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get('path') ?? '';
  if (!rel || rel.includes('..') || rel.startsWith('/')) {
    return NextResponse.json({ ok: false, error: 'invalid path' }, { status: 400 });
  }
  // Accept "entities/foo" or "entities/foo.md"
  const withExt = rel.endsWith('.md') ? rel : `${rel}.md`;
  const abs = normalize(join(paths.wiki, withExt));
  if (!abs.startsWith(paths.wiki)) {
    return NextResponse.json({ ok: false, error: 'path traversal' }, { status: 400 });
  }
  try {
    const content = await readFile(abs, 'utf8');
    return NextResponse.json({ ok: true, path: withExt, content });
  } catch {
    return NextResponse.json({ ok: false, error: 'not found', path: withExt }, { status: 404 });
  }
}
