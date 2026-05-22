---
type: concept
tags: [beast2, mcmc, phylogenetics, bayesian, java, beagle, hpc]
created: 2026-04-27
updated: 2026-05-18
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms, 2026-05-15-beast2-ha-wild-aves-bench, 2026-05-15-beast1-5535-taxa-bench]
related: [beast1-on-betty, beagle-gpu-tuning, beagle-tuning, cuda-mps, beast-checkpointing, beast-phylonco, genoa-std-mem-partition, genoa-lrg-mem-partition, b200-mig45-partition, b200-mig90-partition, dgx-b200-partition, vast-storage, slurm-on-betty, betty-software-deployment]
status: current
---

# BEAST2 on Betty

> **Empirical validation (completed 2026-05-15):** the recommendations on this page are validated against two real datasets — see [[2026-05-15-beast2-ha-wild-aves-bench]] (690-pattern DNA, **CPU `-threads 1` wins** single-chain; GPU MPS wins 4-chain workflows) and [[2026-05-15-beast1-5535-taxa-bench]] (5535-taxa, GPU 1.73× over CPU with FP64). The BEAST2 ladder noted "in flight" in [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] is now complete; results captured in the experiment page above. See [[beagle-gpu-tuning]] for the GPU-side decision tree, [[beagle-tuning]] for the general flag reference, [[cuda-mps]] for the multi-chain GPU recipe, and [[beast-checkpointing]] for the BEAST1-vs-BEAST2 restart comparison.

## One-line summary
BEAST2 is a Java/MCMC Bayesian phylogenetics engine; on Betty it lands primarily on Genoa CPU nodes (single-thread MCMC with BEAGLE-CPU likelihood), with optional MIG-45 GPU runs for very large alignments and a checkpoint-and-chain pattern for the multi-week wall times typical of phylogenetic workloads.

## Why BEAST2 needs a different shape than ML/MD workloads
BEAST2 is fundamentally **single-chain MCMC**, which means:
- The chain is **sequential** by definition — step *t+1* depends on step *t*. There is no intra-chain parallelism that scales linearly.
- The only thing that parallelizes within a chain is the **per-step likelihood evaluation** (handled by [BEAGLE](https://github.com/beagle-dev/beagle-lib)). The right `-threads N` depends on the dataset: on the 690-pattern wild-aves HA BEAST2 XML, `-threads 1` is fastest on both CPU and GPU; on the 5535-taxa/1028-patterns BEAST1 XML, CPU `-threads 32` is the right call. **Default to `-threads 1` on single-partition DNA below ~1k patterns**; raise N only when patterns × states² per BEAGLE instance > ~10k (see [[beagle-gpu-tuning]] and [[beagle-tuning]]).
- The standard "use more compute" patterns are **across chains**, not within: independent replicas, Metropolis-coupled chains (MC³), or lambda-window arrays for partition analyses.
- Convergence is measured in MCMC steps and ESS, not wall time, so users routinely need **days to weeks** of runtime per chain. This is normal for the algorithm, not a deployment failure.

This shapes every Betty decision: prefer Genoa CPU partitions, prefer many small jobs over one big one, plan for checkpoint-and-resume.

## Availability on Betty (confirmed 2026-05-13)

Verified during the 2026-05-13 bench session ([[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]):
- `beast2/2.7.7` is available via the `arch/b200` overspack chain on compute nodes (`ml arch/b200 && ml beast2`).
- BEAGLE-CUDA 4.0.1 (pre-release) ships with that chain — the BEAST2 banner confirms it picks up `NVIDIA B200 …` automatically when invoked with `-beagle_GPU`.
- **Do NOT load the `beagle/5.4` module** — that's an unrelated Browning genotype-phasing tool. The `libbeagle/3.1.2` module is CPU-only (no `libhmsbeagle-cuda.so`); use `arch/b200`'s BEAGLE for GPU.
- See [[beagle-gpu-tuning]] for the QoS/precision/threads gotchas.

If `arch/b200` isn't available on the partition you need, fallbacks (in preference order):
> 1. **Official tarball** from [beast2.org](https://www.beast2.org/) into a project dir on VAST. Bundles a JRE; the `packagemanager` CLI assumes this layout. **This is the canonical install for BEAST2** — unlike GROMACS, the upstream distribution is "download and unpack," not a build.
> 2. **Spack via overspack** (ask [[ryan-bradley]] — see `2026-04-10-ryb-overspack-deployment-docs`). Reasonable if multiple groups will share an install.
> 3. **bioconda**: `mamba install -c bioconda beast2 beagle`. Works, but BEAST2 packages installed via `packagemanager` may end up in `~/.beast/2.7/` regardless of conda env, which can surprise users.
> 4. **Apptainer container**: there is no official NGC-style image; community images on Docker Hub vary in quality. Lowest-priority option.

## Tarball install pattern (recommended default)

```bash
# One-time, into a project dir so multiple users can share
PROJ=/vast/projects/<project>
mkdir -p "${PROJ}/sw" && cd "${PROJ}/sw"

curl -LO https://github.com/CompEvol/beast2/releases/download/v2.7.7/BEAST.v2.7.7.Linux.x86_64.tgz
tar xzf BEAST.v2.7.7.Linux.x86_64.tgz   # produces ./beast/

# Install BEAGLE (likelihood library) — usually via system module or conda
module load beagle-lib    # if available; otherwise see [[betty-software-deployment]]

# Add BEAST2 packages (phylonco lives here — see [[beast-phylonco]])
"${PROJ}/sw/beast/bin/packagemanager" -add phylonco
```

Each user can override the package directory with `-dir <path>` if they want their own package set without re-downloading BEAST2 itself.

## Core command shape

```bash
# Validate XML before submitting a multi-day job
beast -validate analysis.xml

# Production run with BEAGLE-CPU (default for Genoa nodes)
beast -threads $SLURM_CPUS_PER_TASK \
      -beagle -beagle_CPU -beagle_SSE \
      -seed 42 \
      analysis.xml

# Production run with BEAGLE-GPU (B200 MIG or full DGX)
# NOTE: -threads 1 on GPU is intentional — see "ThreadedTreeLikelihood gotcha" below.
# NOTE: -beagle_double is mandatory for trees with >~3000 taxa to avoid FP32 underflow.
beast -threads 1 \
      -beagle_GPU -beagle_double \
      -seed 42 \
      analysis.xml

# Resume a chain from its last checkpoint
beast -resume -threads $SLURM_CPUS_PER_TASK analysis.xml
```

Key flags:
- `-resume` reads the `.state` file written every `storeEvery` steps. **Essential** for multi-week runs broken into wall-time chunks.
- `-threads N` controls BEAGLE's likelihood-evaluation parallelism. **For `<distribution spec="ThreadedTreeLikelihood">` XMLs, `-threads N` shards patterns across N BEAGLE instances** — always use `-threads 1` on GPU. On CPU, use many threads when patterns × states² per shard > ~10k (e.g. 5535-taxa/1028-patterns BEAST1); use `-threads 1` when patterns are sparse (e.g. 690-pattern BEAST2 wild-aves HA — `-threads 6` was 1.58× *slower* than `-threads 1` on CPU there). See *ThreadedTreeLikelihood gotcha* below.
- `-beagle_CPU -beagle_SSE` for CPU partitions; `-beagle_GPU -beagle_double` for GPU with deep trees.
- `-seed N` always set explicitly so independent replicas are reproducible.
- `-statefile <path>` only if you want to relocate the checkpoint outside the run dir.

## ThreadedTreeLikelihood gotcha (the BEAST2 "GPU 2× slower" trap)

If your XML has `<distribution ... spec="ThreadedTreeLikelihood">` (common in TargetedBeast and many template-generated XMLs), BEAST2's `-threads N` flag **shards the alignment's site patterns across N independent BEAGLE instances**, not "uses N threads to drive one instance." Each instance pays its own kernel-launch overhead per MCMC step.

Concrete example from the 2026-05-13 bench session ([[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]) with the completed numbers from [[2026-05-15-beast2-ha-wild-aves-bench]]: an XML with 690 unique patterns invoked with `-threads 6` produced 6 BEAGLE GPU instances of ~115 patterns each. For 4-state DNA, GPU only beats CPU+SSE once an instance has ≳10k patterns — below that, kernel overhead dominates. Measured: `-threads 6 -beagle_GPU` 35.7 min/Msample → `-threads 1 -beagle_GPU` 15.8 min/Msample (2.26× speedup), and `-threads 1 -beagle_CPU -beagle_SSE` 14.2 min/Msample (best). On this dataset CPU `-threads 6` *also* suffered (22.4 min/Msample, 1.58× slower than CPU `-threads 1`) — the fragmentation overhead hits CPU too at low pattern counts. The general rule is `-threads 1` always on GPU and on CPU below ~1k patterns; raise N on CPU when there's enough work per shard to amortize the coordination. Full reasoning in [[beagle-gpu-tuning]] and [[beagle-tuning]].

## Heap sizing (the BEAST2-specific gotcha)
BEAST2 launches a JVM. The default heap is small. Long chains with many parameters or partitions OOM silently with cryptic errors. Always set:

```bash
export BEAST_OPTS="-Xmx${MEM_GB}g -Xms${MEM_GB}g"   # both equal avoids GC churn
beast ${BEAST_OPTS} ...
```

Rule of thumb: heap = (Slurm `--mem`) − 4 GB for OS/BEAGLE buffers. If users report `OutOfMemoryError`, this is almost always the cause.

## Partition selection cheat-sheet

| Workload                                   | Suggested partition              | Why                                              |
|--------------------------------------------|----------------------------------|--------------------------------------------------|
| Small alignment (<1000 patterns), 1 partition | [[genoa-std-mem-partition]]   | GPU overhead-bound; CPU+SSE wins                 |
| Medium-large alignment, deep tree (>1000 taxa, ≥1k patterns in one BEAGLE instance) | [[b200-mig90-partition]]  | Measured 1.73× over 32-core CPU; mig90 ≈ full B200 |
| Very deep tree (>3000 taxa) on GPU         | [[b200-mig90-partition]] + `-beagle_double` | FP64 required to avoid underflow            |
| Large heap (>100GB), many partitions       | [[genoa-lrg-mem-partition]]      | ~1TB nodes accommodate big JVM heaps             |
| Many-partition XML (e.g. ~100 patterns/partition) | [[genoa-std-mem-partition]]  | GPU is overhead-bound; consider XML consolidation first |
| `LogCombiner` / `TreeAnnotator` / Tracer   | [[genoa-std-mem-partition]]      | Post-processing is single-threaded               |

**GPU when-it-helps rule of thumb (verified 2026-05-13)**: ≥1k patterns per BEAGLE instance for 4-state DNA, ≥1000-taxon tree, and a single-partition XML (or `-threads 1` to consolidate). Half-GPU (`b200-mig90`) is indistinguishable from a full B200 for this workload — pick the MIG slice. For QoS use `--qos=mig-max`, NOT `--qos=mig` (the latter is currently saturated). See [[beagle-gpu-tuning]] for the full decision tree and the FP32 underflow trap for deep trees.

## The checkpoint-and-chain pattern (for runs >7 days)

This is the answer to "we need a 30-day wall time." Don't ask for one — chain seven 7-day jobs.

```bash
# First job: starts the chain
jid=$(sbatch --parsable run.sbatch)

# Subsequent jobs: each starts only after the prior succeeds, and uses -resume
for i in 1 2 3 4 5 6; do
  jid=$(sbatch --parsable --dependency=afterok:${jid} run.sbatch)
done
```

Required for this to be safe:
- `--requeue` in the sbatch header so a preempted job auto-resumes from the *same* state file
- `--signal=B:USR2@300` so BEAST2 has time to flush state on time-limit kill
- `storeEvery` in the BEAST2 XML set to a value that bounds *re*-work to a tolerable amount (e.g. 1M steps for chains running ~10M steps/day)
- All output written to VAST (`/vast/projects/<project>/runs/<exp>/`), never `$HOME`

A ready-to-use Slurm template lives at `betty-ai/templates/slurm/beast2_resume.sbatch.j2`.

## Replica / ensemble patterns

- **Independent replicas** (the default for any serious BEAST2 analysis) → Slurm `--array=1-N`, each task one chain with a different `-seed`. Combine post-hoc:
  ```bash
  logcombiner -log run-1.log -log run-2.log -log run-3.log -log run-4.log -o combined.log -burnin 10
  logcombiner -log run-1.trees -log run-2.trees ... -o combined.trees -burnin 10
  ```
  This is also the cheapest convergence diagnostic — if independent chains give different posteriors, the model isn't converged.
- **Metropolis-coupled MCMC (MC³)** via the [CoupledMCMC](https://github.com/nicfel/CoupledMCMC) BEAST2 package. Multiple chains at different temperatures swap states; can accelerate *convergence* (not just throughput) on multimodal posteriors. Install with `packagemanager -add CoupledMCMC`.
- **Path-sampling / stepping-stone** (model comparison) → lambda windows as array tasks; each task a short independent chain.
- **Multi-chain on one GPU via CUDA MPS** → for the standard 4-chain convergence diagnostics workflow, packing 4 chains on one B200 with `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25` is ~10% faster aggregate than 4× single-core CPU multiproc (4.05 vs 4.48 min/Msample on the wild-aves HA dataset; CPU multiproc loses to L3+DRAM contention while MPS chains stay isolated on separate SM partitions). Full recipe and gotchas in [[cuda-mps]]; measured in [[2026-05-15-beast2-ha-wild-aves-bench]].

## Storage discipline (same rules as any Betty workload)
- Trajectories of `.trees` and `.log` files can grow to **tens of GB** for long chains — write to `/vast/projects/<project>/runs/<exp>/`, never `$HOME` ([[vast-storage]]).
- BEAST2 default behavior is to **append** to existing log files on `-resume`. Combined with chained jobs, this is what you want — but it means a corrupt or partial log will propagate. Take periodic snapshots of `.state` files for safety.
- `~/.beast/2.7/<package>/` is where `packagemanager` installs by default. On a shared install, redirect this with `-dir` to a project dir so users don't all duplicate the same packages.

## Common pitfalls

- **`-Xmx` not set** → silent JVM OOM after days of chain. Always set heap explicitly.
- **`storeEvery` too high** → a 7-day job dies with the last checkpoint hours behind. Set to bound re-work to <5% of total runtime.
- **Forgot `-seed`** → "independent" replicas may share an RNG seed (some launchers default to time-based seeds with second-resolution → array tasks launching in the same second collide). Pass `-seed ${SLURM_ARRAY_TASK_ID}` explicitly.
- **Phylonco / package installed at user level** → if the install path is `~/.beast/2.7/`, the user's home quota fills. See [[beast-phylonco]] for the project-dir install pattern.
- **`-beagle_GPU` chosen by default** → on small alignments, host↔device transfer dominates and GPU is *slower*. Benchmark first.
- **`update gpu`-style assumption from MD workloads** → BEAST2 has no equivalent of MD's "everything on GPU." MCMC step logic stays on the JVM; only likelihood is delegated to BEAGLE.
- **Asking for one 30-day wall time** → not how Betty works. Use the chain pattern above.

## Validation / benchmarking
When a new BEAST2 module/tarball appears, run a short sanity benchmark before production:
- A 10k-step run of a small (<1000 sites) nucleotide alignment under HKY+G — should finish in minutes.
- A 10k-step run of the user's actual XML — captures realistic per-step cost. Multiply by target chain length to get a wall-time estimate.
- Inspect `.log` ESS values in Tracer; minimum threshold is 200 for any reported parameter.
- Archive the benchmark output and `beast.log` under `wiki/experiments/` so future users can compare BEAST2 versions and BEAGLE backends.

## See also
- [[beast1-on-betty]] — sibling page; checkpointing requires `-save_every` on initial run
- [[beagle-gpu-tuning]] — GPU when-it-helps decision tree, FP64 / threads-1 / QoS gotchas
- [[beagle-tuning]] — general BEAGLE flag reference (CPU + GPU), including the `-openmpi` module gotcha
- [[cuda-mps]] — multi-chain GPU sharing recipe (4-chain BEAST2 MPS pattern)
- [[beast-checkpointing]] — BEAST1 vs BEAST2 restart procedures side-by-side
- [[beast-phylonco]] — single-cell phylogenetics package; how to install and run on top of BEAST2
- [[vast-group-permissions]] — diagnosing cross-group input-file access (the BEAST2 XML access blocker from 2026-05-13)
- [[2026-05-15-beast2-ha-wild-aves-bench]] — full 15-cell bench matrix; CPU `-threads 1` single-chain winner, GPU MPS multi-chain winner
- [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 case, GPU 1.73× with `-beagle_double`
- [[genoa-std-mem-partition]]
- [[genoa-lrg-mem-partition]]
- [[b200-mig45-partition]]
- [[b200-mig90-partition]]
- [[dgx-b200-partition]]
- [[vast-storage]]
- [[slurm-on-betty]]
- [[betty-software-deployment]]

## Sources
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] — measured 1.73× GPU speedup, ThreadedTreeLikelihood fragmentation trap, FP64 / QoS / module gotchas confirmed
- [[2026-05-15-beast2-ha-wild-aves-bench]] — completed BEAST2 ladder results (jobs 5743516-5743519 in the original source) plus 4-chain MPS comparison
- [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 deep-tree bench
