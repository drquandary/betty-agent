---
type: concept
tags: [beast, beast2, beast1, beagle, phylogenetics, gpu, cpu, tuning]
created: 2026-05-15
updated: 2026-05-15
sources: [2026-05-15-beast2-ha-wild-aves-bench, 2026-05-15-beast1-5535-taxa-bench]
related: [beast2-on-betty, beast-phylonco, cuda-mps, beast-checkpointing]
status: current
---

# BEAGLE Flag Reference (BEAST1 / BEAST2)

## One-line summary
BEAGLE 4.0.1 (the likelihood-calculation library both BEAST1 and BEAST2 link against) exposes a small set of flags that determine device, threading, and precision — getting them wrong is the most common cause of BEAST runs being 2–10× slower than they need to be.

## Why this page exists
Group reports of "GPU is 2× slower than CPU" on Betty almost always trace back to a single flag mismatch, not a real device-level result. See [[2026-05-15-beast2-ha-wild-aves-bench]] for the empirical study that produced this reference.

## Device selection

| Flag | What it does | When to use |
|------|--------------|-------------|
| `-beagle_CPU` | Force CPU backend | **Default for ≤1k-pattern 4-state DNA.** Pair with `-beagle_SSE`. |
| `-beagle_SSE` | SSE-vectorized CPU kernels | Always include with `-beagle_CPU`. Big win on Zen5 Genoa. |
| `-beagle_GPU` | Force CUDA backend | Codon (60 states), amino-acid (20 states), ≥5k patterns, deep trees, or multi-chain MPS workflows. |
| *(no device flag)* | BEAGLE auto-selects | Don't rely on it — pin explicitly. |

`-beagle` (no underscore) just enables BEAGLE; combine with one of the above: `beast -beagle -beagle_CPU -beagle_SSE …`.

## Threading — the landmine

| Flag | What it does | Watch out for |
|------|--------------|---------------|
| `-threads N` (BEAST2) | `ThreadedTreeLikelihood` shards site patterns across N BEAGLE instances | **N > 1 is usually a trap on GPU and often a trap on CPU.** Each shard pays full kernel-launch / coordination overhead for 1/N the work. |
| `-threads N` (BEAST1) | Similar | Same caveat. |
| `-instances N` (BEAST1) | Parallel BEAGLE instances per partition | Only useful with multi-partition XMLs. |

**Wild-aves HA case study** (690 patterns, single partition, DNA): `-threads 6 -beagle_GPU` was the production config the group reported as "GPU 2× slower than CPU." Switching to `-threads 1 -beagle_GPU` cut wall time from 35.7 → 15.8 min/Msample (2.26× win) — and `-threads 1 -beagle_CPU -beagle_SSE` then beat that at 14.2 min/Msample.

**Rule of thumb:** start with `-threads 1`. Only increase if `patterns × states²` per instance > ~50k *and* you've confirmed the speedup empirically.

The old "4–8 threads is the sweet spot" advice in [[beast2-on-betty]] was a pre-empirical estimate; it applies to large datasets (codon, ≥5k patterns, many partitions). It does not apply to typical single-partition DNA work.

## Precision

| Flag | What it does | When required |
|------|--------------|---------------|
| `-beagle_double` | Force FP64 likelihoods | **Required** for trees > ~3k taxa or deep coalescent priors — FP32 underflows. See [[2026-05-15-beast1-5535-taxa-bench]] for the crash signature. |
| `-beagle_single` | Force FP32 | Default. Faster on GPU. Fine for shallow trees. |
| `-beagle_scaling dynamic` | Auto-rescale partials as needed | Required with `-beagle_double` for deep trees. Cheap to leave on always. |
| `-beagle_scaling always` | Rescale every eval | Diagnostic only. |
| `-beagle_scaling none` | Disable | Don't. |

**FP32 underflow crash signature**: BEAST exits within ~3 seconds of starting the chain with NaN likelihood. Add `-beagle_double -beagle_scaling dynamic` and resubmit.

## Async / multipartition

| Flag | Status | Note |
|------|--------|------|
| `-beagle_async` | **BEAST1 only** | BEAST2 does not have this flag — passing it makes BEAST2 print help and exit immediately. |
| `-beagle_multipartition auto` | BEAST2 has it | Marginal benefit on single-partition XMLs (15.8 → 15.6 min/Msample in our test). Worth trying for multi-locus / partitioned analyses. |

## Canonical flag combinations

```bash
# BEAST2 DNA single-chain, small/medium alignment (typically the winner)
beast -beagle -beagle_CPU -beagle_SSE -overwrite -threads 1 run.xml

# BEAST2 DNA single-chain GPU (rarely wins on small datasets; bench first)
beast -beagle -beagle_GPU -overwrite -threads 1 run.xml

# BEAST1 deep tree (5k+ taxa) GPU — FP64 required
beast -beagle -beagle_GPU -beagle_double -beagle_scaling dynamic \
      -overwrite -threads 1 run.xml

# BEAST2 multi-chain on one GPU via MPS — see [[cuda-mps]] for env setup
CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25 \
  beast -beagle -beagle_GPU -overwrite -threads 1 -seed 142 run.xml
```

## Module bundle on Betty

```bash
source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200      # provides CUDA-enabled libbeagle (BEAGLE 4.0.1 pre-release)
ml -openmpi -beast1 beast2   # swap last two for BEAST1
```

The `-openmpi` removal matters. Without it, an MPI/JNI interaction causes BEAST to segfault on B200 nodes when `OMPI_*` env vars are set by the slurm prolog. Always include `-openmpi` in the module load line.

## Diagnosing "is BEAGLE actually using the device I asked for?"

BEAST prints the BEAGLE resource list and the chosen instance at chain start. Look for:

```
BEAGLE resources available:
  0 : CPU
  1 : CUDA (NVIDIA B200)
Using BEAGLE resource 1: CUDA (NVIDIA B200)
```

If `-beagle_GPU` was set but it reports CPU:
- `arch/b200` module not loaded (no CUDA libbeagle in `$LD_LIBRARY_PATH`)
- Job didn't actually get a GPU allocation — check `nvidia-smi` inside the job
- BEAGLE detected an unsupported model and silently fell back; check earlier stderr

## See also
- [[beast2-on-betty]] — partition selection, install pattern, OOM caveats
- [[beast-phylonco]] — package-on-top-of-BEAST2 install pattern
- [[cuda-mps]] — multi-chain GPU sharing recipe
- [[beast-checkpointing]] — `-resume` and `-load_state` procedures
- [[2026-05-15-beast2-ha-wild-aves-bench]] — empirical source for the threading recommendations
- [[2026-05-15-beast1-5535-taxa-bench]] — empirical source for the FP64 recommendation

## Sources
- [[2026-05-15-beast2-ha-wild-aves-bench]] — 15+ config bench on 690-pattern DNA dataset
- [[2026-05-15-beast1-5535-taxa-bench]] — 5535-taxa BEAST1 bench
