import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { JobOutcomeCard } from './JobOutcomeCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('JobOutcomeCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<JobOutcomeCard fetcher={fetcher} />);
    expect(screen.getByText(/checking sacct/i)).toBeInTheDocument();
  });

  it('renders a stacked bar per hour bucket and KPI tiles for totals', async () => {
    const fetcher = makeFetch({
      ok: true,
      hours: 24,
      data: {
        buckets: [
          {
            hour: '2026-04-27T12:00:00',
            completed: 3,
            failed: 1,
            timeout: 0,
            cancelled: 0,
            other: 0,
          },
          {
            hour: '2026-04-27T13:00:00',
            completed: 2,
            failed: 0,
            timeout: 1,
            cancelled: 1,
            other: 0,
          },
        ],
        totals: { completed: 5, failed: 1, timeout: 1, cancelled: 1, other: 0 },
        sampleCount: 8,
      },
    });
    render(<JobOutcomeCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByTestId('stacked-bar')).toBeInTheDocument());
    expect(screen.getAllByTestId('stacked-bar-row').length).toBe(2);
    // 5 outcomes in bucket 1 (2 non-zero) + bucket 2 (3 non-zero) = 5 segments
    expect(screen.getAllByTestId('stacked-bar-segment').length).toBe(5);
    // Per-totals KPIs (5 outcome labels)
    expect(screen.getAllByText('completed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('failed').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('timeout').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('cancelled').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('other').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'sacct timeout', data: null });
    render(<JobOutcomeCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/sacct timeout/i)).toBeInTheDocument();
  });

  it('renders the empty state when there are no buckets', async () => {
    const fetcher = makeFetch({
      ok: true,
      hours: 24,
      data: {
        buckets: [],
        totals: { completed: 0, failed: 0, timeout: 0, cancelled: 0, other: 0 },
        sampleCount: 0,
      },
    });
    render(<JobOutcomeCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(
        screen.getByText(/sacct returned no completions in the last 24h/i),
      ).toBeInTheDocument(),
    );
  });
});
