---
type: entity
tags: [betty, partition, cpu, amd, epyc]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, genoa-lrg-mem-partition, slurm-on-betty, betty-billing-model]
status: current
---

# genoa-std-mem Partition

## One-line summary
Betty's default CPU partition: 64 AMD EPYC Genoa nodes with 64 cores and ~340 GB RAM each.

## Key specs
- **Nodes**: 64 (`epyc-1-*`, `epyc-2-*`, ..., `epyc-6-*`)
- **CPU**: AMD EPYC Genoa, 64 cores/node (2 sockets x 32 cores)
- **RAM/node**: ~340 GB (347,851 MB)
- **Max nodes/job**: 15
- **Max walltime**: 7 days
- **Default memory**: 5120 MB/CPU (max 6144 MB/CPU)
- **Allowed QOS**: `normal`, `genoa-std` (640 CPU), `cpu-max` (960 CPU), `wharton`
- **Billing weight**: CPU=10 (cheapest compute)
- **Default partition**: yes — jobs without `-p` land here

See `betty-ai/configs/betty_cluster.yaml`.

## When to use
- Agent-based modeling (Mesa, NetLogo, Repast HPC)
- Classical HPC / MPI workloads
- Data preprocessing, dataset curation
- Parameter sweeps via Slurm job arrays
- Bioinformatics pipelines (alignment, assembly, variant calling)

## Typical usage
```bash
#SBATCH --partition=genoa-std-mem
#SBATCH --ntasks=64
#SBATCH --mem=300G
#SBATCH --time=24:00:00
```

## See also
- [[genoa-lrg-mem-partition]]
- [[betty-cluster]]
- [[slurm-on-betty]]
- [[betty-billing-model]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
