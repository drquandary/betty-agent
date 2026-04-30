/**
 * slurm_recommend — given a high-level intent (gpus, hours, mem), pick the
 * cheapest legal Betty partition + resource shape and emit a runnable sbatch
 * block. Backed by the MiniZinc constraint model when MiniZinc is installed,
 * pure-Python search otherwise (same answer for our small partition set).
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runRemote } from '../cluster/ssh';
import { renderRichCard, runSlurmCli } from './slurm-shared';

/**
 * Best-effort fairshare snapshot for the current user, so the recommend
 * card can show "this job costs X PC-minutes; you have Y left this period".
 *
 * `sshare -h -P -U -o "Account,User,RawShares,RawUsage,EffectvUsage,FairShare"`
 * is per-user (not all-users); fails silently if SSH is down. The Python
 * recommender ingests whatever rows we send.
 *
 * NOTE (Ryan #4 — fairshare parsing investigation, 2026-04-27): a test run
 * captured rows whose values looked like header columns from a different
 * tool (`parcc_quota.py`-style "INodes Used / Path / Used / Limit"). We
 * deliberately do NOT silently drop those rows — instead we surface the
 * raw stdout (truncated) in the payload so the user can see what Betty
 * actually emitted, and we tag suspect rows. This is the "before you fix
 * the parser, show me the raw output" path Ryan asked for.
 */
/**
 * Defensive parser for `sshare -h -P -U` output.
 *
 * Two real symptoms we've seen and need to handle:
 *   1. Slurm 24.11.7 + `-P -h` sometimes still emits a unit/source row that
 *      isn't suppressed by `-h`. Symptoms: a row whose User column is
 *      "User" or "Src" (i.e., a header word).
 *   2. A login MOTD wrapper or shell init can inject text before the actual
 *      `sshare` output. Symptoms: a row where numeric columns aren't
 *      parseable as floats.
 *
 * Strategy:
 *   - Skip rows whose `User` matches a known header keyword.
 *   - Skip rows whose `RawUsage` and `FairShare` aren't numeric.
 *   - Track dropped rows separately so the card can show "we dropped N
 *     suspicious rows" + a sample for audit, instead of silently hiding them.
 *
 * Exposed for unit tests so we can lock the symptom→behavior mapping.
 */
export function parseSshareDefensive(
  stdout: string,
  cols: string[],
): {
  rows: Array<Record<string, string>>;
  dropped_count: number;
  dropped_samples: string[];
} {
  const rows: Array<Record<string, string>> = [];
  const dropped_samples: string[] = [];
  let dropped_count = 0;
  const HEADER_WORDS = new Set([
    'user', 'account', 'src', 'source', 'path', 'login', 'pennkey',
  ]);
  const looksNumeric = (s: string) =>
    /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s.trim());

  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < cols.length) {
      // Not pipe-delimited or wrong column count → almost certainly MOTD
      // junk (e.g. `Last login: ...`). Drop with sample.
      dropped_count += 1;
      if (dropped_samples.length < 3) dropped_samples.push(`malformed: ${line}`);
      continue;
    }
    const row: Record<string, string> = {};
    cols.forEach((c, i) => (row[c] = parts[i].trim()));
    // Symptom 1: header keyword in User column
    if (!row.User || HEADER_WORDS.has(row.User.toLowerCase())) {
      dropped_count += 1;
      if (dropped_samples.length < 3) dropped_samples.push(`header-row: ${line}`);
      continue;
    }
    // Symptom 2: numeric columns aren't numeric (only enforce for the
    // "leaf" association rows; parent rows have empty FairShare which is
    // legitimate).
    const fsOk = !row.FairShare || looksNumeric(row.FairShare);
    const usageOk = !row.RawUsage || looksNumeric(row.RawUsage);
    if (!fsOk || !usageOk) {
      dropped_count += 1;
      if (dropped_samples.length < 3) dropped_samples.push(`non-numeric: ${line}`);
      continue;
    }
    rows.push(row);
  }
  return { rows, dropped_count, dropped_samples };
}

async function fetchFairshare(): Promise<{
  rows: Array<Record<string, string>>;
  source: string | null;
  raw_stdout_excerpt?: string;
  dropped_count?: number;
  dropped_samples?: string[];
}> {
  try {
    const { stdout, exit } = await runRemote(
      'sshare -h -P -U -o "Account,User,RawShares,RawUsage,EffectvUsage,FairShare"',
    );
    if (exit !== 0) return { rows: [], source: null };
    const cols = ['Account', 'User', 'RawShares', 'RawUsage', 'EffectvUsage', 'FairShare'];
    const { rows, dropped_count, dropped_samples } = parseSshareDefensive(stdout, cols);
    // Truncate the raw stdout to keep payload size bounded but keep enough
    // to diagnose. 800 chars is well under the LLM context cost and shows
    // ~10–20 lines on most outputs.
    const excerpt = stdout.slice(0, 800);
    return {
      rows,
      source: 'sshare',
      raw_stdout_excerpt: excerpt,
      dropped_count,
      dropped_samples,
    };
  } catch {
    return { rows: [], source: null };
  }
}

export const slurmRecommendTool = tool(
  'slurm_recommend',
  'Pick a Betty partition + (nodes, GPUs/node, CPUs, memory, walltime) for a desired workload. The constraint solver enforces partition QOS rules, per-GPU CPU/memory caps, and walltime limits. Use this when the user describes intent ("I need 2 GPUs for 8 hours") rather than handing you an sbatch.',
  {
    gpus: z.number().int().min(0).default(0).describe('Number of GPUs.'),
    cpus: z
      .number()
      .int()
      .min(0)
      .default(0)
      .describe('Number of CPUs (only set for CPU-only jobs; GPU jobs derive from the per-GPU cap).'),
    mem_gb: z.number().int().min(1).optional().describe('Total memory in GB. Optional; defaults to per-GPU policy.'),
    hours: z.number().min(0.1).max(168).default(1).describe('Walltime hours.'),
    partition: z.string().optional().describe('Pin to a specific partition (e.g. "dgx-b200").'),
    qos: z.string().optional().describe('Pin to a specific QOS (e.g. "normal").'),
    interactive: z.boolean().default(false).describe('If true, walltime is capped at 4h.'),
    min_vram_gb: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        "Minimum VRAM per GPU the workload needs (GB). Excludes partitions whose " +
        "gpu_vram_gb is below this — e.g. pass 80 for a 70B fine-tune so the " +
        "solver can't pick the 45 GB MIG slices. If you don't know, call " +
        "gpu_calculate first to derive it from the model + method, then pass " +
        "the resulting vram_needed_gb here. When omitted, the recommend card " +
        "will show a 'VRAM not constrained' disclaimer.",
      ),
  },
  async (input) => {
    // Fetch fairshare in parallel with the solver — saves a round-trip.
    const fairsharePromise = fetchFairshare();

    const args: string[] = [];
    if (input.gpus) args.push('--gpus', String(input.gpus));
    if (input.cpus) args.push('--cpus', String(input.cpus));
    if (input.mem_gb) args.push('--mem-gb', String(input.mem_gb));
    args.push('--hours', String(input.hours));
    if (input.partition) args.push('--partition', input.partition);
    if (input.qos) args.push('--qos', input.qos);
    if (input.interactive) args.push('--interactive');
    if (input.min_vram_gb) args.push('--min-vram-gb', String(input.min_vram_gb));

    const { ok, stdout, stderr, code } = await runSlurmCli('recommend', args);
    if (!ok) {
      return {
        content: [{ type: 'text', text: `slurm_recommend failed (exit ${code}).\n${stderr}` }],
        isError: true,
      };
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return {
        content: [{ type: 'text', text: `slurm_recommend returned non-JSON:\n${stdout}` }],
        isError: true,
      };
    }
    // Merge fairshare data into the payload for the recommend card to render.
    const fs = await fairsharePromise;
    parsed.fairshare = {
      rows: fs.rows,
      source: fs.source,
      raw_stdout_excerpt: fs.raw_stdout_excerpt,
      dropped_count: fs.dropped_count,
      dropped_samples: fs.dropped_samples,
    };
    return {
      content: [{ type: 'text', text: renderRichCard('recommend', parsed) }],
    };
  },
  { annotations: { readOnlyHint: true, idempotentHint: true } },
);
