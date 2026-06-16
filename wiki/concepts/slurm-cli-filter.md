---
type: concept
tags: [betty, slurm, cli-filter, lua, qos, mem, bashrc, facilitation]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest]
related: [slurm-on-betty, slurm-advisor, ryan-bradley, jeffrey-vadala, jaime-combariza, betty-cluster]
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

## Rollout guidance
- Use the updated instructions and put the filter invocation in `~/.bashrc` so it covers interactive sessions, not just batch.

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
