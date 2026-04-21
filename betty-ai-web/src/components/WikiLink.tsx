'use client';

import { useState, type ReactNode } from 'react';

const WIKI_SCHEME = 'betty-wiki://';

interface WikiPageResponse {
  ok: boolean;
  path?: string;
  content?: string;
  error?: string;
}

const cache = new Map<string, WikiPageResponse>();

async function fetchPage(slug: string): Promise<WikiPageResponse> {
  const hit = cache.get(slug);
  if (hit) return hit;
  const categories = ['entities', 'concepts', 'models', 'workflows', 'experiments', 'sources'];
  for (const cat of categories) {
    try {
      const res = await fetch(`/api/wiki/page?path=${encodeURIComponent(`${cat}/${slug}`)}`);
      const body = (await res.json()) as WikiPageResponse;
      if (body.ok) {
        cache.set(slug, body);
        return body;
      }
    } catch {
      /* keep trying */
    }
  }
  const miss: WikiPageResponse = { ok: false, error: 'not found' };
  cache.set(slug, miss);
  return miss;
}

function firstLines(markdown: string, n: number): string {
  const withoutFrontmatter = markdown.replace(/^---[\s\S]*?---\s*/m, '');
  return withoutFrontmatter.split('\n').slice(0, n).join('\n').trim();
}

/**
 * Transforms text like "Betty uses [[slurm]] for scheduling" into a markdown
 * link with a custom scheme (betty-wiki://slurm) so react-markdown renders it
 * as an <a>. The `WikiLinkAnchor` below intercepts those anchors and adds a
 * hover card.
 */
export function transformWikiLinks(input: string): string {
  return input.replace(/\[\[([a-z0-9][a-z0-9-]{0,80})\]\]/gi, (_, slug: string) => {
    const normalized = slug.toLowerCase();
    return `[${slug}](${WIKI_SCHEME}${normalized})`;
  });
}

export function isWikiHref(href: string | undefined): boolean {
  return !!href && href.startsWith(WIKI_SCHEME);
}

export function WikiLinkAnchor({ href, children }: { href: string; children: ReactNode }) {
  const slug = href.replace(WIKI_SCHEME, '');
  const [page, setPage] = useState<WikiPageResponse | null>(null);
  const [hovered, setHovered] = useState(false);

  const onEnter = async () => {
    setHovered(true);
    if (!page) setPage(await fetchPage(slug));
  };

  return (
    <span
      className="relative inline-block"
      onMouseEnter={onEnter}
      onMouseLeave={() => setHovered(false)}
    >
      <a
        href={`#wiki/${slug}`}
        onClick={(e) => e.preventDefault()}
        className="rounded bg-indigo-900/40 px-1 text-indigo-200 decoration-indigo-400 decoration-dotted underline-offset-2 hover:underline"
      >
        {children}
      </a>
      {hovered && page && (
        <span className="absolute left-0 top-full z-50 mt-1 block w-[28rem] max-w-[80vw] rounded-md border border-slate-800 bg-slate-950 p-3 text-xs font-normal text-slate-200 shadow-2xl">
          {page.ok ? (
            <>
              <span className="mb-1 block font-mono text-[10px] text-slate-500">
                wiki/{page.path}
              </span>
              <span className="block whitespace-pre-wrap text-slate-300">
                {firstLines(page.content ?? '', 10)}
              </span>
            </>
          ) : (
            <span className="block text-red-300">
              [[{slug}]] — page not found in wiki
            </span>
          )}
        </span>
      )}
    </span>
  );
}
