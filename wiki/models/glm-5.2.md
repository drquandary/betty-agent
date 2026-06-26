---
type: model
tags: [llm, glm, zai, model-serving, mtp]
created: 2026-06-25
updated: 2026-06-26
sources: [2026-06-25-teams-chats-digest, 2026-06-26-teams-chats-digest]
related: [z.ai, multi-token-prediction, kenneth-chaney, jeffrey-vadala, deepseek-v3]
status: tentative
---

# GLM-5.2

## One-line summary
[[z.ai]]'s flagship GLM-family LLM that powers the Z.ai chatbot/agent; notable for fast inference via [[multi-token-prediction]] (MTP). On PARCC's radar to try, not yet deployed on Betty.

## Content
- **What it is.** GLM-5.2 is the model behind z.ai's "Advanced AI Chatbot & Agent" — marketed for website/code building, long-horizon agentic tasks, and instant answers. Surfaced by Jeffrey in the Ken 1:1 on 2026-06-25.
- **Speed mechanism.** Per Ken, GLM-5.2's throughput edge comes from **MTP (multi-token prediction)** — *"a much faster MTP"* — rather than classic two-model draft/verify speculative decoding. See [[multi-token-prediction]].
- **PARCC status (updated 2026-06-26).** Now **available on PARCC's coding/inference stack** — Ken told Jeffrey *"you can move any of your coding from kimi over to glm 5.2,"* so it is served alongside **Kimi-code**. (As of 2026-06-25 neither had used it; Ken's intent — *"Not yet, but we will!"* — has since landed.) Fits the existing GLM-family serving thread (cf. **GLM-DSA**, served at Q4 via Unsloth quants — see [[kenneth-chaney]]). Deployment details (which quant for coding, benchmarks) still unrecorded.
- **Vision support (2026-06-26).** The **fp8-quantized** build PARCC serves does **not** do vision; per Jeffrey *"the regular model is supposed to."* So multimodal needs the full-precision model. Practical impact: Jeffrey tried GLM for **long-horizon "long tasks"** but *"with no vision, it got stuck"* — so he **routes vision subtasks to Claude** via an agent. Vision gaps are a real blocker for long agentic runs on the fp8 build.

> status: tentative — served for coding, but quant/benchmark specs unconfirmed and the fp8-vs-full vision split is from chat, not first-hand testing.

## Our experience
- **Coding:** usable now (move from Kimi); no benchmarks recorded.
- **Vision:** fp8 build can't; long tasks stalled → Jeffrey delegates vision to Claude (workaround). See [[jeffrey-vadala]].

## See also
- [[z.ai]]
- [[multi-token-prediction]]
- [[kenneth-chaney]]
- [[jeffrey-vadala]]

## Sources
- [[2026-06-25-teams-chats-digest]] — Jeffrey shares the z.ai/GLM-5.2 link; Ken: "Not yet, but we will!" and "It is a much faster MTP."
- [[2026-06-26-teams-chats-digest]] — GLM-5.2 now servable for coding ("move coding from kimi over to glm 5.2"); fp8 build lacks vision, full model expected to; Jeffrey routes vision to Claude.
