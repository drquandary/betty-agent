---
type: concept
tags: [beast1, mcmc, phylogenetics, bayesian, java, beagle, hpc, checkpoint]
created: 2026-05-13
updated: 2026-05-18
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms, 2026-05-15-beast1-5535-taxa-bench]
related: [beast2-on-betty, beagle-gpu-tuning, beagle-tuning, cuda-mps, beast-checkpointing, genoa-std-mem-partition, b200-mig90-partition, dgx-b200-partition, slurm-on-betty]
status: current
---

# BEAST1 on Betty

## One-line summary
BEAST v1 (the original BEAST, currently 1.10.x, distinct from [[beast2-on-betty|BEAST2]]) is the more commonly-used Bayesian phylogenetics engine for large taxon datasets and BEAGLE-GPU workflows on Betty. Unlike BEAST2, BEAST1 will NOT write checkpoints unless you explicitly pass `-save_every` and `-save_stem` on the **initial** run — a missed flag means a multi-day chain can't be resumed at all.

## Why a separate page from BEAST2

BEAST1 and BEAST2 share the BEAGLE likelihood library and a similar XML-driven configuration, but they are **separate codebases with non-interchangeable XMLs** and different command-line surfaces. Most production phylogenetic-epidemiology pipelines (BEAST-influenza, BEAST-SARS-CoV-2 phylogeography) are still on BEAST1; new methodological work increasingly lives in BEAST2.

The differences that matter operationally on Betty:

| Topic | BEAST1 | BEAST2 |
|---|---|---|
| Binary | `beast` (1.10.x jar) | `beast` (2.7.x jar) — different `$PATH` |
| Checkpointing | Opt-in via `-save_every N -save_stem PREFIX` | On by default via `<run storeEvery="…">` in XML |
| Resume | `-load_state <path> -force_resume` | `-resume <xml>` (reads `<xml>.state` automatically) |
| Threading | `-threads N` for tree-likelihood eval | `-threads N` for ThreadedTreeLikelihood (see warning in [[beagle-gpu-tuning]]) |
| Package system | None (download jars) | `packagemanager` CLI |
| Convergence/diagnostics tools | LogCombiner, TreeAnnotator, Tracer (same as BEAST2) | LogCombiner, TreeAnnotator, Tracer |

## Measured throughput on Betty (BEAST1 1.10.4, wild-aves HKY+Γ XML)

5535 sequences, 1028 unique site patterns, 1 partition, HKY+Γ, strict clock — see [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]:

| Config | hr/Msample | speedup |
|---|---|---|
| 32-core Genoa CPU + `-beagle_SSE` | 2.60 | 1.00× |
| 32-core Genoa CPU + `-beagle_multipartition on` | 2.75 | 0.95× ↓ |
| B200 MIG 4g.90gb + `-beagle_double` | **1.50** | **1.73×** |
| Full B200 + `-beagle_double` | 1.53 | 1.70× |

GPU is the production choice for trees this deep. See [[beagle-gpu-tuning]] for the underlying pattern-count / FP64 / threads-1 reasoning.

## The checkpointing rule (the BEAST1-specific gotcha)

**BEAST1 does not write state automatically.** Without the flags below, a job that hits walltime has no recovery path — the entire chain is lost. From the 2026-05-13 session: the existing BEAST1 production run (slurm-5708909) had 28 million states on disk but no state file; the only path forward was to restart cold or bootstrap from the last sampled tree.

### On the initial run
```bash
beast -threads $SLURM_CPUS_PER_TASK \
      -beagle -beagle_CPU -beagle_SSE \
      -save_every 1000000 \
      -save_stem state \
      -seed 42 \
      analysis.xml
```

This writes `state.YYYYMMDD-HHMMSS` files every 1M states (about 42 min at the observed 2.55 hr/Msample on 32-core CPU; ~25 min on GPU).

### On resume
```bash
LATEST_STATE=$(ls -1t state.* 2>/dev/null | head -1)
beast -threads $SLURM_CPUS_PER_TASK \
      -beagle -beagle_CPU -beagle_SSE \
      -load_state "$LATEST_STATE" \
      -force_resume \
      -save_every 1000000 \
      -save_stem state \
      -seed 42 \
      analysis.xml
```

`-force_resume` is needed because BEAST1 refuses to resume if the XML's MCMC `chainLength` has been changed since the state was written. For a clean resume of the same XML, `-force_resume` is safe.

Slurm template at `betty-ai/templates/slurm/beast1_checkpoint.sbatch.j2` parameterizes both the initial and resume cases.

## Command-line shape (CPU and GPU)

```bash
# CPU production (32-core Genoa, BEAGLE-CPU+SSE):
beast -threads 32 \
      -beagle -beagle_CPU -beagle_SSE \
      -save_every 1000000 -save_stem state \
      -seed 42 analysis.xml

# GPU production (MIG 4g.90gb or full B200, BEAGLE-CUDA, FP64 required for deep trees):
beast -threads 1 \
      -beagle_GPU -beagle_double \
      -save_every 1000000 -save_stem state \
      -seed 42 analysis.xml
```

Notable flag differences from BEAST2:
- BEAST1 has `-beagle_multipartition on/off`. **Off (default) is right for single-partition XMLs.** Setting it on for a 1-partition XML cost ~6% throughput in the 2026-05-13 bench. Only enable for genuinely multi-partition XMLs after benchmarking.
- BEAST1's `-threads` does **not** trigger the BEAGLE-instance-sharding behavior that ThreadedTreeLikelihood in BEAST2 does. BEAST1's `-threads N` controls per-eval parallelism within one BEAGLE instance.

## Partition selection

| Workload | Suggested partition | Why |
|---|---|---|
| Deep tree (>1000 taxa), DNA/codon | [[b200-mig90-partition]] | 1.7× GPU speedup measured; mig90 is cheapest-per-throughput |
| Very deep tree (>3000 taxa) | [[b200-mig90-partition]] + `-beagle_double` | FP64 mandatory, mig90 still wins |
| Shallow tree (<1000 taxa) | [[genoa-std-mem-partition]] | GPU overhead dominates at low pattern counts |
| Heavy partitioning (many small partitions) | [[genoa-std-mem-partition]] | Per-partition GPU kernel overhead — same trap as BEAST2's threaded XMLs |
| LogCombiner / TreeAnnotator | [[genoa-std-mem-partition]] | Post-processing, single-threaded |

## Heap sizing

Same rule as [[beast2-on-betty]]: set JVM heap explicitly to `(--mem) - 4 GB`, both `-Xmx` and `-Xms`:

```bash
export _JAVA_OPTIONS="-Xmx${MEM_GB}g -Xms${MEM_GB}g"
beast ...
```

OOM is the most common silent-failure mode for long BEAST1 chains. The JVM default heap on Betty's `arch/b200` OpenJDK 17 build is much smaller than typical compute-node memory; you must opt up.

## Storage discipline

- All output (`.log`, `.trees`, `state.*`) to `/vast/projects/<project>/runs/<exp>/`, never `$HOME`. State files in particular can be hundreds of MB each.
- BEAST1's `-load_state` appends to existing `.log`/`.trees`. Combined with the `--dependency=afterok` chain-of-jobs pattern (see [[beast2-on-betty]] *checkpoint-and-chain pattern*), this gives unlimited wall time within the 7-day-chunk policy.

## Common pitfalls
- **`-save_every` not on initial run** → no state file → no resume. Document this prominently in any BEAST1 template you hand a user.
- **FP32 on a 5000-taxon tree** → immediate underflow crash. Add `-beagle_double` on GPU.
- **`-beagle_multipartition on` for 1-partition XML** → ~6% slowdown.
- **Forgot to pass the same `-save_stem`** on resume → BEAST1 invents a new prefix and you lose the chain on next requeue.
- **`-threads 32` on a 5-pattern alignment** → wasted CPUs; BEAGLE overhead dominates. Match `-threads` to the work.

## See also
- [[beast2-on-betty]] — the BEAST2 sibling page; many deployment rules are shared
- [[beagle-gpu-tuning]] — the GPU-specific tuning details
- [[beagle-tuning]] — general BEAGLE flag reference (BEAST1 vs BEAST2 flag differences, `-openmpi` module gotcha)
- [[beast-checkpointing]] — BEAST1-vs-BEAST2 restart comparison (BEAST1 is the must-opt-in case)
- [[cuda-mps]] — MPS multi-chain GPU pattern (not yet benched on BEAST1 but flag-shape applies)
- [[beast-phylonco]] — note: phylonco is BEAST2-only, not BEAST1
- [[2026-05-15-beast1-5535-taxa-bench]] — schema-compliant experiment page with the BEAST1 numbers
- [[2026-05-15-beast2-ha-wild-aves-bench]] — contrasting BEAST2 case (CPU wins, not GPU)
- [[genoa-std-mem-partition]]
- [[b200-mig90-partition]]
- [[slurm-on-betty]]

## Sources
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
- [[2026-05-15-beast1-5535-taxa-bench]]
