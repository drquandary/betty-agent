---
type: entity
tags: [people, parcc, facilitation, jvadala, betty-ai, vlm]
created: 2026-06-16
updated: 2026-06-26
sources: [2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest, 2026-06-25-teams-chats-digest, 2026-06-26-teams-chats-digest]
related: [betty-cluster, betty-ai-agent, surgical-tool-id-vlm, templeton-religious-trust-project, erf-user-facilitation, gromacs-on-betty, slurm-cli-filter, slurm-advisor, ryan-bradley, jaime-combariza, kenneth-chaney, jamie-schnaitter, parcc-skills-modules, glm-5.2]
status: current
---

# Jeffrey Vadala (jvadala)

## One-line summary
PARCC user-facilitation hire and the primary author/operator of the Betty AI agent stack; works under Ryan Bradley on HPC facilitation while bringing in outside research funding.

## Role
- PennKey / Betty username: `jvadala`; email `almjorda@sas.upenn.edu`
- User-facilitation / cyberinfrastructure (CI) support role at PARCC, acclimatizing into academic HPC support (see [[erf-user-facilitation]])
- Reports to / collaborates closely with [[ryan-bradley]] on facilitation; interacts with [[jaime-combariza]], [[kenneth-chaney]], and [[jamie-schnaitter]] on ops

## What he works on
- **[[betty-ai-agent]]** — builds the Betty assistant (web dashboard + pi/Claude agent) for user onboarding, AI training/fine-tuning tips, and SLURM scheduling help. Also drives the [[slurm-advisor]] subsystem.
- **[[surgical-tool-id-vlm]]** — a prior vision-language-model project (surgical implement identification) being considered for hosting on Betty.
- **[[templeton-religious-trust-project]]** — Templeton-funded research: classifying ~2000 free-text religious-experience responses with a 120B open LLM (per Ken's suggestion) and converting them to knowledge graphs for SNA.
- **"betty-toolkit" idea (tentative)** — wants to build a Betty-specific tool-discovery toolkit for researchers, modeled on NVIDIA's BioNeMo agent toolkit (which Ken shared 6/25). Aspiration, not yet started; complements [[betty-ai-agent]].
- **ParccSkills repo** — `github.com/drquandary/ParccSkills`, his agent-skills repo. Two skills (2026-06-26): **resume-session** (fuzzy-match back into any prior session; built for Claude Code, not yet tried with Pi) and **Nsight profiling + Karpathy-loop**. Wants to merge with Ken's skills work; see [[parcc-skills-modules]].
- **Agentic GLM usage (2026-06-26)** — tried [[glm-5.2]] for long-horizon "long tasks" per the hype, but the served **fp8** build has no vision so the run **got stuck**; workaround is an agent that **routes vision subtasks to Claude**.
- **Facilitation tasks** — the ERF code-compilation exercise and the [[gromacs-on-betty]] 1.5M-water onboarding benchmark ryb assigned.
- **Bug-finding** — found the `--mem` propagation bug in ryb's [[slurm-cli-filter]] (~2026-06-15).
- **Outreach / funding** — pulls in research funding (simulation group prototype tied to a grant that pays into PARCC; spread the word about PARCC at a German conference in Jena, May 2026).

## Working style
- Uses agentic tooling heavily (pi agent, Claude agent, Opus); prefers a "hands-off" agent-driven approach vs ryb's "heavy-handed" interactive Claude workflow.
- Works on GitHub via branch-and-merge with ryb; restarted a more modular version of his repo from scratch to address ryb's isolation concerns, and added ryb as a collaborator.

## See also
- [[ryan-bradley]] — mentor/collaborator on facilitation
- [[betty-ai-agent]]
- [[surgical-tool-id-vlm]]
- [[erf-user-facilitation]]
- [[gromacs-on-betty]]

## Sources
- [[2026-06-16-teams-chats-digest]] — Teams chats establishing role, projects, and tasks
- [[2026-06-18-teams-chats-digest]] — Templeton religious-trust project (120B LLM classification → knowledge graphs for SNA)
- [[2026-06-25-teams-chats-digest]] — "betty-toolkit" tool-discovery idea (modeled on BioNeMo agent toolkit)
- [[2026-06-26-teams-chats-digest]] — ParccSkills repo (resume-session, Nsight+Karpathy-loop); GLM fp8 no-vision → routes vision to Claude
