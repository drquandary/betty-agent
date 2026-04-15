---
type: entity
tags: [betty, slurm, scheduler, qos]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, betty-billing-model, parcc-helper-tools]
status: current
---

# Slurm on Betty

## One-line summary
Betty runs Slurm 24.11.7 with backfill scheduling, per-partition QOS limits, and PC-minute billing via TRES weights.

## Cluster-wide limits
- **Slurm version**: 24.11.7
- **Scheduler**: `sched/backfill`, 30-sec time slices
- **Max jobs (cluster-wide)**: 100,000
- **Max array size**: 15,001
- **Default partition**: [[genoa-std-mem-partition]]

## QOS levels (our account: `jcombar1-betty-testing`)
| QOS | Max CPUs | Max GPUs | Use case |
|-----|----------|----------|----------|
| `normal` | 160 | 8 | Default |
| `dgx` | — | 32 | Large multi-GPU |
| `gpu-max` | — | 40 | Max GPU |
| `mig` | — | 8 | MIG slices |
| `mig-max` | — | 40 | Max MIG |
| `genoa-std` | 640 | — | CPU standard |
| `genoa-lrg` | 128 | — | Large-memory CPU |
| `cpu-max` | 960 | — | Max CPU |
| `wharton` | — | — | Wharton allocation |
| `icml-2026` | — | — | Conference deadline |

## Partitions
- [[dgx-b200-partition]] — full B200, billing GPU=1000
- [[b200-mig45-partition]] — 45 GB MIG, GPU=250
- [[b200-mig90-partition]] — 90 GB MIG, GPU=500
- [[genoa-std-mem-partition]] — CPU default, CPU=10
- [[genoa-lrg-mem-partition]] — ~1 TB RAM, CPU=15

See [[betty-billing-model]] for how weights convert to PC minutes.

## Typical commands
```bash
squeue -u jvadala
sinfo
parcc_sfree.py
parcc_sqos.py
scontrol show job <JOBID>
sacct -j <JOBID> --format=JobID,Elapsed,MaxRSS,State
scancel <JOBID>
```

## Good citizenship
- Never train on login nodes — always `srun` / `sbatch`
- Release interactive sessions when done (`scancel`)
- Tight `--time` gets you backfilled faster

## See also
- [[betty-cluster]]
- [[parcc-helper-tools]]
- [[betty-billing-model]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
