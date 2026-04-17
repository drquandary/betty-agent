/**
 * wiki_search — ripgrep-style content search across wiki markdown files.
 *
 * Uses pure Node filesystem + regex so no external ripgrep binary is required.
 * Returns matching file paths + line snippets so the agent can then call wiki_read
 * on the most promising ones.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { z } from 'zod';
import { paths } from '../knowledge/loader';

const MAX_MATCHES = 20;
const SNIPPET_WINDOW = 1; // lines of context on each side

interface Match {
  file: string;
  line: number;
  snippet: string;
}

async function walkMd(dir: string, out: string[] = []): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    const s = await stat(p).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) await walkMd(p, out);
    else if (s.isFile() && e.endsWith('.md')) out.push(p);
  }
  return out;
}

export const wikiSearchTool = tool(
  'wiki_search',
  'Search the Betty AI wiki (all markdown under wiki/) for a case-insensitive regex pattern. Returns up to 20 matches with file paths and snippets. Use this FIRST when the user asks a factual question — the wiki is the source of truth for cluster state, partitions, quotas, bugs, and workflows.',
  {
    pattern: z
      .string()
      .min(1)
      .describe('Regex pattern (case-insensitive). Example: "b200-mig45" or "LoRA"'),
    category: z
      .enum(['entities', 'concepts', 'models', 'sources', 'workflows', 'experiments', 'all'])
      .optional()
      .describe('Restrict search to one wiki subdirectory. Defaults to all.'),
  },
  async ({ pattern, category }) => {
    const base = category && category !== 'all' ? join(paths.wiki, category) : paths.wiki;
    const files = await walkMd(base);

    let re: RegExp;
    try {
      re = new RegExp(pattern, 'i');
    } catch (err) {
      return {
        content: [
          { type: 'text', text: `Invalid regex: ${String((err as Error).message)}` },
        ],
      };
    }

    const matches: Match[] = [];
    for (const file of files) {
      const body = await readFile(file, 'utf8').catch(() => '');
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          const start = Math.max(0, i - SNIPPET_WINDOW);
          const end = Math.min(lines.length, i + SNIPPET_WINDOW + 1);
          matches.push({
            file: relative(paths.wiki, file).replace(/\\/g, '/'),
            line: i + 1,
            snippet: lines.slice(start, end).join('\n'),
          });
          if (matches.length >= MAX_MATCHES) break;
        }
      }
      if (matches.length >= MAX_MATCHES) break;
    }

    if (matches.length === 0) {
      return {
        content: [
          {
            type: 'text',
            text: `No matches for pattern "${pattern}" in wiki${
              category ? `/${category}` : ''
            }.`,
          },
        ],
      };
    }

    const formatted = matches
      .map(
        (m) =>
          `**wiki/${m.file}** (line ${m.line})\n\`\`\`\n${m.snippet}\n\`\`\``,
      )
      .join('\n\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${matches.length} match${matches.length === 1 ? '' : 'es'}:\n\n${formatted}`,
        },
      ],
    };
  },
  {
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
  },
);
