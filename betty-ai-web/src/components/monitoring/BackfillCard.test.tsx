import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BackfillCard } from './BackfillCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('BackfillCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<BackfillCard fetcher={fetcher} />);
    expect(screen.getByText(/checking sdiag/i)).toBeInTheDocument();
  });

  it('renders KPI tiles and a sparkline from a populated payload', async () => {
    const fetcher = makeFetch({
      ok: true,
      data: {
        scheduler: {
          serverThreadCount: 8,
          agentQueueSize: 0,
          dbdAgentQueueSize: 0,
          lastCycleMs: 12.5,
          meanCycleMs: 11.1,
          maxCycleMs: 99.9,
        },
        backfill: {
          lastCycleMs: 142.3,
          meanCycleMs: 122.6,
          maxCycleMs: 1043.0,
          lastDepthTried: 87,
          lastDepthTriedSched: 42,
          totalBackfilledJobs: 14523,
        },
        rpc: [],
        generatedAt: 'Mon Apr 27 14:32:09 2026',
        raw_sections: [],
      },
    });
    render(<BackfillCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText(/last cycle/i)).toBeInTheDocument());
    expect(screen.getByText(/142.3ms/)).toBeInTheDocument();
    expect(screen.getByText(/122.6ms/)).toBeInTheDocument();
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText(/14.5k/)).toBeInTheDocument();
    expect(screen.getByTestId('sparkline')).toBeInTheDocument();
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'sdiag stale', data: null });
    render(<BackfillCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/sdiag stale/i)).toBeInTheDocument();
  });

  it('renders the empty state when data is null', async () => {
    const fetcher = makeFetch({ ok: true, data: null });
    render(<BackfillCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/sdiag returned no backfill stats/i)).toBeInTheDocument(),
    );
  });
});
