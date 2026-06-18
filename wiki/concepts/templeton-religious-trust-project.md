---
type: concept
tags: [project, jvadala, llm, classification, knowledge-graph, sna, templeton]
created: 2026-06-18
updated: 2026-06-18
sources: [2026-06-18-teams-chats-digest]
related: [jeffrey-vadala, kenneth-chaney, betty-ai-agent]
status: tentative
---

# Templeton Religious-Trust Project

## One-line summary
jvadala's research project (funded under a Templeton religious-trust grant) that uses a large open LLM to classify free-text accounts of religious experience and convert them into knowledge graphs for social-network analysis (SNA).

## Content
- **Goal**: turn ~2000 free-response survey answers describing religious experience into structured knowledge graphs, then run SNA over them.
- **Method**: LLM-driven classification — **4 classifications per response**, **bootstrapped 10×**. The high call volume (≈2000 × 4 × 10) is why inference speed dominates the model choice.
- **Model**: a **120B open model** (status: tentative — likely the gpt-oss-120b class), adopted on [[kenneth-chaney]]'s recommendation; chosen because it is fast enough for the bootstrapped classification workload. Jeffrey is using the same 120B model Ken suggested for his other work.
- **Early quality signal**: one classification ("q2") scored ~86% — noted as a bit lower than hoped but workable (tentative; single data point shared in chat).
- Distinct from jvadala's [[surgical-tool-id-vlm]] and [[betty-ai-agent]] work; this is research-funded outreach Jeffrey brings to PARCC.

## See also
- [[jeffrey-vadala]]
- [[kenneth-chaney]] — recommended the 120B model
- [[surgical-tool-id-vlm]]

## Sources
- [[2026-06-18-teams-chats-digest]] — Ken Chaney 1:1 chat, 2026-06-18T22:18–22:24Z
</content>
</invoke>
