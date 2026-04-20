/**
 * cluster_status — poll SLURM for a job's status via `sacct`, falling back to
 * `squeue` when sacct has no record. Optionally updates the experiment page's
 * marker-delimited `## Status` section.
 *
 * `sacct` and `squeue` are invoked via `runRemote` directly (trusted internal)
 * — the job_id input is regex-validated at the tool boundary, so whitelist
 * validation (which is for the user-facing cluster_run tool) is not needed.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runRemote } from '../cluster/ssh';
import { writeWikiPage } from './wiki-write';

export const JOB_ID_RE = /^\d+(_\d+)?$/;
export const STATUS_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,63}$/i;

export type JobState =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'UNKNOWN';

const KNOWN_STATES = new Set<JobState>([
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
]);

export interface SacctRow {
  JobID: string;
  State: string;
  Elapsed?: string;
  ExitCode?: string;
  Submit?: string;
  Start?: string;
  End?: string;
  [key: string]: string | undefined;
}

export interface ClusterStatusResult {
  ok: boolean;
  rows: SacctRow[];
  state: JobState;
  source: 'sacct' | 'squeue' | 'none';
  raw: { stdout: string; stderr: string; exit: number };
  message?: string;
}

/**
 * Parse sacct's default pipe-delimited output when called with
 * `--format=JobID,State,Elapsed,ExitCode,Submit,Start,End`. sacct prints the
 * header row first (unless -n/--noheader). We auto-detect the header.
 */
export function parseSacctOutput(stdout: string): SacctRow[] {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  // Detect header: first line whose first column is literally "JobID".
  const headerIdx = lines.findIndex((l) => l.split('|')[0].trim() === 'JobID');
  let header: string[];
  let dataStart: number;
  if (headerIdx === -1) {
    // No header — assume default format.
    header = ['JobID', 'State', 'Elapsed', 'ExitCode', 'Submit', 'Start', 'End'];
    dataStart = 0;
  } else {
    header = lines[headerIdx].split('|').map((s) => s.trim());
    dataStart = headerIdx + 1;
  }
  const rows: SacctRow[] = [];
  for (let i = dataStart; i < lines.length; i++) {
    const cols = lines[i].split('|');
    if (cols.length === 1 && cols[0].trim() === '') continue;
    const row: SacctRow = { JobID: '', State: '' };
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = (cols[c] ?? '').trim();
    }
    if (row.JobID) rows.push(row);
  }
  return rows;
}

/**
 * squeue fallback parser. `squeue -j <id>` returns whitespace-columnar output
 * with a header like: JOBID PARTITION NAME USER ST TIME NODES NODELIST(REASON)
 */
export function parseSqueueOutput(stdout: string): SacctRow[] {
  const lines = stdout.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = lines[0].trim().split(/\s+/);
  const rows: SacctRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].trim().split(/\s+/);
    const row: SacctRow = { JobID: '', State: '' };
    for (let c = 0; c < header.length; c++) {
      row[header[c]] = cols[c] ?? '';
    }
    // squeue state is in column "ST" (two-letter code) — normalize common ones.
    const st = row['ST'] ?? '';
    const map: Record<string, JobState> = {
      PD: 'PENDING',
      R: 'RUNNING',
      CG: 'COMPLETED',
      CD: 'COMPLETED',
      F: 'FAILED',
      CA: 'CANCELLED',
    };
    if (st && map[st]) row.State = map[st];
    else if (st) row.State = st;
    row.JobID = row['JOBID'] ?? row['JobID'] ?? '';
    if (row.JobID) rows.push(row);
  }
  return rows;
}

export function extractState(rows: SacctRow[]): JobState {
  for (const row of rows) {
    const raw = (row.State ?? '').split(/\s+/)[0].toUpperCase();
    // Treat CANCELLED+ variants
    if (raw.startsWith('CANCELLED')) return 'CANCELLED';
    if (KNOWN_STATES.has(raw as JobState)) return raw as JobState;
  }
  return 'UNKNOWN';
}

export interface ClusterStatusInput {
  job_id: string;
  experiment_slug?: string;
  experiment_date?: string; // YYYY-MM-DD; if omitted, no wiki update
}

export async function getClusterStatus(
  input: ClusterStatusInput,
): Promise<ClusterStatusResult> {
  const { job_id } = input;
  if (!JOB_ID_RE.test(job_id)) {
    return {
      ok: false,
      rows: [],
      state: 'UNKNOWN',
      source: 'none',
      raw: { stdout: '', stderr: '', exit: -1 },
      message: `Rejected: job_id "${job_id}" must match /^\\d+(_\\d+)?$/`,
    };
  }
  // Wiki update requires both experiment_slug AND experiment_date. If only
  // one is provided, reject so the caller fixes the mistake instead of
  // silently skipping the update.
  const hasSlug = input.experiment_slug !== undefined;
  const hasDate = input.experiment_date !== undefined;
  if (hasSlug !== hasDate) {
    return {
      ok: false,
      rows: [],
      state: 'UNKNOWN',
      source: 'none',
      raw: { stdout: '', stderr: '', exit: -1 },
      message:
        'experiment_slug and experiment_date must be provided together (or both omitted). Got only one.',
    };
  }
  if (input.experiment_slug !== undefined && !STATUS_SLUG_RE.test(input.experiment_slug)) {
    return {
      ok: false,
      rows: [],
      state: 'UNKNOWN',
      source: 'none',
      raw: { stdout: '', stderr: '', exit: -1 },
      message: `Rejected: experiment_slug "${input.experiment_slug}" must match /^[a-z0-9][a-z0-9-]{0,63}$/i`,
    };
  }

  const sacctCmd = `sacct -j ${job_id} --format=JobID,State,Elapsed,ExitCode,Submit,Start,End --parsable2`;
  let raw: { stdout: string; stderr: string; exit: number };
  let rows: SacctRow[] = [];
  let source: 'sacct' | 'squeue' | 'none' = 'none';
  try {
    raw = await runRemote(sacctCmd);
    rows = parseSacctOutput(raw.stdout);
    if (rows.length > 0) {
      source = 'sacct';
    }
  } catch (err) {
    return {
      ok: false,
      rows: [],
      state: 'UNKNOWN',
      source: 'none',
      raw: { stdout: '', stderr: '', exit: -1 },
      message: `SSH error on sacct: ${(err as Error).message}`,
    };
  }

  if (rows.length === 0) {
    try {
      const sq = await runRemote(`squeue -j ${job_id}`);
      const sqRows = parseSqueueOutput(sq.stdout);
      if (sqRows.length > 0) {
        rows = sqRows;
        raw = sq;
        source = 'squeue';
      }
    } catch (err) {
      return {
        ok: false,
        rows: [],
        state: 'UNKNOWN',
        source: 'none',
        raw,
        message: `sacct returned no rows; squeue fallback failed: ${(err as Error).message}`,
      };
    }
  }

  const state = extractState(rows);

  if (input.experiment_slug && input.experiment_date) {
    const page = `experiments/${input.experiment_date}-${input.experiment_slug}.md`;
    const primary = rows[0] ?? {};
    const elapsed = primary.Elapsed ?? '';
    const exitCode = primary.ExitCode ?? '';
    const statusBody = [
      '## Status',
      '',
      '<!-- betty:auto-start -->',
      `- Updated: ${new Date().toISOString()}`,
      `- Job ID: ${job_id}`,
      `- State: ${state}`,
      elapsed ? `- Elapsed: ${elapsed}` : '',
      exitCode ? `- ExitCode: ${exitCode}` : '',
      `- Source: ${source}`,
      '<!-- betty:auto-end -->',
      '',
    ]
      .filter((l) => l !== '')
      .join('\n');
    // The wiki-write helper preserves user-owned sections via the marker
    // splice — we trust it and pass only the status block.
    await writeWikiPage(page, statusBody, 'update');
  }

  return {
    ok: true,
    rows,
    state,
    source,
    raw,
  };
}

export const clusterStatusTool = tool(
  'cluster_status',
  'Poll SLURM for a job\'s status. Runs `sacct -j <job_id> --format=JobID,State,Elapsed,ExitCode,Submit,Start,End`; falls back to `squeue -j <job_id>` if sacct has no record. Returns {rows, state, source}. If experiment_slug+experiment_date are provided, also updates wiki/experiments/<date>-<slug>.md Status section (user-owned sections preserved).',
  {
    job_id: z
      .string()
      .min(1)
      .describe('SLURM job id, e.g. "123456" or "123456_0" for array tasks.'),
    experiment_slug: z
      .string()
      .optional()
      .describe('Optional: if set, update the matching experiment page.'),
    experiment_date: z
      .string()
      .optional()
      .describe('Optional: YYYY-MM-DD prefix of the experiment page. Required alongside experiment_slug.'),
  },
  async (input) => {
    const res = await getClusterStatus(input);
    return {
      content: [
        {
          type: 'text',
          text: res.ok
            ? JSON.stringify(
                { state: res.state, source: res.source, rows: res.rows },
                null,
                2,
              )
            : `cluster_status error: ${res.message ?? '(unknown)'}`,
        },
      ],
      isError: res.ok ? undefined : true,
    };
  },
  {
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
    },
  },
);
