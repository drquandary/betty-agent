/**
 * gpu_calculate — wraps the existing Python GPU calculator at
 * betty-ai/models/gpu_calculator.py. Invokes via child_process.
 *
 * The Python script returns JSON with partition/GPUs/QOS/cost — we just
 * pass it through so the model can reason about the result.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { z } from 'zod';
import { paths } from '../knowledge/loader';

const CALCULATOR = join(paths.bettyAi, 'models', 'gpu_calculator.py');

/**
 * Spawn the Python interpreter. Tries `python3` first (macOS default, modern
 * Linux), falls back to `python` (Betty's anaconda / some container envs).
 * Override with env var BETTY_PYTHON if neither default works.
 */
function spawnPython(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const candidates = process.env.BETTY_PYTHON
    ? [process.env.BETTY_PYTHON]
    : ['python3', 'python'];

  return new Promise(async (resolve) => {
    let lastErr = '';
    for (const bin of candidates) {
      const result = await new Promise<{ code: number; stdout: string; stderr: string; launched: boolean }>((res) => {
        const proc = spawn(bin, [CALCULATOR, ...args], {
          cwd: paths.bettyAi,
          env: process.env,
        });
        let stdout = '';
        let stderr = '';
        let launched = true;
        proc.stdout.on('data', (d: Buffer) => (stdout += d.toString()));
        proc.stderr.on('data', (d: Buffer) => (stderr += d.toString()));
        proc.on('close', (code) => res({ code: code ?? -1, stdout, stderr, launched }));
        proc.on('error', (err) => {
          launched = false;
          res({ code: -1, stdout, stderr: String(err), launched: false });
        });
      });

      if (result.launched) return resolve(result);
      lastErr = result.stderr;
    }
    resolve({ code: -1, stdout: '', stderr: `No Python interpreter found (tried: ${candidates.join(', ')}). Last error: ${lastErr}` });
  });
}

// Keep old name as an alias so existing imports don't break.
const runPython = spawnPython;

export const gpuCalculateTool = tool(
  'gpu_calculate',
  'Calculate optimal GPU/partition/QOS/cost allocation for a Betty workload. Wraps betty-ai/models/gpu_calculator.py. Use this whenever the user asks for resource estimates for fine-tuning or serving a model.',
  {
    model: z
      .string()
      .describe(
        'HuggingFace model ID like "meta-llama/Llama-3-8B" or a known slug in betty-ai/models/model_registry.yaml',
      ),
    method: z
      .enum(['lora', 'qlora', 'full', 'deepspeed', 'inference'])
      .describe('Training or serving method. "inference" = vLLM serving.'),
    dataset_tokens: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Approximate training set size in tokens (skip for inference).'),
    epochs: z.number().positive().optional().describe('Epochs (skip for inference).'),
  },
  async ({ model, method, dataset_tokens, epochs }) => {
    const args = ['--model', model, '--method', method];
    if (dataset_tokens !== undefined) args.push('--dataset-tokens', String(dataset_tokens));
    if (epochs !== undefined) args.push('--epochs', String(epochs));

    const { code, stdout, stderr } = await runPython(args);

    if (code !== 0) {
      return {
        content: [
          {
            type: 'text',
            text: `gpu_calculate failed (exit ${code}).\nstderr:\n${stderr || '(empty)'}\nstdout:\n${stdout || '(empty)'}`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `gpu_calculator output:\n\`\`\`json\n${stdout.trim()}\n\`\`\``,
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
