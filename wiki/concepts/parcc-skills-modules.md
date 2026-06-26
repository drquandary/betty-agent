---
type: concept
tags: [parcc, skills, agents, spack, modules, lmod, tooling]
created: 2026-06-26
updated: 2026-06-26
sources: [2026-06-26-teams-chats-digest]
related: [betty-software-deployment, betty-lmod-architecture, kenneth-chaney, jeffrey-vadala, betty-ai-agent]
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
