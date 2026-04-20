/**
 * Unit tests for cluster_run.
 * Mocks the SSH transport so no real connection is ever opened.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runRemote = vi.fn();

vi.mock('../cluster/ssh', () => ({
  runRemote: (cmd: string) => runRemote(cmd),
  uploadFile: vi.fn(),
  closeConnection: vi.fn(),
  DEFAULT_SSH_HOST: 'fake',
}));

type ClusterRunModule = typeof import('./cluster-run');
let mod: ClusterRunModule;

beforeEach(async () => {
  runRemote.mockReset();
  mod = await import('./cluster-run');
});

afterEach(() => {
  vi.clearAllMocks();
});

async function callTool(command: string): Promise<{ text: string; isError?: boolean }> {
  // The tool() helper's handler is stored under `.handler`. Since this changes
  // across SDK versions, call through the ZodObject-compatible raw signature.
  const t = mod.clusterRunTool as unknown as {
    handler: (input: { command: string }, extra?: unknown) => Promise<{
      content: Array<{ type: string; text: string }>;
      isError?: boolean;
    }>;
  };
  const res = await t.handler({ command }, {});
  return { text: res.content[0]?.text ?? '', isError: res.isError };
}

describe('cluster_run tool', () => {
  it('rejects a non-whitelisted command without calling SSH', async () => {
    const res = await callTool('rm -rf /');
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/not in the cluster read whitelist/);
    expect(runRemote).not.toHaveBeenCalled();
  });

  it('rejects shell injection attempts without calling SSH', async () => {
    const res = await callTool('squeue -u jvadala; echo pwned');
    expect(res.isError).toBe(true);
    expect(runRemote).not.toHaveBeenCalled();
  });

  it('passes through a whitelisted command and returns JSON stdout/stderr/exit', async () => {
    runRemote.mockResolvedValueOnce({ stdout: 'JOBID 1\n', stderr: '', exit: 0 });
    const res = await callTool('squeue -u jvadala');
    expect(res.isError).toBeFalsy();
    expect(runRemote).toHaveBeenCalledWith('squeue -u jvadala');
    const parsed = JSON.parse(res.text);
    expect(parsed).toEqual({ stdout: 'JOBID 1\n', stderr: '', exit: 0 });
  });

  it('propagates SSH transport errors as an isError response', async () => {
    runRemote.mockRejectedValueOnce(new Error('ssh master exited'));
    const res = await callTool('sinfo');
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/SSH error/);
  });

  it('returns non-zero exit verbatim (does not throw)', async () => {
    runRemote.mockResolvedValueOnce({ stdout: '', stderr: 'bad', exit: 1 });
    const res = await callTool('sinfo');
    expect(res.isError).toBeFalsy();
    const parsed = JSON.parse(res.text);
    expect(parsed.exit).toBe(1);
    expect(parsed.stderr).toBe('bad');
  });
});
