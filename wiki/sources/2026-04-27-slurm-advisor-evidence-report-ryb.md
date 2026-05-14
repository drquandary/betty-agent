---
type: source
tags: [source, slurm, advisor, betty-agent, validation]
created: 2026-05-13
updated: 2026-05-13
sources: []
related: [slurm-advisor, slurm-state-dimensionality]
status: current
---

# Source: 2026-04-27 — SLURM Advisor end-to-end evidence report

## What it is
Companion to the [[2026-04-27-slurm-advisor-report-ryb]] status report. Drives the four `slurm_*` agent tools end-to-end through the chat UI against the live cluster and captures the rendered card outputs verbatim. Lives at `raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md`.

## Key claims
- `slurm_recommend` and `slurm_check` both worked first try with real cluster data: MiniZinc returned a correct shape using real `sshare` fairshare rows; `slurm_check` blocked correctly with all three expected violation codes and the suggested fix was self-valid.
- `slurm_availability` worked with full live data in the first session; in a retry session Kerberos had expired and the system correctly **degraded gracefully** — labelled the load curve as synthetic and named the missing precondition ("Kerberos ticket expired — run `kinit jvadala@UPENN.EDU`") rather than hallucinating.
- `slurm_diagnose` was not tested in this session — it needed both a fresh kinit and a real pending JobID.
- The graceful-degradation behavior is itself the most important property to verify: no hallucination, no invented data.
- Backend confirmed: MiniZinc 2.9.6 + Gecode 6.2.0 (registered via `~/.minizinc/solvers/gecode.msc` because the brew formula doesn't auto-register Gecode).

## See also
- [[slurm-advisor]]
- [[2026-04-27-slurm-advisor-report-ryb]]
- [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]]
