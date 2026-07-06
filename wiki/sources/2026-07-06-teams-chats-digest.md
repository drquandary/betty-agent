---
type: source
tags: [teams, digest, glm, model-serving, nginx, litellm, tokens-as-a-service]
created: 2026-07-06
updated: 2026-07-06
related: [glm-5.2, parcc-tokens-as-a-service, kenneth-chaney, jeffrey-vadala]
status: current
---

# Teams Chats Digest — 2026-07-06

## One-line summary
Chaney 1:1 (13 new msgs) — Ken **confirms the nginx reverse proxy** exists (corroborating Jeffrey's 7/3 `413` diagnosis) and offers a serving-stack session, with the caveat that **the whole stack changes at production**; Jeffrey is **building Dr. Chatterjee's lab agent** and weighing a model fallback. PARCC Group (2 msgs) — Jaime tracking an inbound **demo unit** (ETA this week).

## New this cycle
- **nginx reverse proxy CONFIRMED (Ken).** Ken: *"We do run a reverse proxy with nginx to get https functionality."* This corroborates the mechanism in Jeffrey's 7/3 root-cause of the served-GLM `413` (a `client_max_body_size` rejection at the nginx layer) — it's now Ken-confirmed that such a layer terminates HTTPS in front of the served vLLM. Cap not yet raised (Ken on morning email from phone, laptop not open). Real-world impact restated: **[[z.ai|ZCode]] "was working really spanky … especially for long tasks … but it hit that error and just totally wanked out."**
- **The serving stack is pre-production (durable caveat).** Ken kept the walkthrough shallow because *"the whole stack will change when we go into production"* — so current LiteLLM/nginx/vLLM specifics are **transient**.
- **Ken offers a serving-stack session.** *"I need to do a session for you guys on it"* — already did a short one for Jamie. Jeffrey wants it so he can help in **all-hands-on-deck** token-as-a-service situations; today his serving experience is "only … Ollama [or] Vllm" for himself.
- **Chatterjee lab agent — build underway + fallback question.** Jeffrey: *"I was working on Anjan Chatterjees lab agent."* Weighing a **model fallback** for GLM outages but **unsure whether a GLM outage also downs the other served models** ("not sure if when our glm goes down, if the others do too") — a genuine reliability decision for any lab bot. GLM was **up** ~2pm (Ken: "It is spitting out tokens for somebody right now"), though Jeffrey believed it had been down over the weekend.
- **PARCC Group — demo unit inbound (Jaime).** A **demo unit** has an **ETA this week**, tracked via **AIT Worldwide Logistics** ("FasTrak"). Vendor/what-it-is unstated in-message (possibly PARCC↔NVIDIA or the Dell/R7725 hardware thread). Second message was an empty "FYI:" (skipped).

## Pages touched
- [[glm-5.2]] — 413 section: Ken's confirmation of the nginx proxy + pre-production caveat + serving-stack-session note.
- [[parcc-tokens-as-a-service]] — Chatterjee lab agent build + failure-independence/fallback open question; serving-stack knowledge-transfer; production-architecture-unsettled caveat.

## See also
- [[glm-5.2]]
- [[parcc-tokens-as-a-service]]
- [[2026-07-03-teams-chats-digest]] — prior cycle: Jeffrey's original nginx `client_max_body_size` diagnosis of the 413.
- [[2026-07-02-teams-chats-digest]] — the 413 + context-window regression first surfaced.
