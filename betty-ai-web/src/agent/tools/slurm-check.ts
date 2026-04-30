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
import { renderRichCard, runSlurmCli } from './slurm-shared';

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
    const { ok, stdout, stderr, code } = await runSlurmCli('check', [], sbatch);
    if (!ok) {
      return {
        content: [{
          type: 'text',
          text: `slurm_check failed (exit ${code}).\nstderr:\n${stderr || '(empty)'}`,
        }],
        isError: true,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return {
        content: [{ type: 'text', text: `slurm_check returned non-JSON:\n${stdout}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: renderRichCard('check', parsed) }],
    };
  },
  { annotations: { readOnlyHint: true, idempotentHint: true } },
);
