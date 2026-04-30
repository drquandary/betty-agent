/**
 * Unit tests for slurm_availability's parsers — sinfo aggregation and the
 * new squeue --start parser. We keep these pure-function tests so they
 * don't need to touch the SSH transport.
 */

import { describe, expect, it } from 'vitest';
import { parseSshareDefensive } from './slurm-recommend';
import {
  parseScontrolReservations,
  parseSinfoForAvailability,
  parseSqueueStart,
} from './slurm-availability';

describe('parseSinfoForAvailability', () => {
  it('aggregates GPUs per partition from typed gres', () => {
    const text = [
      'dgx-b200|10|idle|gpu:b200:8',
      'dgx-b200|17|alloc|gpu:b200:8',
      'b200-mig45|1|idle|gpu:b200_mig45_g:32',
    ].join('\n');
    const snap = parseSinfoForAvailability(text);
    expect(snap).not.toBeNull();
    expect(snap!.gpus_total_by_partition['dgx-b200']).toBe((10 + 17) * 8);
    expect(snap!.gpus_idle_by_partition['dgx-b200']).toBe(10 * 8);
    expect(snap!.gpus_total_by_partition['b200-mig45']).toBe(32);
    expect(snap!.gpus_idle_by_partition['b200-mig45']).toBe(32);
  });

  it('strips default-partition asterisk', () => {
    const text = 'genoa-std-mem*|64|idle|(null)';
    const snap = parseSinfoForAvailability(text);
    // No GPU gres -> partition not added at all (CPU-only is fine for advisor)
    expect(snap!.gpus_total_by_partition['genoa-std-mem']).toBeUndefined();
  });

  it('treats idle* as idle', () => {
    const text = 'dgx-b200|3|idle*|gpu:b200:8';
    const snap = parseSinfoForAvailability(text);
    expect(snap!.gpus_idle_by_partition['dgx-b200']).toBe(24);
  });
});

describe('parseSqueueStart', () => {
  it('counts pending jobs per partition', () => {
    const text = [
      '111|dgx-b200|2026-04-28T22:00:00',
      '112|dgx-b200|N/A',
      '113|b200-mig45|2026-04-27T18:30:00',
    ].join('\n');
    const out = parseSqueueStart(text);
    expect(out.pending_by_partition['dgx-b200']).toBe(2);
    expect(out.pending_by_partition['b200-mig45']).toBe(1);
  });

  it('records earliest start, skipping N/A', () => {
    const text = [
      '101|dgx-b200|N/A',
      '102|dgx-b200|2026-04-28T22:00:00',
      '103|dgx-b200|2026-04-28T15:00:00',
    ].join('\n');
    const out = parseSqueueStart(text);
    // Lexicographic-on-ISO works for dates within the same century
    expect(out.next_start_by_partition['dgx-b200']).toBe('2026-04-28T15:00:00');
  });

  it('handles empty input', () => {
    const out = parseSqueueStart('');
    expect(out.pending_by_partition).toEqual({});
    expect(out.next_start_by_partition).toEqual({});
  });

  it('skips malformed rows', () => {
    const text = [
      '101|dgx-b200|2026-04-28T22:00:00',
      'garbage line without pipes',
      '|missing-jobid|2026-04-28T22:00:00',
    ].join('\n');
    const out = parseSqueueStart(text);
    expect(out.pending_by_partition['dgx-b200']).toBe(1);
  });
});

describe('parseSshareDefensive', () => {
  const cols = ['Account', 'User', 'RawShares', 'RawUsage', 'EffectvUsage', 'FairShare'];

  it('accepts well-formed sshare rows', () => {
    const text = [
      'parcc-jvadala|jvadala|1|12345.6|0.5|0.42',
      'parcc-jvadala|alice|1|9876.5|0.3|0.65',
    ].join('\n');
    const out = parseSshareDefensive(text, cols);
    expect(out.rows).toHaveLength(2);
    expect(out.dropped_count).toBe(0);
  });

  it('drops rows whose User column is a header word', () => {
    const text = [
      '|User|Path|Used|Limit|INodes Used',  // the symptom we observed live
      'parcc-jvadala|jvadala|1|12345.6|0.5|0.42',
    ].join('\n');
    const out = parseSshareDefensive(text, cols);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].User).toBe('jvadala');
    expect(out.dropped_count).toBe(1);
    expect(out.dropped_samples[0]).toContain('header-row');
  });

  it('drops rows where numeric columns are not numeric', () => {
    const text = [
      'parcc-jvadala|jvadala|1|not-a-number|junk|also-junk',
    ].join('\n');
    const out = parseSshareDefensive(text, cols);
    expect(out.rows).toHaveLength(0);
    expect(out.dropped_count).toBe(1);
    expect(out.dropped_samples[0]).toContain('non-numeric');
  });

  it('drops MOTD-style preamble lines', () => {
    const text = [
      'Last login: Mon Apr 27 09:15:00 2026 from 130.91.56.129',
      'You have new mail in /var/spool/mail/jvadala',
      'parcc-jvadala|jvadala|1|12345.6|0.5|0.42',
    ].join('\n');
    const out = parseSshareDefensive(text, cols);
    expect(out.rows).toHaveLength(1);
    expect(out.dropped_count).toBe(2);
  });

  it('limits dropped_samples to 3 even when many rows are dropped', () => {
    const lines: string[] = [];
    for (let i = 0; i < 10; i++) lines.push(`junk-line-${i}`);
    const out = parseSshareDefensive(lines.join('\n'), cols);
    expect(out.dropped_count).toBe(10);
    expect(out.dropped_samples).toHaveLength(3);
  });

  it('preserves parent-account rows with empty FairShare', () => {
    // sshare emits parent-account rows with no FairShare value; these are
    // legitimate and the parser must not reject them as malformed.
    const text = [
      'parcc-jvadala|jvadala|1|9999.0|0.5|',  // empty FairShare ok
    ].join('\n');
    const out = parseSshareDefensive(text, cols);
    expect(out.rows).toHaveLength(1);
  });
});

describe('parseScontrolReservations', () => {
  it('parses a maintenance window with partition scope', () => {
    const text = [
      'ReservationName=weekly-maint StartTime=2026-04-30T05:00:00',
      'EndTime=2026-04-30T11:00:00 Duration=06:00:00',
      'Nodes=dgx[001-027] PartitionName=dgx-b200 Flags=MAINT',
    ].join(' ');
    const out = parseScontrolReservations(text);
    expect(out).toHaveLength(1);
    expect(out[0].start).toBe('2026-04-30T05:00:00');
    expect(out[0].end).toBe('2026-04-30T11:00:00');
    expect(out[0].partition).toBe('dgx-b200');
    expect(out[0].reason).toContain('MAINT');
  });

  it('handles global reservations without PartitionName', () => {
    const text = [
      'ReservationName=cluster-wide-reboot StartTime=2026-05-15T22:00:00',
      'EndTime=2026-05-16T02:00:00 PartitionName=(null) Flags=MAINT',
    ].join(' ');
    const out = parseScontrolReservations(text);
    expect(out).toHaveLength(1);
    expect(out[0].partition).toBeUndefined();
  });

  it('separates multiple reservation stanzas', () => {
    const text = [
      'ReservationName=res-a StartTime=2026-04-30T05:00:00 EndTime=2026-04-30T11:00:00 PartitionName=dgx-b200',
      '',
      '',
      'ReservationName=res-b StartTime=2026-05-01T05:00:00 EndTime=2026-05-01T11:00:00 PartitionName=b200-mig45',
    ].join('\n');
    const out = parseScontrolReservations(text);
    expect(out).toHaveLength(2);
    expect(out[0].partition).toBe('dgx-b200');
    expect(out[1].partition).toBe('b200-mig45');
  });

  it('skips reservations with null timestamps', () => {
    const text = [
      'ReservationName=invalid StartTime=(null) EndTime=2026-05-01T00:00:00',
    ].join(' ');
    const out = parseScontrolReservations(text);
    expect(out).toHaveLength(0);
  });

  it('returns empty array on empty input', () => {
    expect(parseScontrolReservations('')).toEqual([]);
  });
});
