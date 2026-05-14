---
type: concept
tags: [betty, monitoring, dashboard, slurm, observability, betty-agent]
created: 2026-05-13
updated: 2026-05-13
status: current
related: [slurm-state-dimensionality, slurm-advisor]
---

# Monitoring tab

## One-line summary
A Datadog-style live Slurm health view inside the Betty AI dashboard — six cards bound to five Wave 2D parser routes, each polling at 60s, each backed by an SVG chart primitive (Sparkline / Donut / StackedBar / Heatmap) and a JSONL ringbuffer on disk for short-window history.

## What each card surfaces
- **PendingReasonsCard** — top SLURM `Reason` codes across the queue (Donut + table); source `squeue -h -o "%r"` aggregated by `/api/cluster/pending-reasons`.
- **BackfillCard** — backfill cycle timing, depth, last-run age (Sparkline); source `sdiag` backfill section parsed by `/api/cluster/sdiag`.
- **SchedulerRpcCard** — slurmctld RPC counts + average µs per RPC type (StackedBar); source `sdiag` RPC section parsed by `/api/cluster/sdiag`.
- **NodeHeatmapCard** — per-node state grid (idle / mix / alloc / drain / down / planned) across partitions (Heatmap); source `sinfo -N -h -o "%N %T %P"` parsed by `/api/cluster/nodes`.
- **JobOutcomeCard** — last 24h job exits by state (COMPLETED / FAILED / TIMEOUT / OOM / CANCELLED) (Donut + tally); source `sacct -X -S now-24hours` parsed by `/api/cluster/sacct-summary`.
- **FairshareCard** — per-job priority decomposition: fairshare, jobsize, age, partition, qos factors (StackedBar per job); source `sprio -hl` parsed by `/api/cluster/sprio`.

## Wiring
`AppShell.tsx` adds a `'monitoring'` branch to the view-switch (next to `dashboard`, `commands`, `workspace`); `TabStrip.tsx` carries the corresponding `DashboardView` union member and a tablist button. `MonitoringView.tsx` imports the six cards and renders them in a `lg:grid-cols-2` grid. URL hash `#monitoring` and `localStorage['betty-dashboard-view']='monitoring'` both round-trip; the hash takes precedence on mount.

## Testid contract
Two layers of test selectors are preserved so both Wave 1B slot tests and Wave 2E card tests keep working:
- Slot wrappers (Wave 1B): `monitoring-pending-reasons`, `monitoring-backfill-health`, `monitoring-scheduler-rpc`, `monitoring-node-states`, `monitoring-job-outcomes`, `monitoring-fairshare`.
- Card roots (Wave 2E): `pending-reasons-card`, `backfill-card`, `scheduler-rpc-card`, `node-heatmap-card`, `job-outcome-card`, `fairshare-card`.
The view container itself carries `data-testid="monitoring-view"`.

## Metrics ringbuffer
On each successful route response, `_shared/metrics.ts` appends a JSONL record to `<repo>/betty-ai/data/metrics/<endpoint>.jsonl` (24h ringbuffer; see [[slurm-state-dimensionality]] for what each axis captures and what it does not). Cards read recent history from these files to draw sparklines without waiting for a poll round-trip.

## Smoke harness
`npm run monitoring:smoke` from `betty-ai-web/` shells out to the local vitest binary scoped to the three contract surfaces (cards / charts / routes). Exit 0 = all green; exit 1 = at least one bucket failed (failing endpoints listed). Final line format:

```
monitoring smoke: 6/6 cards green, 5/5 routes green, 4/4 chart primitives green
```

The harness installs nothing, spawns no Next.js server, and uses the existing test files as the source of truth — keeping it stable as individual cards evolve. Source: `betty-ai-web/scripts/monitoring-smoke.mjs`.

## See also
- [[slurm-state-dimensionality]] — which Slurm dimensions Betty actually captures and which it does not
- [[slurm-advisor]] — the constraint-solver subsystem that the monitoring tab complements (advisor shapes jobs before submit; monitoring watches them after)
