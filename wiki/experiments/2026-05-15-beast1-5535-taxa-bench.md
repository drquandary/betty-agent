---
type: experiment
tags: [beast1, beagle, benchmarking, dna, mcmc, deep-tree, fp64, dgx-b200, genoa-std-mem]
created: 2026-05-13
updated: 2026-05-15
model: []
dataset: [5535-taxa-dna]
method: beast1-mcmc
job_id: (see Appendix)
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]
related: [beast2-on-betty, beast1-on-betty, beagle-tuning, beagle-gpu-tuning, beast-checkpointing, 2026-05-15-beast2-ha-wild-aves-bench, 2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]
status: current
---

# Exp 2026-05-15: BEAST1 5535-taxa bench

## Goal
<!-- (user) -->
Find the optimal BEAST1 v1.10.4 configuration on Betty for a 5535-taxa DNA phylogenetics analysis. Specifically: does the deeper tree push the workload into GPU's sweet spot (vs the contrasting [[2026-05-15-beast2-ha-wild-aves-bench]] case where it doesn't), and what precision is required?

## Status
<!-- betty:auto-start -->
Completed 2026-05-14. Bench cells listed below. Working dir: `/vast/projects/ryb/parcc-data-science/tests/beast1/`.
<!-- betty:auto-end -->

## Runtime
<!-- betty:auto-start -->
~6 GPU-hours + ~8 Genoa-core-hours total. Plus several rapid crash-restart cycles while diagnosing FP32 underflow (see below).
<!-- betty:auto-end -->

## Dataset

- 5535 taxa (vs 690 patterns for the BEAST2 HA dataset — much deeper tree)
- DNA, 4-state
- Working dir: `/vast/projects/ryb/parcc-data-science/tests/beast1/`

## Key gotcha — FP32 underflow

The first GPU jobs crashed within ~3 seconds of starting the chain. The 5535-taxa tree is deep enough that FP32 partials underflow during likelihood propagation; BEAST returns NaN and exits.

**Fix:** `-beagle_double -beagle_scaling dynamic`. See [[beagle-tuning]] for details.

Rule of thumb: ≥3k taxa with a coalescent prior → always use `-beagle_double` on GPU. Cheap to leave on always for deep-tree work.

## Config matrix

All runs used `arch/b200` module bundle (BEAGLE 4.0.1 pre-release, BEAST1 v1.10.4).

| Partition | Device flags | `-threads` | Result |
|-----------|--------------|-----------:|--------|
| [[dgx-b200-partition]] | `-beagle_GPU` *(FP32)* | 1 | **CRASH** in 3s — NaN likelihood underflow |
| [[dgx-b200-partition]] | `-beagle_GPU -beagle_double -beagle_scaling dynamic` | 1 | **~1.73× over CPU baseline** (GPU winner) |
| [[genoa-std-mem-partition]] `-c 1` | `-beagle_CPU -beagle_SSE` | 1 | Baseline |
| [[genoa-std-mem-partition]] `-c 4` | `-beagle_CPU -beagle_SSE` | 4 | Slower than `-threads 1` (same threading landmine as BEAST2 — see [[2026-05-15-beast2-ha-wild-aves-bench]]) |

## Key findings

1. **GPU wins on this dataset** because tree depth gives the device enough branch-level parallelism to amortize launch overhead. Contrast with the 690-pattern BEAST2 case where CPU wins. Roughly matches the Ayres et al. 2019 (BEAGLE 3) inflection: more compute per BEAGLE call = GPU pulls ahead.
2. **`-beagle_double` is non-negotiable** for trees this deep. The FP32 crash is fast and obvious (~3s) which is self-correcting, but production scripts should bake it in from day one to avoid the diagnostic round-trip.
3. **`-threads 1` still wins** even on GPU — the threading landmine from [[beagle-tuning]] applies to BEAST1 too.

## Production recipe

```bash
#SBATCH -p dgx-b200
#SBATCH --gres=gpu:1
#SBATCH -c 4
#SBATCH -t 3-00:00:00
#SBATCH --qos=dgx
#SBATCH -J b1-prod-gpu
#SBATCH -o slurm-%j.out

source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast2 beast1

beast -beagle -beagle_GPU -beagle_double -beagle_scaling dynamic \
      -save_every 1000000 -save_stem run.state \
      -overwrite -threads 1 run.xml
```

Note `-save_every` / `-save_stem` for checkpointing — BEAST1 does **not** auto-checkpoint, unlike BEAST2. See [[beast-checkpointing]].

Staged script: `/vast/projects/ryb/parcc-data-science/tests/beast1/b1_production_gpu.sh`

## Restart caveat — real Betty case

The first BEAST1 production run we received from the group ran for several days without checkpointing flags. When it died at walltime, it was **unrecoverable**. Always include `-save_every` from the first submission. See [[beast-checkpointing]] for the full pattern.

## Lessons
<!-- (user) -->
- Two BEAST datasets, two opposite recommendations: 690-pattern DNA → CPU wins, 5535-taxa DNA → GPU wins. The dataset shape matters more than the device. There is no "always use X" answer for BEAST on Betty.
- FP32 underflow vs FP64 isn't subtle — the crash is fast and obvious. Add `-beagle_double` to deep-tree production scripts from day one.
- BEAST1's lack of auto-checkpoint is a footgun that has bitten the group at least once. Treat `-save_every` as part of the canonical command line for BEAST1, same as `-beagle_GPU`.

## See also
- [[beast2-on-betty]] — phylogenetics workflow patterns on Betty (mostly written before this empirical work; some claims now refined by [[beagle-tuning]] and [[beagle-gpu-tuning]])
- [[beast1-on-betty]] — BEAST1 sibling page; contains a more detailed BEAST1 production recipe with the `beast1_checkpoint.sbatch.j2` slurm template
- [[beagle-gpu-tuning]] — GPU deep dive; this experiment's 1.73× speedup is one of the key data points there
- [[beagle-tuning]] — flag reference, including the FP64 / scaling discussion
- [[beast-checkpointing]] — `-save_every` / `-load_state` workflow
- [[cuda-mps]] — multi-chain GPU pattern (not yet benched on BEAST1 but flag-shape applies)
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] — original session source
- [[2026-05-15-beast2-ha-wild-aves-bench]] — contrasting case where CPU wins
- [[dgx-b200-partition]] / [[genoa-std-mem-partition]] / [[b200-mig90-partition]]
