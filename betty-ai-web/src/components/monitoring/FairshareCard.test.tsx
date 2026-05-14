import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { FairshareCard } from './FairshareCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

describe('FairshareCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<FairshareCard fetcher={fetcher} />);
    expect(screen.getByText(/checking sprio/i)).toBeInTheDocument();
  });

  it('renders a stacked bar per pending job', async () => {
    const fetcher = makeFetch({
      ok: true,
      jobs: [
        {
          jobId: '4242',
          account: 'parcc-test',
          priority: 10500,
          age: 2500,
          fairshare: 6000,
          jobSize: 1000,
          partition: 'dgx-b200',
          qos: 500,
          tres: 'cpu=10',
          normalized: 0.42,
        },
        {
          jobId: '4243',
          account: 'parcc-test',
          priority: 8000,
          age: 1500,
          fairshare: 5000,
          jobSize: 800,
          partition: 'compute',
          qos: 400,
          tres: 'cpu=4',
        },
      ],
    });
    render(<FairshareCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByTestId('stacked-bar')).toBeInTheDocument());
    expect(screen.getAllByTestId('stacked-bar-row').length).toBe(2);
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'sprio unavailable', jobs: [] });
    render(<FairshareCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/sprio unavailable/i)).toBeInTheDocument();
  });

  it('renders the friendly empty state when jobs is empty', async () => {
    const fetcher = makeFetch({ ok: true, jobs: [] });
    render(<FairshareCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(
        screen.getByText(/no pending jobs - you're either running or queued/i),
      ).toBeInTheDocument(),
    );
  });
});
