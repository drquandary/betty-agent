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

### Afternoon continuation (~3:22–3:36pm EDT) — harness architecture + horizontal-scaling question
- **Karpathy-loop architecture** Jeffrey laid out: (1) an **ML-task loop** (rate training outputs → adjust params → rerun → score) and (2) a **wiki-logging loop** for persistent memory of trials/failures; the **Nsight CLI** feeds GPU behavior into the wiki and the scoring. "A dumber model could do all this."
- **Why Opus 4.8:** not intelligence but **long-running persistence** — primitive agents "give up," so they must be "trained to just keep trying." **GLM is supposed to do that** too → motivates an A-B test. Jeffrey offered an **agentic bench**; thinks Ken would like it.
- **Proposed "deep research" phase** that "would have caught the deciding thing" (the known answer). Ryan: "I don't know what deep research means."
- **Ryan's real interest:** does this **scale horizontally** to other users' workflows? The most model-"native" part is **how it inferred data movement from the code (vs. Nsight) and proposed a fix.** Two days of agent labor is too costly as a general test, **but if GLM-5.2 can do it and they quantify tokens + time, generalize.** Bar: **"better is secondary to transparent and reproducible."** Recommended (twice) **talking to Ken**; Jeffrey has logs, mentioned it to Ken last week.
- Worked detail: Jeffrey told it to fetch **synthetic/test data** (got encoded test data), then it tried to **replicate rachit's ~20% GPU utilization ~5 different ways**; Jeffrey **actively managed** it rather than fire-and-forget.
- **rachit status:** Jeffrey asked if rachit replied; Ryan: "not to me. I assume he will try to implement your advice." (See [[parcc-skills-modules]] for the full architecture writeup.)

### Evening continuation (~4–4:29pm EDT) — Pi-Agent vs opencode, GROMACS bench date
- **GPU decode aside:** Jeffrey notes decoding/decompressing on the GPU "are something people do for games and stuff" — i.e. the rachitk fix is a mainstream technique, reinforcing the should-have-googled-first lesson.
- **GROMACS:** Jeffrey "didn't forget about the gromacs stuff" but "still need[s] to run bench on it" → committed to **running the benchmark Wednesday (7/1)** and reporting issues. Ryan 👍.
- **GLM-5.2 / agent UX:** Ryan **tried GLM-5.2 briefly Friday in opencode** — "pretty good" — but finds the **agentic stuff too hands-off**; he uses opencode for **Q&A → markdown or diffs** he implements himself. Jeffrey suggested running GLM-5.2 on **Pi-Agent** (his "super minimal agent in cli," "saves tokens," "less cruft / less bloat … less ux and prompt") — "sort of the same thing as opencode, just with less bloat," pitched to Ryan's "appreciat[ion of] elegance." See [[parcc-skills-modules]], [[glm-5.2]].

### Ken thread (~4:14–4:20pm EDT) — research-loop handoff per Ryan
- Acting on Ryan's repeated recommendation, **Jeffrey opened the research-loop discussion with Ken Chaney**: "Ryan wanted me to talk to you about my 'research-loop' tool … the one the Nvidia dudes liked," with the **github.com/drquandary/ParccSkills** link.
- He **relayed Ryan's two framing quotes verbatim**: (1) the interesting part is less the recursive loop, more **how the model inferred the movement of the data from the code (or was it all from Nsight?) and proposed a solution** — "more 'native' to the model"; real interest is whether it **scales horizontally** to other users; two days of agent labor is a high cost to test, but if **GLM-5.2** can do it and they quantify **tokens/time**, generalize. (2) "**better is secondary to transparent and reproducible** … I'd recommend talking about this with Ken."
- **Jeffrey's cost rebuttal to Ken:** the multi-day harness was expensive in tokens **but enabled multitasking on ~10 other projects**; doing it manually one-at-a-time "may have taken me a week to get the same conclusion which was the decoding needed to be done on the gpu." He expects it to work on **GLM-5.2 or even a lesser model**. Awaiting Ken's response. See [[parcc-skills-modules]].

### Late-afternoon continuation (~4:29–5:02pm EDT) — AI-coding shop talk + ParccSkills roadmap
- **Rule-enforcement lore.** Ryan: Opus **ignored his `CLAUDE.md` formatting rules** on an ORM/Python task; it said the instruction "fell off the context window because it wasn't important." Jeffrey's model: `CLAUDE.md` is for **"directions or themes," not rules** (rule-following is "a roll of the dice"); for real rules use **hooks** (inject a prompt forcing the model to justify deviations — "tell me why you sinned") or **specialized agents/skills**. **Opus 4.8 enforced "rule following"** more than 4.6/4.7; but **>80K-token conversations drop instructions even before compaction**. Concrete fallback for Ryan's 80-char-docstring goal: a **git pre-commit hook** (Opus's own suggestion). Jeffrey shared **`github.com/himself65/skill-lint`** (validates `SKILL.md`).
- **Where agents save time (Jeffrey):** mainly the **first prototype phase** and as a **linter/bug-checker**; for editing his papers they're "sparkly clean" but still need a fine-tooth comb — not a pure time-saver. Ryan's "debt" worry: you end up reviewing everything / writing more tests.
- **ParccSkills roadmap items** (all → [[parcc-skills-modules]]):
  - **Workshop:** Jeffrey proposed co-developing a fall **"using GLM 5.2 and AI Coders"** workshop; Ryan agreed.
  - **MWE / check-your-work skill** (Ryan's idea) — checks the agent's work / reduces a complex case to a Minimal Working Example testable "without asking 20 questions over email"; Ken mentioned a "skills library"; Ryan offered to help with a **tutorial**.
  - **Data-packaging skill** (README "to make") — bundle code + data into a zip / auto-shared location; motivated by rachitk sending **no code or data** (Jeffrey: "imagine if [rachit] used GLM5.2 to package the data for you").
  - **Collaborator add BLOCKED** — Ryan's GitHub is **`bradleyrp`**; Jeffrey's invite to ParccSkills failed ("it wont let me add you"); Ryan asked for the error. See [[ryan-bradley]].

## See also
- [[erf-user-facilitation]] — the facilitation/role-definition thread continues here
- [[parcc-skills-modules]] — the ParccSkills harness behind the rachitk fix
- [[glm-5.2]] — GLM-5.2 vs Opus 4.8 cost/quality claim
- [[bhuv-jain]] — the upcoming physics-faculty engagement
- [[ryan-bradley]], [[jeffrey-vadala]]
