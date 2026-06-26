---
type: source
tags: [teams, parcc, ceph, storage, downtime, vendor, glm, skills, agents]
created: 2026-06-26
updated: 2026-06-26
related: [betty-storage-architecture, jaime-combariza, kenneth-chaney, jeffrey-vadala, glm-5.2, parcc-skills-modules, multi-token-prediction]
status: current
---

# Teams Chats Digest — 2026-06-26

## One-line summary
PARCC Group: the `/ceph` remediation will require a coordinated downtime — AHEAD asked for timing/duration, groups holding /ceph data must be contacted, and the team is weighing an earlier meeting (Jaime offered 9 AM) to leave time to reach out to faculty + AHEAD. **Plus a Ken↔Jeffrey 1:1 (~11:17–11:30 EDT):** GLM vision is missing on the fp8 build (full model supposed to do it), GLM-5.2 is now usable for coding (move from Kimi), and both are building agent "skills" they want to merge.

## Content
- **Ceph remediation needs a coordinated downtime** — continuing the `/ceph`-on-DTN thread ([[2026-06-24-teams-chats-digest]]):
  - **Ken Chaney** suggested meeting **earlier in the day** so there's time to **reach out to faculty and AHEAD** to do the work.
  - **Jaime Combariza** said he **asked AHEAD when this needs to be done and how long the downtime would be**, noted the team **has to contact the groups that have /ceph data and coordinate** with them, and offered he is **available at 9:00 AM if everyone is**.
  - **Ken Chaney (~8:50 AM)** confirmed **9 AM** ("I'm good at 9am"), so an earlier Ceph meeting is agreed by Jaime + Ken. From his **call with AHEAD the night of 6/25** it's a **"sooner vs later"** situation.
- **Ceph PG (placement-group) scaling status** — Ken: the cluster **"just barely got over this hump on PG scaling, from 256 to 512,"** but there's **"a good bit to go"** toward a target of **~2048 PGs**. So the `/ceph` remediation is an in-progress PG-scaling/rebalance operation, which helps explain the need for a coordinated downtime.
- This is distinct from today's confirmed **2 PM PARCC sync**; the full group Ceph discussion is still deferred to **Mon 6/29** when everyone is back (Jamie Schnaitter out until 7/1).
- Filed onto [[betty-storage-architecture]] (Tier 2: Ceph) as a tentative remediation-plan + PG-scaling note.

## Ken ↔ Jeffrey 1:1 — GLM vision + agent skills (~15:17–15:30Z / 11:17–11:30 EDT)
- **GLM vision support.** Resolves the open "did you get glm to work with vision?" thread ([[2026-06-25-teams-chats-digest]] → this one):
  - Jeffrey: *"I don't think the fp8 does vision"* but *"the regular model is supposed to."* So the **fp8-quantized** GLM build PARCC serves lacks vision; the **full-precision model** is expected to support it.
  - Workaround in place: Jeffrey *"told an agent to pass off vision tasks to Claude."*
  - Context: he'd been trying GLM for **"long tasks"** (per the hype) but *"with no vision, it got stuck."* → vision gaps stall long-horizon agentic runs. Filed to [[glm-5.2]].
- **GLM-5.2 now servable for coding.** Ken: *"you can move any of your coding from kimi over to glm 5.2"* — so GLM-5.2 is available on PARCC's coding/inference stack alongside **Kimi-code**. Updates [[glm-5.2]] from "on radar" toward "available"; MTP speed mechanism unchanged ([[multi-token-prediction]]).
- **Agent skills, two strands they want to merge** (see [[parcc-skills-modules]]):
  - **Ken** is having an agent *"write a skill to create skills from modules in spack,"* then plans to *"let it write a skill for every module in Ryan's software tree,"* and wants them **Lmod-loadable** — *"so you could do ml parcc/skills/bio/0.1."* Wants to validate usefulness first.
  - **Jeffrey** shared **github.com/drquandary/ParccSkills** — two skills: **resume-session** (fuzzy-match into any prior session; built for Claude Code, *"not tried with Pi"*) and the **Nsight profiling + Karpathy-loop** skill.
  - Both agreed: *"definitely we should work on combining fully."* Overlaps Jeffrey's **betty-toolkit** idea ([[jeffrey-vadala]]).

## See also
- [[betty-storage-architecture]]
- [[glm-5.2]]
- [[parcc-skills-modules]]
- [[jaime-combariza]]
- [[kenneth-chaney]]
- [[jeffrey-vadala]]
- [[2026-06-24-teams-chats-digest]]
- [[2026-06-25-teams-chats-digest]]

## Sources
- PARCC Group Teams chat, 2026-06-26T12:15–12:22Z (digest `digest_20260626T083924.json`)
- PARCC Group Teams chat, 2026-06-26T12:22–12:51Z (digest `digest_20260626T091149.json`)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T15:17–15:30Z (digest `digest_20260626T114656.json`)
