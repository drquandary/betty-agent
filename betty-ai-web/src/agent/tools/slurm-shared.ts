/**
 * Shared helpers for the slurm_* tools — Python invocation, JSON parsing,
 * and a "render-this-as-a-rich-card" markdown convention.
 *
 * Rich rendering: when a slurm_* tool wants the chat UI to render a custom
 * card (the check report, the availability calendar) instead of plain JSON,
 * it returns a fenced code block tagged with `betty-slurm-<kind>`. The
 * markdown renderer in `ChatMessage.tsx` recognizes those tags and swaps in
 * a React component. Tools that produce a regular text response just return
 * normal markdown.
 */

import { spawn } from 'node:child_process';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { paths } from '../knowledge/loader';

export interface PythonRunResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Spawn `python -m slurm_advisor.cli <verb> [args]` from the betty-ai cwd.
 * Mirrors the spawn-with-fallback approach in gpu-calculate.ts so dev
 * laptops without `python3` still work.
 */
export function runSlurmCli(
  verb: string,
  args: string[],
  stdin?: string,
): Promise<PythonRunResult> {
  const candidates = process.env.BETTY_PYTHON
    ? [process.env.BETTY_PYTHON]
    : ['python3', 'python'];

  return new Promise((resolve) => {
    let lastErr = '';
    (async () => {
      for (const bin of candidates) {
        const result = await new Promise<PythonRunResult & { launched: boolean }>(
          (res) => {
            const proc = spawn(bin, ['-m', 'slurm_advisor.cli', verb, ...args], {
              cwd: paths.bettyAi,
              env: process.env,
            });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
            proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
            proc.on('close', (code) =>
              res({ ok: code === 0, stdout, stderr, code: code ?? -1, launched: true }),
            );
            proc.on('error', (err) =>
              res({ ok: false, stdout: '', stderr: String(err), code: -1, launched: false }),
            );
            if (stdin !== undefined) {
              proc.stdin.write(stdin);
              proc.stdin.end();
            }
          },
        );
        if (result.launched) {
          resolve({ ok: result.ok, stdout: result.stdout, stderr: result.stderr, code: result.code });
          return;
        }
        lastErr = result.stderr;
      }
      resolve({
        ok: false,
        stdout: '',
        stderr: `No Python interpreter found (tried: ${candidates.join(', ')}). Last error: ${lastErr}`,
        code: -1,
      });
    })();
  });
}

/** Render a card payload for `ChatMessage.tsx` to pick up.
 *
 * Wraps the JSON in a fenced block tagged `betty-slurm-<kind>` AND prefixes
 * an instruction telling the model to include the block verbatim in its
 * reply. Without that instruction the model tends to paraphrase the JSON as
 * a markdown table, defeating the rich-card UI.
 */
export function renderRichCard(kind: string, payload: unknown): string {
  const fence = ['```betty-slurm-' + kind, JSON.stringify(payload, null, 2), '```'].join('\n');
  return [
    `[slurm_${kind} result — IMPORTANT: paste the fenced block below into your reply VERBATIM.`,
    `It will render as a rich card. Do NOT rewrite it as a markdown table or paraphrase the JSON.`,
    `You may add a one-sentence intro before it and a one-sentence next-step after it, but the`,
    `fenced block itself must appear unchanged.]`,
    '',
    fence,
  ].join('\n');
}


/**
 * Agent usage log — append-only JSONL of every slurm_* tool invocation.
 *
 * Why: Ryan's wrong-impression risk gets less scary if we can show
 * calibration over time ("of last 100 recommendations, 73% started within
 * the predicted window"). That dataset doesn't exist until we start
 * recording. This is single-user / dev-mode logging today; multi-user
 * audit logging gates on the OOD deployment in §8.1 of the report.
 *
 * Format: one JSON object per line in
 * `betty-ai/data/agent-log/slurm-tool-calls.jsonl`. Each entry has:
 *   - timestamp:  ISO-8601 UTC of when the call started
 *   - tool:       "slurm_check" | "slurm_recommend" | "slurm_diagnose" | "slurm_availability"
 *   - input_summary:  small bag of input fields (gpus, hours, etc.) — no
 *                     full sbatch text or job IDs from other users
 *   - output_summary: small bag of result fields (partition, score, status,
 *                     sources, etc.) — no per-job rows from squeue
 *   - duration_ms:    wall-time of the underlying CLI/SSH call(s)
 *   - error:          non-null if the call failed
 *
 * Privacy: we deliberately log SUMMARIES, not full inputs/outputs. A
 * researcher's sbatch script may contain dataset paths or model names they
 * don't want auditable. The JobIDs from `squeue --start` are aggregated
 * before they ever reach this layer (§5.4 privacy contract). What we log
 * is enough to compute calibration — what we recommended, what category
 * of request it was — without retaining content.
 *
 * Failure mode: log writes are best-effort. A failed write must never
 * affect the tool's return value or surface to the user. The data
 * flywheel is nice-to-have; the tool's correctness is not.
 */

export interface ToolUsageRecord {
  timestamp: string;
  tool: string;
  input_summary?: Record<string, unknown>;
  output_summary?: Record<string, unknown>;
  duration_ms: number;
  error?: string;
}

const LOG_DIR = join(paths.bettyAi, 'data', 'agent-log');
const LOG_FILE = join(LOG_DIR, 'slurm-tool-calls.jsonl');

let logDirEnsured = false;

export function logToolUsage(record: ToolUsageRecord): void {
  // Best-effort: any error here is swallowed so the tool's behavior is
  // never affected by logging.
  try {
    if (!logDirEnsured) {
      mkdirSync(LOG_DIR, { recursive: true });
      logDirEnsured = true;
    }
    appendFileSync(LOG_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    /* swallow — calibration logging is non-essential */
  }
}

/**
 * Helper to wrap a tool's body with timing + logging boilerplate. The
 * caller passes the tool name, an input summarizer (returning the small
 * bag of input fields safe to log), and the body that produces the result.
 * Output summarization happens by the caller passing back what to log.
 */
export async function withUsageLog<T>(
  tool: string,
  input_summary: Record<string, unknown>,
  body: () => Promise<{ result: T; output_summary?: Record<string, unknown>; error?: string }>,
): Promise<T> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();
  try {
    const { result, output_summary, error } = await body();
    logToolUsage({
      timestamp,
      tool,
      input_summary,
      output_summary,
      duration_ms: Date.now() - startedAt,
      error,
    });
    return result;
  } catch (err) {
    logToolUsage({
      timestamp,
      tool,
      input_summary,
      duration_ms: Date.now() - startedAt,
      error: (err as Error).message,
    });
    throw err;
  }
}
