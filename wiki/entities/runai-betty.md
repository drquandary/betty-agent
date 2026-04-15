---
type: entity
tags: [betty, runai, scheduling, ai-platform]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-cluster, vast-storage, betty-storage-architecture, slurm-on-betty]
status: tentative
---

# RunAI on Betty

## One-line summary
RunAI AI job scheduling platform is present on Betty with a VAST mount at `/mnt/vast/runai`, but its relationship to Slurm and user-facing availability are not yet explored.

## What we know
- **Mount point**: `/mnt/vast/runai` on VAST storage (NFS 4.2 over RDMA, same as other VAST mounts)
- **Discovery**: found during Part 2 storage exploration on dgx028 (2026-04-10)
- **RunAI** is NVIDIA's AI workload scheduling platform, typically used for GPU cluster management, fractional GPU allocation, and ML pipeline orchestration

## What we don't know
- Whether RunAI is actively used or is a legacy/pilot installation
- How it interacts with [[slurm-on-betty]] -- does it replace Slurm for some workloads, or run alongside it?
- Whether regular users can access RunAI, or if it is admin-only
- What configuration or data lives under `/mnt/vast/runai`
- Whether RunAI provides features not available through Slurm (e.g., fractional GPU, gang scheduling)

## Next steps
- Investigate contents of `/mnt/vast/runai` (if readable)
- Ask PARCC admins about RunAI availability and intended use
- Check if any RunAI CLI tools are installed (`runai` command)

## See also
- [[betty-cluster]]
- [[slurm-on-betty]]
- [[vast-storage]]
- [[betty-storage-architecture]]

## Sources
- Part 2 dgx028 architecture exploration (2026-04-10)
