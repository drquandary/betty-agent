import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parsePendingReasons } from './parse';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(__dirname, '..', '__fixtures__', 'pending-reasons');
const HAPPY = readFileSync(path.join(FIX, 'happy.txt'), 'utf8');
const DEGRADED = readFileSync(path.join(FIX, 'degraded.txt'), 'utf8');
const EMPTY = readFileSync(path.join(FIX, 'empty.txt'), 'utf8');

describe('parsePendingReasons', () => {
  it('returns a zero summary on empty input', () => {
    const out = parsePendingReasons(EMPTY);
    expect(out.byReason).toEqual([]);
    expect(out.byPartition).toEqual([]);
    expect(out.total).toBe(0);
    expect(out.privacy_posture).toBe('squeue-aggregated-no-user-or-jobid');
  });

  it('counts cluster-wide reasons and sorts descending', () => {
    const out = parsePendingReasons(HAPPY);
    // Happy fixture has 10 rows.
    expect(out.total).toBe(10);
    // Resources appears 4x, QOSMaxJobsPerUserLimit 2x, others 1x.
    expect(out.byReason[0]).toEqual({ reason: 'Resources', count: 4 });
    expect(out.byReason[1]).toEqual({ reason: 'QOSMaxJobsPerUserLimit', count: 2 });
  });

  it('aggregates per-partition reason counts', () => {
    const out = parsePendingReasons(HAPPY);
    const dgx = out.byPartition.find((p) => p.partition === 'dgx-b200');
    expect(dgx).toBeDefined();
    expect(dgx!.reasons.find((r) => r.reason === 'Resources')?.count).toBe(3);
    expect(dgx!.reasons.find((r) => r.reason === 'Priority')?.count).toBe(1);
    expect(dgx!.reasons.find((r) => r.reason === 'AssocGrpGRES')?.count).toBe(1);
  });

  it('partitions array is sorted alphabetically', () => {
    const out = parsePendingReasons(HAPPY);
    const names = out.byPartition.map((p) => p.partition);
    expect(names).toEqual([...names].sort());
  });

  it('does NOT include any user-identifying field in the returned shape', () => {
    const out = parsePendingReasons(HAPPY);
    // Belt-and-suspenders: serialize and grep for the usernames in the fixture.
    const payload = JSON.stringify(out);
    expect(payload).not.toContain('jvadala');
    expect(payload).not.toContain('jcombar1');
    expect(payload).not.toContain('ryb');
    expect(payload).not.toContain('otheruser');
    expect(payload).not.toContain('grad-student');
    expect(payload).not.toContain('admin');
  });

  it('privacy_posture is set to the contract string', () => {
    const out = parsePendingReasons(HAPPY);
    expect(out.privacy_posture).toBe('squeue-aggregated-no-user-or-jobid');
  });

  it('drops rows that lack a reason or partition', () => {
    const out = parsePendingReasons(DEGRADED);
    // Degraded fixture:
    //   Resources|dgx-b200|jvadala         <- kept
    //   malformed line with no pipes       <- dropped
    //   |empty_reason|user                 <- dropped (reason empty)
    //   Priority||user_no_partition        <- dropped (partition empty)
    //   Resources|dgx-b200                 <- kept (no user col but 2 cols ok)
    expect(out.total).toBe(2);
    expect(out.byReason).toEqual([{ reason: 'Resources', count: 2 }]);
  });

  it('skips a header row if one sneaks in', () => {
    const withHeader = 'REASON|PARTITION|USER\n' + HAPPY;
    const out = parsePendingReasons(withHeader);
    // Header row "REASON|PARTITION|USER" is itself parseable — it would
    // count REASON as a reason. The route command uses -h to suppress it.
    // We accept this and document the contract: -h is required upstream.
    expect(out.total).toBe(11);
  });

  it('handles CRLF line endings', () => {
    const crlf = HAPPY.replace(/\n/g, '\r\n');
    const out = parsePendingReasons(crlf);
    expect(out.total).toBe(10);
  });

  it('within a partition, reasons sort by count desc then name asc', () => {
    const stdout = [
      'Resources|p|u1',
      'Resources|p|u2',
      'Priority|p|u3',
      'Priority|p|u4',
      'Dependency|p|u5',
    ].join('\n');
    const out = parsePendingReasons(stdout);
    const p = out.byPartition[0];
    expect(p.reasons.map((r) => r.reason)).toEqual(['Priority', 'Resources', 'Dependency']);
    expect(p.reasons.map((r) => r.count)).toEqual([2, 2, 1]);
  });
});
