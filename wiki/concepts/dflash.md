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
- **On LiteLLM (6/26, ~1:34pm EDT):** Ken: **"you can test it out on litellm now with the `openai/gpt-oss-120b`."** So gpt-oss-120b + dflash is now reachable through the standard PARCC **LiteLLM gateway** — this is the supported access path.
- **Raw VPN endpoint is NOT usable (6/26, ~1:34pm EDT) — contradicts the earlier "stabilized" read:** despite the ~1:15pm "stabilized" claim, Jeffrey **kept getting 404** hitting the direct URL. His diagnosis: *"the server behind that hostname returns 404 for everything, including the OpenAI-standard `/v1/chat/completions` and `/v1/models` endpoints that SGLang always serves when it's running."* → the direct `sglang-…-runai-test` URL is **not serving** (the SGLang OpenAI server isn't actually up behind it). **Use LiteLLM, not the raw URL.**
- **gpt-oss-20b in progress (6/26):** Ken is also bringing up **`gpt-oss-20b`** but *"the same config is not working for 20b"* yet. Throughput comparison at single concurrency: **gpt-oss-120b + DFlash ~300 tps** vs **gpt-oss-20b ~500 tps** (smaller model, faster; 20b not on a dflash config).
- **What it is:** Still not explicitly stated by Ken, but the endpoint evidence + throughput profile (high aggregate tps, draft-style speculative gains ~2–3×) narrow it to an **sglang inference-serving acceleration component**. Mark **tentative** until Ken explains in words.

## Access
- **Use LiteLLM (supported path, 6/26):** call model **`openai/gpt-oss-120b`** through the standard PARCC LiteLLM gateway.
- **Raw endpoint — DO NOT use:** `https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu` returns **404 for everything** (incl. `/v1/chat/completions`, `/v1/models`) even after the "stabilized" report — the SGLang OpenAI server isn't actually serving behind it. Was crashing ~12:49pm, reported "stabilized" ~1:15pm, but still 404 over the direct URL ~1:34pm.
- **Performance (6/26):** ~5k tok/s/GPU @ concurrency 100; **~300 tps single-stream (gpt-oss-120b + DFlash)**; ~300 tps/user up to ~15 concurrent users. Compare **gpt-oss-20b ~500 tps single-stream** (smaller, no dflash config yet).

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
