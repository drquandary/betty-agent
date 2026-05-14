import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SchedulerRpcCard } from './SchedulerRpcCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('SchedulerRpcCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<SchedulerRpcCard fetcher={fetcher} />);
    expect(screen.getByText(/checking sdiag/i)).toBeInTheDocument();
  });

  it('renders the top-5 RPC table from a populated payload', async () => {
    const fetcher = makeFetch({
      ok: true,
      data: {
        scheduler: {
          serverThreadCount: 8,
          agentQueueSize: 0,
          dbdAgentQueueSize: 0,
          lastCycleMs: 1,
          meanCycleMs: 1,
          maxCycleMs: 1,
        },
        backfill: {
          lastCycleMs: 1,
          meanCycleMs: 1,
          maxCycleMs: 1,
          lastDepthTried: 1,
          lastDepthTriedSched: 1,
          totalBackfilledJobs: 1,
        },
        rpc: [
          { name: 'REQUEST_NODE_INFO', count: 1000, totalTimeMs: 4200 },
          { name: 'REQUEST_JOB_INFO', count: 800, totalTimeMs: 3600 },
          { name: 'REQUEST_PARTITION_INFO', count: 400, totalTimeMs: 1200 },
        ],
        generatedAt: null,
        raw_sections: [],
      },
    });
    render(<SchedulerRpcCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByTestId('scheduler-rpc-table')).toBeInTheDocument(),
    );
    expect(screen.getByText('REQUEST_NODE_INFO')).toBeInTheDocument();
    expect(screen.getByText('REQUEST_JOB_INFO')).toBeInTheDocument();
    expect(screen.getByText('REQUEST_PARTITION_INFO')).toBeInTheDocument();
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'sdiag unreachable', data: null });
    render(<SchedulerRpcCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/sdiag unreachable/i)).toBeInTheDocument();
  });

  it('renders the empty state when rpc is empty', async () => {
    const fetcher = makeFetch({
      ok: true,
      data: {
        scheduler: {
          serverThreadCount: 0,
          agentQueueSize: 0,
          dbdAgentQueueSize: 0,
          lastCycleMs: 0,
          meanCycleMs: 0,
          maxCycleMs: 0,
        },
        backfill: {
          lastCycleMs: 0,
          meanCycleMs: 0,
          maxCycleMs: 0,
          lastDepthTried: 0,
          lastDepthTriedSched: 0,
          totalBackfilledJobs: 0,
        },
        rpc: [],
        generatedAt: null,
        raw_sections: [],
      },
    });
    render(<SchedulerRpcCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/sdiag reported no RPC traffic/i)).toBeInTheDocument(),
    );
  });
});
