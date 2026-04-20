/**
 * Unit tests for cluster_status — sacct parsing, squeue fallback, job_id
 * validation, state extraction, and optional wiki update.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runRemote = vi.fn();
const writeWikiPage = vi.fn();

vi.mock('../cluster/ssh', () => ({
  runRemote: (cmd: string) => runRemote(cmd),
  uploadFile: vi.fn(),
  closeConnection: vi.fn(),
  DEFAULT_SSH_HOST: 'fake',
}));

vi.mock('./wiki-write', () => ({
  writeWikiPage: (page: string, body: string, mode: string) =>
    writeWikiPage(page, body, mode),
}));

type ClusterStatusModule = typeof import('./cluster-status');
let mod: ClusterStatusModule;

beforeEach(async () => {
  runRemote.mockReset();
  writeWikiPage.mockReset();
  mod = await import('./cluster-status');
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('job_id validation', () => {
  it.each(['; rm -rf /', 'abc', '12 34', '1;2', ''])('rejects %s', async (jobId) => {
    const res = await mod.getClusterStatus({ job_id: jobId });
    expect(res.ok).toBe(false);
    expect(runRemote).not.toHaveBeenCalled();
  });

  it('accepts plain numeric and array-task forms', async () => {
    runRemote.mockResolvedValue({
      stdout: 'JobID|State|Elapsed|ExitCode|Submit|Start|End\n123|COMPLETED|00:05:00|0:0|...|...|...\n',
      stderr: '',
      exit: 0,
    });
    const a = await mod.getClusterStatus({ job_id: '123' });
    expect(a.ok).toBe(true);
    const b = await mod.getClusterStatus({ job_id: '123_5' });
    expect(b.ok).toBe(true);
  });
});

describe('parseSacctOutput', () => {
  it('parses pipe-delimited output with header', () => {
    const out = [
      'JobID|State|Elapsed|ExitCode|Submit|Start|End',
      '123|RUNNING|00:10:00|0:0|2026-04-17T12:00:00|2026-04-17T12:01:00|Unknown',
      '123.batch|RUNNING|00:10:00|0:0|2026-04-17T12:00:00|2026-04-17T12:01:00|Unknown',
    ].join('\n');
    const rows = mod.parseSacctOutput(out);
    expect(rows).toHaveLength(2);
    expect(rows[0].JobID).toBe('123');
    expect(rows[0].State).toBe('RUNNING');
    expect(rows[0].Elapsed).toBe('00:10:00');
  });

  it('returns [] on empty input', () => {
    expect(mod.parseSacctOutput('')).toEqual([]);
  });
});

describe('parseSqueueOutput', () => {
  it('maps two-letter state codes to canonical state strings', () => {
    const out = [
      '             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)',
      '               456 dgx-b200    myjob  jvadala  R       0:05      1 dgx-b200-01',
    ].join('\n');
    const rows = mod.parseSqueueOutput(out);
    expect(rows).toHaveLength(1);
    expect(rows[0].JobID).toBe('456');
    expect(rows[0].State).toBe('RUNNING');
  });
});

describe('extractState', () => {
  it('returns UNKNOWN when no rows', () => {
    expect(mod.extractState([])).toBe('UNKNOWN');
  });
  it('coalesces CANCELLED+ variants', () => {
    expect(mod.extractState([{ JobID: '1', State: 'CANCELLED by 1000' }])).toBe('CANCELLED');
  });
  it('returns first known state', () => {
    expect(
      mod.extractState([
        { JobID: '1', State: 'RUNNING' },
        { JobID: '1.batch', State: 'RUNNING' },
      ]),
    ).toBe('RUNNING');
  });
});

describe('getClusterStatus end-to-end', () => {
  it('returns sacct rows when sacct has data', async () => {
    runRemote.mockResolvedValueOnce({
      stdout:
        'JobID|State|Elapsed|ExitCode|Submit|Start|End\n999|COMPLETED|00:01:00|0:0|a|b|c\n',
      stderr: '',
      exit: 0,
    });
    const res = await mod.getClusterStatus({ job_id: '999' });
    expect(res.ok).toBe(true);
    expect(res.source).toBe('sacct');
    expect(res.state).toBe('COMPLETED');
    expect(res.rows[0].JobID).toBe('999');
  });

  it('falls back to squeue when sacct returns no rows', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({
      stdout: [
        '             JOBID PARTITION     NAME     USER ST       TIME  NODES NODELIST(REASON)',
        '               42 dgx-b200    myjob  jvadala PD       0:00      1 (Priority)',
      ].join('\n'),
      stderr: '',
      exit: 0,
    });
    const res = await mod.getClusterStatus({ job_id: '42' });
    expect(res.ok).toBe(true);
    expect(res.source).toBe('squeue');
    expect(res.state).toBe('PENDING');
  });

  it('updates the wiki page when experiment_slug+experiment_date are given', async () => {
    runRemote.mockResolvedValueOnce({
      stdout:
        'JobID|State|Elapsed|ExitCode|Submit|Start|End\n7|RUNNING|00:02:00|0:0|a|b|Unknown\n',
      stderr: '',
      exit: 0,
    });
    writeWikiPage.mockResolvedValueOnce({ ok: true, path: 'p', message: 'ok' });
    const res = await mod.getClusterStatus({
      job_id: '7',
      experiment_slug: 'my-exp',
      experiment_date: '2026-04-17',
    });
    expect(res.ok).toBe(true);
    expect(writeWikiPage).toHaveBeenCalledTimes(1);
    const [page, body, mode] = writeWikiPage.mock.calls[0];
    expect(page).toBe('experiments/2026-04-17-my-exp.md');
    expect(mode).toBe('update');
    expect(body).toContain('<!-- betty:auto-start -->');
    expect(body).toContain('<!-- betty:auto-end -->');
    expect(body).toContain('State: RUNNING');
  });

  it('does NOT call writeWikiPage without experiment_slug+date', async () => {
    runRemote.mockResolvedValueOnce({
      stdout: 'JobID|State|Elapsed|ExitCode|Submit|Start|End\n1|RUNNING|||||\n',
      stderr: '',
      exit: 0,
    });
    await mod.getClusterStatus({ job_id: '1' });
    expect(writeWikiPage).not.toHaveBeenCalled();
  });

  it('rejects when only experiment_slug is provided (no date)', async () => {
    const res = await mod.getClusterStatus({
      job_id: '1',
      experiment_slug: 'orphan',
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/experiment_slug and experiment_date must be provided together/);
    expect(runRemote).not.toHaveBeenCalled();
    expect(writeWikiPage).not.toHaveBeenCalled();
  });

  it('rejects when only experiment_date is provided (no slug)', async () => {
    const res = await mod.getClusterStatus({
      job_id: '1',
      experiment_date: '2026-04-18',
    });
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/experiment_slug and experiment_date must be provided together/);
    expect(runRemote).not.toHaveBeenCalled();
    expect(writeWikiPage).not.toHaveBeenCalled();
  });
});
