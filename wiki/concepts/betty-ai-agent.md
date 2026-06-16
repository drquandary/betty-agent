---
type: concept
tags: [betty-ai, agent, dashboard, proxy, litellm, qwen, parcc, facilitation]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest]
related: [slurm-advisor, monitoring-tab, parcc-helper-tools, betty-cluster, surgical-tool-id-vlm, jeffrey-vadala, kenneth-chaney, ryan-bradley]
status: current
---

# Betty AI Agent

## One-line summary
[[jeffrey-vadala]]'s assistant for Betty users — answers onboarding/"noob" questions and gives AI training/fine-tuning and Slurm scheduling tips — existing as both a web dashboard and a pi/Claude agent, with the [[slurm-advisor]] and [[monitoring-tab]] as subsystems.

## Forms
- **Web dashboard** — visualizes node availability (green = free, purple = used); see the live-monitoring detail in [[monitoring-tab]].
- **pi / Claude agent** — a more basic CLI form, originally built around Chaney's Kimi-agent setup; started as an agent/skill for **login + job submission**.
- Already answers questions in the PARCC group chat (e.g. the conda-vs-venv SSH explanation), though that particular answer was flagged as imprecise by [[jamie-schnaitter]] — see [[kerberos-ssh-macos-fix]].

## Guidance from Chaney
- **Use `parcc_sfree.py`** as the availability data source (consolidates bug sources); supports `--by node` and `--json`. See [[parcc-helper-tools]].
- Add a **"booting AI in progress"** label in the UI.
- A **webserver with a local proxy** is the agreed way to handle access.

## API-key protection (open design, with ryb + Chaney)
- Concern: don't leak the provider API key.
- Proposed flow: `user/agent → localhost proxy → PARCC LiteLLM gateway → provider model`. The client only ever sees `OPENAI_BASE_URL=http://127.0.0.1:8080/v1`.
- Options floated: free usage via a cheaper model (e.g. **Qwen**) behind the proxy; users supply **their own keys**; or **rotating temp API tokens**. Idea: keep the proxy open while the user holds a valid Kerberos ticket — with a Qwen model + bounded time, abuse is unlikely.
- Open question: **where the agent lives** (Open OnDemand vs a `/betty-agent` CLI) and where the proxy runs (login node vs a special place). jvadala was discussing siting with ryb.

## Related infra
- Chaney's `parcc_sandbox` can wrap the pi/Claude agent for safe filesystem access — see [[parcc-helper-tools]].
- The [[slurm-advisor]] is the deterministic constraint-solver subsystem; [[monitoring-tab]] is the live Slurm-monitoring dashboard.
- Could host jvadala's [[surgical-tool-id-vlm]] alongside as a serving target.

## See also
- [[slurm-advisor]]
- [[monitoring-tab]]
- [[parcc-helper-tools]]
- [[jeffrey-vadala]] — author/operator
- [[kenneth-chaney]] — infra guidance

## Sources
- [[2026-06-16-teams-chats-digest]] — the Chaney ↔ jvadala dashboard/proxy threads
