/**
 * Parser for `squeue -h -t PD -o "%r|%P|%u"`.
 *
 * The command intentionally OMITS `-u <user>` so it captures cluster-wide
 * context — "you're not alone, the entire dgx-b200 partition has 17 jobs
 * blocked on Resources right now". But surfacing other users' identifiers
 * would violate the same privacy contract documented in slurm-availability.ts:
 *
 *   "We MUST NOT retain or forward [other users'] per-job rows in any
 *    payload that reaches the LLM context, the chat UI, or the network
 *    response."
 *
 * So this parser AGGREGATES rows by (reason, partition) and DROPS the user
 * column entirely before returning. The `privacy_posture` field on the
 * return shape is a fixed greppable string so a policy reviewer can confirm
 * the contract at a glance.
 *
 * Lives outside route.ts because Next.js 15 rejects any non-route export
 * from a route module during build-time type validation.
 */

export interface PendingReasonCount {
  reason: string;
  count: number;
}

export interface PendingReasonsByPartition {
  partition: string;
  reasons: PendingReasonCount[];
}

export interface PendingReasonsSummary {
  /** Cluster-wide reason counts, sorted descending by count. */
  byReason: PendingReasonCount[];
  /** Per-partition reason counts, partition name alphabetical, reasons desc. */
  byPartition: PendingReasonsByPartition[];
  /** Total pending jobs (all users, all partitions) in the snapshot. */
  total: number;
  /** Fixed greppable string asserting the no-user-no-jobid contract. */
  privacy_posture: 'squeue-aggregated-no-user-or-jobid';
}

export function parsePendingReasons(stdout: string): PendingReasonsSummary {
  const byReason = new Map<string, number>();
  const byPartition = new Map<string, Map<string, number>>();
  let total = 0;

  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !line.includes('|')) continue;
    const cols = line.split('|');
    // Required: reason, partition. user (cols[2]) is read but NEVER retained.
    if (cols.length < 2) continue;
    const reason = cols[0].trim();
    const partition = cols[1].trim();
    if (!reason || !partition) continue;
    // cols[2] is the user column. We intentionally do not even bind it to a
    // variable, to make accidental retention impossible.
    total += 1;
    byReason.set(reason, (byReason.get(reason) ?? 0) + 1);
    let inner = byPartition.get(partition);
    if (!inner) {
      inner = new Map<string, number>();
      byPartition.set(partition, inner);
    }
    inner.set(reason, (inner.get(reason) ?? 0) + 1);
  }

  const byReasonArr: PendingReasonCount[] = Array.from(byReason.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason));

  const byPartitionArr: PendingReasonsByPartition[] = Array.from(byPartition.entries())
    .map(([partition, inner]) => ({
      partition,
      reasons: Array.from(inner.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count || a.reason.localeCompare(b.reason)),
    }))
    .sort((a, b) => a.partition.localeCompare(b.partition));

  return {
    byReason: byReasonArr,
    byPartition: byPartitionArr,
    total,
    privacy_posture: 'squeue-aggregated-no-user-or-jobid',
  };
}
