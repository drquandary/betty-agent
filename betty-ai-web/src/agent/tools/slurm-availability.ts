/**
 * slurm_availability — propose ranked time slots for a desired GPU+wall request.
 *
 * Snapshots cluster state from `sinfo -h -o '%P %D %T %G'` (free GPUs per
 * partition, derived heuristically), feeds that plus the user's intent into
 * the Python availability ranker, and returns a list of candidate windows.
 *
 * The chat UI renders the result as a `betty-slurm-calendar` card — a compact
 * table the user can click. The user can also paste their own free-time
 * window via the optional `earliest`/`latest` ISO timestamps.
 */

import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { runRemote } from '../cluster/ssh';
import { renderRichCard, runSlurmCli } from './slurm-shared';

interface SnapshotInput {
  gpus_idle_by_partition: Record<string, number>;
  gpus_total_by_partition: Record<string, number>;
  pending_jobs_by_partition: Record<string, number>;
  /** Earliest SLURM-estimated start time per partition (ISO-8601). */
  next_start_by_partition: Record<string, string>;
  /** Provenance: which commands actually succeeded. Surfaced in the card. */
  sources: string[];
  blackouts: Array<{ start: string; end: string; partition?: string; reason?: string }>;
  /**
   * Fixed string asserting the privacy contract for `squeue --start`:
   * other users' job IDs are aggregated and dropped, never retained or
   * surfaced. Greppable so a policy reviewer can confirm at a glance.
   */
  privacy_posture: 'squeue-aggregated-no-per-job-data';
}

/**
 * Best-effort snapshot. Pulls TWO live signals:
 *   1. `sinfo` — idle/total GPUs per partition
 *   2. `squeue --start` — pending count per partition + earliest est. start
 *      (SLURM's own backfill simulator's prediction, when available)
 *
 * Each command is independent — if one fails, the other still contributes.
 * The `sources` field tells the agent (and the user) what's actually live
 * vs. what's missing, so the model doesn't have to guess.
 */
async function fetchSnapshot(): Promise<SnapshotInput> {
  const snap: SnapshotInput = {
    gpus_idle_by_partition: {},
    gpus_total_by_partition: {},
    pending_jobs_by_partition: {},
    next_start_by_partition: {},
    sources: [],
    blackouts: [],
    privacy_posture: 'squeue-aggregated-no-per-job-data',
  };

  // sinfo — partition-level GPU availability
  try {
    const { stdout, exit } = await runRemote('sinfo -h -o "%P|%D|%T|%G"');
    if (exit === 0) {
      const sinfo = parseSinfoForAvailability(stdout);
      if (sinfo) {
        snap.gpus_idle_by_partition = sinfo.gpus_idle_by_partition;
        snap.gpus_total_by_partition = sinfo.gpus_total_by_partition;
        snap.sources.push('sinfo');
      }
    }
  } catch {
    /* fall through — snap still has empty partitions, ranker handles it */
  }

  // scontrol show res — reservation windows that block placement on
  // specific partitions/nodes. We map active or near-future reservations
  // into BlackoutWindow entries so the slot ranker excludes them. Failure
  // is non-fatal: just no blackouts in the snapshot.
  //
  // Cache: reservations change rarely (planned maintenance windows are set
  // hours-to-days ahead). We don't cache here at the TS layer because each
  // chat turn spawns a fresh agent, but the upstream `runRemote`'s
  // ControlMaster reuses the SSH connection so the cost is one extra
  // command per turn (~100ms).
  try {
    const { stdout, exit } = await runRemote('scontrol show res');
    if (exit === 0) {
      const reservations = parseScontrolReservations(stdout);
      snap.blackouts = reservations;
      if (reservations.length > 0) {
        snap.sources.push('scontrol show res');
      }
    }
  } catch {
    /* fall through */
  }

  // squeue --start — pending depth + earliest start estimate per partition.
  // Format: JobID|Partition|StartTime  (StartTime = "N/A" if SLURM hasn't
  // simulated a slot yet, common for low-priority or blocked jobs).
  //
  // PRIVACY POSTURE (Ryan #6, 2026-04-27):
  //   The squeue command returns one row per pending job across the entire
  //   cluster, including OTHER users' job IDs. We MUST NOT retain or
  //   forward those per-job rows in any payload that reaches the LLM
  //   context, the chat UI, or the network response.
  //
  //   The flow:
  //     1. parseSqueueStart aggregates rows into two maps:
  //          pending_by_partition (count only)
  //          next_start_by_partition (earliest StartTime per partition only)
  //     2. The raw stdout is dropped at the end of this try block — never
  //        stored on `snap`.
  //     3. The aggregates contain ZERO job IDs and ZERO usernames.
  //
  //   The `privacy_posture` field below is set to a fixed string so a
  //   policy reviewer can grep for it and confirm the aggregation contract.
  try {
    const { stdout, exit } = await runRemote(
      'squeue -h --start -t PD -o "%i|%P|%S"',
    );
    if (exit === 0) {
      const queue = parseSqueueStart(stdout);
      snap.pending_jobs_by_partition = queue.pending_by_partition;
      snap.next_start_by_partition = queue.next_start_by_partition;
      snap.sources.push('squeue --start');
      // Note: `stdout` (the raw rows with other-user job IDs) goes out of
      // scope at the end of this block. parseSqueueStart's return type
      // does not include any per-job data — only the two aggregate maps.
    }
  } catch {
    /* fall through */
  }

  return snap;
}

interface SqueueStartParse {
  pending_by_partition: Record<string, number>;
  next_start_by_partition: Record<string, string>;
}


/**
 * Parse `scontrol show res` output into BlackoutWindow entries.
 *
 * Output format: blank-line-separated stanzas of space-separated `Key=Value`
 * tokens. Example:
 *   ReservationName=maintenance StartTime=2026-04-30T05:00:00
 *   EndTime=2026-04-30T11:00:00 Duration=06:00:00
 *   Nodes=dgx[001-027] PartitionName=dgx-b200 ...
 *
 * We extract: ReservationName (→ reason), StartTime, EndTime,
 * PartitionName (→ scoped blackout). Reservations without a Partition
 * field apply globally (partition: undefined). MAINT-flagged reservations
 * are explicitly labeled in the reason. Exposed for unit tests.
 */
export function parseScontrolReservations(text: string): Array<{
  start: string;
  end: string;
  partition?: string;
  reason: string;
}> {
  const blackouts: Array<{ start: string; end: string; partition?: string; reason: string }> = [];
  // Split on blank-line stanzas (scontrol delimits records with empty lines)
  const stanzas = text.split(/\n\s*\n/);
  for (const stanza of stanzas) {
    const fields: Record<string, string> = {};
    for (const tok of stanza.split(/\s+/)) {
      if (!tok.includes('=')) continue;
      const [k, ...rest] = tok.split('=');
      fields[k] = rest.join('=');
    }
    const start = fields.StartTime;
    const end = fields.EndTime;
    if (!start || !end || start === '(null)' || end === '(null)') continue;
    const name = fields.ReservationName || 'reservation';
    const flags = fields.Flags || '';
    const reason = flags.includes('MAINT')
      ? `${name} (MAINT)`
      : flags.includes('FLEX')
      ? `${name} (FLEX)`
      : name;
    // PartitionName="" or "(null)" means global; `undefined` partition in
    // BlackoutWindow signals "applies to all partitions".
    const partRaw = fields.PartitionName;
    const partition = partRaw && partRaw !== '(null)' && partRaw !== '' ? partRaw : undefined;
    blackouts.push({ start, end, partition, reason });
  }
  return blackouts;
}

/**
 * Parse `squeue -h --start -t PD -o "%i|%P|%S"` rows.
 * - Pending count per partition
 * - Earliest valid start time per partition (skips "N/A")
 * Exposed for unit tests.
 */
export function parseSqueueStart(text: string): SqueueStartParse {
  const pending: Record<string, number> = {};
  const earliest: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split('|');
    if (cols.length < 3) continue;
    const partition = cols[1].trim();
    const start = cols[2].trim();
    if (!partition) continue;
    pending[partition] = (pending[partition] ?? 0) + 1;
    if (start && start !== 'N/A') {
      const prev = earliest[partition];
      if (!prev || start < prev) {
        earliest[partition] = start;
      }
    }
  }
  return { pending_by_partition: pending, next_start_by_partition: earliest };
}

/**
 * Aggregate `sinfo -h -o "%P|%D|%T|%G"` rows into per-partition GPU counts.
 *
 * Each row: `<partition>|<#nodes>|<state>|<gres>`. We count GPUs as idle
 * when state is `idle` (or `idle*`); GPUs are extracted from `gres` like
 * `gpu:b200:8` or `gpu:b200_mig45_g:32` → N per node. The type-name char
 * class includes `_` because Slurm MIG profile names use underscores.
 */
export function parseSinfoForAvailability(
  text: string,
): Pick<SnapshotInput, 'gpus_idle_by_partition' | 'gpus_total_by_partition'> | null {
  const idle: Record<string, number> = {};
  const total: Record<string, number> = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const cols = line.split('|');
    if (cols.length < 4) continue;
    const partition = cols[0].replace(/\*$/, '');
    const nodes = parseInt(cols[1], 10);
    const state = cols[2].toLowerCase();
    const gres = cols[3];
    const gpuMatch = gres.match(/gpu(?::[a-z0-9_-]+)?:(\d+)/i);
    if (!gpuMatch) continue;
    const perNode = parseInt(gpuMatch[1], 10);
    if (!Number.isFinite(nodes) || !Number.isFinite(perNode)) continue;
    const gpus = nodes * perNode;
    total[partition] = (total[partition] ?? 0) + gpus;
    if (state.startsWith('idle')) {
      idle[partition] = (idle[partition] ?? 0) + gpus;
    }
  }
  return {
    gpus_idle_by_partition: idle,
    gpus_total_by_partition: total,
  };
}

export const slurmAvailabilityTool = tool(
  'slurm_availability',
  'Propose ranked candidate time-slots for a GPU+walltime request and return them as a calendar card. Combines current cluster idle state (sinfo) with hour-of-day load profile and any blackout windows. Use when the user is choosing WHEN to submit, not just what to submit.',
  {
    gpus: z.number().int().min(1).describe('GPUs needed for the slot.'),
    hours: z.number().min(0.5).max(168).describe('Walltime in hours.'),
    partition: z
      .string()
      .default('dgx-b200')
      .describe('Target partition.'),
    earliest: z
      .string()
      .optional()
      .describe('ISO-8601 earliest acceptable start (e.g. "2026-04-28T09:00:00Z"). Defaults to "now".'),
    latest: z
      .string()
      .optional()
      .describe('ISO-8601 latest acceptable start. Defaults to now+7d.'),
  },
  async ({ gpus, hours, partition, earliest, latest }) => {
    const snapshot = await fetchSnapshot();
    const payload = {
      gpus,
      hours,
      partition,
      earliest,
      latest,
      snapshot,
    };
    const { ok, stdout, stderr, code } = await runSlurmCli(
      'availability',
      [],
      JSON.stringify(payload),
    );
    if (!ok) {
      return {
        content: [{
          type: 'text',
          text: `slurm_availability failed (exit ${code}).\n${stderr}`,
        }],
        isError: true,
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(stdout);
    } catch {
      return {
        content: [{
          type: 'text',
          text: `slurm_availability returned non-JSON:\n${stdout}`,
        }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: renderRichCard('calendar', parsed) }],
    };
  },
  { annotations: { readOnlyHint: true, idempotentHint: false } },
);
