---
type: concept
tags: [betty, gpu, cupy, io, performance, case-study, facilitation, ld, genotype, pcie]
created: 2026-07-01
updated: 2026-07-01
sources: [2026-06-29-teams-chats-digest, 2026-07-01-teams-chats-digest]
related: [gpu-topology-betty, cuda-forward-compatibility-betty, parcc-skills-modules, jeffrey-vadala, ryan-bradley, templeton-religious-trust-project]
status: current
---

# GPU host-gather bottleneck (rachitk LD case study)

## One-line summary
A "transfer-bound" CuPy genotype-LD job on Betty (80% GPU mem / 18% util) was actually **CPU-bound on a host-side `ascontiguousarray` gather** of a transposed array — ~97% of the "transfer" time — not the PCIe wire; fixed by moving the **contiguous int8 chunk to the GPU and doing the transpose/cast there** (util 13.6%→53%, transfer ~22× faster, output numerically identical).

## The problem
- **User:** rachitk (a GWAS/LD workload — genotype `r²` cross-products over a 3-D int8 genotype array `(variants, samples, 2 strands)`; VCF-Zarr → CuPy stack with custom NVRTC-JIT kernels).
- **Reported symptom (all Jeffrey started with):** GPU memory ~80%, GPU utilization ~18%.
- **Constraints:** no read access to rachitk's home dir or his data (another project's space, `anuragv`) for most of the investigation — see the [[parcc-skills-modules|data-packaging skill]] motivation.

## The diagnosis (correct classification)
- **80% mem + 18% util = GPU *starved*, not compute-bound.** High memory ⇒ data resident on GPU; low util ⇒ SMs idle between bursts. Rules out "kernel is slow" (that's 90%+ util) and "under-allocated" (mem is high). Correct output of this step is "starved; cause unknown; enumerate the phases where it waits" — **not** "I/O-bound." The inherited email framing ("disk reads are slow / VAST is slow") was an unverified prior.

## Root cause (the reusable finding)
The "transfer" phase was really a **host-side gather**, not the PCIe copy:
- Microbenchmark (single GPU, replicating `chunk.transpose(2,0,1)[0] → cp.asarray`):
  - contiguous float32: **9.3 GB/s**
  - his strided (transposed) pattern: **2.0 GB/s** (~4.7× slower)
  - pinned memory: **55.7 GB/s** (~28×; matches NVIDIA's published ~53.8)
  - **the host `np.ascontiguousarray` gather alone = ~97% of "transfer" time**
- `nsys` confirmed the actual **PCIe HtoD copy = 38 ms** (negligible) — so the ~100 s "transfer" was host-side CPU work gathering the transposed (non-contiguous) array into a contiguous buffer before the copy.
- **Mechanism:** DMA needs contiguous memory; a transposed host array forces a CPU gather. Textbook, but only became relevant once a test confirmed it applied here.

## The fix
Transfer the **contiguous int8 chunk** to the GPU; do the **transpose/cast on the GPU** (reordering runs at GPU bandwidth). Touched `ld_gpu.py` (read raw int8) and `ld_functions.py` (contiguous transfer + on-GPU transpose/sum).
- **OOM detour (honest):** the naive version OOM'd twice — CuPy's memory pool retained the transients, leaving no room for the ~80 GB `r²` matrix. Real fix had to be **memory-careful** (strand-by-strand, free early) + a smaller `--gpu-memsize`.
- **Results:** transfer **68.9 s → 3.05 s (~22×)**, util **13.6% → 53.1%**, output LD matrices **numerically identical** (max diff ~2e-6 = float rounding).
- Corroborated four ways: timers → microbench → working+correct fix → nsys, plus literature (transpose-before-transfer is documented CuPy behavior; the VCF-Zarr→CuPy stack is a published pattern whose paper names the same bottleneck).

## Environment-rebuild gotchas (single-node Betty)
Reproducing his multi-node MPI env on one node was the most time-consuming phase (~6 failed-job → fix → resubmit cycles):
- **InfiniBand/UCX hang** (multi-node env on single node) → force shared-memory transport: `OMPI_MCA_pml=ob1`, `OMPI_MCA_btl=self,vader,sm`.
- **System HPCX-MPI vs conda MPI collision** — `module load nvhpc` fought the conda MPI → drop it, pin `OPAL_PREFIX` to the conda env.
- **CuPy "no CUDA headers"** — custom kernels JIT via NVRTC → set `CUDA_PATH` to the conda CUDA root.
- **Zarr >2 GB chunk limit** — chunk×samples exceeded the codec buffer cap → `compressor=None` + smaller chunk.
- Missing dep `bio2zarr` (unused PLINK path) → `pip install`; wrong genotype shape (3-D, not 2-D) → fix the synthetic generator.

## Methodology lessons (falsification discipline)
The engine was one loop: **hypothesize → test → let the test overrule the hypothesis.** Nothing believed until a measurement confirmed it. Three wrong turns, each killed by a test, not by more thinking:
1. **"VAST contention"** — blamed the filesystem, "supported" by a 367-running-jobs proxy (motivated reasoning). Refuted: VAST delivered its normal ~1.7 GB/s; the slow run was a node anomaly. *Lesson: never infer filesystem load from job count.*
2. **"Compute-bound"** — a coarse `[INSTR-COMPUTE]` timer lumped the host→device transfer into "compute" (transfer happens inside `compute_cross_r2` via `cp.asarray`). Split into transfer-vs-GEMM → xfer 1372 s, GEMM 44 s → transfer-bound, not compute-bound.
3. **"Multi-node is the gap"** — refuted by grounding: his submission script is `--nodes=1`, recent logs all single-node, he said he won't scatter across nodes. Testing it would chase an abandoned config.
- **Synthetic-proxy trap:** synthetic genotype stores (int8, his shape) built to test cheaply without his data *validated the wrong bottleneck* — they made small random reads the cost and "confirmed" the I/O-bound / prefetch-helps hypothesis, an artifact of the synthetic test, not his real workload. (Cache-defeat principle: size the store larger than the mem limit so reads stay cold, else you benchmark RAM.) Gap only closed once his real code ran (step 3).
- **CuPy async timing fix:** a device-sync around the compute timer is mandatory — CuPy is async, so without it compute reads ~0 and the job looks infinitely I/O-bound.
- **Human-in-the-loop mattered:** Jeffrey's skepticism (and a colleague's "same node / different node / scale up" reframe, and "was he even doing multi-node?") killed two of the three wrong turns — the falsification discipline came partly from the human, not autonomous running.
- **Training knowledge vs. work split:** ~20–30% training knowledge (the *map* — vocabulary of candidate causes, how to build every instrument, the fix once the bottleneck was named), ~70–80% empirical. Crucially, training knowledge also handed *confident wrong answers* (the I/O-bound framing, the prefetch reflex); every fact that turned out right came only from running things. This whole loop (scope → synthetic harness → run on Betty → nsys → ingest to wiki) is what the [[parcc-skills-modules|research-loop skill]] packages.

## Facilitation framing
This is the case behind Ryan's role-classification question (facilitation vs "AI consultant" vs RSE) and the standing ask to **spell out the reasoning in writing** — Jeffrey shared this full distillation to Ryan on 7/1. Also the motivating example for the **data-packaging** and **MWE/check-your-work** [[parcc-skills-modules|ParccSkills]] roadmap items (rachitk sent no code/data → Jeffrey had to synthesize).

## See also
- [[gpu-topology-betty]] — B200 PCIe/NVLink topology; why HtoD transfer patterns matter
- [[cuda-forward-compatibility-betty]] — CUDA/NVRTC toolchain on Betty (the header/`CUDA_PATH` issue)
- [[parcc-skills-modules]] — the research-loop harness + data-packaging/MWE skill roadmap this case motivated
- [[jeffrey-vadala]] — ran the investigation
- [[ryan-bradley]] — asked for the written reasoning; role-classification motive

## Sources
- [[2026-06-29-teams-chats-digest]] — first mention (decode-on-GPU fix, multi-day harness)
- [[2026-07-01-teams-chats-digest]] — full two-part distillation Jeffrey shared to Ryan
