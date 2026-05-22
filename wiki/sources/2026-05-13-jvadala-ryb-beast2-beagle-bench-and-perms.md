---
type: source
tags: [beast2, beast1, beagle, gpu, mig, benchmark, permissions, chgrp, setgid, facilitation]
created: 2026-05-13
updated: 2026-05-13
related: [beast2-on-betty, beast1-on-betty, beagle-gpu-tuning, vast-group-permissions, b200-mig45-partition, b200-mig90-partition, dgx-b200-partition, ryan-bradley]
status: current
---

# 2026-05-13 — jvadala + ryb session: BEAST2/BEAGLE GPU benchmarking + VAST group permissions

## One-line summary
Live Betty session driven by jvadala (with running side-chat help from ryb) that (a) measured BEAST + BEAGLE-CUDA GPU vs CPU on Betty for the first time — **1.73× speedup on a B200 MIG 4g.90gb slice over 32-core Genoa CPU+SSE for a 5535-taxon BEAST1 chain** — and (b) surfaced a VAST cross-group permission gotcha (file marooned in `jcombar1TestingVast` group inside a `rybParccDataScienceVast`-setgid directory) that ryb explicitly called out as a recurring HPC facilitation lesson.

## Source artifact
- Raw chat transcript: `raw/cluster_exploration/2026-05-13-beast2-beagle-bench-and-perms.txt`
- Working dir on Betty: `/vast/projects/ryb/parcc-data-science/tests/beast{1,2}/` and `/vast/projects/ryb/parcc-data-science/jvadala-beast-bench/b1_*` / `beast2_*`
- Slurm job IDs cited: `5708953` (BEAST2 production), `5742742-5742746` (BEAST1 v1 bench), `5742756-5742758` (BEAST1 v2 GPU bench), `5743516-5743519` (BEAST2 bench ladder)

## What happened (chronological)

### 1. Initial ask — wrong directory
The researcher (`jcombar1`) wanted BEAST2 + BEAGLE-GPU on Betty for `/vast/projects/jcombar1/testing/TestB4` and reported a "2× slower on GPU" result. jvadala couldn't read TestB4 (group `jcombar1TestingVast` — jvadala is not a member).

### 2. Pivot — ryb's project space
ryb suggested using `/vast/projects/ryb/parcc-data-science/tests/beast{1,2}/` where jvadala has read access and ryb already had benchmark inputs staged. ryb also asked about restart/checkpoint functionality.

### 3. Critical software discovery
- The Betty module named `beagle/5.4` is **the Browning genotype-phasing tool**, NOT the BEAGLE phylogenetics library. Coincidence of name.
- The Betty module named `libbeagle/3.1.2` is **CPU-only** — its `.so` files are `libhmsbeagle-cpu*.so` and `libhmsbeagle-cpu-sse.so`; no `libhmsbeagle-cuda.so`.
- The CUDA-built BEAGLE 4.0.1 (pre-release) is shipped via the `arch/b200` overspack chain — that's what `tests/beast2/job.sh` was already loading. The previous BEAST2 run's banner confirmed: `Using BEAGLE … NVIDIA B200 MIG 2g.45gb` — GPU was being used.

### 4. Root cause of the BEAST2 "2× slower" report
Not a BEAGLE-fallback-to-CPU problem. The BEAST2 XML uses `<distribution spec="ThreadedTreeLikelihood">` and was invoked with `-threads 6`, which **shards the 690 unique site patterns across 6 BEAGLE GPU instances** — ~115 patterns per instance. For 4-state DNA, GPU only beats CPU+SSE once an instance has ≳10k patterns. Below that, kernel-launch + PCIe overhead dominates each MCMC eval. The fix on GPU is `-threads 1` (consolidate into one big instance); CPU keeps many threads.

### 5. Restart investigation
- **BEAST2**: writes `.xml.state` periodically per `storeEvery` in the XML. Restart is `beast -resume <xml>` — no other change. The previous BEAST2 run had a valid `.xml.state` at sample 120,951,000 ready to resume.
- **BEAST1**: requires `-save_every N -save_stem <prefix>` on the **initial run** for state to be written. The existing BEAST1 run (slurm-5708909) did not pass those flags, so its 28M chain states were stuck. Future BEAST1 runs need explicit checkpointing; resume uses `-load_state ... -force_resume`.

### 6. BEAST1 benchmark ladder
After the user pushed past "stop asking and run the benchmarks," 5 configs were submitted simultaneously on the same BEAST1 XML (5535 sequences, 1028 patterns, HKY+Γ, 1 partition):

| Config | hr/Msample | speedup | Notes |
|---|---|---|---|
| 32-core Genoa CPU + `-beagle_SSE` | 2.60 | 1.00× | baseline |
| 32-core Genoa CPU + `-beagle_multipartition on` | 2.75 | 0.95× | **slower** for 1-partition XML; don't enable blindly |
| B200 MIG 4g.90gb + FP64 + dyn scaling | **1.50** | **🏆 1.73×** | recommended production recipe |
| Full B200 + FP64 + dyn scaling | 1.53 | 1.70× | indistinguishable from half-GPU |
| B200 MIG 2g.45gb | n/a | — | `RaisedSignal:53` on dgx028 — infra glitch, not script |

### 7. Two failure modes hit during bench
1. **FP32 underflow on first eval** for the 5535-taxon tree (deep tree → partial likelihoods drop below 2⁻¹²⁶). Crashed the v1 GPU jobs at ~3 seconds. Resolved with `-beagle_double`. **Rule: BEAGLE+GPU on trees with thousands of taxa must use FP64.**
2. **`--qos=mig` is saturated** on Betty (0/8 free at submission time). The right QoS for B200 MIG is `--qos=mig-max` (40 GPUs). The v1 mig45 job submitted with `--qos=mig` was rejected silently with exit `0:53` and no slurm output file. Diagnosed via `parcc_sdebug.py --job`.

### 8. BEAST2 ladder (in flight at end of transcript)
After getting access to the BEAST2 XML, jvadala set up an analogous 4-config ladder (CPU+SSE, mig45, mig90, full B200) with `-threads 16` on CPU (CPU shards 690 patterns across 16 SSE instances → benefits from threading) and `-threads 1` on GPU (consolidates into one instance → fixes the per-partition fragmentation from the original run). Submitted as jobs `5743516-5743519`. Results were not in the transcript.

## The permissions thread (ryb's facilitation point)

The BEAST2 XML `main-intro_equal-time-loc_ha_empirical_targeted_1.xml` was mode `0600` owned by `ryb:jcombar1TestingVast` — every other file in the directory was group `rybParccDataScienceVast` (the directory itself has the setgid bit, `drwxrwsr-x`). The XML predated the setgid or was copied in with metadata preservation, so it didn't inherit.

The fix sequence:
1. ryb tried `chmod g+rw` → mode became `0660` but **group still `jcombar1TestingVast`** → jvadala still couldn't read (not in that group).
2. The actual fix was `chgrp rybParccDataScienceVast <file>` — change the file's group to a group jvadala IS in.
3. Equivalent low-risk alternative: `cp file{,.new} && mv file{.new,}` — the new file inherits the directory's group via the setgid bit.

### ryb's explicit takeaways (verbatim from chat)
- > "this is good practice. … teaching users to be mindful of `chgrp` and `chmod` will be a big part of our facilitation effort"
- > "we could also teach them ACLs eventually, but even ACLs do not help when you retain metadata when you transfer data from elsewhere, so just remaining vigilant is best"
- > "teaching the users `stat`, `chmod`, `chgrp`, and maybe `setfacl` will be important. … I probably use no more than 10 bash commands in a single day"
- > "we can also help them script around the permissions problems"

jvadala wants to make a "cmd guide dashboard" for himself — captured here as a follow-up.

## Things this source establishes (file these as wiki facts)

1. **BEAST + BEAGLE-GPU CAN deliver real speedup on Betty** — measured 1.73× over 32-core CPU+SSE for a 5535-taxa HKY+Γ chain. The earlier wiki's "benchmark first, GPU often slower" hedge is correct but was missing the positive data point.
2. **Half-GPU ≈ full-GPU** for this workload class — MIG 4g.90gb is the cheapest right-sized resource. Validates the mig90 partition for medium phylogenetics.
3. **FP64 is mandatory** for BEAGLE-GPU on trees with >~3000 taxa. Underflow happens on the very first eval.
4. **ThreadedTreeLikelihood + GPU = `-threads 1`**; on CPU use many threads. The `-threads N` flag's meaning is "shard patterns across N BEAGLE instances," not "use N OS threads to drive one instance."
5. **`-beagle_multipartition on` hurts single-partition XMLs** — don't blindly enable.
6. **`libbeagle/3.1.2` module is CPU-only**; the CUDA build is via `arch/b200` (overspack). The `beagle/5.4` module is unrelated software.
7. **`--qos=mig` is currently saturated**; the productive QoS for MIG slices is `--qos=mig-max`.
8. **`b200-mig45` (dgx028) returned transient `RaisedSignal:53` on 2026-05-13** for fresh submissions — not a script bug; previous-day BEAST2 run on the same partition succeeded.
9. **BEAST1 requires `-save_every` on the initial run** for resume to work later; missed flag = no checkpoint = restart from zero.
10. **VAST cross-group sharing fails on group ownership, not just mode bits.** `chmod g+r` is useless if the file's group isn't one the reader belongs to; the correct fix in a setgid project dir is `chgrp <dir's group> <file>` or `cp+mv` to inherit.

## See also
- [[beagle-gpu-tuning]] — concept page synthesizing items 1-6 above
- [[beast2-on-betty]] — updated with measured benchmarks + the threads-1 GPU trick
- [[beast1-on-betty]] — new page, BEAST1 specifics including the `-save_every` rule
- [[vast-group-permissions]] — facilitation-oriented page synthesizing item 10
- [[b200-mig45-partition]] — QoS gotcha added
- [[ryan-bradley]] — owner of the project space; the facilitation framing came from him

## Sources
<!-- Self-evident: this page summarises the raw transcript cited above. -->
