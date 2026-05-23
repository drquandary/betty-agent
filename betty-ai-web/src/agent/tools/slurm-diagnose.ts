/**
 * slurm_diagnose — explain why a pending job hasn't started.
 *
 * Pulls TWO live signals in parallel from the cluster (via the existing SSH
 * transport):
 *   1. `scontrol show job <id>` — JobState, Reason code, ReqTRES, TimeLimit.
 *   2. `sprio -hl -j <id>` — per-factor priority decomposition (AGE,
 *      FAIRSHARE, JOBSIZE, PARTITION, QOS, TRES). Optional — sprio fails
 *      gracefully if the job has already started or doesn't exist.
 *
 * Both feed `slurm_advisor.cli diagnose` which produces a structured
 * diagnosis with likely causes and concrete actions. When sprio is
 * available the card surfaces "your FAIRSHARE factor is the dominant
 * drag" instead of the opaque "higher-priority jobs are queued ahead".
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { runRemote } from '../cluster/ssh';
import { logToolUsage, renderRichCard, runSlurmCli } from './slurm-shared';

const JOB_ID_RE = /^\d+(_\d+)?$/;

/**
 * Provider-agnostic core: diagnose a pending job and return the text the chat
 * should show. Shared by the Claude-SDK tool wrapper and the OpenAI/LiteLLM
 * path. Returns an error string (not a throw) for any failure so both
 * backends surface it the same way.
 */
export async function runSlurmDiagnose(
  job_id: string,
): Promise<{ text: string; isError: boolean }> {
    if (!JOB_ID_RE.test(job_id)) {
      return { text: `slurm_diagnose: invalid job_id "${job_id}" (must be digits or digits_digits).`, isError: true };
    }
    const startedAt = Date.now();
    const timestamp = new Date(startedAt).toISOString();
    // We deliberately don't log the job_id directly — it's a foreign
    // identifier for our calibration purposes. Log only that a diagnose
    // happened. (The audit log is for "did our recommendations work?",
    // not "which jobs did this user inspect?".)
    const input_summary = { job_id_supplied: !!job_id };

    // Run scontrol and sprio in parallel — both are read-only and target
    // the same job. sprio's failure is non-fatal: if it errors (job
    // already started, doesn't exist, etc.) we proceed without priority
    // decomposition. scontrol's failure IS fatal — without JobState we
    // have nothing to diagnose.
    const [scontrolRes, sprioRes] = await Promise.all([
      runRemote(`scontrol show job ${job_id}`).catch((err) => ({
        stdout: '', stderr: (err as Error).message, exit: -1,
      })),
      runRemote(`sprio -hl -j ${job_id}`).catch(() => ({
        stdout: '', stderr: 'sprio unreachable (non-fatal)', exit: -1,
      })),
    ]);

    if (scontrolRes.exit !== 0) {
      logToolUsage({
        timestamp, tool: 'slurm_diagnose', input_summary,
        duration_ms: Date.now() - startedAt,
        error: `scontrol exit ${scontrolRes.exit}`,
      });
      return { text: `slurm_diagnose: scontrol exited ${scontrolRes.exit}.\n${scontrolRes.stderr || scontrolRes.stdout || '(no output)'}`, isError: true };
    }
    const scontrolOut = scontrolRes.stdout;
    const sprioOut = sprioRes.exit === 0 ? sprioRes.stdout : '';

    // Pipe sprio through a temp file so we don't have to extend the CLI
    // protocol to multiplex two stdin streams. The file is removed in the
    // `finally` block whether the CLI succeeds or fails.
    let sprioFile: string | null = null;
    let sprioDir: string | null = null;
    if (sprioOut) {
      sprioDir = mkdtempSync(join(tmpdir(), 'betty-sprio-'));
      sprioFile = join(sprioDir, `sprio-${job_id}.txt`);
      writeFileSync(sprioFile, sprioOut, 'utf8');
    }

    const cliArgs = sprioFile ? [job_id, '--sprio-file', sprioFile] : [job_id];
    let result;
    try {
      result = await runSlurmCli('diagnose', cliArgs, scontrolOut);
    } finally {
      if (sprioDir) {
        try { rmSync(sprioDir, { recursive: true, force: true }); } catch { /* swallow */ }
      }
    }
    const { ok, stdout, stderr, code } = result;
    if (!ok) {
      logToolUsage({
        timestamp, tool: 'slurm_diagnose', input_summary,
        duration_ms: Date.now() - startedAt, error: `advisor exit ${code}: ${stderr}`,
      });
      return { text: `slurm_diagnose: advisor exited ${code}.\n${stderr}`, isError: true };
    }
    let parsed: { state?: string; reason?: string; priority_dominant_negative?: string };
    try {
      parsed = JSON.parse(stdout);
    } catch {
      logToolUsage({
        timestamp, tool: 'slurm_diagnose', input_summary,
        duration_ms: Date.now() - startedAt, error: 'non-json output',
      });
      return { text: `slurm_diagnose returned non-JSON:\n${stdout}`, isError: true };
    }
    logToolUsage({
      timestamp,
      tool: 'slurm_diagnose',
      input_summary,
      output_summary: {
        state: parsed.state,
        reason: parsed.reason,
        sprio_used: sprioOut.length > 0,
        priority_bottleneck: parsed.priority_dominant_negative,
      },
      duration_ms: Date.now() - startedAt,
    });
  return { text: renderRichCard('diagnose', parsed), isError: false };
}

export const slurmDiagnoseTool = tool(
  'slurm_diagnose',
  'Diagnose why a SLURM job is still pending. Runs `scontrol show job <id>` on Betty, then maps the Reason code to a human-readable explanation and concrete suggested actions (e.g. "shorten --time so backfill picks it up", "your QOS GPU minutes are exhausted").',
  {
    job_id: z
      .string()
      .min(1)
      .regex(JOB_ID_RE, 'job_id must be digits or digits_digits')
      .describe('SLURM job id to diagnose, e.g. "123456" or "123456_0".'),
  },
  async ({ job_id }) => {
    const { text, isError } = await runSlurmDiagnose(job_id);
    return { content: [{ type: 'text', text }], ...(isError ? { isError: true } : {}) };
  },
  { annotations: { readOnlyHint: true, idempotentHint: false } },
);
