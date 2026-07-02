---
type: concept
tags: [betty, slurm, cli-filter, job-submit, lua, qos, mem, bashrc, deployment, facilitation]
created: 2026-06-16
updated: 2026-07-02
sources: [2026-06-16-teams-chats-digest, 2026-07-02-teams-chats-digest]
related: [slurm-on-betty, slurm-advisor, ryan-bradley, jeffrey-vadala, jaime-combariza, kenneth-chaney, jamie-schnaitter, betty-cluster]
status: current
---

# SLURM CLI Filter

## One-line summary
A Lua `cli_filter` plugin for Slurm on Betty that rewrites and validates job-submission flags client-side (e.g. defaulting `--qos=dgx` for `dgx-b200`); owned by [[ryan-bradley]], with a known `--mem`-propagation bug found by [[jeffrey-vadala]].

## What it does
- Intercepts `srun` / `sbatch` / `salloc` flags before submission and applies PARCC defaults and validation.
- Observed behavior in logs: `cli_filter: defaulting --qos=dgx for partition 'dgx-b200' (acct=...)`.
- Distributed to users to put in `~/.bashrc` so it applies to interactive sessions. jvadala runs a local **copy** of `slurm-cli-filter.py`.
- Complements the deterministic-policy approach of the [[slurm-advisor]] (which pre-validates an entire pasted sbatch in chat); the cli_filter is the in-band, always-on client-side enforcement layer.

## The `--mem` bug (found ~2026-06-15)

> **Significance:** `--mem` is the key memory flag for AI/ML users, so this bug matters for the primary user base.

- Documented in `bug1.rtf` (shared in Teams).
- Symptom: when both `--mem` and `--mem-per-cpu` are involved, the filter mishandles `--mem` — it propagates and causes an error.
- Root cause per ryb: he rarely uses `--mem`; the test suite checks the memory *amount* but not the actual *usage of the `--mem` flag*.
- **Fix plan:** prevent `--mem` from propagating / causing the error unless it disagrees with `--mem-per-cpu`; add a test covering `--mem` usage; then jvadala retests.
- ryb wants the filter solid before [[jaime-combariza]] tests it heavily.

## Default-memory contract (2026-07-02)
The filter's memory behavior, per owner [[ryan-bradley]] — the design goal is *"the user doesn't need to think about memory if it's enough, and they can use fewer flags"*:
- **CPU nodes:** **5.5 GB or 15.5 GB per core** (allocated in MB) — i.e. std-mem vs large-mem tiers ([[genoa-std-mem-partition]] / [[genoa-lrg-mem-partition]]).
- **GPU partitions:** **8 GB per CPU thread**.
- [[jaime-combariza]] pushed back (7/2), wanting the old Slurm behavior — memory = **tasks × `MemPerCPU` from `slurm.conf`** (e.g. 8 cores → ~48 GB) — set **partition-independently** so users needn't request it explicitly (else an error/warning). Ryan holds it's already working as intended and asked Jaime whether he's *"seeing something that contradicts this."* Open thread; cf. the `--mem` bug below (both concern how memory flags flow through the filter). `status: tentative` — awaiting Jaime's reply.

## Rollout guidance
- Use the updated instructions and put the filter invocation in `~/.bashrc` so it covers interactive sessions, not just batch.

## Server-side deployment (2026-07-02)
Moving from per-user `~/.bashrc` opt-in toward **centrally-configured Slurm plugins**.
- [[kenneth-chaney]] convened a working meeting **"Deploy cli_filter and job_submit plugins"** (started ~8:59 AM, 7/2), pulling in [[jamie-schnaitter]] and **AHEAD/vendor guests** (Swapnil Ninave, Rahul Tiwari, Ryan Heath — the same vendor engineers from the Ceph remediation).
- **Two plugins being deployed together:**
  - `cli_filter` — the client-side Lua flag-rewriter documented above.
  - `job_submit` — a **server-side** Slurm plugin (configured via `JobSubmitPlugins=` in `slurm.conf`), i.e. policy/validation enforced centrally at submission time rather than depending on each user's bashrc.
- **Prod config path** (posted by Swapnil Ninave): `/cm/shared/apps/slurm/etc/slurm/slurm.conf` — the live `slurm.conf` under the BCM/`cm`-shared Slurm install (see [[bcm-bright-cluster-manager]], [[slurm-on-betty]]). `status: tentative` — deployment in progress, outcome not yet confirmed.

## Related thread — Rachit's GPU code (`ld-gpu`)
- jvadala hit a permission wall reading a complex GPU LD code at `/vast/home/r/rachitk/src/ld-gpu/` (`not readable by jvadala (permission denied)`) while chasing a similar memory-related issue he hit last year.
- Rachit offered the code, so copying is implied-OK, but it needs **root** (no sudo system on Betty yet) — ryb to copy it somewhere readable.
- ryb's caution: without a strict MWE / exact reproduction inputs, copying highly complex code leads to a "wild goose chase."

## See also
- [[slurm-on-betty]] — the Slurm 24.11.7 install the filter plugs into
- [[slurm-advisor]] — the chat-side pre-validation companion
- [[ryan-bradley]] — owner of the filter
- [[jeffrey-vadala]] — found the `--mem` bug
- [[betty-cluster]]

## Sources
- [[2026-06-16-teams-chats-digest]] — the `--mem` bug thread, bashrc rollout, and Rachit code thread
- [[2026-07-02-teams-chats-digest]] — "Deploy cli_filter and job_submit plugins" meeting; prod `slurm.conf` path; the default-memory contract (5.5/15.5 GB per core CPU, 8 GB per thread GPU) + Jaime's partition-independent-memory request
