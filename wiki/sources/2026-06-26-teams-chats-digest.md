---
type: source
tags: [teams, parcc, ceph, storage, downtime, vendor, glm, skills, agents, dflash, gpt-oss]
created: 2026-06-26
updated: 2026-06-26
related: [betty-storage-architecture, jaime-combariza, kenneth-chaney, jeffrey-vadala, glm-5.2, parcc-skills-modules, multi-token-prediction, dflash, runai-betty, betty-auth-architecture, workweave-router, parcc-tokens-as-a-service]
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

## Ceph working session — downtime scheduled (~17:55–18:33Z / 1:55–2:33 EDT)
- Ken Chaney created a **dedicated "Ceph" meeting chat** and a live meeting **started 1:55 PM**, pulling in **AHEAD/vendor guests Ryan Heath and Swapnil Ninave** alongside Ryan Bradley; **Jeffrey ("Jeff") was invited**; Andrew Chant and Jay Deheve joined then left. This is the working session that operationalizes the morning's Ceph-downtime plan.
- **Maintenance window START: 06/27/2026 @ 6:00 AM** (Ken) — the Ceph remediation/PG-scaling downtime begins the next morning.
- **`ceph osd pause`** posted by Ken — staging the pre-downtime drain step (stop OSD scheduling so the cluster can be quiesced).
- **Affected-account contact list** (~31 users/groups holding /ceph data) compiled by Ken: akreddy, brisson, chaneyk, dyer1, ggrant, jbabdor, jmurr, jushi, ksusztak, pcamara, ryb, sattertt, tamachad, ycheng11, yyee, zives, asokr, ccb, chenyuli, gahead, glogsdon, jcombar1, juliochi, kj4tbt, mzarella, qinl1, ryroark, sun12, vidalr, yxdeng, zahrt — the notify-before-the-window set.
- **Live job-drain hunt:** Swapnil Ninave ran `squeue -t RUNNING -O "JobID,UserID,NodeList,WorkDir" | grep /ceph` and surfaced a running job — **6850091**, node **epyc-2-2**, workdir `/ceph/projects/ksusztak/nephrobase_1/Siyu/3_Projects/6_scMR`. Jobs touching /ceph must be drained before the 6 AM pause.
- **Live cluster I/O:** Michael Saldaris posted `ceph status` snapshots — client ~234 MiB/s→1.4 GiB/s rd, recovery ~52 MiB/s / 17 objects/s — confirming the cluster is still actively rebalancing as the PG scale-up proceeds.
- Filed to [[betty-storage-architecture]] (Tier 2: Ceph → downtime-scheduled note).

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

## Ken ↔ Jeffrey 1:1 — dflash testing (~16:02–16:08Z / 12:02–12:08 EDT)
- Continuing the **dflash** thread ([[2026-06-25-teams-chats-digest]]): Ken reports **"dflash is running"** and **"I need to test it now."** When Jeffrey asked "for what model," Ken said **`gpt-oss-120b` to start**.
- So dflash's first test target on PARCC is the **gpt-oss-120b** serving stack. Still an unidentified inference/serving tool — filed tentatively to [[dflash]]; follow up with Ken on results.

### dflash endpoint + crash (~16:34–16:49Z / 12:34–12:49 EDT)
- Jeffrey asked **"how do I use it?"** Ken: while **on the PARCC VPN**, hit the endpoint directly — **`https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`**.
- The hostname reveals the full serving stack: **sglang** engine + **gpt-oss-120b** + **dflash** on **run:ai** ([[runai-betty]]), a **test** deployment under `inference.betty.parcc.upenn.edu`. This is the first concrete signal that **RunAI actively serves inference on Betty** (not just the `/mnt/vast/runai` mount), and that **dflash is an sglang-side acceleration component**.
- Minutes later (~16:49Z) Ken: **"andddd it is crashing lol"** — the test endpoint is **not yet stable**. Filed to [[dflash]] (Access + status) and [[runai-betty]].

### dflash stabilized + throughput numbers (~17:15–17:25Z / 1:15–1:25 EDT)
- Ken: **"I think it is stabilized now"** — the endpoint now **responds**. Reported performance:
  - **~5,000 tokens/sec/GPU** aggregate at **concurrency 100**, which Ken calls **"about double (almost triple) previous performance."**
  - **~300 tps at single concurrency** (one request).
  - Per-user **~300 tps sustained for up to ~15 concurrent users**; beyond that, **slowdown**. (Solo, Jeffrey gets the fast single-stream rate — he joked he'd get "whiplash.")
- On distribution: the raw URL is **"just an endpoint"**; Ken will **"get it on litellm shortly"** so it's reachable via the standard PARCC LiteLLM gateway, not only the direct VPN URL.
- These are the first **real throughput figures** for an sglang+dflash+RunAI inference deployment on Betty. Filed to [[dflash]] and [[runai-betty]].

### dflash on LiteLLM + raw endpoint 404 + gpt-oss-20b (~17:34–17:44Z / 1:34–1:44 EDT)
- **On LiteLLM now.** Ken: *"you can test it out on litellm now with the `openai/gpt-oss-120b`."* So gpt-oss-120b + dflash is reachable through the standard PARCC **LiteLLM gateway** — the supported path.
- **But the raw VPN endpoint is broken — contradicts the ~1:15pm "stabilized" read.** Jeffrey *"kept getting 404"* on the direct URL; his diagnosis: *"the server behind that hostname returns 404 for everything, including the OpenAI-standard `/v1/chat/completions` and `/v1/models` endpoints that SGLang always serves when it's running."* → the SGLang OpenAI server isn't actually up behind `sglang-…-runai-test`. **Use LiteLLM, not the direct URL.** Filed to [[dflash]] (Access) + [[runai-betty]].
- **gpt-oss-20b WIP.** Ken is also standing up **`gpt-oss-20b`** but *"the same config is not working for 20b"* yet. Throughput comparison (single concurrency): **gpt-oss-120b + DFlash ~300 tps** vs **gpt-oss-20b ~500 tps** (smaller, faster; no dflash config on 20b).
- **Draft models.** Jeffrey: *"do they have a draft model for glm 5.2?"* — Ken: *"not yet"* (consistent with GLM-5.2's MTP, [[multi-token-prediction]]). **Kimi** has one Ken spotted, pending a license/access acceptance (*"I just need to agree to stuff"*). Filed to [[glm-5.2]].

### dflash — Jeffrey's first LiteLLM test + bandwidth diagnosis (~18:37–19:09Z / 2:37–3:09 EDT)
- After Ken's nudge to try it, Jeffrey **tested `openai/gpt-oss-120b` via LiteLLM** and saw underwhelming results: *"trying, not sure"*, *"seems like thats old model?"*
- **Ken's diagnosis = client-side, not server:** *"Where are you sending this from?"* → *"If your mac on wifi, then that's a your wifi problem"*, adding his **synthetic test was 1k in / 1k out**. Jeffrey confirmed he's **on the Mac over wifi** and said he'd **plug in (ethernet)** and retest. Durable takeaway filed to [[dflash]] (Access → client-side caveat): benchmark from a wired link before blaming the serving stack.

### dflash — back in a crash loop (~19:56Z / 3:56 EDT)
- Ken: **"gpt-oss-120b with dflash was in a crash loop."** So after the ~1:15pm "stabilized" report the deployment went unstable again — this **likely explains Jeffrey's slow ~2:37–3:09pm results** (the crash loop, not just the Mac-wifi/measurement issues both had floated). Confirms the test deployment is **not stable**; the afternoon throughput figures are suspect pending Ken's all-clear. Filed to [[dflash]] (status/stability).

### dflash reverted + workweave/router idea (~20:21–20:44Z / 4:21–4:44 EDT)
- **dflash shelved.** After the ~3:56pm crash-loop report, Ken: **"I'm putting the standard back in place now"** — rolling gpt-oss-120b back from the crash-looping dflash config to **standard serving**. So dflash on gpt-oss-120b is **not deployed** as of late afternoon 6/26; the LiteLLM `openai/gpt-oss-120b` route reverts to standard (non-dflash) serving until Ken stands it back up. Filed to [[dflash]] (status).
- **workweave/router (new).** Jeffrey shared **github.com/workweave/router** — a "model router for agentic systems" that routes each prompt to the right model in **<50 ms** and claims **40-70% cost cuts** via "just an endpoint change." His framing: *"This is cool … Might be cool to use with dflash … Like a for super fast sub agent tasks"* — i.e. front a fast local serving stack with a per-prompt router for cheap, high-volume sub-agent calls. New tentative page [[workweave-router]]; relates to [[betty-ai-agent]] sub-agent tooling.

### Ken ↔ Jeffrey 1:1 — tokens-as-a-service + event cameras (~20:45–21:09Z / 4:45–5:09 EDT)
- **Tokens as a service.** Continuing from the dflash/LiteLLM work, the conversation turns to PARCC's LLM offering as a *service*:
  - Ken: *"We will eventually need to implement a router or similar to get people going to consistent models"* — a per-prompt router need (cf. [[workweave-router]]), now voiced by PARCC itself rather than just Jeffrey.
  - Demand signal: at the **NVIDIA workshop** Jeffrey *"listened in"* and saw **people using parcc for their own ollama** — *"like half the group."*
  - Ken: *"We need to get tokens as a service fully going"* and crucially *"if you find people who want to use it, I can make them keys now"* — **key issuance is ready; the gap is users + terms.**
  - Jeffrey: *"I know several. For free beta period?"* — has *"like two labs of people"* and floats building *"a little TUI with their lab tools … a rag db with research papers, formatting stuff, mat lab code."* Self-caveat: most already pay for **ChatGPT Plus** and just **paste code into MATLAB**, so they'd *"barely use tokens."* Also: *"people might pay to have us host their models too."*
  - New concept page [[parcc-tokens-as-a-service]]; relates to [[dflash]], [[glm-5.2]], [[workweave-router]], [[betty-ai-agent]].
- **Event-camera aside (Ken's background).** Jeffrey shared Prophesee's **Event Camera Structured Light EVK3D** (`prophesee.ai/event-camera-structured-light-evk-3d/`, IMX636 Sony-Prophesee sensor + VCSEL) and asked about **per-pixel volumetrics** for event cameras, mentioning his own pipeline ("I need a drone"). Ken: *"I built a version of the structured light 3d that went up to 40kHz … That was a fun project."* Durable background fact filed to [[kenneth-chaney]].

### Ken ↔ Jeffrey 1:1 — GLM-5.2 NVFP4 quant (~23:13–23:15Z / 7:13–7:15 EDT)
- Ken shared an NVIDIA-published **NVFP4** quantization of GLM-5.2 — **`huggingface.co/nvidia/GLM-5.2-NVFP4`** — and mused about deployment: *"I'm thinking if I should put nvfp4 on 8 GPUs hmmmm."*
- Jeffrey: *"Oooh that should be zippy."* **NVFP4** is NVIDIA's **4-bit floating-point** format, native to **Blackwell (B200) tensor cores** — hardware-accelerated rather than emulated 4-bit — so it should run fast on Betty's [[dgx-b200-partition|B200s]]. A **distinct build** from the **fp8** GLM PARCC currently serves (which lacks vision); whether NVFP4 keeps vision is unconfirmed.
- Status: **not deployed** — a deployment Ken is weighing (NVFP4 on 8 GPUs). Filed to [[glm-5.2]] (quant variants).

### Ceph working session ended (~18:44Z / 2:44 EDT)
- System messages: **"Meeting ended … after 49 minutes 57 seconds"** (~50 min, 2:44 PM) — the dedicated **"Ceph"** planning session wrapped. Jeff, Andrew Chant, and Ryan Heath left the chat. The **6/27 6 AM maintenance window** set in that session stands.

## PARCC Group — VPN/Duo support routing for external users (~17:34–17:56Z / 1:34–1:56 EDT)
- **Jaime Combariza:** a Pitt user on **Keystone** reports her **VPN/Duo no longer works** — who do we contact?
- **Ken Chaney** gives the routing rule: find **who sponsored the PennKey**, then go to that sponsor's **LSP (Local Support Provider)** — e.g. **PARCC → HireIT**, **SEAS → CETS**.
- **Jaime** confirms he sponsored it and **will email HireIT**. So Duo/VPN identity issues for sponsored externals are an LSP matter, not a PARCC/Betty fix. Filed to [[betty-auth-architecture]].

## See also
- [[dflash]]
- [[workweave-router]]
- [[runai-betty]]
- [[betty-auth-architecture]]
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
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T16:34–16:49Z (digest `digest_20260626T125412.json`)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T17:15–17:25Z (digest `digest_20260626T132740.json`)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T17:34–17:58Z (digest `digest_20260626T140055.json`) — dflash on LiteLLM, raw endpoint 404, gpt-oss-20b, draft models
- PARCC Group Teams chat, 2026-06-26T17:34–17:56Z (digest `digest_20260626T140055.json`) — VPN/Duo → sponsor's LSP routing
- "Ceph" meeting Teams chat, 2026-06-26T17:55–18:33Z (digest `digest_20260626T143548.json`) — downtime scheduled 6/27 6am, `ceph osd pause`, /ceph-data contact list, job-drain hunt (AHEAD guests Ryan Heath + Swapnil Ninave)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T18:37–19:09Z (digest `digest_20260626T150904.json`) — Jeffrey's first LiteLLM gpt-oss-120b test slow → Ken: Mac-wifi bandwidth issue (his synthetic test 1k-in/1k-out); + "Ceph" meeting ended 2:44pm (~50m)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T19:56Z (digest `digest_20260626T161248.json`) — Ken: gpt-oss-120b + dflash was in a crash loop (deployment unstable again; explains afternoon slow results)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T20:21–20:44Z (digest `digest_20260626T164500.json`) — Ken reverts dflash ("putting the standard back in place now"); Jeffrey shares github.com/workweave/router and floats pairing it with dflash for fast sub-agent tasks
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T20:45–21:09Z (digest `digest_20260626T171824.json`) — tokens-as-a-service (Ken: "I can make them keys now" + need a router for consistent models; ~half the NVIDIA group already on parcc ollama); Jeffrey recruiting two labs + free-beta question + TUI/RAG idea; event-camera aside (Ken built a 40 kHz structured-light 3D system)
- Chaney↔Vadala 1:1 Teams chat, 2026-06-26T23:13–23:15Z (digest `digest_20260626T192414.json`) — Ken shares NVIDIA NVFP4 quant of GLM-5.2 (huggingface.co/nvidia/GLM-5.2-NVFP4), weighing NVFP4 on 8 GPUs; Jeffrey: "should be zippy"
