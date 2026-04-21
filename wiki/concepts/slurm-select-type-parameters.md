---
type: concept
tags: [slurm, scheduler, admin, betty, open-question]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-21-parcc-ops-discussion]
related: [slurm-on-betty]
status: tentative
---

# SLURM SelectTypeParameters on Betty

## One-line summary
`SelectTypeParameters` in `slurm.conf` controls how the `select/cons_tres` (or `select/cons_res`) plugin tracks and packs consumable resources; Betty is currently `CR_Core_Memory` and Jaime is weighing whether `CR_Pack_Nodes` would be better.

## Current setting (as of 2026-04-21)
```
SelectTypeParameters=CR_Core_Memory
```

## What the options mean (relevant subset)
| Flag | Effect |
|------|--------|
| `CR_CPU` | Treat CPUs (hardware threads) as the consumable unit. Memory not tracked. |
| `CR_Core` | Cores are consumable; memory not tracked. |
| `CR_CPU_Memory` | CPUs + memory both tracked per-job. |
| `CR_Core_Memory` | **Current Betty setting.** Cores + memory both tracked per-job. |
| `CR_Socket_Memory` | Whole sockets consumable; memory tracked. |
| `CR_Pack_Nodes` | Pack allocations onto the smallest number of nodes rather than spreading across many nodes. Combines with the `CR_*` units above. |
| `CR_LLN` | Prefer "least loaded node" — opposite of `Pack_Nodes`. |

## Jaime's open question
> "Should we be using `SelectTypeParameters=CR_Pack_Nodes`? (It is set to `CR_Core_Memory`)"

These flags are **not** mutually exclusive — `CR_Pack_Nodes` is typically specified **in addition to** `CR_Core_Memory`, e.g. `SelectTypeParameters=CR_Core_Memory,CR_Pack_Nodes`. So the real question is whether Betty should add packing behavior on top of core+memory accounting.

## Tradeoffs for a GPU-heavy cluster like Betty
**For `CR_Pack_Nodes`:**
- Consolidates fragmented small jobs onto fewer nodes, keeping other nodes fully free for large multi-GPU training.
- Tends to produce better GPU utilization for mixed workloads (a 1-GPU interactive session and a 1-GPU job are more likely to land on the same node).

**Against `CR_Pack_Nodes`:**
- Small jobs share NUMA / PCIe bandwidth / VAST NFS caches, so noisy-neighbor effects get worse.
- A single wedged job can affect more co-tenants.
- Harder to reason about performance reproducibility for benchmarks.

## Why this is `status: tentative`
We have not tested this on Betty. Jaime's instinct needs a test cluster ("this is when I would like to have a test cluster"). Do **not** recommend changing `SelectTypeParameters` on Betty until:
1. A test cluster or maintenance window exists to validate.
2. Current job-mix data (ratio of 1-GPU vs 8-GPU jobs) is reviewed — if the cluster is mostly full-node jobs anyway, `CR_Pack_Nodes` is a no-op.

## See also
- [[slurm-on-betty]]
- [[dgx-b200-partition]]
- Slurm docs: `slurm.conf(5)` — `SelectTypeParameters`

## Sources
- [[2026-04-21-parcc-ops-discussion]]
