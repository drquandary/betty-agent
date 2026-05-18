---
type: experiment
tags: [beast2, beagle, benchmarking, dna, mcmc, dgx-b200, genoa-std-mem, mig]
created: 2026-05-13
updated: 2026-05-15
model: []
dataset: [wild-aves-ha-690-patterns]
method: beast2-mcmc
job_id: (see Appendix)
sources: []
related: [beast2-on-betty, beagle-tuning, cuda-mps, beast-checkpointing, 2026-05-15-beast1-5535-taxa-bench]
status: current
---

# Exp 2026-05-15: BEAST2 wild-aves HA bench matrix

## Goal
<!-- (user) -->
Resolve the group's report that "GPU is 2× slower than CPU" for BEAST2 on a 690-pattern wild-aves influenza HA dataset, and produce a recommendation for the production run shape on Betty. Driver: external research group (jcombar1/ryb) needed a production recipe and the GPU-vs-CPU question had stalled them.

## Status
<!-- betty:auto-start -->
Completed 2026-05-14. 26 sbatch submissions across the 15-cell matrix between 2026-05-11 and 2026-05-14. Full per-job log preserved in `/vast/projects/ryb/parcc-data-science/jvadala-beast-bench/REPORT.md`.
<!-- betty:auto-end -->

## Runtime
<!-- betty:auto-start -->
Each cell ran for ~100k MCMC samples on a short chain to extrapolate `min/Msample`. Aggregate compute time: ~12 GPU-hours + ~30 Genoa-core-hours across all cells. Working dir: `/vast/projects/ryb/parcc-data-science/jvadala-beast-bench/`.
<!-- betty:auto-end -->

## Dataset

- XML: `main-intro_equal-time-loc_ha_empirical_targeted_1.xml`
- 690 site patterns, 4-state nucleotide
- Single partition
- HKY+Gamma site model
- SkyGrid coalescent prior
- TargetedBeast operators v1.0.0
- CoupledMCMC v1.2.2 available (not used in single-chain cells)

## Config matrix

All runs used `beast -beagle … <XML>` with the `arch/b200` module bundle (BEAGLE 4.0.1 pre-release, CUDA-enabled libbeagle, BEAST2 v2.7.7). All numbers are `min/Msample` extrapolated from the per-100k-sample line in stdout.

| # | Partition | Device flags | `-threads` | min/Msample | 500M-state ETA | Notes |
|---|-----------|--------------|-----------:|------------:|---------------:|-------|
| 1 | [[dgx-b200-partition]] | `-beagle_GPU` | 6 | **35.7** | 12.4 days | Original broken config the group reported |
| 2 | [[dgx-b200-partition]] | `-beagle_GPU` | 1 | 15.8 | 5.49 days | Fix threading → 2.26× speedup |
| 3 | [[dgx-b200-partition]] | `-beagle_GPU -beagle_multipartition auto` | 1 | 15.6 | 5.42 days | Marginal |
| 4 | [[genoa-std-mem-partition]] `-c 1` | `-beagle_CPU -beagle_SSE` | 1 | **14.2** | 4.93 days | **Single-chain winner** |
| 5 | [[genoa-std-mem-partition]] `-c 6` | `-beagle_CPU -beagle_SSE` | 6 | 22.4 | 7.78 days | Threading hurts on CPU too |
| 6 | [[genoa-std-mem-partition]] `-c 4` | `-beagle_CPU -beagle_SSE -beagle_multipartition auto` | 4 | 21.7 | 7.53 days | Multipartition does ~nothing on single-partition XML |
| 7 | [[b200-mig45-partition]] | `-beagle_GPU` | 1 | 17.1 | 5.94 days | Mid; persistent dgx028 infra flake during bench window |
| 8 | [[b200-mig90-partition]] | `-beagle_GPU` | 1 | 15.9 | 5.52 days | Within noise of full B200 |
| 9 | [[dgx-b200-partition]] 4×MPS | `-beagle_GPU` × 4, `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25` | 1 each | 16.2/chain, **4.05 aggregate** | 5.63 days/chain in parallel | **4-chain winner**. See [[cuda-mps]] |
| 10 | [[genoa-std-mem-partition]] `-c 4`, 4 procs | `-beagle_CPU -beagle_SSE` × 4 | 1 each | 17.9/chain, 4.48 aggregate | 6.21 days/chain in parallel | ~26%/chain L3+DRAM contention |

## Key findings

1. **The "GPU 2× slower" report was a `-threads 6` artifact, not a device-level result.** Fixing `-threads 1` recovers GPU performance (row 1 → row 2: 2.26× speedup). The full speedup story is "unbreak the threading flag" first, then "pick the device that matches your dataset" second.
2. **CPU `-threads 1` is the single-chain winner** by ~10% over GPU `-threads 1`. The 22M FLOPs/eval workload fits in Zen5 SSE without needing the GPU. GPU pays 10–25 µs Java→JNI→CUDA per eval, which can't amortize at 690 patterns × 4 states. Matches the inflection in Ayres et al. 2019 (BEAGLE 3 paper).
3. **GPU MPS wins for 4-chain convergence diagnostics workflows** (row 9 vs row 10: 4.05 vs 4.48 min/Msample aggregate). CPU multiproc chains contend for memory bandwidth; MPS chains stay isolated on separate SM partitions. See [[cuda-mps]].
4. **MIG slices are usable** — [[b200-mig90-partition]] within noise of full [[dgx-b200-partition]]. Useful when dgx-b200 queue is backed up.
5. **`-openmpi` must be removed from the module load** or BEAST segfaults on B200 nodes from MPI/JNI env contamination. See [[beagle-tuning]].

## Production recipes delivered to the group

Staged at `/vast/projects/ryb/parcc-data-science/tests/beast2/`:

- `b2_production_cpu.sh` — single-chain CPU `-threads 1` (the winner)
- `b2_production_cpu_resume.sh` — same with `-resume` for chained sbatch submissions
- `b2_production_4chain_mps.sh` — 4-chain GPU MPS for convergence diagnostics

See [[beast-checkpointing]] for restart procedures and [[cuda-mps]] for the MPS script anatomy.

## Lessons
<!-- (user) -->
- Always include a `-threads 1 -beagle_CPU -beagle_SSE` baseline in any BEAST bench. Often the surprise winner on DNA datasets.
- The right way to read "GPU 2× slower than CPU" is "did the user use `-threads N` matching their `-c N`?" — almost certainly the artifact, not a real device-level finding.
- For 4-chain workflows, submitting 4 separate single-core CPU jobs is competitive with 4× MPS on one B200, simpler operationally, and frees the GPU. Recommend that as the default unless the user explicitly wants the MPS recipe.
- Re-bench triggers (the equation flips toward GPU): pattern count > ~5k; codon model (60 states); amino acid (20 states); multiple partitions; tree depth > 3k taxa (also forces `-beagle_double`, see [[2026-05-15-beast1-5535-taxa-bench]]).

## Appendix — SLURM job IDs

Preserved in `REPORT.md` appendix at the dataset working dir. 26 submissions:
- Bench cells 1–10 above
- ~5 failed re-attempts on dgx028 (mig45 infra issue)
- ~5 misc setup / smoke jobs (Lmod cache repair, CoupledMCMC install verification, MPS daemon smoke test)

## See also
- [[beast2-on-betty]] — install pattern, partition selection, OOM caveats
- [[beagle-tuning]] — flag reference (lifted from this experiment)
- [[cuda-mps]] — MPS recipe (lifted from this experiment)
- [[beast-checkpointing]] — restart procedures
- [[2026-05-15-beast1-5535-taxa-bench]] — contrasting case where GPU wins
- [[beast-phylonco]]
- [[dgx-b200-partition]] / [[b200-mig45-partition]] / [[b200-mig90-partition]] / [[genoa-std-mem-partition]]
