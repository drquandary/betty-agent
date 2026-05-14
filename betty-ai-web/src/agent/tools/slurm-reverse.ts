/**
 * slurm_reverse — reverse CLI filter.
 *
 * Wraps `python -m slurm_advisor.cli reverse`. The Python side shells out to
 * Ryan's `slurm-cli-filter.py` (PARCC's CLI filter kernel) as the legality
 * oracle. If the user's request is illegal, the reverse filter enumerates a
 * neighborhood, asks Ryan's kernel which candidates are legal, and ranks them
 * by weighted L1 distance from the original request.
 *
 * Output contract (one JSON object):
 *   { original, forward: {status, code, message, params, set, branches},
 *     legal, candidates: [{request, distance, set}], filter_path, solver }
 *
 * Source of truth = Ryan's kernel. We never re-encode his rules. See
 * betty-ai/slurm_advisor/reverse.py and reverse.mzn for details.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { renderRichCard, runSlurmCli } from './slurm-shared';

const PARTITIONS = ['dgx-b200', 'genoa-std-mem', 'genoa-lrg-mem'] as const;

export const slurmReverseTool = tool(
  'slurm_reverse',
  "Reverse CLI filter: validates a job request against PARCC's slurm-cli-filter.py (the production cluster CLI filter). If illegal, returns ranked nearest-legal alternatives instead of plain rejection — \"did you mean …?\". Use this whenever the user describes a Slurm job request and wants to know whether it'll pass the filter, or wants a corrected request when their numbers don't line up.",
  {
    partition: z.enum(PARTITIONS).describe('Slurm partition name.'),
    gpus: z.number().int().optional().describe('Total GPUs requested (-G).'),
    gres: z.number().int().optional().describe('GPUs per node (--gres=gpu:N).'),
    nodes: z.number().int().optional().describe('Node count (-N).'),
    tasks: z.number().int().optional().describe('Total tasks (--ntasks).'),
    tasks_per_node: z.number().int().optional().describe('--ntasks-per-node.'),
    cpus: z.number().int().optional().describe('--cpus-per-task.'),
    memory: z.number().int().optional().describe('Per-node memory in GiB (--mem).'),
    mem_per_cpu: z.number().optional().describe('--mem-per-cpu in GiB.'),
    mem_per_gpu: z.number().optional().describe('--mem-per-gpu in GiB.'),
    cpus_per_gpu: z.number().int().optional().describe('--cpus-per-gpu.'),
    max_candidates: z
      .number()
      .int()
      .optional()
      .describe('How many nearest-legal candidates to return (default 3).'),
  },
  async (input) => {
    const args: string[] = ['--partition', input.partition];
    const optional: Record<string, string> = {
      gpus: '--gpus',
      gres: '--gres',
      nodes: '--nodes',
      tasks: '--tasks',
      tasks_per_node: '--tasks-per-node',
      cpus: '--cpus',
      memory: '--memory',
      mem_per_cpu: '--mem-per-cpu',
      mem_per_gpu: '--mem-per-gpu',
      cpus_per_gpu: '--cpus-per-gpu',
      max_candidates: '--max-candidates',
    };
    for (const [k, flag] of Object.entries(optional)) {
      const v = (input as Record<string, unknown>)[k];
      if (v !== undefined && v !== null) {
        args.push(flag, String(v));
      }
    }

    const { ok, stdout, stderr, code } = await runSlurmCli('reverse', args);
    if (!ok) {
      return {
        content: [
          {
            type: 'text',
            text:
              `slurm_reverse failed (exit ${code}).\n` +
              `Hint: set PARCC_CLI_FILTER to the path of slurm-cli-filter.py ` +
              `(and PARCC_CLI_FILTER_PYTHON to a python>=3.10 if your default ` +
              `python3 is older).\nstderr:\n${stderr || '(empty)'}`,
          },
        ],
        isError: true,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return {
        content: [{ type: 'text', text: `slurm_reverse returned non-JSON:\n${stdout}` }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: renderRichCard('reverse', parsed) }],
    };
  },
  { annotations: { readOnlyHint: true, idempotentHint: true } },
);
