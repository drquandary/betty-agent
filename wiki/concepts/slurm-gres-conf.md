---
type: concept
tags: [slurm, gres, gpu, admin, betty]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-21-parcc-ops-discussion]
related: [slurm-on-betty, 2026-04-17-dgx002-gpu5-oversubscription, betty-cluster]
status: current
---

# SLURM gres.conf on Betty

## One-line summary
`gres.conf` tells `slurmd` which physical devices (GPUs, NICs) back the Generic RESource names in `slurm.conf`; on Betty it is expected alongside `slurm.conf` under `/etc/slurm` on every compute node, and missing or incomplete versions can let SLURM double-book GPUs.

## What gres.conf does
- Pairs each logical `Gres=gpu:B200:N` declaration in `slurm.conf` with the concrete device files (`/dev/nvidia0` ... `/dev/nvidia7`) and, optionally, core affinity, NVLink topology, and a `UniqueId` for stable identification.
- Read by `slurmd` at node startup and on `scontrol reconfigure`.
- If absent, `slurmd` falls back to `slurm.conf`'s GRES declaration plus whatever `AutoDetect` discovers — which may or may not be sufficient depending on the plugins available.

## Relevant fields
| Field | What it means | Why it matters |
|-------|---------------|----------------|
| `Name=gpu` | Generic resource name | Must match `slurm.conf` |
| `Type=B200` | GPU model type | Lets users request a specific GPU type |
| `File=/dev/nvidiaN` | Device node | Needed for cgroup device isolation |
| `Cores=0-55` | CPU affinity hint | Used by the task/cgroup plugin for NUMA-aware placement |
| `Links=0,-1,0,...` | NVLink/NVSwitch topology | Used by `--gres-flags=enforce-binding` |
| `UniqueId=<id>` | Stable device ID | Stops two jobs from colliding on the same physical GPU when device files are re-ordered |
| `AutoDetect=nvml` | Let NVIDIA NVML fill in the above | Present on dgx002 per 2026-04-17 debug log |

## The "AutoDetect=nvml without UniqueId" anomaly on dgx002
As of the 2026-04-17T10:17:54 `slurmd` debug log on dgx002:
- `AutoDetect=nvml` **is** set (flags `ENV_NVML`, `ENV_RSMI`, `ENV_ONEAPI`, `ENV_OPENCL` all present).
- But every merged GRES row reports `UniqueId:(null)` — NVML either didn't supply it or slurmd didn't record it.
- On the same day, two jobs (`inyoun`, `ttz2`) both received `CUDA_VISIBLE_DEVICES=0` and oversubscribed GPU-5.
- Jaime's hypothesis: missing `UniqueId` may be a contributing factor even though cgroup plugins were loaded. See [[2026-04-17-dgx002-gpu5-oversubscription]].

## Where the file should live on Betty
- **Canonical location**: `/etc/slurm/gres.conf` on every compute node, co-located with `slurm.conf`.
- As of 2026-04-21, `gres.conf` is **NOT** symlinked next to `slurm.conf` in `/etc/slurm` on the node Jaime checked. Usual practice is to bundle them (both managed by the same config-push mechanism, e.g. BCM image sync or a Puppet module).
- It is still **an open question** whether `/etc/slurm` is the ground truth on Betty or whether another path (e.g. `/cm/shared/apps/slurm/...` under BCM) is authoritative and symlinked to `/etc/slurm`. Worth verifying with Jaime.

## Diagnostics
```bash
# On a compute node
cat /etc/slurm/gres.conf           # should list each /dev/nvidia*
scontrol show node <node> | grep -i gres
slurmd -D -vvv 2>&1 | grep _merge_system_gres_conf    # shows the merge output
```

## Related observations from 2026-04-17 debug log
GPU-to-core affinity is **socket-split**: GPUs 0-3 bind to cores 0-55, GPUs 4-7 bind to cores 56-111. Useful to know when pinning tasks.

## See also
- [[slurm-on-betty]]
- [[slurm-select-type-parameters]]
- [[2026-04-17-dgx002-gpu5-oversubscription]]
- [[bcm-bright-cluster-manager]] — config propagation via BCM image sync
- [[gpu-topology-betty]] — the physical topology this file describes

## Sources
- [[2026-04-21-parcc-ops-discussion]]
