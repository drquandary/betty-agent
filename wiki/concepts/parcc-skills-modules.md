---
type: concept
tags: [parcc, skills, agents, spack, modules, lmod, tooling]
created: 2026-06-26
updated: 2026-06-29
sources: [2026-06-26-teams-chats-digest, 2026-06-29-teams-chats-digest]
related: [betty-software-deployment, betty-lmod-architecture, kenneth-chaney, jeffrey-vadala, betty-ai-agent, erf-user-facilitation]
status: tentative
---

# PARCC Agent Skills (skills-as-modules)

## One-line summary
An emerging PARCC effort to package agent "skills" so they can be discovered and loaded like software — including auto-generating one skill per Spack module and exposing them through Lmod (`ml parcc/skills/bio/0.1`). Two strands (Ken's generator + Jeffrey's ParccSkills repo) that the two intend to merge.

## Content

### Ken's strand — skills generated from Spack modules
- Ken is **having an agent write a skill that creates skills from modules in Spack**.
- Once that meta-skill works, the plan is to **let it write a skill for every module in Ryan's Spack software tree** (the `/vast/parcc/sw/` tree — see [[betty-software-deployment]]).
- Design goal: **skills loadable as Lmod modules**, e.g. `ml parcc/skills/bio/0.1` — a versioned, namespaced skill tree alongside the normal software modules ([[betty-lmod-architecture]]).
- Status: prototype; Ken wants to **confirm it is useful at all** before investing further or combining repos. `tentative`.

### Jeffrey's strand — the ParccSkills repo
- Repo: **github.com/drquandary/ParccSkills** (jvadala). Two skills as of 2026-06-26:
  - **resume-session** — fuzzy-match back into any prior session; built for **Claude Code**, **not yet tried with Pi**.
  - **Nsight profiling + Karpathy-loop** skill (GPU profiling + iterative agent loop).
- After the PARCC↔NVIDIA meeting, Jeffrey **added the NVIDIA Nsight ("Insight") CLI** into the harness (2026-06-29).
- **Pi-Agent (2026-06-29).** Jeffrey runs his agents on **Pi-Agent** — his own "super minimal agent in cli" — which he positions as "sort of the same thing as **opencode**, just with less cruft / less bloat … **less ux and prompt**" and which "**saves tokens**." He pitched it to Ryan (who tried [[glm-5.2|GLM-5.2]] in opencode and liked it but finds agentic flows "too hands-off") as the elegant, low-overhead alternative. The `resume-session` skill above was "built for Claude Code, not yet tried with Pi" — so Pi-Agent is the lighter runtime he's migrating toward.

### The harness method (how the skills get used in practice) — 2026-06-29
The ParccSkills "Karpathy-loop" is the engine behind Jeffrey's facilitation deliverables. Method as he described it for the **rachitk** OOM case:
1. **Babysit Opus 4.8 running ~10 agents for a couple of days** against the problem.
2. **Refine** the loop; **discard bogus answers**; keep the most plausible candidate.
3. The harness **tests/benchmarks** the candidate fixes (now with the Nsight CLI for GPU profiling).
4. **Verify independently** — Jeffrey confirmed the winning answer with **Google** and found others had recommended the same fix.
- **rachitk result:** the fix was to **decode ON the GPU itself** (avoid the CPU↔GPU round-trip that triggered the OOM — the case involved both a CPU and a *prospective* GPU OOM).
- Self-critique / lesson: "I should have just googled it first" — the multi-day agent search converged on a known answer, so cheap lookup first, harness for verification/benchmarking second.
- **Cost/role angle:** this kind of read-the-code-and-optimize work is exactly what ryb is trying to classify as facilitation vs funded consulting (see [[erf-user-facilitation]]), and prompted his cost question — could it run on **GLM-5.2** instead of Opus 4.8 (Jeffrey: yes), and what does the Opus run cost (`npx ccusage`)? See [[glm-5.2]].

### Karpathy-loop architecture (Jeffrey's description, 2026-06-29 afternoon)
Two cooperating loops:
1. **ML-task loop** — rate the outputs of an ML training run, **adjust parameters, and rerun training**; score each trial.
2. **Wiki-logging loop** — logs trials and failures to give the agent a **persistent memory** of what's been tried (the Karpathy LLM-wiki pattern; same idea as this wiki).
- The **Nsight ("Nvidia insight") CLI** is wired in as a third signal: it reads what the GPU is doing, **logs that to the wiki, and folds it into the scoring**.
- Jeffrey's view on model requirements: **"a dumber model could do all this"** — the task isn't compute-intelligence-bound. What actually mattered was **long-running persistence**: many primitive agents **give up**, so they "have to be trained to just keep trying stuff." That persistence is **why he used Opus 4.8** (pushed it via "long running"); **GLM is supposed to do that** too. → motivates the A-B test below.
- Worked example (rachitk): Jeffrey told it to **get synthetic / test data**; it pulled some **encoded test data**, then tried to **replicate the ~20% GPU utilization rachit was seeing in ~5 different ways**. Jeffrey **actively managed** it ("it's like I stepped in and managed these things") rather than fire-and-forget ("I didn't just say 'fix it' and come back 3 days later").
- **Proposed improvement:** add a **"deep research" phase** up front — Jeffrey thinks it "would have caught the deciding thing" (the known answer), consistent with the should-have-googled-first lesson. (Ryan: "I don't know what deep research means" → worth defining when pitching it.)

### Does it scale horizontally? (Ryan's framing, 2026-06-29)
- Ryan's **real interest** is whether this harness **generalizes to other users' workflows**, not the recursive loop itself. He separately flagged that the most "native"-to-the-model part is **how the model inferred the data movement from the code (vs. from Nsight) and proposed a fix** — that's the capability worth probing.
- Cost objection: **two days of agent labor is too expensive to be a general test.** Path forward he proposed: **if GLM-5.2 can do the same task**, and they **quantify tokens + wall-clock time**, the workflow could be generalized to other users.
- Ryan's quality bar: **"better is secondary to transparent and reproducible across other projects."** Recommended (twice) **talking it through with Ken**; Jeffrey has **full logs** and **mentioned it to Ken last week**. → see tasks: A-B GLM-5.2 vs Opus-4.8 benchmark + Ken conversation.
- **Handoff to Ken initiated (2026-06-29 eve).** Jeffrey opened the thread with [[kenneth-chaney]] — framed it as "my **research-loop** tool … the one the Nvidia dudes liked," shared the ParccSkills link, and relayed Ryan's two framing quotes (data-movement-inferred-from-code vs Nsight; horizontal scaling; transparent/reproducible > better). His cost rebuttal: the multi-day token spend was offset because it **let him multitask ~10 other projects** — solo, one-at-a-time, the same conclusion (decode-on-GPU) "may have taken a week." Expects it runs on **GLM-5.2 or even a lesser model**. Awaiting Ken's reply.

### Convergence
- Both want to **combine into a shared PARCC skills repo** ("definitely we should work on combining fully"), gated on Ken validating his generator first.
- Conceptually overlaps Jeffrey's **"betty-toolkit"** tool-discovery idea (see [[jeffrey-vadala]], [[betty-ai-agent]]) — both aim to make Betty's capabilities discoverable to researchers/agents; the Lmod-loadable angle is a concrete delivery mechanism.

## See also
- [[betty-software-deployment]]
- [[betty-lmod-architecture]]
- [[kenneth-chaney]]
- [[jeffrey-vadala]]
- [[betty-ai-agent]]

## Sources
- [[2026-06-26-teams-chats-digest]] — Ken/Jeffrey 1:1 on skills-from-spack + ParccSkills repo
- [[2026-06-29-teams-chats-digest]] — the multi-day Opus-4.8 harness method, Nsight-CLI addition, and the rachitk decode-on-GPU OOM fix
