import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NodeHeatmapCard } from './NodeHeatmapCard';

function makeFetch(payload: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  ) as unknown as typeof fetch;
}

function node(
  name: string,
  partition: string,
  state: 'idle' | 'mix' | 'alloc' | 'drain' | 'down' | 'maint' | 'resv' | 'other',
) {
  return {
    node: name,
    partition,
    state,
    flag: null,
    gpus: { type: 'b200', total: 8 },
    cpus: { alloc: 0, idle: 96, other: 0, total: 96 },
    memMb: 1_000_000,
    cpuLoad: 0.5,
    reason: null,
  };
}

describe('NodeHeatmapCard', () => {
  it('shows the loading placeholder before the fetch resolves', () => {
    const fetcher = vi.fn(() => new Promise<Response>(() => {})) as unknown as typeof fetch;
    render(<NodeHeatmapCard fetcher={fetcher} />);
    expect(screen.getByText(/checking sinfo/i)).toBeInTheDocument();
  });

  it('renders a heatmap cell per node and a stacked bar per partition', async () => {
    const fetcher = makeFetch({
      ok: true,
      nodes: [
        node('betty-b200-01', 'dgx-b200', 'idle'),
        node('betty-b200-02', 'dgx-b200', 'alloc'),
        node('betty-b200-03', 'dgx-b200', 'mix'),
        node('betty-mig-01', 'dgx-b200-mig', 'idle'),
      ],
    });
    render(<NodeHeatmapCard fetcher={fetcher} />);
    await waitFor(() => expect(screen.getByTestId('heatmap')).toBeInTheDocument());
    expect(screen.getAllByTestId('heatmap-cell').length).toBe(4);
    expect(screen.getByTestId('stacked-bar')).toBeInTheDocument();
    expect(screen.getAllByTestId('heatmap-row').length).toBe(2);
  });

  it('renders the error banner when ok:false', async () => {
    const fetcher = makeFetch({ ok: false, error: 'sinfo died', nodes: [] });
    render(<NodeHeatmapCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/Cluster unreachable/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/sinfo died/i)).toBeInTheDocument();
  });

  it('renders the empty state when nodes is empty', async () => {
    const fetcher = makeFetch({ ok: true, nodes: [] });
    render(<NodeHeatmapCard fetcher={fetcher} />);
    await waitFor(() =>
      expect(screen.getByText(/sinfo returned no nodes/i)).toBeInTheDocument(),
    );
  });
});
