'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Heatmap } from '@/components/charts/Heatmap';
import { StackedBar } from '@/components/charts/StackedBar';
import { CHART_PALETTE } from '@/components/charts/palette';
import type { NodeRow, NodeBaseState } from '@/app/api/cluster/nodes/parse';

interface NodesPayload {
  ok: boolean;
  error?: string;
  nodes: NodeRow[];
}

interface Props {
  /** Inject a fetcher for tests; defaults to window.fetch. */
  fetcher?: typeof fetch;
}

const POLL_MS = 60_000;

const STATE_ORDER: NodeBaseState[] = [
  'idle',
  'mix',
  'alloc',
  'drain',
  'down',
  'maint',
  'resv',
  'other',
];

function stateColor(state: NodeBaseState): string {
  return CHART_PALETTE[state] ?? CHART_PALETTE.other;
}

export function NodeHeatmapCard({ fetcher }: Props = {}) {
  const [payload, setPayload] = useState<NodesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    const f = fetcher ?? fetch;
    try {
      const res = await f('/api/cluster/nodes', { cache: 'no-store' });
      const json = (await res.json()) as NodesPayload;
      setPayload(json);
      setLastUpdated(new Date());
    } catch (err) {
      setPayload({
        ok: false,
        error: err instanceof Error ? err.message : 'fetch failed',
        nodes: [],
      });
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const nodes = payload?.nodes ?? [];

  // Group nodes by partition, preserving partition encounter order, and sort
  // the nodes alphabetically inside each partition.
  const heatmapRows = useMemo(() => {
    const grouped = new Map<string, NodeRow[]>();
    for (const n of nodes) {
      let bucket = grouped.get(n.partition);
      if (!bucket) {
        bucket = [];
        grouped.set(n.partition, bucket);
      }
      bucket.push(n);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([partition, ns]) => ({
        label: partition,
        cells: ns
          .slice()
          .sort((a, b) => a.node.localeCompare(b.node))
          .map((n) => ({
            key: n.node,
            value: 1,
            label: `${n.state} - CPU ${n.cpus.alloc}/${n.cpus.total}`,
            color: stateColor(n.state),
          })),
      }));
  }, [nodes]);

  const stackedGroups = useMemo(() => {
    const grouped = new Map<string, Map<NodeBaseState, number>>();
    for (const n of nodes) {
      let inner = grouped.get(n.partition);
      if (!inner) {
        inner = new Map();
        grouped.set(n.partition, inner);
      }
      inner.set(n.state, (inner.get(n.state) ?? 0) + 1);
    }
    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([partition, counts]) => ({
        label: partition,
        segments: STATE_ORDER.filter((s) => (counts.get(s) ?? 0) > 0).map((s) => ({
          key: s,
          value: counts.get(s) ?? 0,
          color: stateColor(s),
        })),
      }));
  }, [nodes]);

  const isEmpty = payload?.ok && nodes.length === 0;

  return (
    <section
      data-testid="node-heatmap-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Node states
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Heatmap of nodes by partition, colored by Slurm state.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-zinc-600">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-zinc-300 transition hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </header>

      {loading ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">checking sinfo...</div>
      ) : payload && !payload.ok ? (
        <div className="rounded-lg border border-amber-400/25 bg-amber-400/5 px-3 py-2 text-[11.5px] text-amber-200">
          <span className="font-semibold">Cluster unreachable.</span>{' '}
          <span className="text-amber-200/80">{payload.error?.slice(0, 220)}</span>
        </div>
      ) : isEmpty ? (
        <div className="py-6 text-center text-[11.5px] text-zinc-600">
          sinfo returned no nodes.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="-mx-1 overflow-x-auto">
            <Heatmap rows={heatmapRows} ariaLabel="Nodes by partition" />
          </div>
          <div className="border-t border-white/5 pt-2">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              State counts per partition
            </div>
            <StackedBar
              groups={stackedGroups}
              legend
              height={Math.max(80, 22 * stackedGroups.length + 26)}
              ariaLabel="Node-state stack by partition"
            />
          </div>
        </div>
      )}
    </section>
  );
}
