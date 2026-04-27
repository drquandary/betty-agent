---
type: concept
tags: [beast2, mcmc, phylogenetics, bayesian, java, beagle, hpc]
created: 2026-04-27
updated: 2026-04-27
sources: []
related: [beast-phylonco, genoa-std-mem-partition, genoa-lrg-mem-partition, b200-mig45-partition, vast-storage, slurm-on-betty, betty-software-deployment]
status: tentative
---

# BEAST2 on Betty

## One-line summary
BEAST2 is a Java/MCMC Bayesian phylogenetics engine; on Betty it lands primarily on Genoa CPU nodes (single-thread MCMC with BEAGLE-CPU likelihood), with optional MIG-45 GPU runs for very large alignments and a checkpoint-and-chain pattern for the multi-week wall times typical of phylogenetic workloads.

## Why BEAST2 needs a different shape than ML/MD workloads
BEAST2 is fundamentally **single-chain MCMC**, which means:
- The chain is **sequential** by definition — step *t+1* depends on step *t*. There is no intra-chain parallelism that scales linearly.
- The only thing that parallelizes within a chain is the **per-step likelihood evaluation** (handled by [BEAGLE](https://github.com/beagle-dev/beagle-lib)). This caps out around 4–8 threads for typical alignments.
- The standard "use more compute" patterns are **across chains**, not within: independent replicas, Metropolis-coupled chains (MC³), or lambda-window arrays for partition analyses.
- Convergence is measured in MCMC steps and ESS, not wall time, so users routinely need **days to weeks** of runtime per chain. This is normal for the algorithm, not a deployment failure.

This shapes every Betty decision: prefer Genoa CPU partitions, prefer many small jobs over one big one, plan for checkpoint-and-resume.

## Availability on Betty (verify before relying on)

> **Status: tentative.** This page was written before a confirmed `module spider beast2` run. Before a production run, check:
> ```bash
> module spider beast2
> module avail beast2
> ```
> If no module exists, the fallbacks (in preference order) are:
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

# Resume a chain from its last checkpoint
beast -resume -threads $SLURM_CPUS_PER_TASK analysis.xml
```

Key flags:
- `-resume` reads the `.state` file written every `storeEvery` steps. **Essential** for multi-week runs broken into wall-time chunks.
- `-threads N` controls BEAGLE's likelihood-evaluation parallelism. Match to `--cpus-per-task`. Diminishing returns past 4–8 for typical alignments.
- `-beagle_CPU -beagle_SSE` for CPU partitions; switch to `-beagle_GPU -beagle_CUDA` only on a MIG slice with a verified BEAGLE-CUDA build.
- `-seed N` always set explicitly so independent replicas are reproducible.
- `-statefile <path>` only if you want to relocate the checkpoint outside the run dir.

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
| Most BEAST2 chains (small/medium alignment) | [[genoa-std-mem-partition]]      | CPU-bound MCMC; 4–8 threads is the sweet spot   |
| Large heap (>100GB), many partitions       | [[genoa-lrg-mem-partition]]      | ~1TB nodes accommodate big JVM heaps             |
| Very large alignments where BEAGLE-GPU pays off | [[b200-mig45-partition]]    | Cheap MIG slice; verify CUDA-BEAGLE build first  |
| `LogCombiner` / `TreeAnnotator` / Tracer   | [[genoa-std-mem-partition]]      | Post-processing is single-threaded               |

**GPU caveat**: BEAGLE-GPU helps when likelihood evaluation dominates the per-step cost — large nucleotide alignments, codon models, or many partitions. For small alignments or skyline-style coalescent analyses, GPU is often *slower* than `-beagle_CPU -beagle_SSE` due to host↔device transfer overhead. **Always benchmark a 10k-step run on both before committing**.

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
- [[beast-phylonco]] — single-cell phylogenetics package; how to install and run on top of BEAST2
- [[genoa-std-mem-partition]]
- [[genoa-lrg-mem-partition]]
- [[b200-mig45-partition]]
- [[vast-storage]]
- [[slurm-on-betty]]
- [[betty-software-deployment]]

## Sources
<!-- No cited sources yet — page seeded from general BEAST2 + Betty cluster knowledge.
     Next ingest should attach a real `module spider beast2` capture, a tarball install log,
     or a benchmark run from the phylonco group. -->
