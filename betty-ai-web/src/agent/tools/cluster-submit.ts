/**
 * cluster_submit — upload an sbatch script, submit it, and atomically log the
 * experiment to the wiki.
 *
 * Input: { script_body, sbatch_args?, experiment_slug }
 *
 * Flow:
 *   1. Sanitize slug + sbatch_args.
 *   2. `mkdir -p` the remote scripts dir (trusted internal runRemote — the
 *      whitelist is for the user-facing cluster_run tool only, not for internal
 *      sequences whose arguments are validated at this tool's input boundary).
 *   3. Upload the script via uploadFile().
 *   4. `sbatch <args> <path>` (trusted internal runRemote — same rationale).
 *   5. Parse JobID from stdout.
 *   6. Atomically create wiki/experiments/YYYY-MM-DD-<slug>.md and append a
 *      line to wiki/log.md. If any wiki write fails, the error surfaces the
 *      JobID so the user can recover manually.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runRemote, uploadFile } from '../cluster/ssh';
import { writeWikiPage } from './wiki-write';

export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;
// Each sbatch_args entry must be a single shell token. Accepts three forms:
//   1) long flag w/ value: --partition=dgx-b200
//   2) short flag:          -p
//   3) bare value token:    dgx-b200   (paired with a preceding flag token)
// Split pairs (`-p dgx-b200`) work by passing two array elements.
export const SBATCH_ARG_RE = /^-{0,2}[a-zA-Z0-9][a-zA-Z0-9_=,.:/+\-]*$/;
const REMOTE_SCRIPTS_DIR = '/vast/home/j/jvadala/.betty-ai/scripts';
const JOB_ID_RE = /Submitted batch job (\d+)/;

export function todayUtcDate(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function nowUtcTimestamp(now: Date = new Date()): string {
  const date = todayUtcDate(now);
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mm = String(now.getUTCMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mm}`;
}

function nowUtcIso(now: Date = new Date()): string {
  return now.toISOString();
}

export interface ClusterSubmitInput {
  script_body: string;
  sbatch_args?: string[];
  experiment_slug: string;
  name?: string;
  description?: string;
}

export interface ClusterSubmitResult {
  ok: boolean;
  job_id?: string;
  experiment_page?: string;
  remote_script_path?: string;
  message: string;
}

export function buildExperimentBody(opts: {
  slug: string;
  jobId: string;
  scriptBody: string;
  date: string;
  createdIso: string;
  name?: string;
  description?: string;
}): string {
  const { slug, jobId, scriptBody, date, createdIso, name, description } = opts;
  const title = name ?? slug;
  const desc = description ?? `Experiment ${slug} submitted as SLURM job ${jobId}.`;
  return [
    '---',
    'type: experiment',
    `name: ${title}`,
    `description: ${desc}`,
    'status: submitted',
    `job_id: ${jobId}`,
    `created: ${createdIso}`,
    `updated: ${createdIso}`,
    `slug: ${slug}`,
    `date: ${date}`,
    '---',
    '',
    `# ${title}`,
    '',
    '## Goal',
    '',
    '<!-- user-owned: fill in the research goal -->',
    '',
    '## Script',
    '',
    '```bash',
    scriptBody.replace(/\r\n/g, '\n').replace(/\s+$/, ''),
    '```',
    '',
    '## Status',
    '',
    '<!-- betty:auto-start -->',
    `- Submitted: ${createdIso}`,
    `- Job ID: ${jobId}`,
    '- State: PENDING',
    '<!-- betty:auto-end -->',
    '',
    '## Runtime',
    '',
    '<!-- betty:auto-start -->',
    '- (no runtime data yet; cluster_status will populate this)',
    '<!-- betty:auto-end -->',
    '',
    '## Lessons',
    '',
    '<!-- user-owned: record what you learned -->',
    '',
  ].join('\n');
}

export async function submitClusterJob(
  input: ClusterSubmitInput,
  now: Date = new Date(),
): Promise<ClusterSubmitResult> {
  const { script_body, sbatch_args = [], experiment_slug } = input;

  if (!SLUG_RE.test(experiment_slug)) {
    return {
      ok: false,
      message: `Rejected: experiment_slug "${experiment_slug}" must match /^[a-z0-9][a-z0-9-]{0,63}$/i (lowercase alphanumerics + hyphen).`,
    };
  }
  for (const arg of sbatch_args) {
    if (typeof arg !== 'string' || !SBATCH_ARG_RE.test(arg)) {
      return {
        ok: false,
        message: `Rejected: sbatch_args contains unsafe value "${arg}". Each entry must be a single token matching /^-{0,2}[a-zA-Z0-9][a-zA-Z0-9_=,.:/+\\-]*$/ (flag or bare value; pass split pairs as two entries).`,
      };
    }
  }

  const slug = experiment_slug.toLowerCase();
  const date = todayUtcDate(now);
  const remotePath = `${REMOTE_SCRIPTS_DIR}/${date}-${slug}.sbatch`;

  // 1. Ensure remote dir. Trusted internal command — bypasses isSafeReadCommand.
  try {
    const mk = await runRemote(`mkdir -p ${REMOTE_SCRIPTS_DIR}`);
    if (mk.exit !== 0) {
      return {
        ok: false,
        message: `mkdir -p ${REMOTE_SCRIPTS_DIR} failed (exit ${mk.exit}): ${mk.stderr.trim() || '(no stderr)'}`,
      };
    }
  } catch (err) {
    return { ok: false, message: `SSH error on mkdir: ${(err as Error).message}` };
  }

  // 2. Upload the script body.
  try {
    await uploadFile(script_body, remotePath);
  } catch (err) {
    return { ok: false, message: `Upload failed: ${(err as Error).message}` };
  }

  // 3. sbatch. Trusted internal — args are regex-validated above.
  const sbatchCmd = ['sbatch', ...sbatch_args, remotePath]
    .filter((t) => t.length > 0)
    .join(' ');
  let sbatchStdout = '';
  let sbatchStderr = '';
  try {
    const res = await runRemote(sbatchCmd);
    sbatchStdout = res.stdout;
    sbatchStderr = res.stderr;
    if (res.exit !== 0) {
      return {
        ok: false,
        remote_script_path: remotePath,
        message: `sbatch failed (exit ${res.exit}): ${sbatchStderr.trim() || sbatchStdout.trim() || '(no output)'}`,
      };
    }
  } catch (err) {
    return {
      ok: false,
      remote_script_path: remotePath,
      message: `SSH error on sbatch: ${(err as Error).message}`,
    };
  }

  const m = JOB_ID_RE.exec(sbatchStdout);
  if (!m) {
    return {
      ok: false,
      remote_script_path: remotePath,
      message: `sbatch succeeded but JobID could not be parsed from stdout: ${JSON.stringify(sbatchStdout)}`,
    };
  }
  const jobId = m[1];

  // 4. Atomic wiki log. Errors after this point MUST surface the JobID.
  const experimentPage = `experiments/${date}-${slug}.md`;
  const createdIso = nowUtcIso(now);
  const body = buildExperimentBody({
    slug,
    jobId,
    scriptBody: script_body,
    date,
    createdIso,
    name: input.name,
    description: input.description,
  });

  const createRes = await writeWikiPage(experimentPage, body, 'create');
  if (!createRes.ok) {
    return {
      ok: false,
      job_id: jobId,
      remote_script_path: remotePath,
      message: `sbatch succeeded (JobID ${jobId}) but wiki create of ${experimentPage} failed: ${createRes.message}. Recover by manually tracking JobID ${jobId}.`,
    };
  }

  const ts = nowUtcTimestamp(now);
  const logLine = `- ${ts} submitted ${slug} as job ${jobId}\n`;
  const appendRes = await writeWikiPage('log.md', logLine, 'append');
  if (!appendRes.ok) {
    return {
      ok: false,
      job_id: jobId,
      experiment_page: experimentPage,
      remote_script_path: remotePath,
      message: `sbatch succeeded (JobID ${jobId}) and experiment page created at ${experimentPage}, but wiki/log.md append failed: ${appendRes.message}. JobID ${jobId} tracked on the experiment page.`,
    };
  }

  return {
    ok: true,
    job_id: jobId,
    experiment_page: experimentPage,
    remote_script_path: remotePath,
    message: `Submitted ${slug} as SLURM job ${jobId}. Logged to wiki/${experimentPage}.`,
  };
}

export const clusterSubmitTool = tool(
  'cluster_submit',
  'Submit an sbatch script to the Betty cluster. Uploads the script body to /vast/home/j/jvadala/.betty-ai/scripts/<date>-<slug>.sbatch, runs sbatch, parses the JobID, and atomically files wiki/experiments/<date>-<slug>.md plus a line in wiki/log.md. `experiment_slug` must be lowercase alphanumeric + hyphen. `sbatch_args` entries must each be plain flags like "--time=01:00:00" (no quoting, no spaces).',
  {
    script_body: z.string().min(1).describe('Full sbatch script contents (shebang + #SBATCH directives + commands).'),
    sbatch_args: z
      .array(z.string())
      .optional()
      .describe('Additional sbatch flags, e.g. ["--time=01:00:00", "--qos=standard"]. Each must be a single token.'),
    experiment_slug: z
      .string()
      .min(1)
      .describe('Kebab-case slug identifying the experiment, e.g. "llama3-8b-lora-test". Used in filenames and the wiki page.'),
    name: z.string().optional().describe('Human-readable name for the experiment page frontmatter.'),
    description: z.string().optional().describe('Short description for the experiment page frontmatter.'),
  },
  async (input) => {
    const res = await submitClusterJob(input);
    return {
      content: [
        {
          type: 'text',
          text: res.ok
            ? JSON.stringify(
                {
                  job_id: res.job_id,
                  experiment_page: res.experiment_page,
                  remote_script_path: res.remote_script_path,
                },
                null,
                2,
              )
            : res.message,
        },
      ],
      isError: res.ok ? undefined : true,
    };
  },
  {
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
    },
  },
);
