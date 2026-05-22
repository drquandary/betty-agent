---
type: concept
tags: [beagle, beast2, beast1, gpu, mig, b200, phylogenetics, tuning, benchmark]
created: 2026-05-13
updated: 2026-05-18
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms, 2026-05-15-beast2-ha-wild-aves-bench, 2026-05-15-beast1-5535-taxa-bench]
related: [beast2-on-betty, beast1-on-betty, beagle-tuning, cuda-mps, beast-checkpointing, beast-phylonco, b200-mig45-partition, b200-mig90-partition, dgx-b200-partition, betty-software-deployment]
status: current
---

# BEAGLE GPU tuning on Betty

## One-line summary
BEAGLE-CUDA delivers real speedup for phylogenetics on Betty (measured 1.73× over 32-core CPU+SSE on a 5535-taxon HKY+Γ chain) but only when three conditions all hold: enough work per BEAGLE instance, FP64 precision for deep trees, and the right module/QoS choice. Get any of those wrong and GPU is silently 2-50× slower than CPU.

## Where this knowledge comes from
Measured during the 2026-05-13 bench session ([[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]) on `/vast/projects/ryb/parcc-data-science/tests/beast{1,2}/`. The numbers below are the reported throughputs from 20-min same-XML benchmarks with `-seed 42`.

## The "is GPU even helping?" decision tree

1. **Check the BEAGLE banner in the slurm `.out`** — look for `Using BEAGLE … NVIDIA B200 …`. If it says CPU, the rest is moot; see *Module gotchas* below.
2. **Count patterns per BEAGLE instance.** In the same banner, BEAGLE prints one resource block per instance with its pattern count. For 4-state DNA you need **≳10k patterns per instance** before GPU beats CPU+SSE. With <1k patterns, GPU is overhead-bound and typically slower.
3. **For deep trees (>~3000 taxa), confirm `-beagle_double` is set** — otherwise the run crashes within seconds (see *FP32 underflow* below).
4. **Compare hr/Msample** against a CPU+SSE baseline on the same XML. If the GPU number isn't lower, one of the above is wrong.

## Measured speedups (BEAST1, 5535 taxa, 1028 patterns, HKY+Γ, 1 partition)

| Config | hr/Msample | speedup vs CPU+SSE |
|---|---|---|
| 32-core Genoa CPU + `-beagle_SSE` | 2.60 | 1.00× (baseline) |
| 32-core Genoa CPU + `-beagle_multipartition on` | 2.75 | 0.95× ↓ |
| B200 MIG 4g.90gb + FP64 + dyn scaling | **1.50** | **🏆 1.73×** |
| Full B200 + FP64 + dyn scaling | 1.53 | 1.70× |

**Read this carefully**: half-GPU and full-GPU are within noise of each other. This workload doesn't saturate one B200, so the cheapest pick (MIG 4g.90gb, [[b200-mig90-partition]]) is also the fastest by a hair. Don't ask for a whole DGX node without measuring.

## Completed BEAST2 ladder (wild-aves HA, 690 patterns, HKY+Γ, 1 partition)

The bench jobs 5743516-5743519 noted as "in flight" in the original source ([[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]) completed with the following results, plus follow-up 4-chain MPS / CPU multiproc comparisons. Full matrix in [[2026-05-15-beast2-ha-wild-aves-bench]].

| Config | min/Msample | Notes |
|---|---:|---|
| dgx-b200 full + `-threads 6 -beagle_GPU` | **35.7** | The original "GPU 2× slower" config |
| dgx-b200 full + `-threads 1 -beagle_GPU` | 15.8 | The `-threads 1` fix: 2.26× speedup |
| dgx-b200 full + `-threads 1 -beagle_GPU -beagle_multipartition auto` | 15.6 | Marginal |
| b200-mig90 + `-threads 1 -beagle_GPU` | 15.9 | Within noise of full B200 (matches BEAST1 finding) |
| b200-mig45 + `-threads 1 -beagle_GPU` | 17.1 | Slightly slower; persistent dgx028 flake during bench window |
| **genoa-std-mem `-c 1` + `-threads 1 -beagle_CPU -beagle_SSE`** | **14.2** | **🏆 single-chain winner** at this dataset size |
| genoa-std-mem `-c 6` + `-threads 6 -beagle_CPU -beagle_SSE` | 22.4 | CPU `-threads N>1` *also* fragments at 690 patterns — 1.58× *slower* than CPU `-threads 1` |
| dgx-b200 4×MPS @ `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25` | 16.2/chain, **4.05 aggregate** | **🏆 4-chain winner** — see [[cuda-mps]] |
| genoa-std-mem `-c 4` × 4 procs single-core each | 17.9/chain, 4.48 aggregate | CPU multiproc loses to L3/DRAM contention (~26%/chain slowdown) |

**Two-dataset rule of thumb**: at 690 patterns × 4 states (11k work per eval), CPU+SSE on a single Genoa core wins. At 1028 patterns × 4 states × 5535 taxa (deeper tree), GPU wins by 1.73×. The dataset *shape* — patterns × states² × tree depth — drives the recommendation, not the device.

## CPU threading caveat (added 2026-05-18)

The original `beast2-on-betty` page said CPU benefits from many `-threads N` "at any size." That's correct for the BEAST1 5535-taxa dataset (1028 patterns) where 32-core CPU was the baseline, but **wrong for the 690-pattern wild-aves HA case** where `-threads 6` was 1.58× *slower* than `-threads 1` on CPU. The general statement: `ThreadedTreeLikelihood` fragmentation hurts whenever patterns × states² per shard drops below ~10k, on either device. Above that threshold, more CPU threads help; below, they hurt. Default to `-threads 1` and bench up.

## The five things that go wrong

### 1. Pattern fragmentation (the BEAST2 "2× slower" trap)
BEAST2's `<distribution spec="ThreadedTreeLikelihood">` shards an alignment's site patterns across `-threads N` BEAGLE instances. If the original alignment has ~700 patterns and you pass `-threads 6`, you get **six instances of ~115 patterns each** — every MCMC step pays kernel-launch overhead six times for work that's far below the GPU efficiency threshold. Result: GPU appears 2× slower than CPU.

**Fix**: on GPU use `-threads 1` (one big instance). On CPU keep many threads (CPU benefits from per-instance SSE/AVX scaling at any size).

Same trap applies to XMLs that **manually** split data into many partitions for biological reasons (one BEAGLE instance per partition is forced; you can't merge them via flags). For those, the GPU may just be the wrong tool until partitions are biologically consolidatable.

### 2. FP32 underflow on deep trees
For trees with >~3000 taxa, BEAGLE's per-branch partial likelihoods drop below the FP32 minimum (~2⁻¹²⁶) on the very first eval — before scaling has a chance to help. Job dies in <5 seconds with no useful output.

**Fix**: add `-beagle_double` to the BEAST command. For shallower trees (low hundreds of taxa) FP32 + dynamic scaling is often fine and ~1.5× faster than FP64.

### 3. Wrong precision / scaling combo
- `-beagle_double` + `-beagle_scaling always` = worst-case GPU performance (FP64 is the slower kernel and `always` scaling stops the algorithm from optimizing).
- `-beagle_double` + `-beagle_scaling dynamic` (or omit `-beagle_scaling`, which defaults to dynamic) = the right production combo for deep trees.

### 4. CPU starvation
The B200 is fast enough that the JVM and BEAST's non-BEAGLE work (MCMC proposals, prior calc, I/O) can become the bottleneck. Allocate **≥4 CPU cores per GPU instance**; we used `-c 6` on the MIG slice and `-c 8` on the full B200.

### 5. Module / QoS gotchas
- **`beagle/5.4` is the Browning genotype-phasing tool**, not the BEAGLE phylogenetics library. Coincidence of name. Don't load it.
- **`libbeagle/3.1.2` is CPU-only** — `find $LIBBEAGLE_PREFIX -name 'libhmsbeagle-*.so'` shows only `cpu*` flavors.
- **BEAGLE-CUDA on Betty ships via `arch/b200`** (overspack) — that's the module chain in the working `tests/beast2/job.sh`. Load `arch/b200` then `module load beast2` (or invoke beast directly from the tarball install). BEAGLE-CUDA will be on the JVM `java.library.path` automatically.
- **`--qos=mig` is currently saturated** (0/8 free). Use `--qos=mig-max` for MIG slices.
- **`b200-mig45` on dgx028 returned transient `RaisedSignal:53`** on 2026-05-13 for fresh submissions, but `b200-mig90` and full `dgx-b200` worked fine. Diagnose with `parcc_sdebug.py --job <id>` and `--node dgx028`.

## Production GPU recipe (verified 2026-05-13)

```bash
#!/bin/bash
#SBATCH -p b200-mig90
#SBATCH -c 6
#SBATCH -t 3-00:00:00
#SBATCH --qos=mig-max
#SBATCH -J beast-gpu
#SBATCH -o slurm-%j.out
#SBATCH --requeue
#SBATCH --signal=B:USR2@300

source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml beast2     # or your tarball wrapper

# Threading: ONE BEAGLE instance to avoid pattern fragmentation
# FP64 is mandatory for trees with >~3000 taxa
beast -threads 1 \
      -beagle_GPU -beagle_double \
      -seed 42 \
      analysis.xml
```

For BEAST1, swap `beast` → `beast1` (or the explicit jar wrapper) and add `-save_every 1000000 -save_stem state` for checkpointing — see [[beast1-on-betty]].

## Open questions / next benchmarks

- **The BEAST2 ladder** (jobs 5743516-5743519, started 2026-05-13 but results not in transcript) — confirm the `-threads 1` fix recovers GPU speedup for the targeted_1 XML; needs follow-up source page.
- **Codon models / multi-state DNA** — the 10k-pattern rule of thumb is for 4-state DNA. Codon (61 states) has a much higher per-pattern compute cost; GPU should win at lower pattern counts. Untested on Betty.
- **The `b200-mig45 RaisedSignal:53`** — transient or persistent? Worth a `parcc_sdebug.py --node dgx028` revisit before recommending the MIG-45 slice for production phylogenetics.
- **BEAGLE 4.0.1 pre-release** — that's what's installed via `arch/b200`. Track 4.0.x changelog for any release that affects scaling/threading.

## See also
- [[beast2-on-betty]] — full BEAST2 deployment pattern; this page is the GPU subset
- [[beast1-on-betty]] — BEAST1 specifics (checkpointing, command shape)
- [[beagle-tuning]] — general BEAGLE flag reference (CPU + GPU), including `-openmpi` module gotcha and BEAST1-vs-BEAST2 flag differences
- [[cuda-mps]] — multi-chain BEAST on one GPU via MPS (4.05 vs 4.48 aggregate min/Msample vs CPU multiproc)
- [[beast-checkpointing]] — restart procedures side-by-side (BEAST2 auto vs BEAST1 opt-in)
- [[beast-phylonco]] — phylonco workflow (same GPU rules apply)
- [[2026-05-15-beast2-ha-wild-aves-bench]] — completed BEAST2 ladder + 4-chain MPS comparison
- [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 5535-taxa case (the 1.73× speedup source)
- [[b200-mig45-partition]] — QoS = mig-max gotcha
- [[b200-mig90-partition]] — the right-sized GPU for medium phylogenetics
- [[dgx-b200-partition]] — full B200 reference
- [[betty-software-deployment]] — `arch/b200` overspack chain explanation

## Sources
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] — original BEAST1 bench + BEAST2 ladder in flight
- [[2026-05-15-beast2-ha-wild-aves-bench]] — BEAST2 ladder completed + MPS / multiproc comparison
- [[2026-05-15-beast1-5535-taxa-bench]] — schema-compliant experiment page for the BEAST1 numbers above
