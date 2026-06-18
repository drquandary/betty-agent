---
type: source
tags: [betty, teams, slurm, ssh, pam, cgroup]
created: 2026-06-18
updated: 2026-06-18
related: [betty-auth-architecture, jamie-schnaitter, slurm-on-betty]
status: current
---

# Teams Chats Digest — 2026-06-18

## One-line summary
PARCC Group thread: Jamie Schnaitter confirms `pam_slurm_adopt` is now live on Betty (SSH to a node with a running job), with a multi-job-per-node cgroup caveat.

## What's new this cycle

- **`pam_slurm_adopt` is deployed** (Jamie Schnaitter, PARCC Group, 2026-06-18): users can now SSH directly to a compute node where they have a running job, and the session is adopted into that job's cgroup.
- **Multi-job caveat**: if a user has more than one job on the same node, the SSH session attaches to the cgroup of only **one** of those jobs — so resource visibility (CPU/GPU/memory) reflects a single allocation, not the union. Relevant when interactively debugging stacked jobs on one node.

## Pages touched
- Updated [[betty-auth-architecture]] — added deployment-status + multi-job cgroup caveat under the pam_slurm_adopt section
- Updated [[jamie-schnaitter]] — added compute-node SSH confirmation

## Sources
- PARCC Group Teams chat, message from Jamie Schnaitter, 2026-06-18T17:57Z (digest `digest_20260618T140429.json`)
