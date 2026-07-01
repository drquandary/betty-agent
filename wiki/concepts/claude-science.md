---
type: concept
tags: [anthropic, claude, skills, hpc, science, agent]
created: 2026-06-30
updated: 2026-07-01
sources: [2026-06-30-teams-chats-digest, 2026-07-01-teams-chats-digest]
related: [parcc-skills-modules, betty-ai-agent, dgx-b200-partition, ryan-bradley, parcc-tokens-as-a-service]
status: tentative
---

# Claude Science

## One-line summary
Anthropic product announced 2026-06-30 — a bundle of inbuilt agent "skills" for HPC & science tasks that can run "jobs"; a reference point/competitor for the in-house ParccSkills / betty-toolkit effort.

## What we know (tentative, first impressions only)
First seen 2026-06-30 when Jeffrey and [[kenneth-chaney|Ken]] tried it the day it was announced:

- **Shape:** appears to be a **set of inbuilt skills** aimed at **HPC and science tasks** (Jeffrey: "it's a bunch of inbuilt skills … for hpc and science tasks"). Mirrors the agent-skills model PARCC is already building toward — see [[parcc-skills-modules]].
- **Runs "jobs":** it can do "jobs" — i.e. has some job-execution capability (unconfirmed whether this means Slurm-style batch jobs or its own task abstraction).
- **Auto-profiling:** it **auto-generated a profile for running GPU benchmarks on Betty** without being hand-fed the cluster spec.
- **Accuracy caveat:** its default hardware assumptions were **wrong for Betty** — Ken: "We have B200 not H100." It assumed **H100** GPUs; Betty is **B200** ([[dgx-b200-partition]]). So benchmark profiles it generates need spec correction before use.

## Why it matters here
- Direct reference point for the PARCC skills work: ParccSkills (jvadala), Ken's skills-from-Spack generator, and the "betty-toolkit" tool-discovery idea all target the same "inbuilt skills for science/HPC" niche. Worth checking what Claude Science's built-in HPC skills cover and whether its wrong-default-hardware behavior is config-fixable (i.e. can it be pointed at a real Betty hardware profile).

## PARCC / RSE positioning (2026-07-01, Vadala↔Bradley)
Discussed as a **competitive/strategic** matter, not just a tool to try:
- **[[ryan-bradley|Ryan]]'s framing:** it's "flattering that people are spending a lot of effort to take best practices that research computing has refined over many years and then try to sell it back to us." PARCC can **"make sure some of the RSE services respond to"** the marketing claim that "grad students are going to 10x their productivity with claude science" — i.e. position PARCC's own RSE/facilitation services (and in-house stack) as the answer rather than ceding the narrative.
- **Who the users actually are:** Jeffrey — the people who **sign up and use** this will be **grad students** ("it's gunna be the grad students signing up and using this"). That pins the audience for both Claude Science *and* PARCC's counter-offering ([[parcc-tokens-as-a-service]], [[parcc-skills-modules|ParccSkills]]/betty-toolkit) to the grad-student tier.
- **Next step:** both agreed **"we should prep for it"**; Jeffrey to **demo Claude Science to Ryan at their next sync** ("I'll show it to you at our meeting").

## Open questions
- What exactly is a "job" in its model (Slurm batch vs. internal task)?
- Can the hardware profile be overridden so it stops assuming H100?
- How does its skill set overlap with / complement ParccSkills?

## See also
- [[parcc-skills-modules]]
- [[betty-ai-agent]]
- [[dgx-b200-partition]]
- [[ryan-bradley]]
- [[parcc-tokens-as-a-service]]

## Sources
- [[2026-06-30-teams-chats-digest]] — Chaney↔Vadala reactions on announcement day
- [[2026-07-01-teams-chats-digest]] — Vadala↔Bradley: RSE positioning ("respond to the grad-student 10x claim"), demo at next sync
