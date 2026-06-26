---
type: concept
tags: [routing, llm, agents, inference, cost-optimization, third-party-tool, jeffrey-vadala]
created: 2026-06-26
updated: 2026-06-26
sources: [2026-06-26-teams-chats-digest]
related: [dflash, betty-ai-agent, jeffrey-vadala, parcc-skills-modules, parcc-tokens-as-a-service]
status: tentative
---

# workweave/router

## One-line summary
A third-party open-source "model router for agentic systems" (github.com/workweave/router) that Jeffrey flagged as interesting — it routes each prompt to the most appropriate model in <50 ms and claims 40-70% cost savings via a drop-in endpoint change. Not yet evaluated on PARCC; on the radar mainly as a front-end for [[dflash]] / fast sub-agent dispatch.

## Content
- **What it claims (per the repo blurb Jeffrey shared):** routes "every prompt to the right model in <50ms," cutting costs **40-70%** with "just an endpoint change." So it presents as an **OpenAI-compatible proxy** that classifies each request and dispatches it to a cheaper or more capable backend model automatically.
- **Why Jeffrey is interested (6/26, ~4:43-4:44pm EDT):** "This is cool … Might be cool to use with dflash … Like a for super fast sub agent tasks." The idea: front a **fast local serving stack** ([[dflash]] / gpt-oss on PARCC's LiteLLM) with a router that sends **cheap, high-volume sub-agent calls** to the fastest/cheapest model and reserves heavier models for harder work. Fits the broader sub-agent tooling / [[betty-ai-agent]] direction.
- **Fit with PARCC stack (speculative):** PARCC already fronts models with a **LiteLLM gateway**; a router like this would sit in front of (or alongside) LiteLLM to do per-prompt model selection. Relationship to LiteLLM's own routing is unverified.
- **PARCC now wants a router too (6/26, ~4:57pm):** in the [[parcc-tokens-as-a-service]] thread Ken said *"We will eventually need to implement a router or similar to get people going to consistent models."* So the routing need is no longer just Jeffrey's sub-agent idea — it's a stated requirement for the planned tokens-as-a-service offering (steer many users to consistent backends). workweave/router is a candidate fit.

## Open questions
- Does it actually deliver <50 ms routing + 40-70% savings, or is that marketing? Needs a real test.
- How does it interoperate with PARCC's existing **LiteLLM** gateway — replace, layer on top, or redundant?
- Does it support local/self-hosted OpenAI-compatible backends (so it could route to dflash/gpt-oss endpoints), or is it geared to commercial APIs?
- License / self-hostability for PARCC use.

## See also
- [[dflash]] — fast gpt-oss serving stack Jeffrey wants to pair this with
- [[betty-ai-agent]] — the sub-agent tooling this would serve
- [[jeffrey-vadala]]
- [[parcc-skills-modules]]

## Sources
- [[2026-06-26-teams-chats-digest]] — Jeffrey shares github.com/workweave/router; floats pairing it with dflash for fast sub-agent tasks; Ken later voices PARCC's own need for "a router … to get people going to consistent models"
