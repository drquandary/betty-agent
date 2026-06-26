---
type: concept
tags: [dflash, inference, serving, gpt-oss, sglang, runai, kenneth-chaney, agents]
created: 2026-06-26
updated: 2026-06-26
sources: [2026-06-25-teams-chats-digest, 2026-06-26-teams-chats-digest]
related: [kenneth-chaney, jeffrey-vadala, templeton-religious-trust-project, runai-betty, vllm-serving]
status: tentative
---

# dflash

## One-line summary
An unidentified tool/project Ken Chaney is testing on PARCC against GPT-OSS serving stacks — likely inference/serving related; Jeffrey thinks it may be "killer" for one of his own projects. Details still uncertain.

## Content
- **Origin (6/25):** Ken asked Jeffrey "Have you seen dflash?" with no further context. Jeffrey reacted that "dflash might be killer for this other project I am trying to do" (plausibly the [[templeton-religious-trust-project]] LLM-classification work). Ken said he'd "get it tested on gpt oss today hopefully."
- **Status (6/26, ~12pm EDT):** Ken reports **"dflash is running"** and **"I need to test it now."** First test target: **`gpt-oss-120b`** ("to start").
- **Serving stack revealed (6/26, ~12:36pm EDT):** Ken shared the test endpoint — **`https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`** — reachable directly **when on the PARCC VPN**. The hostname decomposes the stack: **sglang** (serving engine) + **gpt-oss-120b** (model) + **dflash** + **run:ai** ([[runai-betty]]) scheduler + **test**, under `inference.betty.parcc.upenn.edu`. This strongly implies **dflash is an sglang-side inference acceleration component** (e.g. a speculative-decoding / fast-decode add-on served through sglang), not a standalone engine.
- **Status (6/26, ~12:49pm EDT):** Ken reports the endpoint **"is crashing"** — so the test deployment is **not yet stable**. Don't rely on it until Ken confirms.
- **Stabilized + benchmarked (6/26, ~1:15–1:25pm EDT):** Ken: **"I think it is stabilized now"** and "you should be able to get the endpoint to respond now." Measured throughput:
  - **~5,000 tokens/sec/GPU** aggregate at **concurrency 100** — **"about double (almost triple) previous performance."**
  - **~300 tps single-concurrency** (one request at a time).
  - Per-user **~300 tps holds for up to ~15 concurrent users**, then **degrades** beyond that. (Jeffrey, solo, would see the high single-stream rate — "whiplash.")
- **Distribution plan (6/26):** the raw URL is *"just an endpoint"*; Ken will **put it on LiteLLM shortly** so it's reachable through the standard PARCC LiteLLM gateway rather than only the direct VPN URL.
- **What it is:** Still not explicitly stated by Ken, but the endpoint evidence + throughput profile (high aggregate tps, draft-style speculative gains ~2–3×) narrow it to an **sglang inference-serving acceleration component**. Mark **tentative** until Ken explains in words.

## Access
- **Endpoint (test):** `https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`
- **How to reach it:** be on the **PARCC VPN**, then hit the endpoint directly. Ken is also adding it to **LiteLLM** (the standard gateway) shortly.
- **Stability:** crashing as of ~12:49pm EDT 6/26, then **stabilized ~1:15pm EDT 6/26** and responding — still a test deployment, not production.
- **Performance (6/26):** ~5k tok/s/GPU @ concurrency 100; ~300 tps single-stream; ~300 tps/user up to ~15 concurrent users.

## Open questions
- What does dflash actually do (sglang speculative-decode add-on, attention kernel, eval harness, something else)? Endpoint + ~2–3× throughput gain suggest an sglang acceleration component.
- Test results / quality against `gpt-oss-120b` now that it's stable.
- Whether it fits Jeffrey's "other project" as he suspects.

## See also
- [[kenneth-chaney]]
- [[jeffrey-vadala]]
- [[runai-betty]]
- [[vllm-serving]]
- [[templeton-religious-trust-project]]

## Sources
- [[2026-06-25-teams-chats-digest]] — dflash introduced; "tested on gpt oss" plan
- [[2026-06-26-teams-chats-digest]] — dflash running → crashing → stabilized w/ throughput numbers; LiteLLM plan
