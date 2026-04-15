---
type: entity
tags: [betty, partition, cpu, amd, epyc, large-memory]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, genoa-std-mem-partition, slurm-on-betty, betty-billing-model]
status: current
---

# genoa-lrg-mem Partition

## One-line summary
10-node large-memory CPU partition — AMD EPYC Genoa nodes with ~1 TB RAM each for memory-bound workloads.

## Key specs
- **Nodes**: 10 (`epyc-lg-[1-10]`)
- **CPU**: AMD EPYC Genoa, 64 cores/node
- **RAM/node**: ~1 TB (Slurm reports 104,458 MB which is likely a reporting artifact)
- **Max nodes/job**: 2
- **Max walltime**: 7 days
- **Default memory**: 15,872 MB/CPU (max 18,432 MB/CPU)
- **Allowed QOS**: `normal`, `genoa-lrg` (128 CPU), `wharton`
- **Billing weight**: CPU=15 (50% premium over std-mem)

See `betty-ai/configs/betty_cluster.yaml`.

## When to use
- Large in-memory datasets (genomics, graph analytics)
- CPU-offloaded LLM training (DeepSpeed ZeRO-3 offload prep — rare)
- Anything needing >340 GB RAM per node
- Single-node memory-intensive jobs

## When NOT to use
- GPU workloads (use [[dgx-b200-partition]] / MIG partitions)
- Jobs that fit in 340 GB — use [[genoa-std-mem-partition]] instead

## See also
- [[genoa-std-mem-partition]]
- [[betty-cluster]]
- [[betty-billing-model]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
