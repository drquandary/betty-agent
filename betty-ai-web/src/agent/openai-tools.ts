/**
 * OpenAI-compatible tool definitions + dispatcher for the LiteLLM provider.
 *
 * This is the read-only subset of the Betty AI toolset, exposed in the
 * OpenAI function-calling schema so models like gpt-oss-120b served through
 * LiteLLM can actually call them. Write-path tools (cluster_submit,
 * wiki_write) are intentionally NOT included — they need the permission
 * handshake that only the Claude Code provider currently implements.
 *
 * The tool handlers here deliberately duplicate a small amount of logic
 * from src/agent/tools/*.ts rather than routing through the Anthropic SDK's
 * `tool()` wrapper. That keeps the dependency on the SDK out of this path
 * and makes the LiteLLM flow independent of Claude-specific types.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, normalize, relative } from 'node:path';
import { paths } from './knowledge/loader';
import { runRemote } from './cluster/ssh';
import { isSafeReadCommand } from './cluster/whitelist';
import { runSlurmAvailability } from './tools/slurm-availability';
import { runSlurmRecommend } from './tools/slurm-recommend';
import { runSlurmCheck } from './tools/slurm-check';
import { runSlurmDiagnose } from './tools/slurm-diagnose';

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** Schemas sent to the model in the `tools` array. */
export const OPENAI_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'wiki_search',
      description:
        'Search the Betty AI wiki (markdown under wiki/) for a case-insensitive regex. Use this FIRST for factual questions — wiki is the source of truth for cluster state.',
      parameters: {
        type: 'object',
        properties: {
          pattern: { type: 'string', description: 'Regex pattern (case-insensitive).' },
          category: {
            type: 'string',
            enum: ['entities', 'concepts', 'models', 'sources', 'workflows', 'experiments', 'all'],
            description: 'Restrict to one wiki subdirectory. Defaults to all.',
          },
        },
        required: ['pattern'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'wiki_read',
      description: 'Read a wiki page in full. Input is the path relative to wiki/ (e.g. "entities/betty-cluster").',
      parameters: {
        type: 'object',
        properties: {
          page: { type: 'string', description: 'Wiki page path relative to wiki/. .md optional.' },
        },
        required: ['page'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cluster_run',
      description:
        'Run a whitelisted read-only command on Betty (e.g. `squeue -u jvadala`, `sinfo`, `parcc_sfree.py`, `cat` of log files). Non-whitelisted commands are rejected.',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string', description: 'The exact command. Must match the read whitelist.' },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'gpu_calculate',
      description: 'Estimate resource needs for a model + training method. Returns partition, GPUs, VRAM, runtime, cost.',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'HuggingFace model id, e.g. meta-llama/Meta-Llama-3-8B.' },
          method: { type: 'string', enum: ['lora', 'qlora', 'full', 'inference'] },
          dataset_tokens: { type: 'number', description: 'Rough total training tokens (optional).' },
          epochs: { type: 'number', description: 'Number of epochs (training only).' },
        },
        required: ['model', 'method'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slurm_recommend',
      description:
        'Pick a Betty partition + (nodes, GPUs/node, CPUs, memory, walltime) for a desired workload. Constraint-solver-backed; enforces QOS, per-GPU CPU/memory caps, walltime limits. Use when the user describes intent ("I need 2 GPUs for 8 hours") rather than handing you an sbatch. Returns a rich card — paste the fenced betty-slurm-recommend block VERBATIM.',
      parameters: {
        type: 'object',
        properties: {
          gpus: { type: 'number', description: 'Number of GPUs.' },
          cpus: { type: 'number', description: 'CPUs (CPU-only jobs; GPU jobs derive from per-GPU cap).' },
          mem_gb: { type: 'number', description: 'Total memory in GB (optional).' },
          hours: { type: 'number', description: 'Walltime hours.' },
          partition: { type: 'string', description: 'Pin to a partition (e.g. dgx-b200).' },
          qos: { type: 'string', description: 'Pin to a QOS.' },
          interactive: { type: 'boolean', description: 'If true, walltime capped at 4h.' },
          min_vram_gb: { type: 'number', description: 'Min VRAM/GPU in GB; excludes smaller GPUs/MIG slices.' },
        },
        required: ['hours'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slurm_availability',
      description:
        'Propose ranked candidate time-slots for a GPU+walltime request (a calendar card). Combines live cluster idle state with an hour-of-day load profile and blackout windows. Use when the user is choosing WHEN to submit. Returns a rich card — paste the fenced betty-slurm-calendar block VERBATIM.',
      parameters: {
        type: 'object',
        properties: {
          gpus: { type: 'number', description: 'GPUs needed for the slot.' },
          hours: { type: 'number', description: 'Walltime in hours.' },
          partition: { type: 'string', description: 'Target partition (default dgx-b200).' },
          earliest: { type: 'string', description: 'ISO-8601 earliest acceptable start (optional).' },
          latest: { type: 'string', description: 'ISO-8601 latest acceptable start (optional).' },
        },
        required: ['gpus', 'hours'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slurm_check',
      description:
        'Lint a full sbatch script against Betty constraints (partition limits, CPU/GPU ratios, memory caps, walltime backfill). Returns status (ok|revise|block) + issues + a corrected sbatch. Run BEFORE suggesting a submit. Returns a rich card — paste the fenced betty-slurm-check block VERBATIM.',
      parameters: {
        type: 'object',
        properties: {
          sbatch: { type: 'string', description: 'Full sbatch script text (shebang + #SBATCH directives + body).' },
        },
        required: ['sbatch'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'slurm_diagnose',
      description:
        'Diagnose why a SLURM job is still pending. Runs scontrol show job <id> + sprio, maps the Reason code to a human explanation + suggested actions. Returns a rich card — paste the fenced betty-slurm-diagnose block VERBATIM.',
      parameters: {
        type: 'object',
        properties: {
          job_id: { type: 'string', description: 'SLURM job id, e.g. "123456" or "123456_0".' },
        },
        required: ['job_id'],
      },
    },
  },
];

/** Dispatch table: tool name → handler taking parsed JSON args. */
type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

const MAX_SEARCH_MATCHES = 20;

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

const handlers: Record<string, ToolHandler> = {
  async wiki_search(args) {
    const pattern = String(args.pattern ?? '');
    const category = typeof args.category === 'string' ? args.category : 'all';
    if (!pattern) return 'Missing required arg: pattern';
    const base = category && category !== 'all' ? join(paths.wiki, category) : paths.wiki;
    const files = await walkMd(base);
    let re: RegExp;
    try {
      re = new RegExp(pattern, 'i');
    } catch (err) {
      return `Invalid regex: ${(err as Error).message}`;
    }
    const matches: Array<{ file: string; line: number; snippet: string }> = [];
    for (const file of files) {
      const body = await readFile(file, 'utf8').catch(() => '');
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (re.test(lines[i])) {
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 2);
          matches.push({
            file: relative(paths.wiki, file).replace(/\\/g, '/'),
            line: i + 1,
            snippet: lines.slice(start, end).join('\n'),
          });
          if (matches.length >= MAX_SEARCH_MATCHES) break;
        }
      }
      if (matches.length >= MAX_SEARCH_MATCHES) break;
    }
    if (matches.length === 0) return `No matches for "${pattern}" in wiki${category !== 'all' ? `/${category}` : ''}.`;
    return matches
      .map((m) => `wiki/${m.file} (L${m.line})\n${m.snippet}`)
      .join('\n---\n');
  },

  async wiki_read(args) {
    const raw = String(args.page ?? '');
    if (!raw) return 'Missing required arg: page';
    const rel = raw.endsWith('.md') ? raw : `${raw}.md`;
    const normalized = normalize(rel).replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.includes('..') || normalized.startsWith('/')) {
      return `Rejected: path traversal in "${raw}"`;
    }
    try {
      return await readFile(join(paths.wiki, normalized), 'utf8');
    } catch {
      return `Page not found: wiki/${normalized}`;
    }
  },

  async cluster_run(args) {
    const command = String(args.command ?? '');
    if (!command) return 'Missing required arg: command';
    if (!isSafeReadCommand(command)) {
      return `cluster_run rejected: "${command}" is not in the cluster read whitelist.`;
    }
    try {
      const { stdout, stderr, exit } = await runRemote(command);
      return JSON.stringify({ stdout, stderr, exit }, null, 2);
    } catch (err) {
      return `cluster_run SSH error: ${(err as Error).message}`;
    }
  },

  async gpu_calculate(args) {
    const script = join(paths.bettyAi, 'models', 'gpu_calculator.py');
    const a: string[] = ['--model', String(args.model ?? ''), '--method', String(args.method ?? '')];
    if (args.dataset_tokens != null) a.push('--dataset-tokens', String(args.dataset_tokens));
    if (args.epochs != null) a.push('--epochs', String(args.epochs));
    const py = process.env.BETTY_PYTHON ?? 'python3';
    return new Promise<string>((resolve) => {
      const proc = spawn(py, [script, ...a], { cwd: paths.bettyAi });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));
      proc.on('close', (code) =>
        resolve(code === 0 ? stdout.trim() : `gpu_calculate failed (exit ${code}): ${stderr.trim()}`),
      );
      proc.on('error', (err) => resolve(`gpu_calculate spawn error: ${err.message}`));
    });
  },

  async slurm_recommend(args) {
    const { text } = await runSlurmRecommend({
      gpus: args.gpus != null ? Number(args.gpus) : undefined,
      cpus: args.cpus != null ? Number(args.cpus) : undefined,
      mem_gb: args.mem_gb != null ? Number(args.mem_gb) : undefined,
      hours: args.hours != null ? Number(args.hours) : undefined,
      partition: typeof args.partition === 'string' ? args.partition : undefined,
      qos: typeof args.qos === 'string' ? args.qos : undefined,
      interactive: args.interactive === true,
      min_vram_gb: args.min_vram_gb != null ? Number(args.min_vram_gb) : undefined,
    });
    return text;
  },

  async slurm_availability(args) {
    if (args.gpus == null || args.hours == null) {
      return 'slurm_availability requires both gpus and hours.';
    }
    const { text } = await runSlurmAvailability({
      gpus: Number(args.gpus),
      hours: Number(args.hours),
      partition: typeof args.partition === 'string' ? args.partition : undefined,
      earliest: typeof args.earliest === 'string' ? args.earliest : undefined,
      latest: typeof args.latest === 'string' ? args.latest : undefined,
    });
    return text;
  },

  async slurm_check(args) {
    const sbatch = String(args.sbatch ?? '');
    if (!sbatch.trim()) return 'slurm_check requires the sbatch script text.';
    const { text } = await runSlurmCheck(sbatch);
    return text;
  },

  async slurm_diagnose(args) {
    const jobId = String(args.job_id ?? '');
    if (!jobId.trim()) return 'slurm_diagnose requires a job_id.';
    const { text } = await runSlurmDiagnose(jobId);
    return text;
  },
};

export async function dispatchOpenAITool(name: string, rawArgs: string): Promise<string> {
  const handler = handlers[name];
  if (!handler) return `Unknown tool: ${name}`;
  let args: Record<string, unknown>;
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch (err) {
    return `Invalid JSON args for ${name}: ${(err as Error).message}`;
  }
  try {
    return await handler(args);
  } catch (err) {
    return `${name} threw: ${(err as Error).message}`;
  }
}
