---
type: entity
tags: [betty, tools, parcc, cli]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, slurm-on-betty, vast-storage, betty-billing-model]
status: current
---

# PARCC Helper Tools

## One-line summary
Python helper scripts in `/vast/parcc/sw/bin/` that wrap Slurm and VAST to give quick answers on quota, availability, QOS, and billing.

## The scripts
| Tool | Purpose | Example |
|------|---------|---------|
| `parcc_quota.py` | Storage quota overview | `parcc_quota.py` |
| `parcc_du.py` | Directory disk usage | `parcc_du.py /vast/projects/<proj>` |
| `parcc_sfree.py` | Available partitions / nodes / GPUs | `parcc_sfree.py` |
| `parcc_sqos.py` | Your QOS limits and current usage | `parcc_sqos.py` |
| `parcc_sreport.py` | Usage / billing summary | `parcc_sreport.py --user jvadala` |
| `parcc_sdebug.py` | Debug failed jobs or nodes | `parcc_sdebug.py --job <JOBID>` |
| `parcc_free.py` | Free resources overview | `parcc_free.py` |
| `interact` | Quick interactive session | **BROKEN** — references nonexistent `defq` |
| `betty-jupyter.sh` | Launch Jupyter on a compute node | `betty-jupyter.sh` |
| `spackon` / `p-spackon` | Spack package management | `spackon` |

## Known issues
- **`interact`** is broken — references nonexistent `defq` partition. Use `srun -p dgx-b200 --gpus=1 -t 00:30:00 --pty bash` instead.

## Daily-driver workflow
```bash
parcc_quota.py          # am I out of space?
parcc_sfree.py          # is the cluster busy?
parcc_sqos.py           # what are my limits?
parcc_sreport.py --user jvadala   # how much have I burned?
```

## See also
- [[betty-cluster]]
- [[slurm-on-betty]]
- [[vast-storage]]
- [[betty-billing-model]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
