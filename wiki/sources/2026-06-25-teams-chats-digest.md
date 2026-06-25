---
type: source
tags: [teams, parcc, ken, metrics, ai-agents, bionemo, glm, zai, mtp]
created: 2026-06-25
updated: 2026-06-25
related: [kenneth-chaney, jaime-combariza, jeffrey-vadala, glm-5.2, z.ai, multi-token-prediction]
status: current
---

# Teams Chats Digest — 2026-06-25

## One-line summary
Ken Chaney 1:1: argues PARCC's bigger problem than any outside assessment is the lack of *defined* success metrics; is fine with a third party gathering info; commits to scheduling coffees; shares the NVIDIA BioNeMo agent toolkit.

## Content
- **PARCC has no defined success metrics (tentative org insight).** Discussing an outside party gathering info about PARCC (apparently the anthropology study of Betty/PARCC — see [[kenneth-chaney]] note from 6/18), Ken's view: the third party gathering info "is not a problem… we should be encouraging her." The real issue, in his opinion, is *"What metric are we gauging ourselves against? What is good? None of that is defined right now."* He notes this is a topic where his opinion **differs from most of the group**. Jeffrey read Jaime as uneasy ("eggy") about the study. → Captured as a tentative gap: PARCC lacks agreed performance/success metrics.
- **Coffee with Ken.** Ken apologized for being busy when in the office and said he'll "make it more of a point to get coffees on the books" — a commitment to schedule, no firm time set. Jeffrey noted he and Ken likely share the most overlap in AI/LLM interest (vs. Ryan and Jamie, who are less excited by LLM/AI).
- **Reference shared — NVIDIA BioNeMo agent toolkit.** Ken pointed Jeffrey to https://github.com/NVIDIA-BioNeMo/bionemo-agent-toolkit — "turn any agent into a life-science expert with NVIDIA BioNeMo skills." Of interest given the shared AI-agent work and life-science compute on Betty.

(Remaining messages in the thread were personal/social chit-chat and not ingested.)

## Ken 1:1 follow-up — betty-toolkit idea + coffee confirmed (2026-06-25T15:11–15:15Z)
- **"betty-toolkit" idea (tentative).** Riffing on the [[betty-ai-agent]] and the BioNeMo toolkit Ken shared, Jeffrey said he'd been "hoping to make a betty-toolkit that would be specific to betty but be like a way for researchers to find tools like above" — i.e. a Betty-local analog to the NVIDIA BioNeMo agent toolkit, a tool-discovery surface for researchers. Aspiration, not committed work; status: tentative. See [[jeffrey-vadala]].
- **Coffee with Ken confirmed.** The previously-uncommitted coffee firmed up: Jeffrey received a calendar invite from Ken and confirmed they're meeting at **3pm today**. Location is the coffee shop in the "red oval building" (bottom floor near the bridge, close to Smilow).
- **"dflash" (tentative, unidentified).** Ken asked "Have you seen dflash?" — no further context given in-thread; identity/relevance unknown. Captured for follow-up.

## PARCC Group — ColdFront project-activation follow-up (2026-06-25T14:00Z)
- Ken replied to Jaime's 6/24 report that two ColdFront projects had not activated to Betty (users `recha` / `surbhig`, project IDs **269** and **270**): *"Taking a look now. Probably an issue with my patch for the users."*
- **Durable link:** Ken attributes the failed project activation to **his manual user-creation patch** — the 6/23 workaround run while account sync was paused (see [[kenneth-chaney]], [[betty-cluster]]). So the manual path that unblocked *user* provisioning appears to have a side effect on *project/allocation* propagation. Root cause still being confirmed; status: tentative.

## Ken 1:1 follow-up — z.ai / GLM-5.2 + MTP (2026-06-25T15:51–16:01Z)
- **z.ai / GLM-5.2 surfaced.** Jeffrey shared the [[z.ai]] product link — "Advanced AI Chatbot & Agent powered by GLM-5.2" (builds websites, writes code, long-horizon tasks). Asked Ken if he'd used it; Ken: *"Not yet, but we will!"* → intent to evaluate, captured as a task. See [[glm-5.2]].
- **Durable concept — MTP vs. speculative decoding.** Jeffrey framed the speedup as classic draft/verify speculative decoding: *"the draft model writes, and the large model just checks it?"* Ken corrected: *"It is a much faster MTP."* I.e. GLM-5.2's throughput edge is **multi-token prediction** (single model with extra prediction heads emitting several tokens per step), not a separate draft model. Synthesized into [[multi-token-prediction]]. Fits Ken's existing GLM-family serving thread (GLM-DSA, Unsloth quants — see [[kenneth-chaney]]).

## See also
- [[kenneth-chaney]]
- [[jaime-combariza]]
- [[jeffrey-vadala]]
- [[glm-5.2]]
- [[z.ai]]
- [[multi-token-prediction]]

## Sources
- Chaney, Kenneth P 1:1 Teams chat, 2026-06-25T13:28–13:54Z (digest `digest_20260625T095929.json`)
- Chaney, Kenneth P 1:1 Teams chat, 2026-06-25T15:11–15:15Z (digest `digest_20260625T113558.json`) — betty-toolkit idea, coffee confirmed (3pm), dflash mention
- Chaney, Kenneth P 1:1 Teams chat, 2026-06-25T15:51–16:01Z (digest `digest_20260625T120842.json`) — z.ai/GLM-5.2 shared, "Not yet, but we will!", "It is a much faster MTP"
