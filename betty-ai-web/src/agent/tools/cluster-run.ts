/**
 * cluster_run — run a read-only command on the Betty cluster over SSH.
 *
 * Input: { command: string }
 *
 * This tool is the user-facing cluster read path. Commands MUST pass
 * `isSafeReadCommand()` (D7 whitelist) or they're rejected before touching SSH.
 * Internal trusted callers (cluster_submit, cluster_status) that need to run
 * `sbatch` / `sacct` / `mkdir -p` / etc. bypass this guard by calling
 * `runRemote()` from `@/agent/cluster/ssh` directly — the whitelist is not
 * applied to their internal sequences because the arguments they construct are
 * validated at their tool boundary.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runRemote } from '../cluster/ssh';
import { isSafeReadCommand } from '../cluster/whitelist';

export const clusterRunTool = tool(
  'cluster_run',
  'Run a whitelisted read-only command on the Betty cluster (e.g. `squeue -u jvadala`, `sinfo`, `parcc_sfree.py`, `ls /vast/home/j/jvadala/...`, `cat` of .out/.err/.log files). The command must match the cluster read whitelist exactly — anything unknown is rejected. Returns {stdout, stderr, exit} as JSON.',
  {
    command: z
      .string()
      .min(1)
      .describe('The exact shell command to run remotely. Must match a whitelist pattern.'),
  },
  async ({ command }) => {
    if (!isSafeReadCommand(command)) {
      return {
        content: [
          {
            type: 'text',
            text: `cluster_run rejected: command "${command}" is not in the cluster read whitelist. See the allowed patterns in the system prompt.`,
          },
        ],
        isError: true,
      };
    }

    try {
      const { stdout, stderr, exit } = await runRemote(command);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ stdout, stderr, exit }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: 'text',
            text: `cluster_run SSH error: ${(err as Error).message}`,
          },
        ],
        isError: true,
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
