---
type: source
tags: [betty, slurm, gres, gpu, incident, dgx002, admin]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-21-parcc-ops-discussion]
related: [slurm-gres-conf, slurm-on-betty, dgx-b200-partition, gpu-topology-betty]
status: tentative
---

# dgx002 GPU-5 Oversubscription Incident — 2026-04-17

## One-line summary
Two SLURM jobs (users `inyoun` and `ttz2`) ran concurrently on dgx002 and both received `CUDA_VISIBLE_DEVICES=0`, colliding on the same physical B200 GPU despite `AutoDetect=nvml` and loaded cgroup plugins; root cause not confirmed as of 2026-04-21.

## What happened
- **When**: 2026-04-17 (Friday). Slurmd debug log captured at 10:17:54 local.
- **Where**: `dgx002` in the [[dgx-b200-partition]].
- **Symptom**: Two jobs on the node, both reporting `CUDA_VISIBLE_DEVICES=0`. Physical GPU-5 observed to be in use by both (so the logical→physical mapping was also wrong, not just a shared logical index).
- **Impact**: Both users' jobs competed for the same GPU — performance + correctness hit, possible OOM.

## What was checked
| Check | Result |
|-------|--------|
| `SLURM_CONF` | Correct on the compute node |
| `/etc/slurm/gres.conf` on dgx002 | **Missing or not findable** |
| `AutoDetect=nvml` | Set — confirmed in debug log (flags `ENV_NVML`) |
| cgroup plugins | Successfully loaded on that node |
| `UniqueId` on each GRES row | **`(null)` for all 8 GPUs** |
| GRES merge with system | Succeeded — 8 B200 GPUs included, cores 0-55 on GPUs 0-3, 56-111 on GPUs 4-7 |

## Candidate root causes (unresolved)
1. **Missing `gres.conf`** — if `slurmd` can't read it, the GRES tracking may fall back to a less-isolating path. See [[slurm-gres-conf]].
2. **Missing `UniqueId`** — without stable per-device IDs, SLURM may mis-map logical GPU indices to device files after any reordering (driver reload, hotplug, etc.).
3. **cgroup device isolation misconfig** — cgroup plugins were loaded but might not be actually enforcing `devices.allow`/`devices.deny` on `/dev/nvidiaN`. Needs verification that `cgroup.conf` has `ConstrainDevices=yes`.
4. **Some other SLURM pathway** — Jaime noted his reproduction attempts on 2026-04-21 failed ("it's not letting me in … perhaps there is some other reason SLURM was letting jobs double book the GPUs on Friday") — meaning whatever allowed the double-booking may have been transient or fixed incidentally.

## Debug log artifact (excerpt)
```
[2026-04-17T10:17:54.937] debug:  Gres GPU plugin: Merging configured GRES with system GPUs
[2026-04-17T10:17:54.937] debug2:     GRES[gpu] Type:B200 Count:8 Cores(224):(null)  Links:(null) Flags:HAS_TYPE,ENV_NVML,ENV_RSMI,ENV_ONEAPI,ENV_OPENCL,ENV_DEFAULT File:(null) UniqueId:(null)
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):0-55   Links:-1,0,0,0,0,0,0,0 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia0 UniqueId:(null)
... (GPUs 1-7 omitted, same pattern; full text in raw)
[2026-04-17T10:17:54.937] debug:      GRES[gpu] Type:B200 Count:1 Cores(224):56-111 Links:0,0,0,0,0,0,0,-1 Flags:HAS_FILE,HAS_TYPE,ENV_NVML File:/dev/nvidia7 UniqueId:(null)
```

Full log preserved in `raw/ops_chat/2026-04-21-parcc-ops-discussion.md`.

## What changed the debug log tells us
- GPUs 0-3 → cores 0-55 (socket 0)
- GPUs 4-7 → cores 56-111 (socket 1)
- Every GPU has `Flags:HAS_FILE,HAS_TYPE,ENV_NVML` — so the merge succeeded.
- `UniqueId:(null)` on every row is the standout anomaly.
- No `Links:...` beyond a single `-1` (self) and zeroes — NVLink topology **not** reflected in the config, which would also prevent `--gres-flags=enforce-binding` from doing meaningful work.

## Reproduction attempts
Jaime tried a controlled reproduction on 2026-04-21: submit jobs to nodes in state `alloc` and see if a second job gets admitted. **Could not reproduce** — the scheduler blocked the second submission as expected. (A typo briefly appeared to reproduce it — false positive.) Either the bug is transient, conditional on some state we haven't identified, or was incidentally fixed.

> "This is when I would like to have a test cluster." — Jaime

## Next steps (open)
1. **Verify `/etc/slurm/gres.conf` exists on all DGX B200 nodes** and matches what `slurm.conf` declares. See [[slurm-gres-conf]].
2. **Check `cgroup.conf`** on dgx002: `ConstrainDevices=yes`, `ConstrainRAMSpace=yes` set?
3. **Figure out why `UniqueId` is null** — is NVML supplying it and slurmd dropping it, or NVML not supplying it? May be a Slurm/NVML version interaction.
4. **Stand up a test cluster** for safe `SelectTypeParameters` / `gres.conf` experiments. See [[slurm-select-type-parameters]] — Jaime also wants this for the `CR_Pack_Nodes` question.

## See also
- [[2026-04-21-parcc-ops-discussion]]
- [[slurm-gres-conf]]
- [[slurm-on-betty]]
- [[dgx-b200-partition]]
- [[gpu-topology-betty]]

## Sources
- `raw/ops_chat/2026-04-21-parcc-ops-discussion.md` — original chat + full debug log
