---
type: concept
tags: [parcc, skills, agents, spack, modules, lmod, tooling]
created: 2026-06-26
updated: 2026-06-30
sources: [2026-06-26-teams-chats-digest, 2026-06-29-teams-chats-digest, 2026-06-30-teams-chats-digest]
related: [betty-software-deployment, betty-lmod-architecture, kenneth-chaney, jeffrey-vadala, betty-ai-agent, erf-user-facilitation, ryan-bradley, glm-5.2]
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

### Roadmap / "to make" (2026-06-29 eve)
- **Add Ryan as a collaborator — RESOLVED (6/29 eve).** The repo was **public**, which is likely why the invite originally failed (Ryan: "it looks like it's public, maybe that's why"); Jeffrey then **added him** ("i added you"). Ryan (`bradleyrp`) can now contribute directly, and **Ken is also going to add a few** ideas (see [[ryan-bradley]]).
- **Data-packaging skill (planned, README "to make").** Ryan's idea: a skill that **bundles a problem's code + data into a zip or an auto-shared location** so a handoff ships a runnable example. Motivated by the rachitk case, which cost extra time because rachit sent **no code/examples and no data** (Jeffrey had to synthesize data). Ryan: "imagine if your rachit interaction used real data because he used GLM5.2 to package the data for you. might have saved time." Jeffrey is adding this to the repo README as a "to make."
- **MWE / check-your-work skill (planned, Ryan's idea).** A skill that **checks an agent's work** and/or **reduces a complicated example to a Minimal Working Example** testable "without asking 20 questions over email." Ken separately mentioned a "skills library"; Ryan offered to help write a **tutorial** for it.
- **Benchmark / test case for the above (Ryan, 6/29 eve).** The concrete way to test the data-packaging + MWE skills: build a **contrived example of a user who scatters input data across many folders**, then have **GLM-5.2 (or whichever model) track the files down and dump the MWE somewhere** so it can be run. Ryan further wants the LLM to **reformulate the resulting benchmark into the format he uses for regression + performance testing — `github.com/upenn/benchtest`** (his benchtest harness; the target format for PARCC perf/regression benchmarks). Jeffrey will **paste Ryan's idea into the ParccSkills README via the github agent** and the two will "fill it out more." This ties the skills repo to a reproducible benchmark format (aligns with Ryan's "transparent and reproducible > better" bar).
- **skill-lint** (`github.com/himself65/skill-lint`) — third-party linter/validator for `SKILL.md` files (Claude.ai / Claude Code / other agents). Jeffrey shared it as a way to **force an agent into a mode** (or have a sub-agent with its own context enforce it). A candidate dependency for validating ParccSkills entries.
- **Fall workshop** "using GLM 5.2 and AI Coders" — Jeffrey + Ryan to co-develop (see [[ryan-bradley]], [[glm-5.2]]).

### Why skills/hooks, not CLAUDE.md (rule-enforcement lore, 2026-06-29)
Context from Ryan's complaint that Opus **ignored his `CLAUDE.md` formatting rules** (it said the instruction "fell off the context window because it wasn't important"). Jeffrey's working model, which motivates the skills effort:
- **`CLAUDE.md` is for general "directions or themes," not hard rules** — rule-following from it is "a roll of the dice."
- For **real rules, use hooks** — e.g. a hook that fires after a specific action and **injects a prompt** forcing the model to justify deviations ("tell me why you sinned").
- **Specialized agents / skills** can force the model into a mode; a sub-agent with its own context can do the check.
- **Opus 4.8 enforced "rule following"** more than 4.6/4.7 (which "had a habit" of dropping instructions); but in **long conversations (>80K tokens)** even important instructions get dropped **before compaction**. Practical fallback for the 80-char-docstring case: a **git pre-commit hook** (Opus's own suggestion).
- Jeffrey's broader take on where agents save time: mainly the **first prototype phase** and as a **linter/bug-checker**; for editing (e.g. his papers) they produce "sparkly clean" output but still need a fine-tooth comb, so they're not a pure time-saver.

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

### Ken's evaluation criteria for the tool (2026-06-30)
Ken replied (caveat: he **must read the tool before giving real feedback**, and hit a transient **404 because the repo had gone private** — now fixed, he's added as `k-chaney`). His framing for whether a multi-day agent harness is worth running:
- Ryan is mainly pushing **reliability** — the bar for being a tool that can be **recommended/used**.
- The cost that matters **isn't tokens, it's human time** — *"even though it is a compressed amount of time you spend on it, you still spend time on it … the time is the bigger part."* The optimization is the "running vs swimming across a river" calculus: **token-time × human duration × actual human direct attention.**
- Two gating questions: **(1)** is it reliable enough that the time/tokens are unlikely to be wasted? **(2)** if it fails, do we still learn something? — *"the result out of the tools should be learning something, even if it fails."*
- Ideal trajectory: **trust it enough to eventually give it to researchers.** Risk (exists for any software): a researcher could burn ~$50 tokens + ~$500 compute for nothing.
- **Internal-vs-researcher scope:** Jeffrey clarified he **only intended internal use**, not researcher-facing; Ken argues *"same thought process applies even for internal use."*
- Jeffrey's counter-data (his rachitk run): **3–4 days wall-clock but only ~2–3 hrs of direct attention** (steering, hitting OK, checking logs), little token-crunching while off work, **auto-logged the whole run to the wiki/knowledge-graph**, and improved the tool — *"I doubt a noob could really beat me unless they had direct experience with that app."* On reliability he told Ryan *"the proof will be in the puddin — if the fix actually works."* This is the empirical case for the harness against Ken's time/reliability bar.

### Convergence
- Both want to **combine into a shared PARCC skills repo** ("definitely we should work on combining fully"), gated on Ken validating his generator first.
- **Collaborator add (2026-06-30).** After Ken 404'd on the (now-private) ParccSkills repo, Jeffrey **added Ken** as a collaborator (GitHub **`k-chaney`**) — joining Ryan (`bradleyrp`). So both PARCC staff now have direct access; next ball is Ken reading the harness before feedback.
- **Curation as a team decision (2026-06-30).** Ken wants the group to **"sit down and hash out the ways these skills should be curated in the PARCC environment overall"** and says he has **"initial ideas for testing this."** So skills curation is being elevated from the two-person repo merge to a **PARCC-wide governance/testing question** (how skills are vetted, versioned, and exposed — ties to the Lmod-loadable delivery and Ken's skills-from-Spack generator).
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
- [[2026-06-30-teams-chats-digest]] — Ken's reliability/time evaluation criteria for the harness; repo went private → Ken added (`k-chaney`); curation as a PARCC-wide question
