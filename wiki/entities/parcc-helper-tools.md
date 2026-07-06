---
type: entity
tags: [betty, tools, parcc, cli]
created: 2026-04-08
updated: 2026-07-06
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide, 2026-06-16-teams-chats-digest, 2026-07-06-teams-chats-digest]
related: [betty-cluster, slurm-on-betty, vast-storage, betty-billing-model, betty-ai-agent, kenneth-chaney]
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

## Updates (June 2026, from [[2026-06-16-teams-chats-digest]])
- **`parcc_sfree.py`** — additional flags surfaced by [[kenneth-chaney]]: `--by node` for per-node granularity and `--json` for machine-readable output. This is the canonical free/used data source the [[betty-ai-agent]] dashboard should consume.
- **`parcc_sandbox`** — new tool built by Chaney: a sandboxing wrapper that runs a tool (e.g. `pi` / Claude code) with RW to the current dir and RO elsewhere. `parcc_sandbox -- pi`; add writable dirs with `parcc_sandbox -w ${OTHER_DIR} -- pi`. Deployed on `login03`.
- **`parcc_quota` / `parcc-quota`** — home-folder logic **broken since the NFSv4 upgrade** (broken for all users, not user-specific). Intermittently returns nothing for HOME dirs.

## Updates (July 2026, from [[2026-07-06-teams-chats-digest]])
- **`parcc_quota.py --snapshots`** — new flag added by [[kenneth-chaney]] (2026-07-06) that surfaces the **per-project protected-path snapshots** now deployed on [[vast-storage]]. **Off by default** and stays quiet until snapshots populate (~2-week ramp to full count per protected path). Protected paths are **configured in ColdFront**, not on the filesystem.

## Known issues
- **`interact`** is broken — references nonexistent `defq` partition. Use `srun -p dgx-b200 --gpus=1 -t 00:30:00 --pty bash` instead.
- **`parcc_quota`** home-folder reporting broken post-NFSv4 (see above).

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
- [[betty-ai-agent]] — consumes `parcc_sfree.py --json` for its dashboard
- [[kenneth-chaney]] — built `parcc_sandbox`, owns `parcc_sfree.py`

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
- [[2026-06-16-teams-chats-digest]] — `parcc_sfree.py` flags, `parcc_sandbox`, `parcc_quota` breakage
- [[2026-07-06-teams-chats-digest]] — `parcc_quota.py --snapshots` flag for VAST protected-path snapshots
