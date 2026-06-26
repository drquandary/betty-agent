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
- **What it is:** Still not explicitly stated by Ken, but the endpoint evidence narrows it to an **sglang inference-serving acceleration tool**. Mark **tentative** until Ken explains in words.

## Access
- **Endpoint (test):** `https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`
- **How to reach it:** be on the **PARCC VPN**, then hit the endpoint directly (no other gateway needed as of 6/26).
- **Stability:** crashing as of 6/26 ~12:49pm EDT — test deployment, not production.

## Open questions
- What does dflash actually do (sglang speculative-decode add-on, attention kernel, eval harness, something else)? Endpoint suggests an sglang acceleration component.
- Why is the test endpoint crashing, and test results against `gpt-oss-120b` once stable.
- Whether it fits Jeffrey's "other project" as he suspects.

## See also
- [[kenneth-chaney]]
- [[jeffrey-vadala]]
- [[runai-betty]]
- [[vllm-serving]]
- [[templeton-religious-trust-project]]

## Sources
- [[2026-06-25-teams-chats-digest]] — dflash introduced; "tested on gpt oss" plan
- [[2026-06-26-teams-chats-digest]] — dflash running; first test target `gpt-oss-120b`
