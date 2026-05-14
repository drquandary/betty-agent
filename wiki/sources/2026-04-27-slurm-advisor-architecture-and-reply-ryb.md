---
type: source
tags: [source, slurm, advisor, betty-agent, architecture]
created: 2026-05-13
updated: 2026-05-13
sources: []
related: [slurm-advisor, slurm-state-dimensionality]
status: current
---

# Source: 2026-04-27 — SLURM Advisor architecture deep-dive + reply to Ryan

## What it is
Same-day revised reply from jvadala to ryb addressing Ryan's five review asks plus the "how does this actually work" architecture deep dive Ryan requested. One document doing two jobs: Part A is the slide deck (data flow, where MiniZinc fits relative to SLURM, what runs on the user's laptop vs. on Betty); Part B is the point-by-point replies. Lives at `raw/docs/2026-04-27-slurm-advisor-architecture-and-reply-ryb.md`.

## Key claims
- End-to-end chat turn flow: browser → Next.js `/api/chat` SSE → claude-agent-sdk → MCP tool (registers 11 tools, 4 of them `slurm_*`) → either spawn local Python (`python -m slurm_advisor.cli ...`) or `runRemote` over the shared SSH ControlMaster socket → JSON payload wrapped in a `betty-slurm-*` fenced code block.
- The **verbatim-paste contract**: the LLM is instructed to introduce the card with one sentence, paste the fenced block verbatim, and follow with one next-step sentence. Phrasing variation in the intro/outro is tolerated; structural variation in the fenced block is not. `ChatMessage.tsx` dispatches each fence kind to a dedicated React renderer (`<SlurmRecommendCard/>`, etc.).
- The architecture treats the LLM as a tool-selector and narrator; the constraint solving and policy enforcement are deterministic Python.
- Anti-hallucination is enforced at three layers: (1) the JSON schema includes provenance fields, (2) the system prompt enumerates exactly what each tool sees, (3) wiki pages mirror the prompt section so it can be linked from the chat.

## See also
- [[slurm-advisor]]
- [[2026-04-27-slurm-advisor-report-ryb]]
- [[2026-04-27-slurm-advisor-evidence-report-ryb]]
