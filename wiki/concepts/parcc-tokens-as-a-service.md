---
type: concept
tags: [llm, inference, litellm, parcc, service, api-keys, tokens-as-a-service, jeffrey-vadala, kenneth-chaney]
created: 2026-06-26
updated: 2026-07-01
sources: [2026-06-26-teams-chats-digest, 2026-06-30-teams-chats-digest, 2026-07-01-teams-chats-digest]
related: [kenneth-chaney, jeffrey-vadala, dflash, glm-5.2, workweave-router, betty-ai-agent, multi-token-prediction]
status: tentative
---

# PARCC "Tokens as a Service"

## One-line summary
PARCC's emerging offering to serve LLM inference to researchers as an API-key-gated service over its LiteLLM gateway — Ken can mint keys on demand and wants it "fully going"; Jeffrey is recruiting beta users (two labs) and floated a free beta period (2026-06-26, tentative).

## Content
- **What it is.** PARCC fronts its self-hosted models (e.g. gpt-oss-120b via [[dflash]], [[glm-5.2]]/Kimi for coding) behind a **LiteLLM gateway** and issues **per-user API keys** so labs can consume tokens against PARCC hardware instead of commercial APIs. Ken (2026-06-26): *"We need to get tokens as a service fully going."*
- **Demand signal.** At the PARCC↔NVIDIA workshop, Jeffrey observed **~half the group were already using PARCC for their own ollama** — i.e. researchers are self-serving local inference on the cluster, which is the latent demand this service would formalize.
- **Key issuance is ready now.** Ken: *"if you find people who want to use it, I can make them keys now."* So the blocker is **user recruitment + terms**, not infrastructure — keys can be minted immediately.
- **Recruiting (Jeffrey).** Says he knows **several / "two labs of people"** and asked about a **free beta period**. Self-flagged caveat: most of these users currently **pay for ChatGPT Plus and cut/paste code into MATLAB**, so they'd **"barely use tokens"** — low-volume, MATLAB-centric usage.
- **Router for consistent models.** Ken: *"We will eventually need to implement a router or similar to get people going to consistent models."* As the user base grows, a per-prompt router (cf. [[workweave-router]]) would steer users to the right/consistent backend rather than each lab pinning ad-hoc models.
- **Possible client.** Jeffrey floated building **"a little TUI with their lab tools"** — a RAG DB of research papers + formatting helpers + MATLAB code-gen — as the front-end labs would use against their keys. Overlaps the betty-toolkit idea ([[jeffrey-vadala]]). **Update 2026-06-30:** Jeffrey restated this as wanting to "work on a **chatbot for a lab**" — the concrete first instance of the lab-tools client.
- **First beta lab identified (2026-07-01).** The lab was *"quite enthusiastic about getting a api key and a special TUI bot for them."* Jeffrey asked Ken to **mint a key** and proposed **attaching it to Dr. Anjan Chatterjee (Neurology)** as the owning PI/account — so this is the concrete first customer for the service. Ken had not yet replied; Jeffrey added "no rush." This turns the abstract "two labs" into one named engagement (Chatterjee lab, Neurology).
- **Operational requirement surfaced: a maintenance/downtime broadcast.** Jeffrey flagged he'll *"have to set up some sort of system that lets them know about reboots or down time"* (he's "open to any ideas"). Because the served menu sits behind a single-point-of-failure LiteLLM gateway and depends on cluster maintenance (e.g. Ceph windows, gateway reboots), any lab bot needs an **uptime/maintenance-notification channel** so users aren't surprised by outages. Design this alongside the lab TUI.
- **Gateway is a single point of failure.** The LiteLLM gateway fronting everything was **rebooted 2026-06-30 afternoon**, during which Jeffrey couldn't reach [[glm-5.2]] ("can't seem to get it"; Ken: "We were rebooting LiteLLM"). Transient, but a reminder that gateway availability gates the whole served menu.
- **Monetization angle (tentative).** Jeffrey: *"people might pay to have us host their models too"* — beyond token consumption, hosting researchers' own models is a candidate revenue line.

## Open questions
- Free-beta terms and duration — undefined; awaiting Ken/Jeffrey agreement.
- Billing/metering model once beta ends (tie-in to [[betty-billing-model]]?).
- Which models are in the supported menu, and how the planned router picks among them.

## See also
- [[kenneth-chaney]] — mints keys, owns the serving stack, wants the router
- [[jeffrey-vadala]] — recruiting beta labs, TUI/RAG client idea
- [[dflash]] — fast gpt-oss-120b serving that would back the service
- [[glm-5.2]] — served coding model in the menu
- [[workweave-router]] — candidate per-prompt router for "consistent models"
- [[betty-ai-agent]]

## Sources
- [[2026-06-26-teams-chats-digest]] — Ken offers to mint keys now; "tokens as a service fully going" + router; Jeffrey recruiting two labs, free-beta question, TUI/RAG idea
- [[2026-06-30-teams-chats-digest]] — LiteLLM gateway reboot (GLM-5.2 briefly unreachable); Jeffrey reframes the client as a "chatbot for a lab"
- [[2026-07-01-teams-chats-digest]] — first beta lab named (Dr. Anjan Chatterjee, Neurology), key requested from Ken; downtime-notification requirement surfaced
