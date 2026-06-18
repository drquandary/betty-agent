---
type: source
tags: [betty, teams, slurm, ssh, pam, cgroup, cuda, nvidia-driver]
created: 2026-06-18
updated: 2026-06-18
related: [betty-auth-architecture, jamie-schnaitter, slurm-on-betty, cuda-forward-compatibility-betty]
status: current
---

# Teams Chats Digest — 2026-06-18

## One-line summary
PARCC Group threads: Jamie Schnaitter confirms `pam_slurm_adopt` is live on Betty (SSH to a node with a running job), and a long Bradley/Chaney/Schnaitter thread works out PARCC's CUDA forward-compatibility / driver-upgrade strategy.

## What's new this cycle

- **`pam_slurm_adopt` is deployed** (Jamie Schnaitter, PARCC Group, 2026-06-18): users can now SSH directly to a compute node where they have a running job, and the session is adopted into that job's cgroup.
- **Multi-job caveat**: if a user has more than one job on the same node, the SSH session attaches to the cgroup of only **one** of those jobs — so resource visibility (CPU/GPU/memory) reflects a single allocation, not the union. Relevant when interactively debugging stacked jobs on one node.
- **CUDA forward-compatibility strategy** (Bradley/Chaney/Schnaitter, PARCC Group, 2026-06-18): hardware sets the min CUDA (B200 → 12.8), the driver sets the max (580 → ~13.1), and `cuda-compat-*` packages raise the ceiling without a driver change. Spack compiles ahead of the driver and ships no compat layer; Ken will install `cuda-compat-13-1..13-3` in the OS image in July for non-spack (conda) use. Default stack is pinned at `arch/26.1` + `cuda/13.1.1`. Gurobi 13 is driver-locked to NVIDIA 570; RELION patched to gcc 15; CUDA 13.2 brings more fp64 emulation (Ken's B200 GEMM bench: fp32 emul 2.24×, fp64 emul 1.60×). Driver upgrade gated on DOCA-OFED migration (Betty still on mlnx-ofed) and SuperPOD matrix still on 580.126.16. Full detail → [[cuda-forward-compatibility-betty]].

## Pages touched
- Created [[cuda-forward-compatibility-betty]] — the CUDA/driver ceiling model, OS-image compat plan, default modules, driver-upgrade outlook
- Updated [[betty-software-deployment]] — recorded default `arch/26.1`/`cuda/13.1.1` stack and linked the new compat page
- Updated [[betty-auth-architecture]] — added deployment-status + multi-job cgroup caveat under the pam_slurm_adopt section
- Updated [[jamie-schnaitter]] — added compute-node SSH confirmation

## Sources
- PARCC Group Teams chat, Jamie Schnaitter, 2026-06-18T17:57Z (digest `digest_20260618T140429.json`)
- PARCC Group Teams chat, Bradley/Chaney/Schnaitter CUDA thread, 2026-06-18T13:57–16:32Z (digest `digest_20260618T133105.json`)
