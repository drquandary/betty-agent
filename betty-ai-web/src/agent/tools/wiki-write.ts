/**
 * wiki_write — safely write to the wiki/ tree.
 *
 * Modes:
 *   - 'create' — create a new file. Requires YAML frontmatter with name/description/type.
 *                Fails if file already exists.
 *   - 'update' — update an existing file. Preserves user-owned sections; content
 *                inside <!-- betty:auto-start --> / <!-- betty:auto-end --> markers
 *                is replaced wholesale by the provided body (if body contains markers).
 *                If the body does not contain markers, the entire file is rewritten.
 *   - 'append' — append to an existing file. Only permitted for `wiki/log.md`
 *                (per decision D4 — tier-0 auto-approve) and other allowlisted
 *                append-safe files.
 *
 * Path enforcement: resolves the requested page under `paths.wiki`, rejects `..`
 * traversal, absolute paths, and symlinks pointing outside the wiki.
 *
 * This module also exports `writeWikiPage()` for direct server-side use by
 * Track C (cluster-submit auto-logging).
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import {
  mkdir,
  readFile,
  realpath,
  stat,
  writeFile,
  appendFile,
} from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { z } from 'zod';
import { paths } from '../knowledge/loader';

export const AUTO_START_MARKER = '<!-- betty:auto-start -->';
export const AUTO_END_MARKER = '<!-- betty:auto-end -->';

/** Files where `append` mode is permitted. */
export const APPEND_ALLOWLIST: ReadonlySet<string> = new Set(['log.md']);

export type WikiWriteMode = 'create' | 'update' | 'append';

export interface WikiWriteResult {
  ok: boolean;
  path: string; // normalized wiki-relative path
  absolutePath?: string;
  message: string;
}

/** Result of the path-safety check. */
interface ResolvedPath {
  relative: string; // e.g. "experiments/2026-04-17-foo.md"
  absolute: string;
}

function resolveSafeWikiPath(page: string): ResolvedPath | { error: string } {
  if (typeof page !== 'string' || page.length === 0) {
    return { error: 'page must be a non-empty string' };
  }
  // Reject absolute paths early
  if (page.startsWith('/') || /^[A-Za-z]:[\\/]/.test(page)) {
    return { error: `Rejected: absolute path "${page}"` };
  }
  // Null bytes
  if (page.includes('\0')) {
    return { error: 'Rejected: null byte in path' };
  }

  const rel = page.endsWith('.md') ? page : `${page}.md`;
  const normalized = normalize(rel).replace(/\\/g, '/');
  const segments = normalized.split('/');
  if (segments.includes('..') || normalized.startsWith('/')) {
    return { error: `Rejected: path traversal in "${page}"` };
  }

  const absolute = join(paths.wiki, normalized);
  // Re-resolve and ensure containment under paths.wiki
  const wikiRoot = resolve(paths.wiki);
  const absResolved = resolve(absolute);
  if (absResolved !== wikiRoot && !absResolved.startsWith(wikiRoot + '/') && !absResolved.startsWith(wikiRoot + '\\')) {
    return { error: `Rejected: resolved path escapes wiki root` };
  }
  return { relative: normalized, absolute: absResolved };
}

/**
 * After a path exists, verify (via realpath) that it still lives under wiki/.
 * This catches symlinks that would escape the allowlisted tree.
 */
async function assertRealpathInsideWiki(absolute: string): Promise<string | null> {
  try {
    const real = await realpath(absolute);
    const wikiRealRoot = await realpath(paths.wiki);
    if (real !== wikiRealRoot && !real.startsWith(wikiRealRoot + '/') && !real.startsWith(wikiRealRoot + '\\')) {
      return `Rejected: symlinked path escapes wiki root`;
    }
    // Also check the parent directory for create mode (target file might not exist yet)
    return null;
  } catch {
    // realpath fails if the file doesn't exist — caller handles create vs. update.
    return null;
  }
}

async function assertParentRealpathInsideWiki(absolute: string): Promise<string | null> {
  try {
    const parent = dirname(absolute);
    const real = await realpath(parent);
    const wikiRealRoot = await realpath(paths.wiki);
    if (real !== wikiRealRoot && !real.startsWith(wikiRealRoot + '/') && !real.startsWith(wikiRealRoot + '\\')) {
      return `Rejected: symlinked parent directory escapes wiki root`;
    }
    return null;
  } catch {
    // Parent may not exist yet — will be created.
    return null;
  }
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export interface ParsedFrontmatter {
  raw: string;
  fields: Record<string, string>;
  body: string; // body after the frontmatter
}

export function parseFrontmatter(source: string): ParsedFrontmatter | null {
  const m = FRONTMATTER_RE.exec(source);
  if (!m) return null;
  const raw = m[1];
  const fields: Record<string, string> = {};
  for (const line of raw.split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) fields[key] = value;
  }
  return { raw, fields, body: source.slice(m[0].length) };
}

const REQUIRED_FRONTMATTER_FIELDS = ['type'] as const;
// Name+description aren't in SCHEMA.md's strict YAML template (which uses
// `type`/`tags`/`created`/etc.) but the Track A brief lists them. We accept
// either `name` OR a top-level `# Heading` as the page title.
const REQUIRED_OR_FIELDS: ReadonlyArray<readonly string[]> = [
  ['name', 'title'], // frontmatter name OR title — heading also accepted (checked separately)
];

export interface FrontmatterValidationResult {
  ok: boolean;
  reason?: string;
}

export function validateCreateFrontmatter(source: string): FrontmatterValidationResult {
  const parsed = parseFrontmatter(source);
  if (!parsed) {
    return {
      ok: false,
      reason: 'create requires YAML frontmatter (--- ... ---) at the top of the file',
    };
  }
  for (const field of REQUIRED_FRONTMATTER_FIELDS) {
    if (!parsed.fields[field]) {
      return { ok: false, reason: `create requires frontmatter field "${field}"` };
    }
  }
  // Description — require either frontmatter `description` OR a non-empty body
  // after frontmatter (any markdown content counts).
  const hasDescription =
    !!parsed.fields['description'] || parsed.body.trim().length > 0;
  if (!hasDescription) {
    return {
      ok: false,
      reason: 'create requires a "description" frontmatter field or non-empty body',
    };
  }
  // name / title — require one of the alternatives OR a top-level heading.
  const hasNameLike = REQUIRED_OR_FIELDS.every((alts) =>
    alts.some((k) => !!parsed.fields[k]),
  );
  const hasHeading = /^#\s+\S/m.test(parsed.body);
  if (!hasNameLike && !hasHeading) {
    return {
      ok: false,
      reason:
        'create requires either a "name"/"title" frontmatter field or a top-level "# Heading" in the body',
    };
  }
  return { ok: true };
}

/**
 * Splice marker region.
 *
 * If `existing` contains `<!-- betty:auto-start -->` … `<!-- betty:auto-end -->`
 * markers AND `incoming` also contains markers, replace only the content
 * between the markers in `existing` with the content between markers in
 * `incoming`. This preserves user-owned sections.
 *
 * If `existing` has no markers, the full `incoming` body is returned.
 * If `existing` has markers but `incoming` does NOT, returns `incoming` as-is
 * (the agent is doing a full rewrite).
 */
export function spliceMarkerRegion(existing: string, incoming: string): string {
  const startIdx = existing.indexOf(AUTO_START_MARKER);
  const endIdx = existing.indexOf(AUTO_END_MARKER);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return incoming;
  }
  const inStart = incoming.indexOf(AUTO_START_MARKER);
  const inEnd = incoming.indexOf(AUTO_END_MARKER);
  if (inStart === -1 || inEnd === -1 || inEnd < inStart) {
    return incoming;
  }
  const incomingInner = incoming.slice(
    inStart + AUTO_START_MARKER.length,
    inEnd,
  );
  const before = existing.slice(0, startIdx + AUTO_START_MARKER.length);
  const after = existing.slice(endIdx);
  return before + incomingInner + after;
}

/**
 * Write to a wiki page. Exported for server-side use by Track C.
 */
export async function writeWikiPage(
  page: string,
  body: string,
  mode: WikiWriteMode,
): Promise<WikiWriteResult> {
  const resolved = resolveSafeWikiPath(page);
  if ('error' in resolved) {
    return { ok: false, path: page, message: resolved.error };
  }
  const { relative, absolute } = resolved;

  // Per-mode validation
  if (mode === 'create') {
    const v = validateCreateFrontmatter(body);
    if (!v.ok) {
      return { ok: false, path: relative, absolutePath: absolute, message: v.reason! };
    }
  }
  if (mode === 'append') {
    if (!APPEND_ALLOWLIST.has(relative)) {
      return {
        ok: false,
        path: relative,
        absolutePath: absolute,
        message: `append is only permitted for: ${Array.from(APPEND_ALLOWLIST).join(', ')}`,
      };
    }
  }

  // Check symlink containment for the file (update/append) or parent (create).
  const existsErr = await assertRealpathInsideWiki(absolute);
  if (existsErr) {
    return { ok: false, path: relative, absolutePath: absolute, message: existsErr };
  }
  const parentErr = await assertParentRealpathInsideWiki(absolute);
  if (parentErr) {
    return { ok: false, path: relative, absolutePath: absolute, message: parentErr };
  }

  // Determine if file exists
  let fileExists = false;
  try {
    const s = await stat(absolute);
    fileExists = s.isFile();
  } catch {
    fileExists = false;
  }

  try {
    if (mode === 'create') {
      if (fileExists) {
        return {
          ok: false,
          path: relative,
          absolutePath: absolute,
          message: `create failed: ${relative} already exists (use mode="update")`,
        };
      }
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, body, 'utf8');
      return {
        ok: true,
        path: relative,
        absolutePath: absolute,
        message: `Created wiki/${relative}`,
      };
    }
    if (mode === 'update') {
      if (!fileExists) {
        return {
          ok: false,
          path: relative,
          absolutePath: absolute,
          message: `update failed: ${relative} does not exist (use mode="create")`,
        };
      }
      const existing = await readFile(absolute, 'utf8');
      const next = spliceMarkerRegion(existing, body);
      await writeFile(absolute, next, 'utf8');
      return {
        ok: true,
        path: relative,
        absolutePath: absolute,
        message: `Updated wiki/${relative}`,
      };
    }
    // append
    if (!fileExists) {
      return {
        ok: false,
        path: relative,
        absolutePath: absolute,
        message: `append failed: ${relative} does not exist`,
      };
    }
    const toWrite = body.endsWith('\n') ? body : body + '\n';
    await appendFile(absolute, toWrite, 'utf8');
    return {
      ok: true,
      path: relative,
      absolutePath: absolute,
      message: `Appended to wiki/${relative}`,
    };
  } catch (err) {
    return {
      ok: false,
      path: relative,
      absolutePath: absolute,
      message: `Filesystem error: ${(err as Error).message}`,
    };
  }
}

export const wikiWriteTool = tool(
  'wiki_write',
  [
    'Write to a wiki page. Modes:',
    '  - "create": new page; requires YAML frontmatter with at least `type:` and a name/title.',
    '  - "update": modify an existing page; content between <!-- betty:auto-start --> and',
    '    <!-- betty:auto-end --> is the only region replaced if the existing file uses markers,',
    '    so user-owned sections are preserved.',
    '  - "append": append-only; permitted for wiki/log.md.',
    'Path must be relative to wiki/. Traversal is rejected.',
  ].join('\n'),
  {
    page: z
      .string()
      .min(1)
      .describe('Path relative to wiki/, e.g. "experiments/2026-04-17-foo.md". .md extension optional.'),
    body: z.string().describe('Full file body to write (create/update) or chunk to append.'),
    mode: z
      .enum(['create', 'update', 'append'])
      .describe('create | update | append'),
  },
  async ({ page, body, mode }) => {
    const res = await writeWikiPage(page, body, mode);
    return {
      content: [
        {
          type: 'text',
          text: res.ok
            ? res.message
            : `wiki_write error: ${res.message}`,
        },
      ],
      isError: res.ok ? undefined : true,
    };
  },
  {
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
);
