---
type: source
tags: [source, guide, betty, reference]
created: 2026-04-08
updated: 2026-04-08
sources: []
related: [betty-cluster, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, vast-storage, parcc-helper-tools, open-ondemand-betty, slurm-on-betty, betty-billing-model]
status: current
---

# Source: 2026-04-08 — BETTY_SYSTEM_GUIDE.md

## What it is
The structured writeup of our initial Betty cluster audit. Lives at `BETTY_SYSTEM_GUIDE.md` in the repo root. Organized into 14 sections + node inventory appendix.

## Table of contents
1. System overview (OS, Slurm, OnDemand versions)
2. Hardware — compute partitions (GPU + CPU)
3. QOS limits + billing overview
4. Storage ([[vast-storage]])
5. Software environment (modules, Python, CUDA, MPI, containers)
6. PARCC helper tools ([[parcc-helper-tools]])
7. Open OnDemand ([[open-ondemand-betty]])
8. Access & authentication
9. Job submission quick reference
10. Network & architecture
11. Current cluster usage snapshot (2026-04-08)
12. Workflow recommendations
13. Key URLs & contacts
14. Known issues
- Appendix A: node inventory

## Key facts extracted
- DGX B200 node: 224 CPUs, ~202 GB Slurm RAM, 8x B200, InfiniBand
- EPYC Genoa node: 64 cores, ~340 GB std / ~1 TB lrg
- CUDA 13.1.0 available, GCC 13.3.0 default, Apptainer 1.4.1
- No PyTorch module — must use conda or containers
- Login nodes: Intel Xeon Gold 6548Y+ (128 CPUs, 503 GB)
- Snapshot: ~406 jobs in queue; most dgx nodes mixed; dgx023-027 idle

## Wiki pages created or updated from this source
Same as [[2026-04-08-betty-initial-exploration]] — this file IS the primary written artifact of that exploration session. Every entity page under `wiki/entities/` cites this source.

## See also
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-llm-workflows-guide]]
