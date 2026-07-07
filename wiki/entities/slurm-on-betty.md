---
type: entity
tags: [betty, slurm, scheduler, qos]
created: 2026-04-08
updated: 2026-07-07
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide, 2026-04-21-parcc-ops-discussion, 2026-07-07-teams-chats-digest]
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

## Licenses — B200 gating
Betty gates full-B200 allocation with a Slurm **`Licenses=`** resource (a `b200` license pool), requested by jobs via `-L` / `--licenses` and tracked cluster-wide independent of per-node gres. This is a second admission axis on top of gres/QOS: a job can only land on a DGX node if a b200 license is also free.
- **Failure mode observed (7/7):** the license pool drifted out of sync with real capacity — **8 DGX nodes sat idle while `b200` licenses read as exhausted**, stranding GPUs the scheduler wouldn't fill (Jamie Schnaitter). Symptom of a **stale/leaked / mis-accounted license count**.
- **Root cause (7/7, Chaney/Schnaitter):** the original `b200` total was **928 = 29 × 8 × 4** (nodes × GPUs/node × 4). The desync is a **MIG-accounting mismatch** — **MIG jobs consume 1 license per MIG *slice* rather than 1 per B200**, so heavy MIG usage drains the pool faster than a per-B200 count anticipates, exhausting licenses while whole DGX nodes still sit idle. Ken **updated the `job_submit` script** to fix the accounting bugs, but the fix **does not update already-running jobs**, so the pool can stay artificially exhausted until in-flight jobs drain.
- **Mitigation applied:** the license count may legitimately **exceed** the GPU count (real allocation is gated by other limiting factors too), and over-provisioning is harmless — Ken proposed **+50% on all three** license pools; **Jamie raised `b200` to 2000** (CPU pools left as-is). Watch whether the higher cap + fixed `job_submit` clears the stranding.
- **Debug path:** `scontrol show lic` to see Total/Used/Free per license; compare against actually-idle DGX GPUs (`sinfo`, `parcc_sfree.py`); reconcile the total if it has leaked. Same stranded-capacity class as the [[2026-04-17-dgx002-gpu5-oversubscription]] gres incident, but at the license layer rather than gres.

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
- [[slurm-gres-conf]] — how GPU devices are declared to slurmd
- [[slurm-node-state-modifiers]] — decoding `mix-`, `alloc*`, `idle~`, etc.
- [[slurm-select-type-parameters]] — current `CR_Core_Memory`; open question about adding `CR_Pack_Nodes`
- [[interact-script-vs-salloc]] — why `interact` reloads the profile
- [[2026-04-17-dgx002-gpu5-oversubscription]] — GPU double-booking incident

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
- [[2026-04-21-parcc-ops-discussion]]
