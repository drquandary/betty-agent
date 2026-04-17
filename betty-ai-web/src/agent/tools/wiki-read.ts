/**
 * wiki_read — read a specific wiki page by relative path.
 * Accepts either "entities/betty-cluster" or "entities/betty-cluster.md".
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';
import { z } from 'zod';
import { paths } from '../knowledge/loader';

export const wikiReadTool = tool(
  'wiki_read',
  'Read the full contents of a wiki page. Input is the path relative to wiki/ (e.g. "entities/betty-cluster" or "concepts/ood-troubleshooting.md"). Use this AFTER wiki_search identifies a promising page, so you can cite the authoritative text.',
  {
    page: z
      .string()
      .min(1)
      .describe('Wiki page path relative to wiki/. Extension .md is optional.'),
  },
  async ({ page }) => {
    // Normalize + security check: no path traversal outside wiki/.
    // Cross-platform safe: split on both / and \ and reject any ".." segment.
    const rel = page.endsWith('.md') ? page : `${page}.md`;
    const normalized = normalize(rel).replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.includes('..') || normalized.startsWith('/')) {
      return {
        content: [{ type: 'text', text: `Rejected: path traversal in "${page}"` }],
      };
    }

    const full = join(paths.wiki, normalized);
    try {
      const body = await readFile(full, 'utf8');
      return {
        content: [
          {
            type: 'text',
            text: `# wiki/${normalized}\n\n${body}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `Could not read wiki/${normalized}: ${String((err as Error).message)}`,
          },
        ],
      };
    }
  },
  {
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
);
