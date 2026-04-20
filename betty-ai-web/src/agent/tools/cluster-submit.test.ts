/**
 * Unit tests for cluster_submit.
 *
 * Mocks both the SSH transport and the wiki-write helper so we exercise slug
 * validation, sbatch_args validation, sbatch stdout parsing, remote path
 * construction, and atomicity (sbatch failure → no wiki write; wiki failure →
 * error includes JobID).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runRemote = vi.fn();
const uploadFile = vi.fn();
const writeWikiPage = vi.fn();

vi.mock('../cluster/ssh', () => ({
  runRemote: (cmd: string) => runRemote(cmd),
  uploadFile: (content: unknown, path: string) => uploadFile(content, path),
  closeConnection: vi.fn(),
  DEFAULT_SSH_HOST: 'fake',
}));

vi.mock('./wiki-write', () => ({
  writeWikiPage: (page: string, body: string, mode: string) =>
    writeWikiPage(page, body, mode),
}));

type ClusterSubmitModule = typeof import('./cluster-submit');
let mod: ClusterSubmitModule;

beforeEach(async () => {
  runRemote.mockReset();
  uploadFile.mockReset();
  writeWikiPage.mockReset();
  mod = await import('./cluster-submit');
});

afterEach(() => {
  vi.clearAllMocks();
});

const FIXED_DATE = new Date(Date.UTC(2026, 3, 17, 14, 30, 0)); // 2026-04-17 14:30 UTC

function mkScript() {
  return '#!/bin/bash\n#SBATCH -J test\necho hello\n';
}

describe('slug validation', () => {
  it.each(['has space', 'BAD/slug', '../etc', 'UPPER!CASE', '', '-leading-dash'.replace('-l', '-')])(
    'rejects invalid slug %s',
    async (slug) => {
      const res = await mod.submitClusterJob(
        { script_body: mkScript(), experiment_slug: slug },
        FIXED_DATE,
      );
      expect(res.ok).toBe(false);
      expect(runRemote).not.toHaveBeenCalled();
      expect(uploadFile).not.toHaveBeenCalled();
    },
  );

  it('accepts a well-formed slug', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 }); // mkdir
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 42\n', stderr: '', exit: 0 }); // sbatch
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValueOnce({ ok: true, path: 'experiments/...', message: 'ok' });
    writeWikiPage.mockResolvedValueOnce({ ok: true, path: 'log.md', message: 'ok' });
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'llama3-8b-lora' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(true);
    expect(res.job_id).toBe('42');
  });
});

describe('sbatch_args validation', () => {
  it('rejects args with shell metacharacters', async () => {
    const res = await mod.submitClusterJob(
      {
        script_body: mkScript(),
        experiment_slug: 'ok-slug',
        sbatch_args: ['--time=01:00:00; rm -rf /'],
      },
      FIXED_DATE,
    );
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/unsafe/);
    expect(runRemote).not.toHaveBeenCalled();
  });

  it('accepts split flag/value pairs as separate tokens (e.g. "-p", "dgx-b200")', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 100\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValue({ ok: true, path: 'p', message: 'ok' });
    const res = await mod.submitClusterJob(
      {
        script_body: mkScript(),
        experiment_slug: 'ok-slug',
        sbatch_args: ['-p', 'dgx-b200', '-t', '01:00:00'],
      },
      FIXED_DATE,
    );
    expect(res.ok).toBe(true);
    const sbatchCall = runRemote.mock.calls[1][0];
    expect(sbatchCall).toContain('-p dgx-b200');
    expect(sbatchCall).toContain('-t 01:00:00');
  });

  it('accepts standard sbatch flags', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 99\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValue({ ok: true, path: 'p', message: 'ok' });
    const res = await mod.submitClusterJob(
      {
        script_body: mkScript(),
        experiment_slug: 'ok-slug',
        sbatch_args: ['--time=01:00:00', '--qos=standard', '--partition=dgx-b200'],
      },
      FIXED_DATE,
    );
    expect(res.ok).toBe(true);
    // Second call is sbatch
    const sbatchCall = runRemote.mock.calls[1][0];
    expect(sbatchCall).toContain('--time=01:00:00');
    expect(sbatchCall).toContain('--qos=standard');
    expect(sbatchCall).toContain('dgx-b200');
  });
});

describe('remote path construction', () => {
  it('builds /vast/home/j/jvadala/.betty-ai/scripts/YYYY-MM-DD-<slug>.sbatch', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 7\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValue({ ok: true, path: 'p', message: 'ok' });

    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'my-exp' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(true);
    expect(uploadFile).toHaveBeenCalledWith(
      expect.any(String),
      '/vast/home/j/jvadala/.betty-ai/scripts/2026-04-17-my-exp.sbatch',
    );
    expect(res.remote_script_path).toBe(
      '/vast/home/j/jvadala/.betty-ai/scripts/2026-04-17-my-exp.sbatch',
    );
  });
});

describe('JobID parsing', () => {
  it('parses JobID from "Submitted batch job NNNN"', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({
      stdout: 'Submitted batch job 123456\n',
      stderr: '',
      exit: 0,
    });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValue({ ok: true, path: 'p', message: 'ok' });
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'slug' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(true);
    expect(res.job_id).toBe('123456');
  });

  it('errors when sbatch stdout is malformed', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'something went sideways\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'slug' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/could not be parsed/);
    expect(writeWikiPage).not.toHaveBeenCalled();
  });
});

describe('atomicity', () => {
  it('does NOT touch the wiki when sbatch fails', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 }); // mkdir ok
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: 'sbatch: invalid account', exit: 1 });
    uploadFile.mockResolvedValueOnce(undefined);
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'slug' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/sbatch failed/);
    expect(writeWikiPage).not.toHaveBeenCalled();
  });

  it('surfaces JobID when wiki create fails after successful sbatch', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 500\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValueOnce({
      ok: false,
      path: 'x',
      message: 'disk full',
    });
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'slug' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(false);
    expect(res.job_id).toBe('500');
    expect(res.message).toContain('500');
    expect(res.message).toMatch(/wiki create/);
  });

  it('surfaces JobID when log.md append fails after successful create', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: '', exit: 0 });
    runRemote.mockResolvedValueOnce({ stdout: 'Submitted batch job 501\n', stderr: '', exit: 0 });
    uploadFile.mockResolvedValueOnce(undefined);
    writeWikiPage.mockResolvedValueOnce({ ok: true, path: 'p', message: 'ok' }); // create
    writeWikiPage.mockResolvedValueOnce({ ok: false, path: 'log.md', message: 'perm' }); // append
    const res = await mod.submitClusterJob(
      { script_body: mkScript(), experiment_slug: 'slug' },
      FIXED_DATE,
    );
    expect(res.ok).toBe(false);
    expect(res.job_id).toBe('501');
    expect(res.experiment_page).toBe('experiments/2026-04-17-slug.md');
  });
});

describe('buildExperimentBody', () => {
  it('emits required frontmatter + marker-delimited Status/Runtime', () => {
    const body = mod.buildExperimentBody({
      slug: 'x',
      jobId: '1',
      scriptBody: 'echo hi',
      date: '2026-04-17',
      createdIso: '2026-04-17T00:00:00.000Z',
    });
    expect(body).toMatch(/^---\ntype: experiment\n/);
    expect(body).toMatch(/name:/);
    expect(body).toMatch(/description:/);
    expect(body).toMatch(/job_id: 1/);
    expect(body).toMatch(/## Status/);
    expect(body).toMatch(/## Runtime/);
    expect((body.match(/<!-- betty:auto-start -->/g) ?? []).length).toBe(2);
    expect((body.match(/<!-- betty:auto-end -->/g) ?? []).length).toBe(2);
    expect(body).toContain('echo hi');
  });
});
