---
type: source
tags: [teams, digest, glm, model-serving, nginx, litellm, tokens-as-a-service, training, slurm, cli-filter, mailing-list, vast, snapshots, coldfront]
created: 2026-07-06
updated: 2026-07-06
related: [glm-5.2, parcc-tokens-as-a-service, kenneth-chaney, jeffrey-vadala, slurm-cli-filter, ryan-bradley, jamie-schnaitter, jaime-combariza, vast-storage, parcc-helper-tools]
status: current
---

# Teams Chats Digest — 2026-07-06

## One-line summary
Chaney 1:1 (13 new msgs) — Ken **confirms the nginx reverse proxy** exists (corroborating Jeffrey's 7/3 `413` diagnosis) and offers a serving-stack session, with the caveat that **the whole stack changes at production**; Jeffrey is **building Dr. Chatterjee's lab agent** and weighing a model fallback. PARCC Group (2 msgs) — Jaime tracking an inbound **demo unit** (ETA this week). **Cycle 2 (PARCC Group, 10 msgs):** `MaxMemPerCPU` left unset on large-mem nodes (over-default → CLI-filter warning, not error); **PARCC training sessions scheduled** (Thu 7/9 9 AM & Mon 7/13 2 PM) + `parcc-info` listserv send/approval workflow. **Cycle 3 (PARCC Group, 1 msg):** Ken deployed **VAST per-project protected-paths / snapshots** (ColdFront-controlled, `parcc_quota.py --snapshots`, ~2-wk ramp).

## New this cycle
- **nginx reverse proxy CONFIRMED (Ken).** Ken: *"We do run a reverse proxy with nginx to get https functionality."* This corroborates the mechanism in Jeffrey's 7/3 root-cause of the served-GLM `413` (a `client_max_body_size` rejection at the nginx layer) — it's now Ken-confirmed that such a layer terminates HTTPS in front of the served vLLM. Cap not yet raised (Ken on morning email from phone, laptop not open). Real-world impact restated: **[[z.ai|ZCode]] "was working really spanky … especially for long tasks … but it hit that error and just totally wanked out."**
- **The serving stack is pre-production (durable caveat).** Ken kept the walkthrough shallow because *"the whole stack will change when we go into production"* — so current LiteLLM/nginx/vLLM specifics are **transient**.
- **Ken offers a serving-stack session.** *"I need to do a session for you guys on it"* — already did a short one for Jamie. Jeffrey wants it so he can help in **all-hands-on-deck** token-as-a-service situations; today his serving experience is "only … Ollama [or] Vllm" for himself.
- **Chatterjee lab agent — build underway + fallback question.** Jeffrey: *"I was working on Anjan Chatterjees lab agent."* Weighing a **model fallback** for GLM outages but **unsure whether a GLM outage also downs the other served models** ("not sure if when our glm goes down, if the others do too") — a genuine reliability decision for any lab bot. GLM was **up** ~2pm (Ken: "It is spitting out tokens for somebody right now"), though Jeffrey believed it had been down over the weekend.
- **PARCC Group — demo unit inbound (Jaime).** A **demo unit** has an **ETA this week**, tracked via **AIT Worldwide Logistics** ("FasTrak"). Vendor/what-it-is unstated in-message (possibly PARCC↔NVIDIA or the Dell/R7725 hardware thread). Second message was an empty "FYI:" (skipped).

## Cycle 2 (14:27) — PARCC Group (10 msgs)
- **`MaxMemPerCPU` left unset on the large-mem nodes (Ryan calls it an oversight).** Jaime asked whether he can request the max memory or gets an error (saw default/min ~15872 vs a "max" resolving to **`MaxMemPerCPU=18432`**). Ryan: **`DefMemPerCPU`** was set to the right proportions weeks ago (OS overhead reserved) but **`MaxMemPerCPU` wasn't set because the CLI filter wasn't ready** → over-default requests get a **non-blocking CLI-filter warning, not a hard error**. Ryan offered to **lower `MaxMemPerCPU` to match `DefMemPerCPU`**; awaiting Jaime. See [[slurm-cli-filter]].
- **PARCC training sessions SCHEDULED + announcement workflow.** Two 1-hour **"Best Practices for Navigating the Betty Environment"** sessions: **Thu July 9 @ 9 AM** and **Mon July 13 @ 2 PM**, Zoom registration required (agenda: environment overview, policies/usage limits, workflow-monitoring tools, Q&A). Jeffrey **tested the registration link — works**. Session **duration is moot** (Zoom registration doesn't display it). Jaime approved the language/dates.
  - **Mailing-list send procedure (Jamie Schnaitter):** email **`parcc-info@lists.upenn.edu`** → listserv replies asking for approval → reply with **just "OK"**. Set **Reply-To** to yourself or **`no-reply@parcc.upenn.edu`** because **users can't post to the list** (replies to the list address are eaten). Ryan will set Reply-To to himself ("I'd rather get questions"). Prior training used the **`parcc-alerts@lists.upenn.edu`** list.
  - NOTE: **July 9 conflicts with Jeffrey's jury duty** (from the 7/2 cycle).

## Cycle 3 (18:06) — PARCC Group (1 msg)
- **VAST per-project protected-paths / snapshots DEPLOYED (Ken).** Ken: *"Deployed the per project protected paths setup in VAST. This is controllable in coldfront and will be visible in `parcc_quota.py` with `--snapshots` (off by default until the snapshots populate). It will take two weeks to reach the full number of snapshots in each individual protected path."* Key facts:
  - Per-project **protected paths** → point-in-time **snapshots** (recovery for project data).
  - **Policy lives in ColdFront** (allocation UI), not on the filesystem.
  - Inspect via **`parcc_quota.py --snapshots`** — flag **off by default**, stays quiet until snapshots populate.
  - **~2-week ramp** to the full snapshot count per protected path.
  - Relevance: improves backup/recovery posture for the [[parcc-tokens-as-a-service]] beta labs and lab-agent data. See [[vast-storage]] and [[parcc-helper-tools]].

## Pages touched
- [[glm-5.2]] — 413 section: Ken's confirmation of the nginx proxy + pre-production caveat + serving-stack-session note.
- [[parcc-tokens-as-a-service]] — Chatterjee lab agent build + failure-independence/fallback open question; serving-stack knowledge-transfer; production-architecture-unsettled caveat.
- [[slurm-cli-filter]] — `MaxMemPerCPU=18432` unset (oversight); over-default requests warn (non-blocking) via the filter, not hard-fail; Ryan offered to lower it to match `DefMemPerCPU`.
- [[vast-storage]] — new "Snapshots & protected paths" section (ColdFront-controlled, `parcc_quota.py --snapshots`, ~2-wk ramp).
- [[parcc-helper-tools]] — `parcc_quota.py --snapshots` flag documented.

## See also
- [[glm-5.2]]
- [[parcc-tokens-as-a-service]]
- [[2026-07-03-teams-chats-digest]] — prior cycle: Jeffrey's original nginx `client_max_body_size` diagnosis of the 413.
- [[2026-07-02-teams-chats-digest]] — the 413 + context-window regression first surfaced.
