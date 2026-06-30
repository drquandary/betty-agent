---
type: concept
tags: [anthropic, claude, skills, hpc, science, agent]
created: 2026-06-30
updated: 2026-06-30
sources: [2026-06-30-teams-chats-digest]
related: [parcc-skills-modules, betty-ai-agent, dgx-b200-partition]
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

## Open questions
- What exactly is a "job" in its model (Slurm batch vs. internal task)?
- Can the hardware profile be overridden so it stops assuming H100?
- How does its skill set overlap with / complement ParccSkills?

## See also
- [[parcc-skills-modules]]
- [[betty-ai-agent]]
- [[dgx-b200-partition]]

## Sources
- [[2026-06-30-teams-chats-digest]] — Chaney↔Vadala reactions on announcement day
