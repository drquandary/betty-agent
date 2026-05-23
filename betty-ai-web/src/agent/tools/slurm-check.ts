/**
 * slurm_check — lint an sbatch script against Betty cluster constraints.
 *
 * Wraps `python -m slurm_advisor.cli check` (in betty-ai/). The Python side
 * parses #SBATCH directives, applies hard limits from betty_cluster.yaml plus
 * soft limits from PARCC scheduling lore, and produces a structured report
 * including a corrected `suggested_sbatch` block when fixable.
 *
 * The result is rendered as a `betty-slurm-check` rich card in the chat,
 * which shows a status pill, a table of issues, and a copy-paste-ready
 * suggested sbatch block.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { logToolUsage, renderRichCard, runSlurmCli } from './slurm-shared';

/**
 * Provider-agnostic core: lint an sbatch and return the text the chat should
 * show. Shared by the Claude-SDK tool wrapper and the OpenAI/LiteLLM path.
 */
export async function runSlurmCheck(
  sbatch: string,
): Promise<{ text: string; isError: boolean }> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();
  // Log input as a summary — we deliberately don't store the full sbatch
  // text, only its size signal, so personal/research content never lands in
  // the audit log.
  const input_summary = {
    sbatch_size_bytes: sbatch.length,
    sbatch_lines: sbatch.split('\n').length,
  };

  const { ok, stdout, stderr, code } = await runSlurmCli('check', [], sbatch);
  if (!ok) {
    logToolUsage({
      timestamp, tool: 'slurm_check', input_summary,
      duration_ms: Date.now() - startedAt, error: `exit ${code}: ${stderr}`,
    });
    return { text: `slurm_check failed (exit ${code}).\nstderr:\n${stderr || '(empty)'}`, isError: true };
  }
  let parsed: { status?: string; issues?: Array<{ code?: string; severity?: string }> };
  try {
    parsed = JSON.parse(stdout);
  } catch {
    logToolUsage({
      timestamp, tool: 'slurm_check', input_summary,
      duration_ms: Date.now() - startedAt, error: 'non-json output',
    });
    return { text: `slurm_check returned non-JSON:\n${stdout}`, isError: true };
  }
  logToolUsage({
    timestamp,
    tool: 'slurm_check',
    input_summary,
    output_summary: {
      status: parsed.status,
      issue_count: parsed.issues?.length ?? 0,
      issue_codes: parsed.issues?.map((i) => i.code).filter(Boolean),
    },
    duration_ms: Date.now() - startedAt,
  });
  return { text: renderRichCard('check', parsed), isError: false };
}

export const slurmCheckTool = tool(
  'slurm_check',
  'Lint a SLURM sbatch script against Betty cluster constraints (partition limits, CPU/GPU ratios, memory caps, walltime backfill). Returns a structured report with status (ok|revise|block), issues, and a corrected sbatch block when fixable. Use this BEFORE submitting any sbatch to give the user a chance to address warnings.',
  {
    sbatch: z
      .string()
      .min(1)
      .describe('Full sbatch script text (shebang + #SBATCH directives + body).'),
  },
  async ({ sbatch }) => {
    const { text, isError } = await runSlurmCheck(sbatch);
    return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
  },
  { annotations: { readOnlyHint: true, idempotentHint: true } },
);
