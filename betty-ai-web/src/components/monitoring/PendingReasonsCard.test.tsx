import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { PendingReasonsCard } from './PendingReasonsCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('PendingReasonsCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<PendingReasonsCard fetcher={fetcher} />);
    expect(screen.getByText(/checking squeue/i)).toBeInTheDocument();
  });

  it('renders a donut from a populated payload', async () => {
    const fetcher = makeFetch({
      ok: true,
      data: {
        byReason: [
          { reason: 'Priority', count: 12 },
          { reason: 'Resources', count: 7 },
          { reason: 'AssocGrpCpuLimit', count: 3 },
        ],
        byPartition: [
          {
            partition: 'dgx-b200',
            reasons: [
              { reason: 'Priority', count: 8 },
              { reason: 'Resources', count: 4 },
            ],
          },
        ],
        total: 22,
        privacy_posture: 'squeue-aggregated-no-user-or-jobid',
      },
    });
    render(<PendingReasonsCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByTestId('donut')).toBeInTheDocument());
    expect(screen.getAllByTestId('donut-slice').length).toBe(3);
    expect(screen.getAllByText('22').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Total pending/i)).toBeInTheDocument();
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'ssh refused', data: null });
    render(<PendingReasonsCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/ssh refused/i)).toBeInTheDocument();
  });

  it('renders the empty state when total is zero', async () => {
    const fetcher = makeFetch({
      ok: true,
      data: {
        byReason: [],
        byPartition: [],
        total: 0,
        privacy_posture: 'squeue-aggregated-no-user-or-jobid',
      },
    });
    render(<PendingReasonsCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/No pending jobs reported/i)).toBeInTheDocument(),
    );
  });
});
