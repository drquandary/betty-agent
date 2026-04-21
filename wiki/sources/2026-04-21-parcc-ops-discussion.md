---
type: source
tags: [betty, slurm, gres, gpu, ops, admin, vast]
created: 2026-04-21
updated: 2026-04-21
sources: []
related: [2026-04-17-dgx002-gpu5-oversubscription, slurm-gres-conf, slurm-node-state-modifiers, slurm-select-type-parameters, interact-script-vs-salloc, vast-storage, slurm-on-betty]
status: current
---

# PARCC Ops Discussion — 2026-04-21

## One-line summary
Slack/chat thread between Jaime Combariza, Kenneth Chaney, and Jeff (jvadala) spanning a GPU-5 double-booking incident on dgx002 (2026-04-17), several open SLURM config questions, and procurement / tooling status.

## Participants
- **Jaime E. Combariza** (PARCC admin) — diagnosing the oversubscription and `gres.conf` question; evaluating `SelectTypeParameters`
- **Kenneth P. Chaney** (PARCC admin) — explaining `mix-` node-state modifiers, investigating stray processes on dgx024, questioning `interact` script's `bash -i` behavior
- **Jeff Vadala (jvadala)** — observing, asked Chaney to check dgx024, planning this ingest

## Topics covered (and where they landed in the wiki)
1. **VAST tenant-level setting** — Jeff checking something VAST told him to configure at the tenant level. Exact setting unknown as of 2026-04-21. Filed as open thread on [[vast-storage]].
2. **dgx002 GPU-5 double-booking (2026-04-17)** — jobs by users `inyoun` and `ttz2` both landed on the same physical GPU, both got `CUDA_VISIBLE_DEVICES=0`. Full incident page: [[2026-04-17-dgx002-gpu5-oversubscription]].
3. **SLURM `gres.conf`** — missing on the compute node; not symlinked next to `slurm.conf` in `/etc/slurm`; question of whether `/etc/slurm` is ground truth. `AutoDetect=nvml` is set but `UniqueId:(null)` on every GRES row in the debug log. See [[slurm-gres-conf]].
4. **Node state shorthand `mix-`, `alloc-`, etc.** — the trailing `-` means "planned by the backfill scheduler for a higher priority job." Full modifier glossary: [[slurm-node-state-modifiers]].
5. **`interact` helper vs `salloc --pty bash`** — `interact` uses `bash -i`, which re-sources the login profile (reloads Lmod etc.); Chaney argues this is wrong — users want to inherit the env they already have, which is `srun`'s default. See [[interact-script-vs-salloc]].
6. **dgx024 stray processes** — user `ldugan` running processes without a matching SLURM job; earlier in the day the node was allocated only to `jojolee` (job `5359912`, partition `dgx-b200`). Chaney reaching out; flagged on [[dgx-b200-partition]] / log.
7. **`SelectTypeParameters` — `CR_Core_Memory` vs `CR_Pack_Nodes`** — open question Jaime raised. See [[slurm-select-type-parameters]].
8. **Nsight GPU profiling** — install/activate still pending; Ahead needs to do something. Open thread.
9. **Dell quote / ETA** — Dell is seeking internal approval on a quote; they agree the ETA is concerning. Open procurement thread.
10. **Test cluster** — recurring ask; Jaime noted "this is when I would like to have a test cluster" after failing to reproduce the oversubscription.

## Key artifact in the thread
A SLURM debug log from 2026-04-17T10:17:54 showing `gres/gpu: _merge_system_gres_conf` output for dgx002. Every GPU entry has `UniqueId:(null)` — which Jaime flagged as potentially relevant to the double-booking. Eight B200 GPUs merged cleanly with `Flags:HAS_FILE,HAS_TYPE,ENV_NVML`, cores 0-55 on GPUs 0-3 and 56-111 on GPUs 4-7 (socket split). Preserved verbatim in the raw source.

## See also
- [[2026-04-17-dgx002-gpu5-oversubscription]]
- [[slurm-gres-conf]]
- [[slurm-node-state-modifiers]]
- [[slurm-select-type-parameters]]
- [[interact-script-vs-salloc]]
- [[slurm-on-betty]]
- [[vast-storage]]

## Sources
- `raw/ops_chat/2026-04-21-parcc-ops-discussion.md` — verbatim chat capture
