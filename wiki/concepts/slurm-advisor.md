---
type: concept
tags: [betty, slurm, advisor, betty-agent, constraint-solver, minizinc]
created: 2026-05-13
updated: 2026-05-13
sources: [2026-04-27-slurm-advisor-report-ryb, 2026-04-27-slurm-advisor-evidence-report-ryb, 2026-04-27-slurm-advisor-architecture-and-reply-ryb]
related: [slurm-state-dimensionality, slurm-gres-conf, slurm-node-state-modifiers, slurm-on-betty, betty-billing-model, slurm-cli-filter, betty-ai-agent]
status: current
---

# SLURM Advisor

## One-line summary
A subsystem of Betty Agent that shapes and validates SLURM job submissions *before* they reach the scheduler — four agent tools backed by a MiniZinc constraint model, a YAML-encoded policy source-of-truth, and live SLURM commands.

## Why this matters
The most common questions PARCC support handles — "why is my job pending?", "what partition should I use?", "is this sbatch script reasonable?" — have answers that are mechanically derivable from cluster state and policy, but the derivation is not a researcher's specialty. The advisor encapsulates that derivation behind chat, with three load-bearing properties: math runs in Python (not in the LLM), live cluster state is fetched at the moment of use, and every number cites its source. See [`BETTY_SLURM_ADVISOR_REPORT.md`](../../BETTY_SLURM_ADVISOR_REPORT.md) for the full architecture report.

## The four tools

Source: `betty-ai-web/src/agent/tools/slurm-*.ts` (TS adapters) + `betty-ai/slurm_advisor/` (Python core).

- **`slurm_check`** — Lints any pasted sbatch against PARCC policy: per-partition geometry, QOS GPU caps, CPU-per-GPU ratio (≤28 default), memory caps (≤224 GB/GPU), walltime backfill heuristics (≤24h on GPU partitions). Returns `status: ok | revise | block` with a suggested fix that is itself re-validated.
- **`slurm_recommend`** — Given a high-level intent ("2 GPUs for 8 hours, 70B model"), runs a [MiniZinc](https://www.minizinc.org/) constraint model to pick the cheapest legal partition shape. Pre-filters by VRAM floor and NVLink requirement. Falls back to a deterministic Python enumerate-and-rank when MiniZinc isn't installed.
- **`slurm_availability`** — Combines live `sinfo` + `squeue --start` + `scontrol show res` with an hour-of-day load profile to rank candidate time-slots, rendered as a calendar card in chat.
- **`slurm_diagnose`** — Runs `scontrol show job` + `sprio -hl` and maps SLURM Reason codes to plain-English causes plus the specific priority factor (FAIRSHARE / JOBSIZE / AGE / ...) dragging the job down.

## Architecture in one paragraph

A chat turn flows: browser → Next.js SSE → `claude-agent-sdk` → MCP server with 11 tools → tool implementation either spawns local Python (`python -m slurm_advisor.cli ...`) or calls `runRemote` over the shared SSH ControlMaster socket. The tool returns JSON wrapped in a `betty-slurm-*` fenced code block; the model is instructed to paste the fence verbatim, with `ChatMessage.tsx` dispatching each fence kind to a dedicated React card. The LLM is a tool-selector and narrator; constraint solving and policy enforcement are deterministic Python.

## Five safety contracts

Each is encoded as code, tested, and visible to the user in the rendered card.

1. **VRAM safety** — when `min_vram_gb` is set, no partition with smaller per-GPU VRAM appears in the result. When unset, the card's `vram_constraint.enforced` field is `false` and the message contains "not constrained".
2. **Synthetic-vs-historical curve labeling** — the load curve is real (from `betty-ai/data/features/partitions/<p>.json`) when present, synthetic otherwise. The card labels which in `load_curve_kind`, color-coded green/amber.
3. **Backfill caveats** — any pending job with `TimeLimit > 24h` triggers a backfill-related cause regardless of the SLURM Reason; the recommend card emits a backfill warning at the soft cap.
4. **Queue privacy** — `slurm_availability` aggregates pending counts only; no per-job IDs appear in the output payload.
5. **Graceful SSH degradation** — when SSH fails, kinit is expired, or no historical features file exists, the tool returns *empty* `sources` (not synthesized data) and the UI surfaces a red "pre-validation" or "kinit needed" badge. Verified by [`test_propose_slots_tags_synthetic_when_no_real_curve`](../../betty-ai/slurm_advisor/tests/test_load_curve.py) and the expired-kinit E2E walkthrough in [[2026-04-27-slurm-advisor-evidence-report-ryb]].

## Anti-hallucination contract

The original agent invented score weights and tool capabilities when asked "how does this work?". The remedy is three-part:
1. Tool result schema includes `score_formula`, `sources`, and `load_curve_kind` provenance fields.
2. [`system-prompt.ts`](../../betty-ai-web/src/agent/system-prompt.ts) contains a hard "never invent how the tools work" section enumerating what each `slurm_*` tool can and cannot see, with file pointers.
3. Adding a new live signal requires updating the source-code tool, the system-prompt section, AND a wiki page (this one or [[slurm-state-dimensionality]]) in the same commit.

## Test coverage

128 tests total across Python and TypeScript:
- **110 Python** in [`betty-ai/slurm_advisor/tests/`](../../betty-ai/slurm_advisor/tests/) — 82 in the scenario matrix `test_scenarios.py` (cross-product across GPU count × VRAM × walltime × time-of-day × cluster state × pending depth × sbatch shape × Reason code), 28 in the per-module unit tests.
- **18 TypeScript** in [`slurm-availability.test.ts`](../../betty-ai-web/src/agent/tools/slurm-availability.test.ts) — `sinfo` / `squeue` parsers, regex correctness for typed GRES.

The full plan, dimension matrix, and 10 researcher-persona scenarios are documented in [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../../BETTY_SLURM_ADVISOR_TEST_PLAN.md).

## Current gaps and next steps

Ranked from the [[2026-04-27-slurm-advisor-report-ryb]] status report:
1. `sprio` per pending job folded into `slurm_diagnose` — turns opaque `Reason=Resources` into "your jobsize factor is dragging you down".
2. `scontrol show res` auto-fed into `slurm_availability` — parser exists in `betty-ai/scheduling/parsers.py`, just needs a 15-minute cache.
3. Nightly `sacct → features` cron — pipeline exists (`python -m scheduling.cli all`); running it nightly converts the synthetic load curve into a real one.
4. `sdiag` snapshot in the calendar card — tells the user whether backfill is keeping up.
5. Per-node drain reasons surfaced in `slurm_diagnose`.

Multi-user deployment is planned via Open OnDemand Batch Connect.

## See also
- [[slurm-cli-filter]] — the in-band Lua client-side flag enforcer (companion to the advisor's chat-side pre-validation)
- [[betty-ai-agent]] — the broader agent the advisor is a subsystem of
- [[slurm-state-dimensionality]] — what slice of SLURM's TRES vector the advisor currently sees
- [[slurm-on-betty]] — the Slurm 24.11.7 install on Betty
- [[slurm-gres-conf]] — GRES configuration anomalies the advisor must tolerate
- [[slurm-node-state-modifiers]] — `sinfo` suffix glossary the parsers consume
- [[betty-billing-model]] — the cost weights the MiniZinc objective minimizes

## Sources
- [[2026-04-27-slurm-advisor-report-ryb]] — status report introducing the four tools and TRES framing
- [[2026-04-27-slurm-advisor-evidence-report-ryb]] — point-in-time end-to-end validation against live cluster
- [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]] — architecture deep-dive + reply to Ryan's review asks
- [`BETTY_SLURM_ADVISOR_REPORT.md`](../../BETTY_SLURM_ADVISOR_REPORT.md) — full architecture report (in repo root)
- [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../../BETTY_SLURM_ADVISOR_TEST_PLAN.md) — test plan companion
