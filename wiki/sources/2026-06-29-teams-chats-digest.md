---
type: source
tags: [teams, digest, facilitation, rse, consulting, llm-cost, oom, glm]
created: 2026-06-29
updated: 2026-06-29
related: [erf-user-facilitation, parcc-skills-modules, glm-5.2, bhuv-jain, ryan-bradley, jeffrey-vadala]
status: current
---

# 2026-06-29 Teams Chats Digest

## One-line summary
Ryan ↔ Jeffrey 1:1 thread: role-definition framing (facilitation vs "AI consultant" vs RSE) ahead of a Prof. Bhuv Jain meeting; Ryan asks Jeffrey to document the rachitk OOM reasoning and the multi-day LLM-agent harness behind it; and an LLM-cost discussion (GLM-5.2 vs Opus 4.8, `ccusage`, subsidy risk).

## Content

### Role definitions — facilitation vs "AI consultant" vs RSE
- Ryan wants the team **consistent about roles**. The open question: when Jeffrey **reads a research group's code and helps optimize it**, is that **basic facilitation**, an **"AI consultant"** engagement, or an **RSE** engagement? If facilitation already includes this, it may **overlap with a *funded* PARCC consulting service**.
- "Consulting" is framed as a **time-limited engagement** with **varying accountability** — from actually building something to just telling postdocs "do this instead." Jeffrey's read: consulting fits labs with **tech-savvy postdocs who just need direction** (he cited "that kidney group" — postdocs who "didn't need anything really made for them").
- Ryan pointed Jeffrey at **USRSE materials** (other institutions' models for structuring these engagements) to browse before the Jain meeting.

### Prof. Bhuv Jain meeting (next week)
- A meeting with **Prof. Bhuv Jain** (UPenn physics) is set for next week, with Ryan and Jeffrey. Likely about **AI in education**, *not* a full RSE engagement (Jain asked Jeffrey about AI/education in both interviews; it's on his website). See [[bhuv-jain]].

### The rachitk OOM advice + the harness method
- Ryan found Jeffrey's emailed OOM advice to **rachitk** hard to follow — there seemed to be **both a CPU and a prospective GPU OOM**. Standing ask: **spell out the reasoning** in future so Ryan can follow how the conclusion was reached.
- Method Jeffrey described: he ran a **multi-day LLM-agent harness** — "babysat **Opus 4.8** running … with like 10 agents for a couple days," refined it, **discarded bogus answers**, kept the most plausible, then **verified with Google** (others had independently recommended the same fix). The fix found: **decode ON the GPU itself** (avoids the CPU↔GPU transfer that caused the OOM). Self-critique: "I should have just googled it first," but the harness did **test/benchmark** the options.
- He **added the NVIDIA Nsight ("Insight") CLI** to the harness after the PARCC↔NVIDIA meeting. Code lives in **github.com/drquandary/ParccSkills**. See [[parcc-skills-modules]].

### LLM cost / on-prem vs subscription
- Ryan: could the rachitk work be done with **GLM-5.2**? If not, **how much did Opus 4.8 cost**? He converts Claude subscription usage to **API-equivalent rates with `npx ccusage`**.
- Ryan's strategic concern: **personal subscriptions are heavily subsidized and "won't be around forever"** → on-prem models may be the better long-term bet.
- Jeffrey: **GLM-5.2 is "beating opus 4.8 … in some long term tasks … it should work."** See [[glm-5.2]].

## See also
- [[erf-user-facilitation]] — the facilitation/role-definition thread continues here
- [[parcc-skills-modules]] — the ParccSkills harness behind the rachitk fix
- [[glm-5.2]] — GLM-5.2 vs Opus 4.8 cost/quality claim
- [[bhuv-jain]] — the upcoming physics-faculty engagement
- [[ryan-bradley]], [[jeffrey-vadala]]
