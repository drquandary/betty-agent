/**
 * GET /api/wiki/lint — cheap structural checks over the wiki.
 *
 * Finds:
 *   - orphans: pages with no inbound `[[page-name]]` link from any other page
 *   - brokenLinks: `[[page-name]]` that doesn't resolve to a page
 *   - stale: pages with frontmatter `updated:` older than 90 days
 */

import { NextResponse } from 'next/server';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { paths } from '@/agent/knowledge/loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CATEGORIES = ['entities', 'concepts', 'models', 'sources', 'workflows', 'experiments'];
const WIKI_LINK_RE = /\[\[([a-z0-9][a-z0-9-]{0,80})\]\]/gi;
const STALE_DAYS = 90;

interface LintResult {
  orphans: string[];
  brokenLinks: Array<{ from: string; target: string }>;
  stale: Array<{ page: string; updated: string }>;
  totals: { pages: number; links: number };
}

export async function GET() {
  const pages: Array<{ path: string; slug: string; content: string }> = [];
  for (const cat of CATEGORIES) {
    try {
      const entries = await readdir(join(paths.wiki, cat));
      for (const e of entries) {
        if (!e.endsWith('.md')) continue;
        const rel = `${cat}/${e}`;
        const content = await readFile(join(paths.wiki, rel), 'utf8');
        pages.push({ path: rel, slug: e.replace(/\.md$/, '').toLowerCase(), content });
      }
    } catch {
      /* skip missing categories */
    }
  }

  const slugToPath = new Map(pages.map((p) => [p.slug, p.path] as const));
  const inbound = new Map<string, Set<string>>();
  const broken: Array<{ from: string; target: string }> = [];
  let linkCount = 0;

  for (const p of pages) {
    const matches = p.content.match(WIKI_LINK_RE) ?? [];
    for (const raw of matches) {
      linkCount++;
      const target = raw.slice(2, -2).toLowerCase();
      if (slugToPath.has(target)) {
        if (!inbound.has(target)) inbound.set(target, new Set());
        inbound.get(target)!.add(p.path);
      } else {
        broken.push({ from: p.path, target });
      }
    }
  }

  const orphans = pages
    .filter((p) => !inbound.has(p.slug))
    .map((p) => p.path)
    .sort();

  const stale: Array<{ page: string; updated: string }> = [];
  const cutoff = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;
  for (const p of pages) {
    const m = /^updated:\s*([\d-]+(?:T[\d:.]+Z?)?)/m.exec(p.content);
    if (!m) continue;
    const t = Date.parse(m[1]);
    if (Number.isFinite(t) && t < cutoff) {
      stale.push({ page: p.path, updated: m[1] });
    }
  }

  const result: LintResult = {
    orphans,
    brokenLinks: broken.sort((a, b) => a.from.localeCompare(b.from)),
    stale: stale.sort((a, b) => a.updated.localeCompare(b.updated)),
    totals: { pages: pages.length, links: linkCount },
  };
  return NextResponse.json({ ok: true, ...result });
}
