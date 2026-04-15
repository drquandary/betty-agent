---
type: source
tags: [source, exploration, betty, audit]
created: 2026-04-08
updated: 2026-04-08
sources: []
related: [betty-cluster, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, vast-storage, parcc-helper-tools, open-ondemand-betty, slurm-on-betty, betty-billing-model]
status: current
---

# Source: 2026-04-08 — Betty Initial Exploration

## What it is
First full audit of the Betty cluster, conducted by jvadala via the Open OnDemand web shell. Captured hardware inventory, Slurm configuration, QOS limits, storage layout, available modules, helper tools, and known issues.

Primary raw output: `BETTY_SYSTEM_GUIDE.md` (see [[2026-04-08-betty-system-guide]] for the structured summary).

## Key findings
- 27 full DGX B200 nodes + 2 MIG nodes = 216 full B200 GPUs + 32 MIG-45 + 16 MIG-90
- 64 EPYC Genoa standard-mem CPU nodes + 10 large-mem nodes
- Single storage namespace (VAST over InfiniBand); no scratch filesystem
- Slurm 24.11.7 with backfill, PC-minute billing via TRES weights
- QOS: single user can scale from 8 GPU (normal) up to 40 GPU (gpu-max)
- Shared `pytorch` conda env is **outdated** (transformers 4.32.1)
- Open OnDemand is BETA; only Interactive Desktop available
- `interact` helper script is **broken** (references nonexistent `defq`)
- **dgx015** down, **dgx022** in invalid state
- Our account: `jcombar1-betty-testing`, 12,000 PC allocation

## Wiki pages created from this source
**Entities**
- [[betty-cluster]]
- [[dgx-b200-partition]]
- [[b200-mig45-partition]]
- [[b200-mig90-partition]]
- [[genoa-std-mem-partition]]
- [[genoa-lrg-mem-partition]]
- [[vast-storage]]
- [[parcc-helper-tools]]
- [[open-ondemand-betty]]
- [[slurm-on-betty]]

**Concepts**
- [[betty-billing-model]]

## Open questions
- Actual RAM on `epyc-lg-*` nodes (Slurm reports 104 GB)
- Is there a shared model cache path anywhere (`/vast/parcc/...`)?
- Are NGC containers available anywhere on the cluster?

## See also
- [[2026-04-08-betty-system-guide]]
- [[2026-04-08-betty-llm-workflows-guide]]
