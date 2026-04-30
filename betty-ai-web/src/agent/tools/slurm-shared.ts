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
