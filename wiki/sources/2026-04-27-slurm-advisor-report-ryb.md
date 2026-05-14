---
type: source
tags: [source, slurm, advisor, betty-agent]
created: 2026-05-13
updated: 2026-05-13
sources: []
related: [slurm-advisor, slurm-state-dimensionality]
status: current
---

# Source: 2026-04-27 — SLURM Advisor status report to ryb

## What it is
Point-in-time status report from jvadala to ryb (PARCC director) introducing the four `slurm_*` agent tools and the TRES-based framing of what Betty agent currently captures about SLURM state. Lives at `raw/docs/2026-04-27-slurm-advisor-report-ryb.md`. The companion live coverage matrix is the wiki page [[slurm-state-dimensionality]].

## Key claims
- Four tools shipped: `slurm_check`, `slurm_recommend`, `slurm_availability`, `slurm_diagnose`.
- `slurm_recommend` runs a **MiniZinc constraint model** (with a pure-Python deterministic fallback) over `betty_cluster.yaml` partition geometry to pick the cheapest legal shape.
- TRES coverage matrix: of ~12 dimensions a scheduler advisor should see, 5 are captured live, 4 are static-or-parser-ready-but-unwired, 3 are not captured (priority decomposition via `sprio`, backfill health via `sdiag`, per-node drain reasons).
- Anti-hallucination fix: the original agent invented score weights and tool capabilities. Three-part remedy — surface `score_formula` / `sources` / `load_curve_kind` in the tool payload; hard-coded "never invent how the tools work" section in the system prompt; require the wiki page + prompt + code to update together when a new live signal is added.
- Top-ranked next investments: `sprio` per pending job into `slurm_diagnose`; reservations auto-fed into `slurm_availability`; nightly `sacct → features` cron to turn the synthetic load curve into a real one.

## See also
- [[slurm-advisor]]
- [[slurm-state-dimensionality]]
- [[2026-04-27-slurm-advisor-evidence-report-ryb]]
- [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]]
