import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ClusterOverviewCard } from './ClusterOverviewCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('ClusterOverviewCard', () => {
  it('renders partition rows from a successful response', async () => {
    const fetcher = makeFetch({
      ok: true,
      partitions: [
        {
          partition: 'dgx-b200',
          nodesIdle: 2,
          nodesTotal: 5,
          gpusIdle: 16,
          gpusTotal: 40,
          cpusAlloc: 288,
          cpusIdle: 192,
          cpusOther: 0,
          cpusTotal: 480,
        },
      ],
    });
    render(<ClusterOverviewCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText('dgx-b200')).toBeInTheDocument());
    expect(screen.getByText('16')).toBeInTheDocument();
    // GPU used = (40-16)/40 = 60% → label appears
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows an error banner when the API reports ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'ssh stale', partitions: [] });
    render(<ClusterOverviewCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument());
    expect(screen.getByText(/ssh stale/i)).toBeInTheDocument();
  });

  it('shows empty state when there are no partitions but ok:true', async () => {
    const fetcher = makeFetch({ ok: true, partitions: [] });
    render(<ClusterOverviewCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByText(/No partitions reported/i)).toBeInTheDocument());
  });
});
