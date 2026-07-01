---
type: concept
tags: [parcc, skills, agents, spack, modules, lmod, tooling]
created: 2026-06-26
updated: 2026-07-01
sources: [2026-06-26-teams-chats-digest, 2026-06-29-teams-chats-digest, 2026-06-30-teams-chats-digest, 2026-07-01-teams-chats-digest]
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

### Skill anatomy & the standards question (2026-07-01)
What a "skill" actually is, per Jeffrey's description to Ryan, and the standards axis Ryan wants to formalize:
- **Format today: just text, no standard.** Skills are **plain (markdown) text files** with **no enforced schema** — Ryan: "the skills are all just text, right? are there any standards for them?"; Jeffrey: "no … they can be." So a standard is *possible but not yet adopted* (see `SKILL.md` linting via [[#roadmap]]'s **skill-lint** below).
- **Skills can carry executable steps.** *"sometimes I have skills run `.sh` commands."* A skill is text plus optional shell hooks, not pure prose.
- **Worked example — `resume-session` (a "simple one").** Anatomy: (1) a **fuzzy-matching simple text search** over the **past-session files**, (2) it **returns a result**, (3) it **ends with a shell command to load a new window depending on the session**. So even the minimal skill is text + a terminating `.sh` action.
- **The harness looper** (the Karpathy-loop runtime) is heavier: *"I had 3 `.sh` commands."* — multiple shell hooks vs resume-session's single one.
- **Ryan's proposed standards axis (durable):** develop **standards around human-legible vs machine-readable skills so that "we have parity,"** and possibly apply **"more formal methods for doing this."** Rationale: a skill has a human-readable face (the prose an author reads/edits) and a machine-executed face (the `.sh` hooks / structured directives an agent runs); Ryan wants those two to stay in sync (parity) under a common, possibly formally-specified standard. This sharpens the PARCC-wide **skills-curation** question (see [[#convergence]]) from "how do we vet/version skills" toward "what is the *spec* a skill must satisfy." Feeds the skills-curation session task.

### The shared-format design principles (2026-07-01, ~4:25–4:37pm)
Ryan turned the "parity" axis into concrete design goals for a **heavily-constrained shared skill format** meant for eventual *release to users*:
- **Audience classification / target-audience tagging.** Some skills are **readable by both humans and AI**; others (like Jeffrey's harness looper) **require a primer** if a human tries to read them, because they "lean on the model understanding" domain tools it already knows (e.g. `nsys`). The format should **tag each skill's intended audience** so a human isn't dropped into machine-facing prose unwarned. Ryan wants this tagging to be **enforceable** — *"careful tagging of the target audience will require some kind of data structure and review."*
- **Motive — no "metaphorical paywall".** Legibility standards keep the work **non-proprietary, interoperable**, and (Ryan argues) actually **help long-term AI uptake** by not hiding parts of the workflow behind opacity.
- **"Lego-block" composability principle (durable).** Even the lightweight **"fire-off" skills** must compose cleanly: *"we need to avoid a situation where using AI for one block means you can't stick it to another block because the outputs are non-clear to you."* Ryan's worry is grounded — when he uses Claude for simple coding it "frequently makes choices I haven't internalized," and that opacity is **deeper for domain-specific skills**. So a skill's **outputs must be legible enough to feed the next skill's inputs** — inter-skill contract, not just intra-skill prose. Jeffrey agreed lego-like skills are "a good way to think of it."
- **Jeffrey's skill taxonomy.** He'd build two classes: **"loop skills"** (the Karpathy-loop / harness runtimes) and **"simple fire-off" skills**; the fire-off ones **"require the least"** intelligence to run. This taxonomy is the modular unit Ryan wants for **parallel non-AI test tracks** (see benchmark below) and for testing Jeffrey's speculation that *some tasks need less intelligence*.
- **AI-verbose is OK if auto-summarizable.** Ryan: *"it's OK if the AI-readable version is hyper-verbose and specific, as long as we can automatically summarize it in a human tone (and check it, edit it, etc)."* → suggests a two-representation format: a verbose machine face + a generated, human-reviewable summary, kept in parity.
- **Collaborate with Ken on data structures.** Ryan wants to **ask Ken to share the data structures for his skills** (the Spack-generated ones) and design a **shared format** across both strands — the audience-tagging + review process needs a common schema. Reinforces the [[#convergence]] merge.

### Three-mode "rachit exercise" benchmark (2026-07-01, Ryan's idea)
A concrete model-discrimination experiment, reusing the rachitk GPU case ([[gpu-host-gather-bottleneck]]) as the fixed task:
1. **No AI** (human-only baseline).
2. **Full AI with Jeffrey's harness method** (the multi-day Opus-4.8 Karpathy loop).
3. **"Very discrete skills using GLM-5.2"** — decompose the task into small, well-scoped skills and run them on [[glm-5.2|GLM-5.2]].
- **Purpose:** parallel **non-AI tracks** "help us discriminate the models better" and test whether **some tasks require less intelligence** (make the work modular to test that). If mode 3 can be refined, it becomes **workshop material** (pairs with the fall GLM-5.2 workshop).
- **Caveat both flagged:** rachit's problem was **very domain-specific** — Jeffrey "wouldn't have figured it out in a reasonable amount of time without the AI"; Ryan notes this laborious read-the-code work is *"usually an RSE task, not a facilitator task"* (ties to the facilitation-vs-RSE role question in [[erf-user-facilitation]]).

### ZCode — z.ai's official GLM-5.2 harness (2026-07-01)
Jeffrey surfaced **ZCode** (`zcode.z.ai`) — *"ZCode - Simple, Fast, Vibe-Ready | Official Harness for GLM-5.2"* — as the vendor coding harness **"to use with our glm"** (point it at PARCC's served [[glm-5.2|GLM-5.2]]). Marketed as combining agents with existing tools to "plan, code, review, and deploy without friction." A candidate front-end alongside **Pi-Agent** and **opencode** for the GLM-5.2 workflow. `tentative` — not yet evaluated. See [[z.ai]], [[glm-5.2]].
- **What it actually is (2026-07-01 ~5pm).** Per Jeffrey: it's z.ai's **desktop app** ("its just their little desktop thing"), *"supposed to be set up for glm's unique long tasks,"* with **one-click skill install** ("has a bunch of skills sort of one click install"). He's skeptical it's more than positioning — *"idk could be all marketing."* Ryan had **not heard of it** ("I have no idea what zcode does"). Net: ZCode's differentiators to probe are **long-horizon task orchestration** + a **skill installer** — but as a *desktop GUI* it runs into the front-end-on-HPC problem below.

### Front-end / interface strategy (2026-07-01, Ryan) — distinct from skill format
A separate axis from the shared-skill *format*: **what interface do PARCC people (and eventually researchers) drive these skills through?** Ryan's position and framing:
- **BYO interfaces.** *"ideally all the interfaces could be BYO because there's no way I can work outside of vim or nvim on the cluster."* Ryan is **slow to adopt new tools** beyond sublime text / vim, and is **happy with opencode on Betty**. So the skills layer should be **front-end-agnostic** — usable from a plain terminal editor, not tied to a specific GUI.
- **"Can of worms."** Ken reportedly told Ryan that [desktop front-ends] *"were a can of worms for some reason"* — an unresolved caution about GUI harnesses on the cluster.
- **The "VSCode problem" analogy (durable).** *"this is analogous to the VSCode problem though … HPC is an unfriendly platform for everything more complicated than jupyter."* i.e. heavyweight GUIs (remote VSCode, the **ZCode desktop app**, etc.) fight the login/compute-node reality; anything beyond Jupyter is friction. This is the same platform constraint that shows up in [[open-ondemand-betty]] (why OOD sticks to a curated Jupyter + terminal).
- **Priority: text first.** Ryan's own focus is *"building the text of the skills library so everyone can read it"* (aligns with the human-legible parity axis above) — *"but we should also consider the front end though. If these kinds of front ends are essential, then we should have an answer."*
- **Jeffrey: unsure they're essential** — *"eh, idk if they are essential."*
- **Data point that motivates modularity.** Ryan used [[glm-5.2|GLM-5.2]] via **opencode**: *"I gave it a nice prompt and it took 26 minutes to connect [an] email to the code"* (a rachit-style task) — *"part of why I want to break that kind of thing into smaller pieces."* Reinforces the **lego-block / fire-off-skill** taxonomy above: long opaque agentic runs → decompose into small, legible, composable skills.
- **Working direction (tentative):** likely a **BYO/terminal-first** answer — vim/nvim + opencode/Pi-Agent + the sanctioned OOD terminal — with **skills as the portable layer** that any of those front-ends can call, rather than blessing a single GUI harness. Task filed under the skills-curation cluster.

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
  - **IMPLEMENTED (2026-07-01 ~5pm).** Jeffrey: *"i added a lot of 'gates' and the deep research, which makes it scoot around the web after it looks at the code, and sees if there is a solution there."* So the loop now, **after reading the code, searches the web for an existing solution** before/alongside the multi-day search — directly closing the "should have googled it first" gap from the rachitk case. He also added **"gates"** (checkpoints/guards in the loop). Position in the pipeline: code-read → **deep-research (web) gate** → harness search/benchmark → verify. Still to validate that it actually surfaces known answers on the three-mode rachit benchmark.

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
- [[2026-07-01-teams-chats-digest]] — skill anatomy (text + `.sh` hooks; resume-session & 3-command harness looper); Ryan's human-legible-vs-machine-readable "parity" standards proposal; 7th pull: shared-format design principles (audience-tagging, lego-composability, loop-vs-fire-off taxonomy, auto-summarize-verbose, Ken-data-structures), three-mode rachit benchmark, ZCode harness; Ryan's ParccSkills 404 RESOLVED; **8th pull: front-end/interface strategy (BYO vim/nvim, "VSCode problem", opencode-on-Betty), ZCode = desktop app for GLM long tasks w/ one-click skills, harness deep-research phase + "gates" IMPLEMENTED**
