---
type: entity
tags: [betty, hpc, cluster, parcc, upenn]
created: 2026-04-08
updated: 2026-06-23
sources: [2026-04-08-betty-initial-exploration, 2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest, 2026-06-23-teams-chats-digest]
related: [dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, vast-storage, slurm-on-betty, open-ondemand-betty, parcc-helper-tools, slurm-cli-filter, kerberos-ssh-macos-fix, bcm-bright-cluster-manager, kenneth-chaney]
status: current
---

# Betty Cluster

## One-line summary
PARCC's first university-wide HPC/AI supercomputer at UPenn, centered on 27 NVIDIA DGX B200 nodes with 216 total B200 GPUs.

## Basics
- **Login host**: `login.betty.parcc.upenn.edu`
- **Web portal**: [[open-ondemand-betty]] at `ood.betty.parcc.upenn.edu`
- **Organization**: Penn Advanced Research Computing Center (PARCC)
- **Auth**: PennKey + Duo 2FA (Kerberos or password SSH)
- **OS**: Ubuntu 24.04.4 LTS
- **Scheduler**: [[slurm-on-betty]] 24.11.7, backfill policy

## Compute
| Partition | Nodes | Purpose | Page |
|-----------|-------|---------|------|
| dgx-b200 | 27 | Main GPU — 216 full B200s | [[dgx-b200-partition]] |
| b200-mig45 | 1 | 32x 45GB MIG slices | [[b200-mig45-partition]] |
| b200-mig90 | 1 | 16x 90GB MIG slices | [[b200-mig90-partition]] |
| genoa-std-mem | 64 | AMD EPYC CPU | [[genoa-std-mem-partition]] |
| genoa-lrg-mem | 10 | AMD EPYC, ~1TB RAM | [[genoa-lrg-mem-partition]] |

## Facility
- **Server-room noise:** the Betty machine room runs at ~**110 dB** — hearing protection (ear muffs) is required inside the racks (per a Penn Today article photo of [[kenneth-chaney]]). Audio recording on-site is impractical; practical note for visitors/interviews. (2026-06-18)

## Storage
See [[vast-storage]].
- Home: 50 GB quota — **configs and code only, never models/datasets**
- Projects: multi-TB quotas managed by PI
- **Critical rule**: always set `HF_HOME` to project storage (see [[huggingface-cache-management]])

## Access methods
1. **SSH** (primary): `ssh <pennkey>@login.betty.parcc.upenn.edu`
2. **Open OnDemand** (web): [[open-ondemand-betty]] — provides browser-based shell and interactive desktop
3. **OOD shell via Chrome MCP** — how this agent currently drives the cluster

## Our account
- **Account**: `jcombar1-betty-testing`
- **Allocation**: 12,000 PC (as of 2026-04-08)
- **Primary user**: jvadala
- Billing model: see [[betty-billing-model]]

## Known issues
- `interact` helper script references a nonexistent `defq` partition — broken
- **dgx015** node is in `down` state (as of 2026-04-08)
- **dgx022** has a GRES/GPU count mismatch (invalid state)
- Shared `pytorch` conda env has outdated transformers (4.32) — don't use directly
- No pre-built NGC containers or shared model cache

## Incidents / open issues (June 2026, from [[2026-06-16-teams-chats-digest]])
- **`libhwloc.so.15` outage (6/16):** the library went missing → `dlopen(.../mpi_pmix.so): libhwloc.so.15: cannot open shared object file` → cluster-wide `srun` failures (`Invalid MPI type 'pmix'`) and nodes going down. Restored by [[kenneth-chaney]] (library put back); AHEAD doing an RCA on how it was deleted.
- **BCM → VAST new-user home-dir creation fails** after the NFSv4 + idmap switch: BCM (`user; add ...; commit`) cannot create the home dir, leaving it **owned by root** with `/etc/skel` not copied (`Unable to copy to /vast/home/...`, `Failed to create home directory ... from /etc/skel/`). Blocks OOD login for new users (e.g. abbyleib, tamachad, rhoadese). Do **not** manually fix yet — skel deployment is also broken. See [[bcm-bright-cluster-manager]].
  - **Update (2026-06-23, [[kenneth-chaney]]):** the broken home dirs are because **user creation and the rest of the account sync are still paused**. Plan: after the pending **Palo Alto TAC** (firewall vendor support) session, Ken will run one round of syncs and **manually fix all user home folders** that get created.
  - **Midday escalation (2026-06-23):** hold still in place; 3 new PIs onboarded → [[jaime-combariza]] flagged it top priority ("PARCC will not function properly if part of the system is down for weeks"). Ken running a manual workaround while awaiting BCM and/or VAST (~1pm target). Paused user creation is the **upstream dependency for the whole automation pipeline** — downstream automations assume users are already in place, and approved projects/allocations won't propagate to Betty until the sync resumes.
  - **Workaround verified (2026-06-23, ~16:33–16:40Z, [[kenneth-chaney]]):** the manual fix is **good for users**, and the remaining syncs (groups, VAST, Ceph, Slurm) are **verified**. Ken notes the workaround should stay **safe even after the root cause is fixed** (while disliking that it's needed). New-user provisioning is unblocked via the manual path; the underlying paused-sync root cause is still open.
- **`parcc_quota` home-folder logic broken** since the NFSv4 upgrade (for all users) — see [[parcc-helper-tools]].
- **ColdFront ↔ Grouper PI miscommunication:** faculty accounts not flagged `is_pi` (e.g. tamachad); under debugging.
- **VAST VMS portal flaky** (data plane unaffected, no user impact) — see [[vast-storage]].
- **macOS SSH login failures** — client-side Kerberos issue, see [[kerberos-ssh-macos-fix]].
- The Slurm `cli_filter` (defaults `--qos=dgx` for `dgx-b200`) has a `--mem` bug under repair — see [[slurm-cli-filter]].

## Workflows we use
- LLM fine-tuning: see [[lora-fine-tuning]], [[qlora]], [[deepspeed-zero]]
- LLM inference: see [[vllm-serving]]
- Vision-language training: see [[vision-language-models]], [[qwen2.5-vl-7b-instruct]]

## Sources
- [[2026-04-08-betty-initial-exploration]] — First full audit
- [[2026-04-08-betty-system-guide]] — Written guide
