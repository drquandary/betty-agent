import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UserStatsCard } from './UserStatsCard';

const PAYLOAD_BY_PATH: Record<string, unknown> = {
  '/api/cluster/cost': {
    ok: true,
    accounts: [
      { account: 'foo-betty', spentPc: 50, allocatedPc: 100, usedPct: 50 },
    ],
  },
  '/api/cluster/quota': {
    ok: true,
    rows: [{ filesystem: '/vast/home/j/jvadala', used: '100 GiB', quota: '500 GiB', usedPct: 20 }],
    raw: '',
  },
  '/api/cluster/jobs': {
    ok: true,
    jobs: [
      { jobId: '1', partition: 'dgx-b200', name: 'a', state: 'RUNNING', elapsed: '00:01', timeLeft: '01:00', reasonOrNode: '' },
      { jobId: '2', partition: 'dgx-b200', name: 'b', state: 'PENDING', elapsed: '00:00', timeLeft: '02:00', reasonOrNode: 'Priority' },
    ],
  },
};

function multiFetch(map: Record<string, unknown>): typeof fetch {
  return vi.fn(async (url: RequestInfo | URL) => {
    const key = typeof url === 'string' ? url : url.toString();
    const payload = map[key] ?? { ok: false, error: 'unmocked' };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as unknown as typeof fetch;
}

describe('UserStatsCard', () => {
  it('renders cost, storage, and jobs tiles', async () => {
    render(<UserStatsCard fetcher={multiFetch(PAYLOAD_BY_PATH)} />);
    await waitFor(() => expect(screen.getByText(/foo-betty/i)).toBeInTheDocument());
    // Tile titles (exact strings to avoid colliding with the card subtitle).
    expect(screen.getByText('Compute budget')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Active jobs')).toBeInTheDocument();
    // Headline values.
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1R')).toBeInTheDocument();
    expect(screen.getByText('1P')).toBeInTheDocument();
  });

  it('renders unavailable state when an endpoint reports ok:false', async () => {
    const broken = {
      ...PAYLOAD_BY_PATH,
      '/api/cluster/cost': { ok: false, accounts: [], error: 'no kerberos' },
    };
    render(<UserStatsCard fetcher={multiFetch(broken)} />);
    await waitFor(() => expect(screen.getAllByText(/unavailable/i)[0]).toBeInTheDocument());
  });
});
