---
type: model
tags: [llm, glm, zai, model-serving, mtp]
created: 2026-06-25
updated: 2026-07-01
sources: [2026-06-25-teams-chats-digest, 2026-06-26-teams-chats-digest, 2026-06-29-teams-chats-digest, 2026-06-30-teams-chats-digest, 2026-07-01-teams-chats-digest]
related: [z.ai, multi-token-prediction, kenneth-chaney, jeffrey-vadala, deepseek-v3, parcc-skills-modules]
status: tentative
---

# GLM-5.2

## One-line summary
[[z.ai]]'s flagship GLM-family LLM that powers the Z.ai chatbot/agent; notable for fast inference via [[multi-token-prediction]] (MTP). On PARCC's radar to try, not yet deployed on Betty.

## Content
- **What it is.** GLM-5.2 is the model behind z.ai's "Advanced AI Chatbot & Agent" — marketed for website/code building, long-horizon agentic tasks, and instant answers. Surfaced by Jeffrey in the Ken 1:1 on 2026-06-25.
- **Speed mechanism.** Per Ken, GLM-5.2's throughput edge comes from **MTP (multi-token prediction)** — *"a much faster MTP"* — rather than classic two-model draft/verify speculative decoding. See [[multi-token-prediction]].
- **No draft model (2026-06-26).** Jeffrey asked whether GLM-5.2 has a **draft model** (for speculative decoding); Ken: **"not yet."** Consistent with the MTP-not-draft mechanism above. By contrast **Kimi** does have a draft model Ken spotted — pending only a license/access acceptance ("I just need to agree to stuff") to enable it.
- **PARCC status (updated 2026-06-26).** Now **available on PARCC's coding/inference stack** — Ken told Jeffrey *"you can move any of your coding from kimi over to glm 5.2,"* so it is served alongside **Kimi-code**. (As of 2026-06-25 neither had used it; Ken's intent — *"Not yet, but we will!"* — has since landed.) Fits the existing GLM-family serving thread (cf. **GLM-DSA**, served at Q4 via Unsloth quants — see [[kenneth-chaney]]). Deployment details (which quant for coding, benchmarks) still unrecorded.
- **Vision support (2026-06-26).** The **fp8-quantized** build PARCC serves does **not** do vision; per Jeffrey *"the regular model is supposed to."* So multimodal needs the full-precision model. Practical impact: Jeffrey tried GLM for **long-horizon "long tasks"** but *"with no vision, it got stuck"* — so he **routes vision subtasks to Claude** via an agent. Vision gaps are a real blocker for long agentic runs on the fp8 build.
- **NVFP4 quant — DEPLOYED (2026-06-30).** Ken **migrated PARCC's GLM-5.2 serving to NVFP4**: *"token cost will come down under my watch — I migrated us to nvfp4 for glm 5.2."* So the **NVFP4 build is now the served default** (superseding the fp8 build for cost reasons), and the **explicit goal is lower token cost**. (Earlier, 2026-06-26 ~7:13pm, Ken had only been *weighing* it on 8 GPUs from the NVIDIA-published quant `huggingface.co/nvidia/GLM-5.2-NVFP4` — *"I'm thinking if I should put nvfp4 on 8 GPUs."*) **NVFP4** is NVIDIA's **4-bit floating-point** format, native to **Blackwell ([[dgx-b200-partition|B200]]) tensor cores** — hardware-accelerated, not emulated 4-bit — which is why Jeffrey expected it to be fast (*"that should be zippy"*). OPEN QUESTION: whether the NVFP4 build restores **vision** (the fp8 build couldn't — see above) is still unconfirmed; the GPU count actually used isn't restated.

- **vs Opus 4.8 on long-horizon tasks (2026-06-29).** Jeffrey: GLM-5.2 is **"beating opus 4.8 actually … in some long term tasks."** Stated when Ryan asked whether the multi-day [[parcc-skills-modules|agent-harness]] work (rachitk OOM fix) could run on GLM-5.2 instead of Opus 4.8 — Jeffrey: "it should work." No benchmark numbers given; `tentative`.
- **Cost driver toward on-prem (2026-06-29).** This claim sits inside Ryan's cost argument: he converts Claude **subscription** usage to **API-equivalent rates with `npx ccusage`**, and warns personal subscriptions are **"heavily subsidized and this won't be around forever."** GLM-5.2 (served on PARCC's own stack) is the on-prem hedge — relevant to [[parcc-tokens-as-a-service]].
- **Ryan's hands-on impression (2026-06-29).** Ryan **tried GLM-5.2 briefly Friday in opencode** and found it **"pretty good"** — but uses it for **Q&A → markdown/diffs he implements himself**, finding the agentic flows "too hands-off." (Jeffrey countered by pitching **Pi-Agent** as a leaner runtime — see [[parcc-skills-modules]].) First end-user datapoint on GLM-5.2 from a PARCC staffer, even if non-agentic.
- **ZCode — vendor's official harness (2026-07-01).** z.ai ships **ZCode** (`zcode.z.ai`), its "official harness for GLM-5.2." Jeffrey flagged it as the harness **"to use with our glm"** — point ZCode at PARCC's served GLM-5.2. A third candidate front-end (with Pi-Agent / opencode) for the coding workflow; not yet evaluated. See [[z.ai]], [[parcc-skills-modules]].

> status: tentative — served for coding, but quant/benchmark specs unconfirmed, the fp8-vs-full vision split is from chat, and the "beats Opus 4.8 on long tasks" claim is Jeffrey's impression with no numbers.

## Our experience
- **Coding:** usable now (move from Kimi); no benchmarks recorded.
- **Vision:** fp8 build can't; long tasks stalled → Jeffrey delegates vision to Claude (workaround). See [[jeffrey-vadala]].
- **Quant variants tracked:** **NVFP4** (NVIDIA HF build, B200-native 4-bit — **now the served build as of 6/30, migrated to cut token cost**); **fp8** (prior served build, no vision); full-precision (vision-capable, not served). [[kenneth-chaney]].

## See also
- [[z.ai]]
- [[multi-token-prediction]]
- [[kenneth-chaney]]
- [[jeffrey-vadala]]

## Sources
- [[2026-06-25-teams-chats-digest]] — Jeffrey shares the z.ai/GLM-5.2 link; Ken: "Not yet, but we will!" and "It is a much faster MTP."
- [[2026-06-26-teams-chats-digest]] — GLM-5.2 now servable for coding ("move coding from kimi over to glm 5.2"); fp8 build lacks vision, full model expected to; Jeffrey routes vision to Claude; Ken shares NVIDIA NVFP4 quant (huggingface.co/nvidia/GLM-5.2-NVFP4), weighing it on 8 GPUs.
- [[2026-06-29-teams-chats-digest]] — Jeffrey: GLM-5.2 "beating opus 4.8 … in some long term tasks," "it should work"; Ryan's subscription-subsidy / `ccusage` cost argument for on-prem.
- [[2026-06-30-teams-chats-digest]] — Ken **migrated GLM-5.2 serving to NVFP4** to bring token cost down ("I migrated us to nvfp4 for glm 5.2").
- [[2026-07-01-teams-chats-digest]] — Jeffrey shares **ZCode** (`zcode.z.ai`), z.ai's official GLM-5.2 harness, "to use with our glm."
