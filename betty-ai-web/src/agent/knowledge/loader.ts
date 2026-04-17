/**
 * Knowledge loader — reads wiki index + log tail at startup so the system
 * prompt includes live pointers into the knowledge base without bloating context.
 *
 * Everything here runs server-side (Node.js runtime) and is cached after first load.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const PROJECT_ROOT = resolve(process.cwd(), '..');
const WIKI_PATH = process.env.WIKI_PATH
  ? resolve(process.env.WIKI_PATH)
  : join(PROJECT_ROOT, 'wiki');
const BETTY_AI_PATH = process.env.BETTY_AI_PATH
  ? resolve(process.env.BETTY_AI_PATH)
  : join(PROJECT_ROOT, 'betty-ai');

export const paths = {
  projectRoot: PROJECT_ROOT,
  wiki: WIKI_PATH,
  bettyAi: BETTY_AI_PATH,
  schema: join(WIKI_PATH, 'SCHEMA.md'),
  index: join(WIKI_PATH, 'index.md'),
  log: join(WIKI_PATH, 'log.md'),
} as const;

interface Snapshot {
  indexBody: string;
  logTail: string;
  pageList: string[];
}

// Short TTL so active wiki edits become visible without restarting the server.
const CACHE_TTL_MS = 60_000;
let cached: { snapshot: Snapshot; expiresAt: number } | null = null;

/** Clear the in-memory cache (useful for tests or explicit invalidation). */
export function invalidateKnowledgeCache(): void {
  cached = null;
}

/**
 * Read the wiki index.md + last ~40 log lines + a flat page listing.
 * These go into the system prompt so the agent knows what knowledge exists.
 * Cached for 60s so the system prompt doesn't re-read files on every request.
 */
export async function loadKnowledgeSnapshot(): Promise<Snapshot> {
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;

  const [indexBody, logBody, pageList] = await Promise.all([
    readFileSafe(paths.index, '(wiki/index.md missing)'),
    readFileSafe(paths.log, '(wiki/log.md missing)'),
    listWikiPages(),
  ]);

  // Keep just the last ~40 lines of the log for continuity
  const logLines = logBody.split('\n');
  const logTail = logLines.slice(-40).join('\n');

  const snapshot: Snapshot = { indexBody, logTail, pageList };
  cached = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS };
  return snapshot;
}

async function readFileSafe(path: string, fallback: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return fallback;
  }
}

async function listWikiPages(): Promise<string[]> {
  const categories = ['entities', 'concepts', 'models', 'sources', 'workflows', 'experiments'];
  const results: string[] = [];
  for (const cat of categories) {
    try {
      const entries = await readdir(join(WIKI_PATH, cat));
      for (const e of entries) {
        if (e.endsWith('.md')) results.push(`${cat}/${e}`);
      }
    } catch {
      // Category directory doesn't exist yet — skip
    }
  }
  return results.sort();
}
