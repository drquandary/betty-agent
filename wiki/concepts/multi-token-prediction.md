---
type: concept
tags: [llm, inference, decoding, speculative-decoding, mtp, model-serving]
created: 2026-06-25
updated: 2026-06-25
sources: [2026-06-25-teams-chats-digest]
related: [glm-5.2, kenneth-chaney, vllm-serving]
status: tentative
---

# Multi-Token Prediction (MTP)

## One-line summary
An inference-acceleration technique where a model predicts several future tokens per step (via extra prediction heads) and verifies them in one pass — a faster cousin of classic draft-model speculative decoding.

## Content
- **The distinction Ken drew (2026-06-25).** Jeffrey described the speedup as classic *speculative decoding*: "the draft model writes, and the large model just checks it?" Ken corrected the framing — *"It is a much faster MTP."*
- **Classic speculative decoding** uses **two separate models**: a small, fast *draft* model proposes a span of tokens, and the large *target* model verifies them in a single forward pass, accepting the longest correct prefix. Speedup comes from the draft being cheap.
- **MTP (Multi-Token Prediction)** instead trains the **single main model** with additional lightweight prediction *heads* so it emits multiple future tokens per decode step, which are then verified — no separate draft model to host or keep in sync. This is why Ken calls it a "much faster MTP": the proposal stage is essentially free and the architecture is one model.
- **Why PARCC cares.** Faster decoding = higher tokens/sec on the served model on Betty's B200s, relevant to Ken's model-serving work (Unsloth quants, GLM family) and the PARCC LiteLLM gateway. [[glm-5.2]] from [[z.ai]] is the concrete model that surfaced this; Ken intends to try it.

> status: tentative — captured from a short chat exchange; mechanism summary is general LLM knowledge, not yet validated against GLM-5.2's specific implementation on Betty.

## See also
- [[glm-5.2]]
- [[vllm-serving]]
- [[kenneth-chaney]]

## Sources
- [[2026-06-25-teams-chats-digest]] — Ken/Jeffrey exchange: "the draft model writes, and the large model just checks it?" → "It is a much faster MTP."
