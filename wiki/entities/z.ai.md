---
type: entity
tags: [external, llm-vendor, glm, ai-agent]
created: 2026-06-25
updated: 2026-07-01
sources: [2026-06-25-teams-chats-digest, 2026-07-01-teams-chats-digest]
related: [glm-5.2, multi-token-prediction, kenneth-chaney, parcc-skills-modules]
status: tentative
---

# z.ai

## One-line summary
External AI company/product (z.ai) offering an "Advanced AI Chatbot & Agent" powered by the [[glm-5.2]] model, plus **ZCode**, its official coding harness for GLM-5.2; on PARCC's radar via the Ken/Jeffrey AI-tooling interest.

## Content
- Self-described as an AI assistant powered by **GLM-5.2** — builds websites, writes code, handles long-horizon tasks, gives instant answers; positioned as fast/smart/reliable (z.ai marketing).
- Surfaced in the Ken Chaney 1:1 on 2026-06-25; neither had used it yet, Ken intends to ("Not yet, but we will!"). See [[glm-5.2]] for the model and [[multi-token-prediction]] for the MTP speed angle Ken called out.

### ZCode — z.ai's official GLM-5.2 harness (2026-07-01)
- **`zcode.z.ai`** — *"ZCode - Simple, Fast, Vibe-Ready | Official Harness for GLM-5.2."* Marketing: "combines the best AI agents with your existing tools so you can plan, code, review, and deploy without friction."
- Jeffrey shared it to Ryan as the harness **"to use with our glm"** — i.e. point ZCode at PARCC's own served GLM-5.2 rather than z.ai's hosted endpoint. A candidate coding front-end alongside **Pi-Agent** / **opencode** (see [[parcc-skills-modules]]). Not yet evaluated by PARCC.
- **What it actually is (2026-07-01 ~5pm).** Per Jeffrey it's a **desktop app** ("its just their little desktop thing"), *"supposed to be set up for glm's unique long tasks,"* with **one-click skill install** ("has a bunch of skills sort of one click install"). He's skeptical it's more than positioning — *"idk could be all marketing."* Ryan had **not heard of it** ("I have no idea what zcode does"). As a *desktop GUI*, it runs into the "front-end-on-HPC / VSCode problem" Ryan raised — see the front-end-strategy section of [[parcc-skills-modules]].

> status: tentative — captured from chat; ZCode not yet evaluated against PARCC's served GLM-5.2.

## See also
- [[glm-5.2]]
- [[parcc-skills-modules]]
- [[kenneth-chaney]]

## Sources
- [[2026-06-25-teams-chats-digest]] — link shared by Jeffrey, intent-to-try noted by Ken.
- [[2026-07-01-teams-chats-digest]] — ZCode (official GLM-5.2 harness) shared, "to use with our glm"; 8th pull: ZCode = desktop app for GLM long tasks with one-click skill install ("could be all marketing").
