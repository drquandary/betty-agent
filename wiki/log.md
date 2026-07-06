# Wiki Log

> Chronological record of ingests, queries, and lint passes.
> Entry prefix: `## [YYYY-MM-DD] <operation> | <brief title>`
> Grep the last 5 with: `grep "^## \[" log.md | tail -5`

---

## [2026-07-06] ingest | Teams digest — Ken confirms nginx proxy; Chatterjee lab-agent build + fallback question
- Source: [[2026-07-06-teams-chats-digest]] (created; digest `digest_20260706T101520.json`, 11 chats / 21 new — 19 in Chaney 1:1 [13 substantive], 2 in PARCC Group [1 substantive]).
- Created: [[2026-07-06-teams-chats-digest]]. Updated: [[glm-5.2]] (413 section: Ken-confirms-nginx + pre-prod caveat + session; frontmatter→07-06 + source line), [[parcc-tokens-as-a-service]] (Chatterjee build + failure-independence/fallback Q + serving-stack session + open-questions; frontmatter→07-06 + source line), [[index]] (glm-5.2 → 8 sources, tokens-as-a-service → 4 sources, new 7/06 source line), tasks.md (413 update, new serving-stack-session task, Chatterjee-agent update, demo-unit FYI).
- Key facts: **Ken confirmed the nginx reverse proxy** ("we do run a reverse proxy with nginx to get https functionality") — corroborates Jeffrey's 7/3 `413` mechanism (cap not yet raised). **Durable caveat:** "the whole stack will change when we go into production" → current serving specs transient. Ken offered a **serving-stack session** (did a short one for Jamie). Jeffrey **building the Chatterjee lab agent**, weighing a **model fallback** — open Q: does a GLM outage down the other served models, or are LiteLLM model groups failure-independent? GLM up ~2pm ("spitting out tokens for somebody right now"). ZCode "wanked out" on the same 413. PARCC Group: Jaime tracking an inbound **demo unit** (ETA this week, AIT Worldwide Logistics; vendor unstated) + empty "FYI:" (skipped).
- Tasks: 1 update to the 413 item, 1 new serving-stack-session task, 1 update to the Chatterjee/tokens-as-a-service item, 1 new demo-unit FYI. Chit-chat (holiday greeting, GLM-up banter) skipped.

## [2026-07-03] ingest | Teams digest — GLM-5.2 413 root-caused to nginx client_max_body_size
- Source: [[2026-07-03-teams-chats-digest]] (created; digest `digest_20260703T065558.json`, 11 chats / 3 new — all Chaney 1:1, all self-authored by Jeffrey).
- Created: [[2026-07-03-teams-chats-digest]]. Updated: [[glm-5.2]] (served-ceiling section + Our-experience "two caps" note + frontmatter updated→07-03 + source line), [[index]] (glm-5.2 line → 7 sources + 413 root-cause; new 7/03 source line), tasks.md (UPDATE sub-bullet under the GLM-5.2 413 item).
- Key facts: Jeffrey diagnosed the served GLM-5.2 **`413 Request Entity Too Large`** as an **nginx `client_max_body_size` (~1 MB default)** rejection on the reverse proxy fronting PARCC's hosted vLLM — the OpenAI-style JSON body exceeds the cap, so **nginx rejects it before vLLM/GLM**; *"not a model or litellm bug,"* `retryable=false`. GLM-5.2's real **200K context window** makes big bodies legitimate → **server-side fix**: `client_max_body_size 100m;` (+`client_body_buffer_size 1m;`, `proxy_read_timeout 600s;`), reload nginx. IMPORTANT: this **body-size (bytes)** cap is a **separate axis** from the **context-window (tokens)** ~100k↔800k regression Ken owns (7/2) — both must be right. TENTATIVE: flagged as his agent's read (*"the proxy server had limit … at least that's what it thinks"*), unverified against live config.
- Tasks: appended one UPDATE sub-bullet under the existing GLM-5.2 413/context item (For me). No new standalone task; other 10 chats had 0 new messages.

## [2026-07-02] ingest | Teams digest — PennKey deprovisioning cascade + root-password rotation policy
- Source: [[2026-07-02-teams-chats-digest]] (created; digest `digest_20260702T083935.json`, 9 chats / 15 new — all PARCC Group, one thread, ~12:11–12:28Z).
- Created: [[2026-07-02-teams-chats-digest]]. Updated: [[betty-auth-architecture]] (new "PennKey lifecycle: deprovisioning cascades to Betty" + "Root password rotation policy" sections; frontmatter updated→07-02, source added), [[index]], tasks.md (2 FYI items).
- Key facts: **PennKey deprovisioning cascade:** user Gangaram/Vineeth (Witschey collaborator) can't log in — `sudo` gives `This account is currently not available`, shell set to **`/sbin/nologin`**; PennKey reads **`NOT_ACTIVE`** after an HR role change (radiology resident → adjunct faculty; HR-terminated yesterday, OMA file should auto-flip overnight but expect a **gap**). Fix is **not PARCC's** — user contacts **PMACS / department IT** (the sponsor's LSP) to reactivate; blast radius is bigger than PARCC (also loses **PennVPN, AirPennNet**). Adjunct → **no account upgrade** needed. **Root password:** Jaime asked Jamie Schnaitter to reset it with **AHEAD** (proposed 3-month rotation); Jamie files a ticket today but argues fixed-interval rotation doesn't help (**NIST 800-63**) — reset is warranted because **AHEAD staff left**; policy = **event-driven, documented**, cadence unresolved.

## [2026-07-01] ingest | Teams digest (8th pull) — front-end/interface strategy + ZCode internals + harness deep-research IMPLEMENTED
- Source: [[2026-07-01-teams-chats-digest]] (appended "Eighth pull" section; digest `digest_20260701T171313.json`, 9 chats / 15 new — all Bradley, Ryan Patrick ~20:38–21:02Z).
- Updated: [[parcc-skills-modules]] (new "Front-end / interface strategy" section; ZCode subsection expanded; deep-research "proposed improvement" flipped to IMPLEMENTED + "gates"; sources line), [[z.ai]] (ZCode = desktop app for GLM long tasks w/ one-click skills, "could be all marketing"), [[index]], tasks.md.
- Key facts: **Front-end axis (new, durable):** Ryan wants **BYO interfaces** ("no way I can work outside vim/nvim on the cluster"), is happy with **opencode on Betty**, is slow to adopt tools; Ken said desktop front-ends "were a can of worms"; Ryan frames GUIs-on-HPC as the **"VSCode problem"** ("HPC unfriendly for anything more complicated than jupyter"); priority is the skills-library *text* but "if these front ends are essential … we should have an answer"; Jeffrey unsure they're essential. Opencode/GLM-5.2 took **26 min to "connect [an] email to the code"** → "break that into smaller pieces" (motivates lego-block skills). **ZCode:** z.ai **desktop app** for GLM "long tasks" w/ **one-click skill install** ("could be all marketing"); Ryan unfamiliar. **Harness:** Jeffrey **added "gates" + a deep-research phase** ("scoot around the web after it looks at the code, sees if there is a solution") — the 6/29 proposed improvement is now DONE. Tasks: new front-end-strategy item; UPDATEs on ZCode + deep-research items.

## [2026-07-01] ingest | Teams digest (6th pull) — skill anatomy + Ryan's human/machine-readable standards proposal
- Source: [[2026-07-01-teams-chats-digest]] (appended "Sixth pull" section; digest `digest_20260701T140201.json`, 9 chats / 15 new — all Bradley, Ryan Patrick ~17:31–17:40Z).
- Updated: [[parcc-skills-modules]] (new "Skill anatomy & the standards question" section + frontmatter/sources), [[index]], tasks.md.
- Key facts: Skills are **plain text, no adopted standard** (Ryan: "just text, any standards?"; Jeffrey: "no… they can be"); some skills **run `.sh` commands**. `resume-session` anatomy = fuzzy text search over past-session files → result → shell command to open a new window per session; the **harness looper had 3 `.sh` commands**. **Ryan's durable proposal:** standards for **human-legible vs machine-readable** skills "so that we have **parity**," possibly via **formal methods** — sharpens the PARCC-wide skills-curation question from vet/version toward a skill *spec*. Task: added as an UPDATE sub-bullet under the skills-curation item.

## [2026-07-01] ingest | Teams digest (3rd pull) — VAST NFSv4 ACLs + Dell R6725 mix-up
- Source: [[2026-07-01-teams-chats-digest]] (appended "Third pull" section; digest `digest_20260701T111840.json`, 9 chats / 10 new — all PARCC Group ~14:49–15:11Z).
- Updated: [[vast-group-permissions]] (Fix 4 corrected to NFSv4 `nfs4_setfacl`/`nfs4_editfacl` for VAST; POSIX form noted as wrong tool there), [[vast-storage]] (new Permissions & ACLs section), [[betty-cluster]] (Incoming hardware: 4× Dell R6725), [[index]], tasks.md.
- Key facts: **VAST ACL answer (Jamie Schnaitter):** VAST is NFSv4, so use **`nfs4_setfacl`** / **`nfs4_editfacl`** — "same commands as POSIX draft ACLs but `nfs4_` prepended; ACEs differ, v4 permissions differ." This is the tool for Ryan+Jeffrey's **group-RW shared VAST folder**. **Hardware (Ken):** Dell shipped **4× R6725 instead of 1× R7725** (dual EPYC 9655 96C/192T, 1.5TB DDR5, dual 100Gbps Broadcom, 4× 3.2TB NVMe) — racked to dodge Flexential charges; R7725 was a seed-program unit (Jaime has feedback email). **Ops:** OOD Jupyter kernel — Ryan will re-fix ("something overwrote it"); Jaime flags **MIG-slice oversubscription** (procs sharing a MIG) and **`lwhyc` runaway** procs (~23 days, off-queue). Tasks: added VAST-share, MIG, lwhyc, Dell items + OOD-Jupyter and update.

## [2026-07-01] ingest | Teams digest (2nd pull) — first beta lab named + HOME-dir perms policy
- Source: [[2026-07-01-teams-chats-digest]] (appended "Second pull" section; digest `digest_20260701T101203.json`, 9 chats / 12 new: Chaney 5, PARCC Group 7).
- Updated: [[parcc-tokens-as-a-service]] (first beta lab = Dr. Anjan Chatterjee/Neurology, key requested from Ken; downtime-broadcast requirement), [[vast-group-permissions]] (added HOME-dir permission policy section), [[jamie-schnaitter]] (set 0750 home-dir default policy), [[index]], tasks.md.
- Key facts: Jeffrey asked Ken to **mint an API key** for an enthusiastic lab, attaching it to **Dr. Anjan Chatterjee (Neurology)** — first named tokens-as-a-service customer; also needs a **reboot/downtime notification system** for lab users. PARCC Group: HOME-dir perms Q&A → **0750 default; 0700/0750 only; nothing in "other"; share via project dirs** (Jamie + Ken); user `cnman` reports missing HOME despite one existing (owner==group, so a login/mount issue, not perms — needs a separate check).

## [2026-06-30] ingest | Teams digest (3rd) — LiteLLM reboot + lab chatbot; `rheer` upgrade
- Source: [[2026-06-30-teams-chats-digest]] (digest `digest_20260630T164338.json`, 9 chats / 7 new: Chaney 5 ~20:18–20:39Z, PARCC Group 2). 
- Updated: [[2026-06-30-teams-chats-digest]] (appended 3rd-digest section), [[parcc-tokens-as-a-service]] (LiteLLM gateway reboot = transient GLM-5.2 outage; "chatbot for a lab" = concrete lab-client instance), tasks.md.
- Key facts: Jeffrey couldn't reach GLM-5.2 → Ken: **"We were rebooting LiteLLM"** (transient gateway reboot, not a model issue). Jeffrey restated intent to **build a "chatbot for a lab"** (first instance of the lab-tools TUI / tokens-as-a-service beta). PARCC Group: Jaime re-asked Ken to **upgrade user `rheer` (not a PI)**; Ken apologized, has a **Thursday 7/2 meeting** with the PI to watch a live login. Tasks: added `rheer`-upgrade FYI + LiteLLM-reboot FYI; UPDATE on lab-TUI item.

## [2026-06-30] ingest | Teams digest (2nd) — "Claude Science" announced
- Source: [[2026-06-30-teams-chats-digest]] (Chaney↔Vadala, 9 new ~18:08–18:32Z, digest `digest_20260630T143816.json`). Only Chaney chat had new messages; 8 others 0 new.
- Created: [[claude-science]]
- Updated: [[2026-06-30-teams-chats-digest]] (appended 2nd-digest section), [[index]]
- Key facts: Anthropic **announced "Claude Science"** — appears to be **inbuilt agent skills for HPC/science**, can run **"jobs"**, and **auto-generated a GPU-benchmark profile for Betty**. Accuracy caveat: it **assumed H100; Betty is B200** (Ken: "We have B200 not H100"). Tracked as a reference point/competitor for ParccSkills + betty-toolkit. Task: added "evaluate Claude Science" item for Jeffrey.

## [2026-06-30] ingest | Teams digest — GLM-5.2 → NVFP4 migration + Ken's reliability criteria
- Source: [[2026-06-30-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-30T17:05–17:33Z, digest `digest_20260630T133322.json`). Only Chaney chat had new messages (37); 8 others had 0 new.
- Created: [[2026-06-30-teams-chats-digest]]
- Updated: [[glm-5.2]] (NVFP4 now the served build — migrated to cut token cost; supersedes "under consideration"), [[parcc-skills-modules]] (Ken's reliability/human-time evaluation criteria; repo went private → Ken added `k-chaney`; curation as a PARCC-wide question), [[index]]
- Key facts: Ken **"migrated us to nvfp4 for glm 5.2"** to bring token cost down (NVFP4 build now default; fp8 superseded; vision-on-NVFP4 unconfirmed). Ken's harness-evaluation framing: reliability is the bar; **human time > tokens** as the real cost; (1) reliable enough not to waste time? (2) learn something even on failure?; trajectory = trust enough to give researchers eventually; same calculus applies even for Jeffrey's intended internal-only use. Jeffrey's data: 3–4 days wall-clock / ~2–3 hrs attention / auto-logged to wiki. ParccSkills now private → Ken added (`k-chaney`); Ken wants the team to hash out skills curation PARCC-wide. Ken **agreed to lead the Betty field trip**. Tasks: field-trip UPDATE (Ken agreed), ParccSkills-merge UPDATE (private + Ken added), new curation item, A-B/Ken-harness UPDATE (Ken's criteria).

## [2026-06-29] ingest | Teams digest (cont. 2) — Pi-Agent vs opencode + research-loop handoff to Ken
- Source: [[2026-06-29-teams-chats-digest]] (Bradley↔Vadala eve + new Chaney↔Vadala thread, digest `digest_20260629T162846.json`). Two chats with new messages (Ryan 19, Ken 8); 7 others had 0 new.
- Updated: [[parcc-skills-modules]] (Pi-Agent as the lean runtime; Ken-handoff section), [[jeffrey-vadala]] (Pi-Agent + ParccSkills=research-loop, +6/29 source), [[glm-5.2]] (Ryan's "pretty good" opencode datapoint), [[2026-06-29-teams-chats-digest]] (evening + Ken-thread sections)
- Key facts: Jeffrey runs agents on **Pi-Agent** — his minimal CLI agent ("less cruft/bloat than opencode, less ux+prompt, saves tokens"); pitched it to Ryan, who **tried GLM-5.2 briefly Fri in opencode** ("pretty good") but finds agentic flows "too hands-off" (uses Q&A→markdown/diffs). **GROMACS bench committed for Wed 7/1.** Jeffrey **opened the research-loop conversation with Ken** (per Ryan's rec) — shared ParccSkills link, relayed Ryan's framing (data-movement-from-code-vs-Nsight; horizontal scaling; transparent/reproducible > better); cost rebuttal = the multi-day token spend let him **multitask ~10 projects** vs ~a week solo. Tasks: GROMACS-Wed-bench item, A-B/Ken item got handoff UPDATE, new FYI (Ryan GLM-5.2/Pi-Agent).

## [2026-06-29] ingest | Teams digest — role definitions (facilitation/consultant/RSE), rachitk OOM harness, GLM-5.2 vs Opus cost
- Source: [[2026-06-29-teams-chats-digest]] (Bradley↔Vadala 1:1, 2026-06-29T18:57–19:20Z, digest `digest_20260629T152046.json`). Only chat with new messages (56); 8 other chats had 0 new.
- Created: [[bhuv-jain]] (tentative entity — UPenn physics prof, AI-education engagement test case)
- Updated: [[erf-user-facilitation]] (facilitation vs "AI consultant" vs RSE role definitions + funded-service overlap + USRSE materials), [[parcc-skills-modules]] (multi-day Opus-4.8 harness method, Nsight-CLI addition, rachitk decode-on-GPU OOM fix), [[glm-5.2]] ("beating opus 4.8" on some long tasks; `ccusage`/subscription-subsidy cost argument), [[index]]
- Key facts: Ryan wants role consistency — read-code-and-optimize work may overlap a *funded* PARCC consulting service; "consulting" = time-limited engagement, varying accountability. rachitk fix = decode ON the GPU (CPU + prospective GPU OOM), found via Opus-4.8 ~10-agent harness over a couple days, verified by Google. Ryan asks: GLM-5.2 vs Opus 4.8 cost (`npx ccusage`); subsidized subscriptions "won't be around forever." Jeffrey: GLM-5.2 "should work." Tasks: 6 new "For me" items (Wed 10am training chat, browse USRSE pre-Jain, document rachitk reasoning, answer cost question, gromacs follow-up).

## [2026-06-29] ingest | Teams digest (cont.) — Karpathy-loop architecture + horizontal-scaling A-B question
- Source: [[2026-06-29-teams-chats-digest]] (Bradley↔Vadala 1:1 continuation, 2026-06-29T19:22–19:36Z, digest `digest_20260629T155541.json`). Only chat with new messages (30); 8 others had 0 new.
- Updated: [[parcc-skills-modules]] (Karpathy-loop two-loop architecture + Nsight-into-scoring; Opus-4.8 = persistence not intelligence, "dumber model could do it"; proposed "deep research" phase; Ryan's horizontal-scaling/A-B framing), [[2026-06-29-teams-chats-digest]] (afternoon-continuation section)
- Key facts: loop = (1) ML-task loop rate→adjust→rerun→score + (2) wiki-logging memory; Nsight CLI folded into scoring. Opus-4.8 chosen for long-running persistence (primitive agents give up); GLM "supposed to" persist too. Ryan's real interest = does it scale horizontally to other users; proposes GLM-5.2 vs Opus-4.8 A-B quantifying tokens+time; "better is secondary to transparent and reproducible"; recommends talking to Ken (Jeffrey has logs, told Ken last week). rachit hasn't replied to Ryan. Tasks: 3 new "For me" items (Ken/A-B-bench, deep-research phase, rachit reply status).

## [2026-06-26] ingest | Teams digest — tokens-as-a-service recruiting + Ken's event-camera background
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-26T20:45–21:09Z, digest `digest_20260626T171824.json`) — appended new "tokens-as-a-service + event cameras" section to same-day source page
- Created: [[parcc-tokens-as-a-service]] (tentative concept page)
- Updated: [[kenneth-chaney]] (tokens-as-a-service key-minting + router intent; 40 kHz structured-light 3D event-camera background), [[workweave-router]] (PARCC now wants a router for "consistent models"), [[index]]
- Key facts: Ken — "if you find people who want to use it, I can make them keys now" + "We need to get tokens as a service fully going" + "we will eventually need a router … to get people going to consistent models." ~half the NVIDIA-workshop group already running their own ollama on parcc. Jeffrey knows "two labs," asked re: free beta, floated a TUI/RAG (papers + MATLAB) client (caveat: ChatGPT-Plus users would barely use tokens). Aside: Ken built a 40 kHz structured-light 3D event-camera system. Tasks: new "For me" recruiting item (+ TUI sub-idea).

## [2026-06-26] ingest | Teams digest — dflash reverted to standard; workweave/router shared
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-26T20:21–20:44Z, digest `digest_20260626T164500.json`) — appended new "dflash reverted + workweave/router idea" section to same-day source page
- Created: [[workweave-router]] (tentative concept page)
- Updated: [[dflash]] (revert/shelved status + workweave-router cross-link), [[index]]
- Key facts: Ken — "I'm putting the standard back in place now" → rolls gpt-oss-120b back from the crash-looping dflash config to standard serving (dflash shelved; LiteLLM `openai/gpt-oss-120b` reverts to non-dflash). Jeffrey shared github.com/workweave/router (<50ms per-prompt model router, claims 40-70% cost cuts) and floated pairing it with dflash for fast sub-agent tasks. Tasks: dflash item got 4:21pm revert UPDATE; new "For me" item to evaluate workweave/router.

## [2026-06-26] ingest | Teams digest — dflash gpt-oss-120b back in a crash loop
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-26T19:56Z, digest `digest_20260626T161248.json`) — appended new "dflash — back in a crash loop" section to same-day source page
- Updated: [[dflash]] (crash-loop status note + stability timeline), [[index]]
- Key facts: Ken — "gpt-oss-120b with dflash was in a crash loop" → deployment unstable again after the ~1:15pm "stabilized" report; likely explains Jeffrey's slow ~2:37–3:09pm results (not just Mac-wifi). Afternoon throughput numbers now suspect; wait for Ken's all-clear. Tasks: dflash item got the crash-loop UPDATE.

## [2026-06-26] ingest | Teams digest — Ceph downtime SCHEDULED 6/27 6am (dedicated Ceph working session)
- Source: [[2026-06-26-teams-chats-digest]] ("Ceph" meeting chat, 2026-06-26T17:55–18:33Z, digest `digest_20260626T143548.json`) — appended new "Ceph working session" section to same-day source page
- Updated: [[betty-storage-architecture]] (Tier 2 Ceph: new "Downtime scheduled — START 6/27 6am" note — `ceph osd pause` drain, ~31-account /ceph-data contact list, `squeue|grep /ceph` job-drain hunt, AHEAD guests Ryan Heath + Swapnil Ninave), [[index]]
- Key facts: maintenance window begins **6/27 6:00am**; Jeffrey was invited to the session; running job 6850091 (epyc-2-2, `/ceph/projects/ksusztak/...`) flagged for drain; cluster still rebalancing (~52 MiB/s recovery). Tasks: Ceph FYI item got DOWNTIME-SCHEDULED UPDATE; gpt-oss-120b item got Ken's "curious how it'll do for you now" nudge.

## [2026-06-26] ingest | Teams digest — dflash on LiteLLM; raw endpoint 404s; VPN/Duo→LSP routing
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1 + PARCC Group, 2026-06-26T17:34–17:58Z, digest `digest_20260626T140055.json`) — appended to same-day source page
- Updated: [[dflash]] (now on LiteLLM as `openai/gpt-oss-120b`; raw VPN endpoint returns 404 on everything incl. `/v1/*` — contradicts earlier "stabilized" read, use LiteLLM; gpt-oss-20b WIP, ~500 tps vs 120b+DFlash ~300 tps), [[glm-5.2]] (no draft model yet — MTP; Kimi has one pending license), [[betty-auth-architecture]] (new section: VPN/Duo for sponsored externals → sponsor's LSP, PARCC→HireIT/SEAS→CETS), [[index]]
- Tasks: dflash item + GLM-5.2 item UPDATEs (For me); new FYI — Keystone/Pitt user VPN/Duo → Jaime emailing HireIT.

## [2026-06-26] ingest | Teams digest — dflash running, testing on gpt-oss-120b
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-26T16:02–16:08Z, digest `digest_20260626T122146.json`) — appended to same-day source page
- Created: [[dflash]] (tentative stub — unidentified tool, first test target `gpt-oss-120b`)
- Updated: [[2026-06-26-teams-chats-digest]] (dflash subsection + frontmatter tags/related), [[index]]
- Key facts: Ken "dflash is running" / "I need to test it now"; first model `gpt-oss-120b` "to start". Still unidentified (likely inference/serving). Task updated: dflash item (For me · 6/26 UPDATE). Follow up with Ken on results.

## [2026-06-26] ingest | Teams digest — Ken/Jeffrey 1:1: GLM vision + agent skills
- Source: [[2026-06-26-teams-chats-digest]] (Chaney↔Vadala 1:1, 2026-06-26T15:17–15:30Z, digest `digest_20260626T114656.json`) — appended to the same-day source page
- Created: [[parcc-skills-modules]]
- Updated: [[glm-5.2]] (served for coding / Kimi alternative; fp8 build lacks vision, full model expected to; Jeffrey routes vision to Claude), [[kenneth-chaney]] (skills-from-Spack generator; GLM-5.2-for-coding; fp8 no-vision), [[jeffrey-vadala]] (ParccSkills repo; GLM long-task stall workaround), [[2026-06-26-teams-chats-digest]], [[index]]
- Key facts: fp8 GLM lacks vision (regular model supposed to); GLM-5.2 now servable for coding (move from Kimi); Ken building a skill that writes skills from Spack modules → Lmod-loadable `ml parcc/skills/bio/0.1`; Jeffrey's `drquandary/ParccSkills` (resume-session, Nsight+Karpathy-loop); both want to merge repos. Tasks updated: closed GLM-vision follow-up; added skills-merge + Ken-spack-skills items; GLM-5.2 eval item updated to "available."

## [2026-06-26] ingest | Teams digest — Ceph remediation needs coordinated downtime
- Source: [[2026-06-26-teams-chats-digest]] (PARCC Group, Chaney/Combariza, 2026-06-26T12:15–12:22Z, digest `digest_20260626T083924.json`)
- Created: [[2026-06-26-teams-chats-digest]]
- Updated: [[betty-storage-architecture]] (Tier 2 Ceph: tentative remediation-plan note — coordinated downtime, AHEAD timing ask, contact /ceph-data groups), [[index]]
- Key facts: Ken wants to meet earlier to leave time to reach out to faculty + AHEAD; Jaime asked AHEAD when/how-long the downtime; groups with /ceph data must be contacted/coordinated; Jaime offered 9 AM. Distinct from today's 2pm sync; group Ceph talk still deferred to Mon 6/29. Task updated (Others/FYI · Ceph item UPDATE).

## [2026-06-25] ingest | Teams digest — dflash on GPT-OSS + meet-up (Ken 1:1)
- Source: [[2026-06-25-teams-chats-digest]] (Kenneth Chaney 1:1, 2026-06-25T18:30–18:32Z, digest `digest_20260625T144501.json`)
- Updated: [[kenneth-chaney]] (dflash test on GPT-OSS note under Model serving), [[2026-06-25-teams-chats-digest]] (new follow-up section + source), [[index]]
- Key facts: jvadala thinks "dflash might be killer for this other project"; Ken to "get it tested on gpt oss today" → dflash likely an inference/serving tool (still unidentified, tentative). 3pm coffee coordinated live. Remaining messages chit-chat. Task updated (For me · dflash follow-up).

## [2026-06-25] ingest | Teams digest — z.ai/GLM-5.2 + MTP (Ken 1:1)
- Source: [[2026-06-25-teams-chats-digest]] (Kenneth Chaney 1:1, 2026-06-25T15:51–16:01Z, digest `digest_20260625T120842.json`)
- Created: [[glm-5.2]] (model), [[z.ai]] (entity), [[multi-token-prediction]] (concept)
- Updated: [[kenneth-chaney]] (GLM-5.2/MTP interest under Model serving + related), [[2026-06-25-teams-chats-digest]] (new section + source), [[index]]
- Key facts: Jeffrey shared z.ai's GLM-5.2; Ken intends to try it ("Not yet, but we will!"); its speed comes from **MTP (multi-token prediction)** — "a much faster MTP" — not classic two-model draft/verify speculative decoding. Task added (For me · Jeffrey: evaluate GLM-5.2).

## [2026-06-24] ingest | Teams digest — /ceph not mounted on DTN nodes, vendor ticket to Ahead
- Source: [[2026-06-24-teams-chats-digest]] (PARCC Group, Combariza/Chaney, 2026-06-24T12:54–12:56Z, digest `digest_20260624T085626.json`)
- Created: [[2026-06-24-teams-chats-digest]]
- Updated: [[betty-storage-architecture]] (Tier 2 Ceph: tentative known issue — `/ceph` not mounted on DTN nodes), [[index]]
- Key fact: Jaime flagged `/ceph` is not mounted on the DTN (data-transfer) nodes; team agreed a vendor ticket is the right route and Ken submitted one to Ahead. 1:1 thread same date was personal — not ingested.

## [2026-06-23] ingest | Teams digest — account sync paused, post-TAC home-folder fix plan
- Source: [[2026-06-23-teams-chats-digest]] (PARCC Group, Kenneth Chaney, 2026-06-23T14:36Z, digest `digest_20260623T105335.json`)
- Created: [[2026-06-23-teams-chats-digest]]
- Updated: [[betty-cluster]] (BCM→VAST home-dir open issue: 2026-06-23 update), [[kenneth-chaney]] (paused account sync + post-TAC plan), [[index]]
- Key fact: broken new-user home dirs are caused by user creation + account sync being paused; after the pending Palo Alto TAC firewall session, Ken will run one round of syncs and manually fix all home folders made.

## [2026-06-18] ingest | Teams digest — Ken GLM-DSA deployment + 110 dB server-room note
- Source: [[2026-06-18-teams-chats-digest]] (Kenneth Chaney 1:1, 2026-06-18T21:52–22:17Z, digest `digest_20260618T181730.json`)
- Updated: [[kenneth-chaney]] (GLM-DSA deployment: Q4 quant, ~2% hit, no sglang day-zero support), [[betty-cluster]] (new Facility section, ~110 dB server-room noise), [[2026-06-18-teams-chats-digest]] (two new bullets + source)
- Key facts: Ken deploying `glm-dsa` (architecture issues, sglang skipped day-zero support, serving Q4 @ ~2% perf hit); Betty machine room ≈ 110 dB (ear protection required) → on-site audio recording impractical (relevant to an anthropology study of PARCC).

## [2026-06-18] ingest | Teams digest — ryb sandbox cuda-in-hierarchy follow-up
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Ryan Bradley, 2026-06-18T18:54Z, digest `digest_20260618T151039.json`)
- Updated: [[betty-lmod-architecture]] (sandbox-tree / RPATH-vs-hierarchy follow-up in design section), [[2026-06-18-teams-chats-digest]] (new bullet + source)
- Key fact: CUDA-in-hierarchy blocks two simultaneous CUDA versions; CUDA-omitted allows them (binaries RPATH'd at build time). ryb wants real-world examples before deciding. No decision.

## [2026-06-18] ingest | Teams digest — module hierarchy vs flat naming design discussion
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Jamie Schnaitter quoting ryb, 2026-06-18T18:15–18:16Z, digest `digest_20260618T143742.json`)
- Updated: [[betty-lmod-architecture]] (new "Module hierarchy vs flat naming" section, status: tentative), [[2026-06-18-teams-chats-digest]] (new bullet + source)
- Key fact: open debate — hierarchical MODULEPATH (clean names, but `ml beast1` forces unload of cuda/13.1 deps) vs flat toolchain-encoded names (Jamie's UCF `beast/beast-1.2.3-mvapich2-2.3.6-gcc-9.4.2`). No decision.

## [2026-06-18] ingest | Teams digest — pam_slurm_adopt now live + multi-job cgroup caveat
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Jamie Schnaitter, 2026-06-18)
- Created: [[2026-06-18-teams-chats-digest]]
- Updated: [[betty-auth-architecture]] (deployment status + multi-job cgroup caveat), [[jamie-schnaitter]] (compute-node SSH note), [[index]]
- Key fact: `pam_slurm_adopt` is deployed — SSH to a node with a running job works; with multiple jobs on one node the session adopts only one job's cgroup.

## [2026-04-21] add | GROMACS workflow + Ryan Bradley entity
- Sponsor: Ryan Bradley (ryb), PARCC director — wants GROMACS first-class on Betty
- Created concept page: [[gromacs-on-betty]] — partition cheat-sheet (MIG45 for <50k atoms, MIG90 to 300k, full B200 beyond, Genoa for grompp/analysis), `-nb/-pme/-bonded/-update gpu` flag guidance, replica/REMD/FEP patterns, validation benchmark set (benchMEM/benchPEP/benchRIB). **Status: tentative** — no confirmed `module spider gromacs` output yet; page lists three fallback install paths (overspack module, NGC container, conda).
- Created entity page: [[ryan-bradley]] — role, project paths, what ryb owns (overspack, lmod, OOD debugging), GROMACS open items (module-vs-container decision, benchmark set, billing account, trajectory retention).
- Added Slurm template: `betty-ai/templates/slurm/gromacs_mdrun.sbatch.j2` — single-GPU mdrun with `-cpi` checkpoint resume, `--requeue`, three gromacs_source branches (module/container/conda), OpenMP pinning, project-dir working directory.
- Updated: [[index]] (new entity + new concept).
- Open for ryb: confirm module availability, supply blessed benchmark .tpr set, pick billing account, decide VAST vs Ceph for trajectory archive.

## [2026-04-21] ingest | PARCC ops chat — GPU oversubscription, SLURM states, VAST tenant setting
- Source captured: `raw/ops_chat/2026-04-21-parcc-ops-discussion.md` (verbatim chat between Jaime Combariza, Kenneth Chaney, jvadala)
- Created source pages: [[2026-04-21-parcc-ops-discussion]], [[2026-04-17-dgx002-gpu5-oversubscription]]
- Created concept pages: [[slurm-gres-conf]], [[slurm-node-state-modifiers]], [[slurm-select-type-parameters]], [[interact-script-vs-salloc]]
- Updated: [[vast-storage]] (added open thread on tenant-level setting), [[index]]
- Key findings filed:
  - dgx002 GPU-5 double-booking incident (2026-04-17): two jobs, both got `CUDA_VISIBLE_DEVICES=0`; `/etc/slurm/gres.conf` missing on node, `UniqueId:(null)` on every GRES row despite `AutoDetect=nvml`; cgroup plugins loaded. Not reproducible on 2026-04-21 — status `tentative`.
  - `sinfo` node-state trailing `-` means "planned by backfill for higher-priority job"; `parcc_sfree.py --by node` renders this as `MIXED+PLANNED`. Full modifier glossary captured.
  - `interact` helper uses `bash -i` which re-sources login profile (resets Lmod); plain `salloc --pty bash` inherits caller's env. Chaney argues `-i` should be dropped.
  - `SelectTypeParameters=CR_Core_Memory` currently; Jaime evaluating `CR_Pack_Nodes` add-on. Needs a test cluster to validate.
- Open threads (unresolved, NOT filed as fixes):
  - VAST tenant-level setting (exact setting name TBD)
  - `gres.conf` not symlinked next to `slurm.conf` — is `/etc/slurm` ground truth on Betty?
  - dgx024: user `ldugan` running processes without matching SLURM job while `jojolee` held the allocation (job 5359912) — Chaney investigating
  - Nsight install/activate pending on Ahead
  - Dell quote awaiting internal approval; ETA concerning
- Notes: the chat also included Jaime's desire for a test cluster (noted on both [[slurm-select-type-parameters]] and [[2026-04-17-dgx002-gpu5-oversubscription]]).

## [2026-04-16] handoff | Session handoff written for incoming agent
- Created: `raw/docs/2026-04-16-session-handoff.md`
- Context: Jeff wanted to expand Betty AI beyond LLMs to multi-task orchestrator. Initially proposed MATLAB+OOD sandbox; Jeff confirmed Betty has NO MATLAB, so pivoted to enumerating real workflows on Betty (Jupyter, RStudio, MONAI, Nextflow, AlphaFold, GROMACS, RAPIDS, NetLogo, etc.). Session paused at Kerberos-ticket renewal step — ticket expired Apr 13, needs `kinit jvadala@UPENN.EDU`. Plan on resume: run `module spider` recon on Betty, then build task registry + cross-cutting pattern templates.
- Safety note: Jeff pasted PennKey password in chat; agent refused to use it, recommended password rotation.
- Still open: Ceph benchmarking (write-access blocker), spider cache regeneration by ryb, OOD ticket submission, git commit of wiki changes.

## [2026-04-08] bootstrap | Wiki initialized from Karpathy LLM Wiki pattern
- Created: `wiki/SCHEMA.md`, `wiki/index.md`, `wiki/log.md`
- Created seed entity pages: [[betty-cluster]], [[dgx-b200-partition]], [[b200-mig45-partition]], [[b200-mig90-partition]], [[genoa-std-mem-partition]], [[genoa-lrg-mem-partition]], [[vast-storage]], [[parcc-helper-tools]], [[open-ondemand-betty]], [[slurm-on-betty]]
- Created seed concept pages: [[lora-fine-tuning]], [[qlora]], [[deepspeed-zero]], [[vision-language-models]], [[vllm-serving]], [[huggingface-cache-management]], [[betty-billing-model]]
- Created seed model pages: [[qwen2.5-vl-7b-instruct]], [[llama-3-8b]], [[llama-3-70b]], [[mistral-7b]], [[deepseek-v3]]
- Source summaries: [[2026-04-08-betty-initial-exploration]], [[2026-04-08-betty-system-guide]], [[2026-04-08-betty-llm-workflows-guide]]
- Notes: Initial bootstrap from exploration session. Many pages are stubs and need to be expanded.

## [2026-04-08] ingest | Betty cluster initial exploration
- Source: Live OOD shell exploration session
- Tools used: parcc_sfree.py, sinfo, scontrol, squeue, module spider
- Key findings:
  - 27 DGX B200 nodes (216 total GPUs)
  - 2 MIG nodes (45GB x32, 90GB x16)
  - 64 EPYC CPU nodes + 10 large-memory
  - Shared pytorch env at `/vast/parcc/spack/...` with PyTorch 2.7.1+cu126 but OLD transformers (4.32)
  - No pre-built LLM containers or shared model cache
  - HF_HOME not set by default — risk of filling 50GB home quota
  - `interact` helper script is broken (references nonexistent "defq" partition)
  - dgx015 node is down, dgx022 has GRES mismatch
- Pages touched: [[betty-cluster]], all partition pages, [[vast-storage]], [[parcc-helper-tools]]

## [2026-04-09] ingest | ryb's OOD bc_desktop investigation (2026-04-07 log)
- Source: `raw/cluster_exploration/2026-04-07-ryb-ood-bc-desktop-investigation.txt`
- Context: user `ryb` SSH'd from login01 to ood01 to inspect bc_desktop config after Interactive Desktop session failures and lmod cache issues were reported
- New facts surfaced:
  - `/ceph/projects/` filesystem exists alongside `/vast/projects/`
  - OOD host: `ood01.betty.parcc.upenn.edu`, IP `165.123.216.22`, Ubuntu 24.04.4 LTS
  - `/etc/ood/` has 4 sibling config dirs + `.bak-luafix`, `.bak-usermapping`, `.shibboleth-backup` — ongoing admin tinkering
  - ryb at 88% inode quota while debugging — possible silent-failure cause
  - User dev app pattern: `~/ondemand/dev/<app>/` exposed at `/pun/dev/<app>`
  - ryb re-copied `bc_desktop` from sys to dev and `git init`ed — suggests active patching
- Pages created: [[2026-04-07-ryb-ood-bc-desktop-investigation]], [[ood-troubleshooting]]
- Pages updated: (none yet — held for next session)

## [2026-04-09] ingest | jvadala live OOD reproduction (morning session)
- Source: Live browser session on jvadala account, same day
- Slurm job: `5199165` on `dgx028` (b200-mig45), OOD session `468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **3 bugs reproduced:**
  1. Interactive Desktop renders as solid black on b200-mig45 (TurboVNC + websockify work, no DE drawn)
  2. Shell-to-compute-node link returns `Host "dgx028..." not specified in allowlist or cluster configs`
  3. Files app returns 404 (`/pun/sys/dashboard/files/...` not wired into portal routing)
- Could NOT read `output.log` due to bugs 2+3 cascading; browser session abandoned during SSH+Duo fallback
- Pages created: [[2026-04-09-jvadala-ood-bug-reproduction]]
- Pages updated: [[open-ondemand-betty]] (major rewrite: added Known bugs section, OOD host config, form field analysis), [[index]], [[log]]
- Artifact created: `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (initial version)

## [2026-04-09] ingest | jvadala live OOD reproduction (evening session — ROOT CAUSE FOUND)
- Session: `5199382` on `dgx028` (b200-mig45), OOD session `d46900b2-c713-4015-b8ac-8e3372b4f0c8`
- Successfully entered VNC desktop (XFCE), opened in-session terminal, ran diagnostics on dgx028
- **Read the output.log** from the failed morning session via VAST NFS mount (bypassing the 404 Files app and pam_slurm_adopt SSH block) — found:
  - Hundreds of `Xlib: extension "DPMS" missing on display ":27.0"` errors (initially misread as root cause, then corrected)
  - Dbus session bus disconnect loop: "Got disconnected from the session message bus; retrying to reconnect every 10 seconds"
  - 15+ stale `/tmp/.X<N>-lock` files on dgx028 from prior crashed sessions (displays :12 through :26)
- **Reproduced the XFCE screensaver lockout bug**: session auto-locks after ~14 min idle, unlock dialog rejects empty password, PennKey/Kerberos PAM likely broken inside non-login VNC. Verified workaround (`killall xfce4-screensaver light-locker; xset s off; xfconf-query ... /saver/enabled=false`) works to prevent the lock.
- **PRIMARY ROOT CAUSE FOUND**: Lmod spider cache is corrupt cluster-wide.
  - `module avail` crashes with `Cache.lua:340: bad argument #1 to 'next' (table expected, got boolean)` and full Lua traceback
  - Affected file: `~/.cache/lmod/spiderT.x86_64_Linux.lua` (3.4 MB, ASCII text)
  - `rm -rf ~/.cache/lmod/*` is NOT sufficient — a second cache exists at a system-readable path (probably under `/vast/parcc/sw/lmod`) and is also corrupt
  - `module --ignore_cache avail` works perfectly — confirms cache corruption is the issue, not MODULEPATH/binary/env
  - Workaround: `export LMOD_IGNORE_CACHE=yes` in `~/.bashrc`
  - **Why this matters**: bc_desktop startup scripts call `module load` at session start. When those calls hit this bug, XFCE inherits a broken environment → bc_desktop session flakiness. **This is probably the same bug as the Interactive Desktop black-screen.** Fix lmod, bc_desktop may self-heal.
- **Account surprise**: `gemma4-l` (job 5198871) has been running on dgx028 under jvadala for 2h 13m — probably left over from another session, Jeff should check and cancel if unintentional.
- Pages updated: [[ood-troubleshooting]] (complete rewrite of Lmod section with exact error + workaround), [[open-ondemand-betty]] (added Bug 5 Lmod + Bug 6 screensaver with one-line fixes), [[log]]
- Artifact updated: `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` — now has Lmod as Bug 1 (PRIMARY), 5-bug structure, fix recipes for each.
- Pending: Jeff should delete session `5199382` when done, investigate and possibly scancel `gemma4-l` (5198871), and submit the PARCC ticket.

## [2026-04-09] correction | Lmod root cause — was wrong about user cache being the corrupt file
- After more investigation in session `5199382`, we confirmed the crash still happens with `~/.cache/lmod/` empty — so the earlier "`rm -rf ~/.cache/lmod/*` is the fix" claim was wrong.
- Read Cache.lua:333-343 source on dgx028:
  - Line 333: `local resultFunc = loadfile(fn)` — loads cache file as Lua code
  - Line 338: `resultFunc()` — runs it to populate `_G.mrcT` and `_G.mrcMpathT`
  - Line 340: `if (_G.mrcT == nil or next(_G.mrcT) == nil or _G.mrcMpathT == nil) then LmodError ...`
  - The crash is `next(_G.mrcT)` failing because `_G.mrcT` is a **boolean (`false`)** instead of a **table**
  - So the bad file is an executable Lua file that sets `mrcT = false` somewhere — probably a `.modulerc.lua` or site `lmodrc.lua`
- Could NOT find the exact file from user-level access (VNC terminal got wedged on a `find /` and I couldn't get further diagnostics through). Needs root + `strace` or `LMOD_DEBUG=3` to pinpoint.
- **Corrected files**: [[ood-troubleshooting]] (rewrote Root cause + Workaround sections with the correct story), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (rewrote Bug 1 "what I tried and what worked" section with the corrected findings + admin diagnostic recipes)
- **The user-level workaround `LMOD_IGNORE_CACHE=yes` is still the only reliable fix until PARCC identifies and regenerates the system-level file.**

## [2026-04-09] validation | LMOD_IGNORE_CACHE=yes workaround fully tested end-to-end
- Opened a fresh XFCE terminal in session 5199382 on dgx028 (the first one got wedged on a hung `find /` command that ate all subsequent stdin)
- Ran an 8-part test battery with the `LMOD_IGNORE_CACHE=yes` env var set vs unset, and timed both cases
- **All tests passed with the env var set:**
  - `module avail` — full listing, ~7.8 s
  - `module --terse avail` — works (different code path)
  - `module spider python` — lists python/2.7.2 through 3.6.5
  - `module load anaconda3/2023.09-0` — `rc=0`, loads successfully
  - `module list` (after load) — shows anaconda3/2023.09-0 as module #7
  - `bash -c 'module avail'` with env var exported from parent — works (critical: confirms .bashrc and sbatch inheritance)
  - Unsetting the env var brings the crash back immediately with the same Cache.lua:340 traceback (proof the env var is what's doing the work, not some side effect)
- **Measured performance**: ~7.8s for a fresh `module avail` with LMOD_IGNORE_CACHE=yes on dgx028 (b200-mig45 MIG, VAST NFS). Lmod walks MODULEPATH directly every call instead of loading the broken cache. Acceptable for interactive use and sbatch; avoid in hot loops.
- Pages updated: [[ood-troubleshooting]] (added full test results table + measured timing), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (added the validated-workaround block with numbers), [[log]]
- **Conclusion**: the workaround is solid. Jeff can set `export LMOD_IGNORE_CACHE=yes` in `~/.bashrc` on Betty and unblock himself and his colleague immediately.

## [2026-04-09] correction2 | LMOD_IGNORE_CACHE=yes is too slow — found a 10x faster workaround
- Jeff pushed back on the 7.8 s cost, correctly. I tested a better approach: prebuild a user cache + set LMOD_SPIDER_CACHE_DIRS.
- **One-time setup**: `$LMOD_DIR/update_lmod_system_cache_files -d ~/.cache/lmod -t ~/.cache/lmod/timestamp -K "$MODULEPATH"` — writes spiderT.lua (3.4 MB) + spiderT.luac_5.1 (2.6 MB) + timestamp under ~/.cache/lmod. Runs in ~8 s, one time only.
- **Permanent**: add `export LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod` to ~/.bashrc.
- **Measured results on dgx028 session 5199382**:
  - `module load anaconda3/2023.09-0` cold: **1.035 s** (down from 10.0 s with LMOD_IGNORE_CACHE)
  - `module load anaconda3/2023.09-0` warm: **0.494 s** (second call in same shell)
  - `module --terse avail`: **0.458 s** (846 modules listed) — works without any env var, different code path
  - Plain `module avail`: still crashes (Cache.lua:340). Users should alias `--terse` or only use it for listing.
- Why this works: `module load`, `module spider`, and `module --terse avail` take code paths that don't hit the broken `loadfile(fn)` → `next(_G.mrcT)` sequence at Cache.lua:340. Plain `module avail` does, and nothing short of fixing the corrupt file will make it work fast.
- **10x speedup over the earlier LMOD_IGNORE_CACHE=yes recommendation.** This is what goes in [[ood-troubleshooting]] and the PARCC ticket as the recommended workaround. The old slow one is still documented as "fallback if you can't prebuild".
- Updated: [[ood-troubleshooting]] (replaced slow workaround with fast one + full measured timings), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (renamed to "Workaround B (fast, recommended)" and downgraded the ignore_cache approach to "Workaround A (slow but simple)"), [[log]]
- **Final recommendation to Jeff**: use Workaround B. Module load is ~1 second cold, half a second warm. That's what his colleague actually cares about.

## [2026-04-09] investigation | Definitive root cause found with strace + bare-Lua reproduction
- User pushed back on "are you sure" after I'd been wrong earlier today about the user-cache-clear fix
- **Found the corrupt file**: `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
  - Technique: `strace -f -e openat -o /tmp/lmod-trace.$$ bash -c 'module avail'` then `grep '\.lua"' /tmp/lmod-trace.$$ | tail` — the last Lua file opened before the crash IS the bad one
  - File metadata: `-rw-r--r-- 1 ryb bettySWAdmin 3709916 Apr  8 16:45` (3.7 MB, owned by ryb, modified April 8 at 16:45 UTC)
  - Config chain: `init/lmodrc.lua` → `/vast/parcc/sw/lmod/site/lmodrc.lua` → `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
- **Verified the file is malformed** — first 15 lines show it defines `timestampFn = {false,}` and `mrcMpathT = {...}` but NEVER defines `mrcT`. References `/vast/parcc/sw/lmod/alt/26.1.zen4/Core` — the `alt/` dir ryb created on 2026-04-07.
- **Proved this is THE bug** with bare-Lua reproduction:
  ```
  $ lua5.1 -e 'mrcT = false; dofile("/vast/parcc/sw/lmod/site/cache/spiderT.lua"); next(mrcT)'
  lua5.1: (command line):1: bad argument #1 to 'next' (table expected, got boolean)
  stack traceback:
      [C]: in function 'next'
      (command line):1: in main chunk
  ```
  **Same error as Lmod's crash.** No Lmod internals involved — purely the broken file + the `next(false)` call. Q.E.D.
- **Verified the fix**: `(echo 'mrcT = {}'; cat .../spiderT.lua) > /tmp/spiderT-fixed.lua` then bare-Lua dofile of the fixed copy — `mrcT` is now a table, `next()` returns cleanly.
- **Write access**: Jeff (jvadala) cannot write the file directly; owner is ryb, group `bettySWAdmin` is read-only. Cache dir also not writable.
- **Action plan**: email ryb directly (draft at `raw/docs/2026-04-09-email-draft-to-ryb.md`) since they own the file and were already actively working on the alt/ migration. Don't need to go through PARCC support.
- **Meanwhile**: Jeff's `~/.bashrc` already has `LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod` + prebuilt user cache, so he's unblocked at `module load` = 1s cold / 0.5s warm.
- Pages updated: [[ood-troubleshooting]] (added "Definitive proof" section with bare-Lua reproduction; updated "Root cause" with file path, timestamp, ownership, and first 15 lines of bad content); new artifact `raw/docs/2026-04-09-email-draft-to-ryb.md` with the email to send ryb.

## [2026-04-10] ingest | Jaime's /etc/profile.d/modules.sh fix
- Source: Jaime (PARCC admin) changed `/etc/profile.d/modules.sh` on compute nodes to source PARCC's lmod (`/vast/parcc/sw/lmod/lmod`) instead of BCM's bundled lmod (`/usr/share/lmod/lmod`)
- This fixed the cluster-wide `module avail` crash by changing the lmod init chain to bypass the broken site spider cache
- Verified with: `env -u LMOD_SPIDER_CACHE_DIRS -u LMOD_IGNORE_CACHE bash --norc -c 'source /etc/profile.d/modules.sh; module avail 2>&1 | head -5'`
- The corrupt `spiderT.lua` file still exists on disk (same timestamp) but nobody hits it anymore
- Pages created: [[2026-04-10-jaime-modules-sh-fix]]
- Pages updated: [[ood-troubleshooting]] (added RESOLUTION section at top of Lmod section), [[open-ondemand-betty]] (Bug 5 marked RESOLVED), [[index]]

## [2026-04-10] ingest | ryb's overspack deployment documentation
- Source: Documentation Jeff shared about ryb's `overspack` tool and the `26.1.zen4` software deployment
- Key facts: overspack tool, INSTALL_ROOT and MODULEPATH_ROOT at `/vast/parcc/sw/lmod/alt/26.1.zen4`, `update.sh` cache regeneration script, `arch/zen4/26.1` bridge module, `SitePackage.lua` arch-exclusivity guard
- This explains WHY the spider cache was regenerated (new software tree deployment) and what the `alt/` directory is for
- Pages created: [[2026-04-10-ryb-overspack-deployment-docs]]
- Pages updated: [[index]]

## [2026-04-10] ingest | dgx028 architecture exploration
- Source: Live terminal exploration on dgx028 via OOD session 5207320
- Explored: /etc/profile.d/, BCM packages, GPU topology, NVLink, storage mounts, InfiniBand, pam_slurm_adopt, container runtimes, spack infrastructure, SitePackage.lua, lmod config chain
- Pages created: [[bcm-bright-cluster-manager]], [[gpu-topology-betty]], [[betty-auth-architecture]], [[betty-software-deployment]]
- Key discoveries:
  - Betty runs BCM 11.0 for node image management
  - DGX nodes have 16 Mellanox ConnectX-7 NICs (mlx5_0-mlx5_11+) with MT4129 CA type
  - Local NVMe RAID: /dev/md0 ext4 1.8TB per DGX node
  - enroot container runtime available alongside Apptainer
  - CUDA not system-installed, only via modules
  - Jaime's modules.sh fix is literally one line: `source /vast/parcc/sw/lmod/Lmod`
  - SitePackage.lua arch guard was written by Claude Code Opus 4.6

## [2026-04-10] ingest | Part 2 dgx028 storage and network architecture exploration
- Source: Live terminal exploration on dgx028, storage mounts, network interfaces, Ceph cluster
- Key discoveries:
  - VAST uses NFS 4.2 over RDMA (proto=rdma), not TCP NFS -- InfiniBand-native with 1 MB block I/O
  - VAST server: infiniband.vast01.hdc.parcc.private.upenn.edu, 40 endpoints (10.218.159.11-.50)
  - 4 VAST mounts: /vast/home, /vast/projects, /vast/parcc, /mnt/vast/runai
  - Ceph cluster (3 nodes): /ceph/projects (1.1 PB, mirrored) + /ceph/local (936 TB, nearly empty)
  - Local NVMe: /dev/md0 1.8 TB RAID at /, /var/nvme/scratch for job scratch
  - InfiniBand: 6 IB interfaces, 2 active, ConnectX-7 (MT4129)
  - Ethernet: bonded pair for management, BMC/Redfish for out-of-band
  - RunAI discovered: AI job scheduling platform with VAST mount at /mnt/vast/runai
  - Enroot 4.0.1 container runtime present
  - PARCC helper scripts not on compute node PATH (login-only)
- Pages updated: [[vast-storage]] (complete rewrite with RDMA NFS details)
- Pages created: [[betty-storage-architecture]], [[betty-network-architecture]], [[runai-betty]]
- Updated: [[index]]

## [2026-04-10] resolution | Lmod crash RESOLVED by Jaime's fix — BCM lmod replaced with PARCC lmod on compute nodes
- The cluster-wide `module avail` crash that was the PRIMARY BUG since 2026-04-08 is now resolved
- Root cause chain: ryb's overspack deployment -> cache regeneration dropped `mrcT` -> BCM's lmod hit the broken cache -> crash
- Jaime's fix: changed `/etc/profile.d/modules.sh` to source PARCC's lmod instead of BCM's
- Key lesson: always check WHICH lmod binary is running before debugging cache files; BCM clusters can have competing lmod installations
- OOD Interactive Desktop XFCE sessions now work reliably (3 successful launches on 2026-04-10, no black screen)
- Remaining work: ryb needs to fix `update.sh` for future cache regenerations
- Pages created: [[betty-lmod-architecture]]
- Pages updated: [[ood-troubleshooting]], [[open-ondemand-betty]], [[index]], [[log]]

## [2026-04-27] add | BEAST2 + phylonco workflow for Bayesian phylogenetics on Betty
- Driver: external research group using https://github.com/bioDS/beast-phylonco asked about wall-time extensions beyond Betty's 7-day policy. The ask is the expected shape for single-cell phylogenetics — chains routinely need weeks to converge — so the answer is a documented checkpoint-and-chain pattern, not a custom long queue.
- Pages created: [[beast2-on-betty]], [[beast-phylonco]]
- Templates created: betty-ai/templates/slurm/beast2_resume.sbatch.j2 (parameterized for tarball/module/conda/container install, CPU or GPU BEAGLE, single-chain or array-of-replicas, --requeue + --signal + -resume for clean chained restarts)
- Pages updated: [[index]]
- Key design decisions:
  - **Separate page for phylonco** (not buried in beast2-on-betty.md): it has its own install path via packagemanager, its own scientific niche (single-cell phylogenetics with error models), and the pattern of dedicated concept pages per scientific package is what the agent expects to surface on QUERY.
  - **Source order: tarball > module > conda > container** (different from GROMACS, which prioritized module > NGC container). Reasoning: BEAST2 is Java; beast2.org distributes an all-in-one tarball with a bundled JRE that the `packagemanager` CLI assumes. There is no official NGC container for BEAST2.
  - **Default partition: genoa-std-mem, not dgx-b200**. MCMC is sequential; only the per-step BEAGLE likelihood parallelizes, and that caps at ~4–8 threads. GPU only pays off for very large alignments — flagged in the partition cheat-sheet but defaulted off.
  - **Default walltime: 7-00:00:00, default replicas: 4**. Encodes Betty's 7-day policy as the chunk size and 4 independent chains as the convergence-diagnostic floor.
  - **JVM heap set explicitly to (mem - 4)g** with `-Xmx == -Xms`. BEAST2 OOMs are easy to diagnose only after wasting days; this pre-empts the most common silent failure mode.
- Status: both pages tentative — need a real `module spider beast2` check, a tarball install log, and a benchmark from an actual phylonco run before flipping to current.
- Next ingest opportunity: when the research group runs a real chain, capture the analysis XML and a successful run log; would anchor the phylonco page to a real source instead of general knowledge.

## [2026-05-13] add | SLURM Advisor wiki coverage
- Back-filling wiki coverage for the SLURM Advisor feature merged on the `slurm-advisor` branch (PR #7). The feature shipped without a corresponding wiki entry, leaving the system-prompt anti-hallucination contract pointing only at source files rather than a wiki page.
- Created concept: [[slurm-advisor]] — synthesizes [`BETTY_SLURM_ADVISOR_REPORT.md`](../BETTY_SLURM_ADVISOR_REPORT.md), [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../BETTY_SLURM_ADVISOR_TEST_PLAN.md), and the three 2026-04-27 raw docs. Covers the four `slurm_*` tools, MiniZinc + Python solver fallback, five safety contracts, the anti-hallucination contract, 128-test coverage, and the ranked gap list.
- Created sources: [[2026-04-27-slurm-advisor-report-ryb]], [[2026-04-27-slurm-advisor-evidence-report-ryb]], [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]].
- Updated: [[index]] (new concept under Concepts, three new entries under Sources).
- Also fixed doc drift: stale test counts in `BETTY_SLURM_ADVISOR_TEST_PLAN.md` (now 110 Python / 18 TS), stale tool lists in `PLAN.md`, `PROJECT.md`, and `.claude/agents/betty-ai.md`, added the four `slurm-*.ts` tools and `(50+ pages)` to `README.md`, and documented the dashboard routes + components in `PROJECT.md`.

## [2026-05-13] add | Wave 3F monitoring tab smoke harness
- Verified AppShell + TabStrip + MonitoringView wiring (4-tab DashboardView, '#monitoring' hash round-trip, 6 cards in slot wrappers) — all already in place from Wave 2E.
- Added smoke script: `betty-ai-web/scripts/monitoring-smoke.mjs` — shells out to local vitest scoped to src/components/monitoring + src/components/charts + 5 cluster API endpoint dirs. Exit 0 on all green, 1 on any failure. Summary: `monitoring smoke: 6/6 cards green, 5/5 routes green, 4/4 chart primitives green`.
- Added npm script: `monitoring:smoke` in betty-ai-web/package.json (no new deps).
- Created concept page: [[monitoring-tab]]; updated [[index]] and [[PROJECT]] (dashboard section sub-item).

## [2026-05-13] ingest | BEAST + BEAGLE GPU bench (1.73× speedup) + VAST cross-group permissions
- Source: live chat transcript captured at `raw/cluster_exploration/2026-05-13-beast2-beagle-bench-and-perms.txt`. Working dirs `/vast/projects/ryb/parcc-data-science/tests/beast{1,2}` and `…/jvadala-beast-bench/*`. Driven by jvadala with running side-chat from ryb.
- Created source page: [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
- Created concept pages:
  - [[beagle-gpu-tuning]] — when GPU wins, FP64 mandate for deep trees, ThreadedTreeLikelihood `-threads 1` trick, `--qos=mig-max` (not `mig`), module-naming pitfalls (`beagle/5.4` ≠ BEAGLE phylogenetics; `libbeagle/3.1.2` is CPU-only; the CUDA build is via `arch/b200`)
  - [[beast1-on-betty]] — sibling page to [[beast2-on-betty]]; documents that BEAST1 checkpointing is opt-in via `-save_every` / `-save_stem` on the **initial** run and that omitting it means the chain can't be resumed
  - [[vast-group-permissions]] — diagnostic playbook for cross-group file access on VAST; `chgrp` vs `chmod g+r`, setgid project dirs, the `cp+mv` inherit-via-setgid trick, ACL caveats from ryb's chat ("ACLs don't survive transfers from elsewhere"). Includes ryb's verbatim facilitation framing.
  - [[top-10-betty-commands]] — facilitation cheat-sheet: `id`/`stat`/`chmod`/`chgrp`/`setfacl`, `module spider/load`, `parcc_quota.py`/`parcc_du.py`, `parcc_sfree.py`/`sinfo`, `squeue`/`sbatch`/`sacct`, `find -group`. Anchors a planned `betty-ai-web` `/dashboard/commands` route.
- Updated existing pages:
  - [[beast2-on-betty]] — flipped `tentative` → `current`; added ThreadedTreeLikelihood `-threads 1` gotcha section; added GPU production command; partition cheat-sheet now points to mig90 by default with measured speedup numbers; new See-also links and source citation
  - [[b200-mig45-partition]] — added QoS gotcha (`--qos=mig` saturated, use `--qos=mig-max`); added 2026-05-13 transient `RaisedSignal:53` on dgx028; cross-linked to [[beagle-gpu-tuning]]
  - `.claude/agents/betty-ai.md` — new "Domain knowledge to apply" section covering BEAST/BEAGLE GPU pitfalls and the VAST cross-group permissions facilitation pillar (ryb's framing)
- Added template: `betty-ai/templates/slurm/beast1_checkpoint.sbatch.j2` — parameterized BEAST1 sbatch that always passes `-save_every`/`-save_stem` so users can't omit them; auto-resumes from the latest `state.*` file; CPU (Genoa, many threads) vs GPU (`b200-mig90`, FP64, `-threads 1`) branches; `--qos=mig-max` for GPU
- Key findings filed:
  - **Measured speedup**: BEAST1 wild-aves XML (5535 taxa, 1028 patterns, HKY+Γ) — 32-core CPU+SSE 2.60 hr/Msample → B200 MIG 4g.90gb + FP64 1.50 hr/Msample = **1.73× faster**. Full B200 indistinguishable from half-GPU. `-beagle_multipartition on` cost ~6% on this single-partition XML.
  - **FP32 underflow** on the 5535-taxa tree — BEAGLE GPU jobs crashed within 3 seconds without `-beagle_double`. Rule: trees >~3000 taxa need FP64 on GPU.
  - **The "GPU 2× slower" complaint origin**: BEAST2 XML with `ThreadedTreeLikelihood` + `-threads 6` produced 6 BEAGLE GPU instances of ~115 patterns each — kernel-launch overhead dominated. Fix on GPU is `-threads 1` to consolidate.
  - **Module-name collision**: `beagle/5.4` is Browning genotype phasing, NOT BEAGLE phylogenetics. `libbeagle/3.1.2` is CPU-only. CUDA build ships via `arch/b200` overspack chain.
  - **Permission diagnostic**: BEAST2 XML was mode 0660 but group `jcombar1TestingVast` (jvadala not a member). `chmod g+r` was a red herring; fix was `chgrp rybParccDataScienceVast <file>` to a group both share. Setgid on the parent dir means newly-created files inherit; pre-existing or copied-in files don't.
- ryb's verbatim facilitation framing (captured on [[vast-group-permissions]] and [[top-10-betty-commands]]): "teaching users `stat`, `chmod`, `chgrp`, and maybe `setfacl` will be important … I probably use no more than 10 bash commands in a single day." The wiki now encodes this as durable agent knowledge.
- Open follow-ups (NOT acted on in this ingest):
  - BEAST2 bench ladder (jobs 5743516-5743519) was in-flight at the end of the transcript — results not captured. Future source page should attach the throughput numbers and confirm the `-threads 1` fix recovers GPU speedup for the targeted_1 XML. *(Done in the 2026-05-18 add entry below.)*
  - `b200-mig45 RaisedSignal:53` on dgx028 — transient or persistent? Worth a follow-up `parcc_sdebug.py --node dgx028` revisit before recommending mig45 for production.
  - `betty-ai-web` `/dashboard/commands` route to surface [[top-10-betty-commands]] — not implemented; captured as a planned addition in the page.

## [2026-05-18] add | BEAST + BEAGLE empirical bench on wild-aves HA (BEAST2) and 5535-taxa (BEAST1) datasets
- Driver: external research group (jcombar1/ryb) reported "BEAST2 + BEAGLE GPU is 2× slower than CPU" on the wild-aves HA dataset. Investigation revealed root cause was `-threads 6 -beagle_GPU` fragmenting 690 site patterns into 6 BEAGLE instances of ~110 patterns each — kernel-launch latency bound. Fix: `-threads 1`. This produced a 2.26× speedup (35.7 → 15.8 min/Msample on GPU); CPU `-threads 1 -beagle_CPU -beagle_SSE` then edged GPU at 14.2 min/Msample. 15-cell bench matrix and 4-chain MPS comparison built out from there. **This entry closes the "BEAST2 ladder in flight" follow-up from the 2026-05-13 ingest entry above.**
- Pages created:
  - Concepts: [[beagle-tuning]] — full BEAGLE flag reference (device/threading/precision/async), including the `-threads N` landmine, the FP32 underflow diagnostic, and the `-openmpi` removal requirement for B200 nodes.
  - Concepts: [[cuda-mps]] — user-mode CUDA MPS setup on Betty, per-client SM partitioning, full BEAST2 4-chain MPS recipe (benchmarked at 4.05 min/Msample aggregate vs 4.48 for 4× CPU multiproc).
  - Concepts: [[beast-checkpointing]] — BEAST2 auto `.xml.state` + `-resume` vs BEAST1 must-opt-in `-save_every` / `-save_stem` / `-load_state -force_resume`. Includes chained-sbatch `--dependency=afterany` pattern.
  - Experiments: [[2026-05-15-beast2-ha-wild-aves-bench]] — 15-cell matrix on 690-pattern DNA across [[dgx-b200-partition]], [[b200-mig45-partition]], [[b200-mig90-partition]], [[genoa-std-mem-partition]]. CPU `-threads 1` single-chain winner; GPU 4-chain MPS multi-chain winner.
  - Experiments: [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 v1.10.4 on deep tree. GPU ~1.73× over CPU baseline with `-beagle_double -beagle_scaling dynamic`. FP32 underflows in 3s.
- Pages updated:
  - [[beast2-on-betty]] — `status: tentative` → `status: current`, added empirical-validation banner up top, softened "4–8 threads is the sweet spot" to "`-threads 1` for typical single-partition DNA; raise N only when patterns × states² per instance > ~50k", cross-references to all four new pages added in `related:` and inline.
  - [[index]] — added 3 new concept entries and 2 new experiment entries; softened the `beast2-on-betty` tentative annotation.
- Key design decisions:
  - **Separate `beagle-tuning` concept page** (not buried in `beast2-on-betty`): the flag reference applies equally to BEAST1 and BEAST2, has its own cross-cutting structure (device/threading/precision/async), and is the page the agent should surface when users ask "what flags do I use." Mirrors the choice for [[beast-phylonco]].
  - **Separate `cuda-mps` concept page** (not buried in either BEAST page): MPS is a general CUDA mechanism with applications beyond BEAST (ensemble inference, parameter sweeps). Pinning it to BEAST would make it harder to find for non-phylo users.
  - **Separate `beast-checkpointing` concept page**: BEAST1 vs BEAST2 checkpointing differs enough that the comparison deserves dedicated space, and we've already had two real Betty cases where missing `-save_every` flags lost days of compute. Worth surfacing prominently.
  - **Two dated experiment pages** rather than one combined: the two datasets give opposite recommendations (CPU vs GPU), so keeping them separate makes the "dataset shape matters more than device" lesson immediately legible at the index level.
- Real production scripts staged at `/vast/projects/ryb/parcc-data-science/tests/beast2/` and `/vast/projects/ryb/parcc-data-science/tests/beast1/` on Betty. Full report (with all 26 slurm job IDs in appendix) at `/vast/projects/ryb/parcc-data-science/jvadala-beast-bench/REPORT.md`.
- **Reconciled with parallel ingest** (the 2026-05-13 entry above): theirs's source page [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] + concept pages [[beagle-gpu-tuning]], [[beast1-on-betty]], [[vast-group-permissions]], [[top-10-betty-commands]] + the `beast1_checkpoint.sbatch.j2` template were all uncommitted in a separate worktree (`worktree-beast2-bench-ingest`). My pages [[beagle-tuning]] (general/CPU flag reference, complement to theirs's GPU-focused page), [[cuda-mps]] (multi-chain GPU pattern), [[beast-checkpointing]] (BEAST1-vs-BEAST2 side-by-side), and the two experiment pages were committed on a separate branch. Combined into one coherent set with cross-links, no information lost from either side. One real contradiction (theirs said "CPU benefits from many threads at any size", mine said "CPU N>1 is also a trap") resolved with the dataset-shape rule: CPU `-threads N>1` helps when patterns × states² per shard > ~10k, hurts below — empirically true on both datasets.

## [2026-06-16] ingest | Teams chats digest (PARCC / Betty)
- Source: 8 Microsoft Teams chats (278 new messages, ~2026-04-08 → 2026-06-16) between jvadala and the PARCC team — ryb, Jaime Combariza, Kenneth Chaney, Jamie Schnaitter. Raw export `TeamTuI/teams-web-tui/knowledge/raw/seed.json`; pre-distilled notes in `.../knowledge/wiki/`.
- Created source page: [[2026-06-16-teams-chats-digest]] — chat roster, date range, and the synthesized key threads.
- Created entity pages (people): [[jeffrey-vadala]] (jvadala — facilitation hire, betty-ai author), [[jaime-combariza]] (jcombar1 — senior ops/licensing, cli_filter tester), [[kenneth-chaney]] (systems eng — parcc_sandbox / parcc_sfree.py / model serving), [[jamie-schnaitter]] (systems eng — Kerberos/SSH authority).
- Created concept pages: [[slurm-cli-filter]] (Lua cli_filter, the `--mem` propagation bug, bashrc rollout, Rachit ld-gpu thread), [[kerberos-ssh-macos-fix]] (Heimdal-vs-MIT, `KRB5CCNAME="API:"` fix, diagnostic checklist), [[surgical-tool-id-vlm]] (medical VLM hosting idea — tentative), [[erf-user-facilitation]] (ERF code task + CI-facilitation onboarding + repo/branch workflow), [[betty-ai-agent]] (dashboard + pi/Claude agent, proxy/API-key design).
- Updated: [[ryan-bradley]] (cli_filter ownership + `--mem` fix plan, 1.5M-water GROMACS onboarding, branch/PR workflow, Kerberos diagnostics, PTO 19–25 Jun), [[gromacs-on-betty]] (1.5M-water onboarding exercise + ftp.gromacs.org benchmark data; added source), [[betty-auth-architecture]] (macOS client-side Heimdal-vs-MIT failure + fix, link to new page), [[betty-cluster]] (libhwloc.so.15 outage, BCM/NFSv4 root-owned home-dir breakage, parcc_quota breakage, Grouper/ColdFront PI issue, VMS flakiness), [[parcc-helper-tools]] (parcc_sfree.py `--by node`/`--json`, new `parcc_sandbox`, parcc_quota broken), [[slurm-advisor]] (cli_filter + betty-ai-agent cross-links), [[monitoring-tab]] (betty-ai-agent back-link), [[index]].
- Merged-into rather than created: the pre-distilled `slurm-cli-filter`, `kerberos-ssh`, `gromacs-benchmarking`, `erf-user-facilitation`, `betty-ai-agent`, `surgical-tool-id-vlm`, `betty-cluster`, and `people` notes were synthesized into the canonical wiki pages above rather than copied verbatim (GROMACS notes folded into existing [[gromacs-on-betty]]; per-person `people.md` split into individual entity pages).
- Notes: ERF = AMReX "Energy Research and Forecasting" is marked tentative/inferred. [[surgical-tool-id-vlm]] marked `status: tentative` (hosting is discussed, not committed). No tasks/action-item page created (knowledge only, per ingest scope).

## [2026-06-18] ingest | Teams chats digest — CUDA forward-compat thread (PARCC Group)
- Source: PARCC Group thread, Bradley/Chaney/Schnaitter, 2026-06-18 13:57–16:32Z (digest `digest_20260618T133105.json`). Earlier same-day digest (`140429`) already ingested for pam_slurm_adopt.
- Created: [[cuda-forward-compatibility-betty]] — hardware-min/driver-max CUDA ceiling model; `cuda-compat-13-1..13-3` OS-image plan (July) for non-spack; spack compiles ahead-of-driver with no compat layer; default pinned stack `arch/26.1`+`cuda/13.1.1`; 1–2yr refresh cadence; Gurobi 13 driver-locked to NVIDIA 570; RELION→gcc15; CUDA 13.2 fp64 emulation; driver upgrade gated on DOCA-OFED (Betty on mlnx-ofed) + SuperPOD still 580.126.16.
- Updated: [[betty-software-deployment]] (default CUDA stack + link), [[2026-06-18-teams-chats-digest]] (added CUDA section + pages-touched), [[index]].
- Other chats reviewed (Combariza, Catch Up-RHOS, PARCC<>NVIDIA): old (Apr–May) chit-chat / meeting join-leave noise — nothing task- or knowledge-worthy. Action items (gurobi 13, cuda-compat, gostelm, home-perms, pam_slurm_adopt) already in `knowledge/tasks.md` from prior pass; no new tasks added.

## [2026-06-18] ingest | Teams chats digest — Ken Chaney 1:1, Templeton project (digest_20260618T185004.json)
- Source: Kenneth Chaney 1:1 Teams chat, 2026-06-18T22:18–22:24Z (10 new msgs; continuation of the same chat already ingested through 22:17Z). Other 7 chats had no new messages this cycle.
- Created: [[templeton-religious-trust-project]] — jvadala's Templeton-funded research using a 120B open LLM (per Ken's suggestion) to classify ~2000 free-text religious-experience responses (4 classifications × bootstrapped 10×, speed-bound) into knowledge graphs for SNA; early "q2" ~86%. Status: tentative (model identity inferred).
- Updated: [[jeffrey-vadala]] (added project + 6/18 source), [[kenneth-chaney]] (120B model recommendation to jvadala), [[2026-06-18-teams-chats-digest]] (new Templeton section + pages-touched), [[index]].
- Tasks: none added — status/chit-chat, no action item (Jeffrey already offered GLM-DSA help in prior pass).

## [2026-06-23] ingest | Teams chats digest — provisioning workaround verified (digest_20260623T125933.json)
- Source: PARCC Group chat, Kenneth Chaney, 2026-06-23T16:33–16:40Z (3 new msgs; afternoon continuation of the paused-sync thread). Other 7 chats had no new messages.
- Updated: [[2026-06-23-teams-chats-digest]] (new "Workaround verified" section + 3rd source), [[betty-cluster]] (workaround-verified bullet on the home-dir issue), [[kenneth-chaney]] (verified-workaround outcome).
- Key fact: Ken's manual fix is verified good for users; remaining syncs (groups, VAST, Ceph, Slurm) verified. Workaround should stay safe even after the root cause is fixed — new-user provisioning unblocked via the manual path; paused-sync root cause still open.
- Tasks: folded a verified-status UPDATE sub-bullet under the existing hold item in `knowledge/tasks.md`; no new standalone task.

## [2026-06-23] ingest | Teams chats digest — provisioning hold escalation (digest_20260623T122658.json)
- Source: PARCC Group chat, Combariza & Chaney, 2026-06-23T16:13–16:22Z (10 new msgs; same-day continuation of the 14:36Z paused-sync thread). Other 7 chats had no new messages.
- Updated: [[2026-06-23-teams-chats-digest]] (added midday-update section + 2nd source), [[betty-cluster]] (midday escalation on home-dir issue), [[kenneth-chaney]] (manual workaround, downstream-automation insight, wharton_lliu1 4TB).
- Tasks: added 3 to `knowledge/tasks.md` (Others/FYI) — hold still in place / top priority, approvals won't propagate till sync resumes; emergency wharton_lliu1 → 4TB storage; (workaround ~1pm folded into hold item).

## [2026-06-23] ingest | Teams chats digest — LiteLLM contention pause / GLM down (digest_20260623T163557.json)
- Source: Kenneth Chaney 1:1 Teams chat, 2026-06-23T20:19–20:34Z (5 new msgs). Other 7 chats had no new messages this cycle.
- Key fact: Ken asked jvadala to pause requests to the PARCC LiteLLM gateway while resolving model-contention issues; jvadala complied and stopped his jobs. jvadala noted the served GLM model went down during the window. Transient evening incident.
- Updated: [[2026-06-23-teams-chats-digest]] (new "LiteLLM model-contention pause" section + 4th source), [[kenneth-chaney]] (model-serving: 6/23 contention incident under GLM-DSA), [[index]] (digest source line).
- Tasks: added 1 to `knowledge/tasks.md` (For me / Jeffrey) — keep LiteLLM requests paused until Ken's all-clear.

## [2026-06-25] ingest | Teams digest — ColdFront project-activation suspected side effect of Ken's user patch (digest_20260625T103228.json)
- Source: PARCC Group chat, Kenneth Chaney, 2026-06-25T14:00Z (1 new msg, a quote-reply to Jaime's 6/24 report). Other 7 chats had no new messages this cycle.
- Updated: [[2026-06-25-teams-chats-digest]] (new "PARCC Group — ColdFront project-activation follow-up" section), [[kenneth-chaney]] (workaround side-effect bullet + source line), [[betty-cluster]] (project-activation side effect under the home-dir/sync issue; frontmatter updated + 2026-06-25 source).
- Key fact: ColdFront projects 269/270 (users `recha`/`surbhig`) failed to activate to Betty; Ken suspects **his manual user-creation patch** (the 6/23 paused-sync workaround) breaks project/allocation propagation. Status: tentative, root cause being confirmed.
- Tasks: folded a 6/25 UPDATE sub-bullet under the existing ColdFront-activation item in `knowledge/tasks.md` (Others/FYI); no new standalone task.

## [2026-06-25] ingest | Teams digest — betty-toolkit idea + coffee confirmed (digest_20260625T113558.json)
- Source: Kenneth Chaney 1:1 Teams chat, 2026-06-25T15:11–15:15Z (11 new msgs; mostly social — coffee-shop location, NVIDIA test). Other 7 chats had no new messages this cycle.
- Updated: [[2026-06-25-teams-chats-digest]] (new "Ken 1:1 follow-up" section: betty-toolkit idea, coffee confirmed 3pm, dflash; 2nd source line), [[jeffrey-vadala]] (betty-toolkit aspiration + frontmatter/source), [[index]] (digest line).
- Key facts: (1) jvadala wants to build a "betty-toolkit" — a Betty-local tool-discovery surface for researchers, modeled on the BioNeMo agent toolkit (tentative aspiration). (2) Coffee with Ken confirmed for 3pm today via calendar invite; coffee shop in the "red oval building" near Smilow. (3) Ken asked "Have you seen dflash?" — unidentified, captured tentatively.
- Tasks: added 2 to `knowledge/tasks.md` (For me: betty-toolkit prototype, dflash follow-up); folded a 6/25-later UPDATE under the existing coffee item confirming 3pm + location.

## [2026-06-25] ingest | Teams chats digest — Ken 1:1 (digest_20260625T095929.json)
- Source: Kenneth Chaney 1:1 Teams chat, 2026-06-25T13:28–13:54Z (13 new msgs; mostly social, 3 durable items). Other 7 chats had no new messages this cycle.
- Created: [[2026-06-25-teams-chats-digest]].
- Updated: [[kenneth-chaney]] (new "Views / interests" section: no-defined-metrics view, BioNeMo toolkit, coffee commitment + 4th source), [[index]] (digest source line).
- Tasks: added 1 to `knowledge/tasks.md` (For me) — check out NVIDIA BioNeMo agent toolkit; folded a 6/25 UPDATE sub-bullet under the existing pending-coffee item.

## [2026-06-26] ingest | Teams chats digest — Ceph PG scaling (digest_20260626T091149.json)
- Source: PARCC Group Teams chat, 2026-06-26T12:22–12:51Z (2 new msgs; Jaime 12:22 already ingested prior cycle, Ken 12:50 new). Other 7 chats had no new messages.
- Updated: [[2026-06-26-teams-chats-digest]] (added Ken 9 AM confirm + PG-scaling status), [[betty-storage-architecture]] (new Ceph PG-scaling note: 256→512 done, target ~2048; "sooner vs later" per AHEAD).
- Tasks: appended an UPDATE sub-bullet under the existing Ceph item in `knowledge/tasks.md` (Ken confirmed 9 AM; PG-scaling progress detail).

## [2026-06-26] ingest | Teams chats digest — dflash endpoint + crash (digest_20260626T125412.json)
- Source: Chaney↔Vadala 1:1 Teams chat, 2026-06-26T16:34–16:49Z (4 new msgs). Other 7 chats had no new messages.
- Updated: [[dflash]] (Access section + serving-stack reveal + crash status; frontmatter tags/related), [[runai-betty]] ("actively serving inference" evidence; resolved part of the "is it used?" open question; frontmatter source/related/updated), [[2026-06-26-teams-chats-digest]] (new dflash endpoint+crash subsection, 4th source line, runai-betty related), [[index]] (dflash, runai-betty, digest lines).
- Key facts: (1) dflash test endpoint = `https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`, reachable on the PARCC VPN — hostname reveals the stack = sglang + gpt-oss-120b + dflash on RunAI (test). (2) First concrete evidence RunAI serves inference on Betty. (3) Endpoint crashing as of ~12:49pm EDT — not stable. dflash remains tentative (still no plain-English description from Ken).
- Tasks: appended an UPDATE sub-bullet under the existing dflash item in `knowledge/tasks.md` (For me); no new standalone task.

## [2026-06-26] ingest | Teams digest digest_20260626T132740 (Chaney 1:1 — dflash stabilized)
- Updated: [[dflash]], [[2026-06-26-teams-chats-digest]], [[runai-betty]], [[index]]
- Notes: dflash test endpoint went crashing→stabilized same day; ~5k tok/s/GPU @ conc.100 (~2–3× prior), ~300 tps single-stream, ~300 tps/user up to ~15 users; Ken to add to LiteLLM. Only the Chaney 1:1 chat had new messages (16); other 7 chats empty.

## [2026-06-26] ingest | Teams digest digest_20260626T150904 (Chaney 1:1 test + Ceph meeting end)
- Sources: Chaney↔Vadala 1:1 (9 new msgs, ~18:37–19:09Z) + "Ceph" meeting chat (4 system msgs). Other 7 chats had no new messages.
- Updated: [[dflash]] (Access → client-side bandwidth caveat; source line), [[2026-06-26-teams-chats-digest]] (two new subsections: Jeffrey's first LiteLLM test → Mac-wifi bandwidth diagnosis; Ceph session ended 2:44pm ~50m; +source line).
- Tasks: appended UPDATE sub-bullets in `knowledge/tasks.md` — under the gpt-oss-120b test item (slow result = likely Mac wifi; retest wired, then report to Ken) and under the Ceph item (working meeting ended 2:44pm; 6/27 6am window stands). No new standalone tasks.
- Notes: mostly troubleshooting chit-chat + meeting-end system messages; no net-new entities/concepts. dflash still tentative.

## [2026-06-26] ingest | Teams digest digest_20260626T192414 (Chaney 1:1 — GLM-5.2 NVFP4)
- Source: Chaney↔Vadala 1:1 Teams chat, 2026-06-26T23:13–23:15Z (4 new msgs, ~7:13pm EDT). Other 8 chats had no new messages.
- Updated: [[glm-5.2]] (new NVFP4 quant-variant note + quant-variants summary line + source-line extension), [[2026-06-26-teams-chats-digest]] (new "GLM-5.2 NVFP4 quant" subsection + source line), [[index]] (glm-5.2 line + 6/26 digest line).
- Key facts: NVIDIA published an NVFP4 quant of GLM-5.2 (huggingface.co/nvidia/GLM-5.2-NVFP4); Ken weighing deploying NVFP4 on 8 GPUs ("hmmmm"); Jeffrey "should be zippy". NVFP4 = NVIDIA 4-bit float, native to Blackwell/B200 tensor cores → fast on Betty. Distinct from the served fp8 build (which lacks vision); NVFP4 vision support unconfirmed. Not deployed yet.
- Tasks: appended an UPDATE sub-bullet under the GLM-5.2 evaluation item in `knowledge/tasks.md` (For me) — follow up with Ken on NVFP4 standup + whether 4-bit build keeps vision. No new standalone task.

## [2026-06-29] ingest | Teams digest digest_20260629T170251 (Bradley 1:1 — late-afternoon AI-coding talk)
- Source: Bradley↔Vadala 1:1 Teams chat, 2026-06-29T20:29–21:02Z (~4:29–5:02pm EDT, 53 new msgs). Other 8 chats had no new messages. Continuation of the same thread already in [[2026-06-29-teams-chats-digest]].
- Updated: [[2026-06-29-teams-chats-digest]] (new "Late-afternoon continuation" subsection), [[parcc-skills-modules]] (new "Roadmap / to-make" + "Why skills/hooks, not CLAUDE.md" sections; +2 related), [[ryan-bradley]] (GitHub `bradleyrp`, AI-coding views, +4th source, updated date), [[index]] (skills-modules + 6/29 digest lines).
- Tasks: appended 4 items to `knowledge/tasks.md` (For me) — add Ryan (`bradleyrp`) as ParccSkills collaborator (BLOCKED); README "to make" data-packaging skill; MWE/check-your-work skill (Ryan's idea, he'll help w/ tutorial); co-develop fall "GLM 5.2 and AI Coders" workshop.
- Notes: mostly shop talk; durable facts = Ryan's GitHub username, skill-lint tool, and the CLAUDE.md-vs-hooks rule-enforcement model. No new entity/concept pages.

## [2026-06-29] ingest | Teams digest digest_20260629T173640 (Bradley 1:1 — repo access fixed + benchmark plan)
- Source: Bradley↔Vadala 1:1 Teams chat, 2026-06-29T21:03–21:07Z (~5:03–5:07pm EDT, 11 new msgs). Other 8 chats had no new messages. Continuation of the same thread in [[2026-06-29-teams-chats-digest]].
- Updated: [[parcc-skills-modules]] (roadmap: collaborator-add RESOLVED — repo was public, Jeffrey added Ryan, Ken to add a few; new benchmark/test-case bullet w/ benchtest), [[2026-06-29-teams-chats-digest]] (new "Evening continuation ~5:03–5:07pm" subsection).
- Key facts: ParccSkills repo is **public** (why the earlier collaborator invite failed); Ryan now added. New reference: **github.com/upenn/benchtest** (Ryan's regression/perf-test format — target for reformulated benchmarks). Benchmark idea: scatter input data over many folders → LLM tracks files down + dumps an MWE → reformat into benchtest. Jeffrey to paste into ParccSkills README via the github agent.
- Tasks: in `knowledge/tasks.md` — marked the "Add Ryan as collaborator" item [x] RESOLVED; appended an UPDATE sub-bullet under the MWE/check-your-work item (scatter-data benchmark + benchtest format + README paste). No new standalone tasks.
- Notes: no new entity/concept pages; benchtest noted inline (not yet its own page).

## [2026-07-01] ingest | Teams digest digest_20260701T080602 (Bradley 1:1 — Claude Science RSE positioning)
- Source: Bradley↔Vadala 1:1 Teams chat, 2026-07-01T11:37–11:45Z (13 new msgs). Other 8 chats had 0 new.
- Created: [[2026-07-01-teams-chats-digest]].
- Updated: [[claude-science]] (new "PARCC / RSE positioning" section + 2nd source + related ryan-bradley/parcc-tokens-as-a-service; updated date), [[index]] (claude-science line → 2 sources + RSE note; new 7/1 source line).
- Tasks: appended UPDATE sub-bullets in `knowledge/tasks.md` — under the ParccSkills 404 REOPENED item (still unresolved, Jeffrey "idk why", re-invite still owed) and under the Claude Science item (RSE-positioning discussion; demo to Ryan at next sync; "prep for it"). No new standalone tasks.
- Notes: ~half the messages were delayed-delivery reconciliation (transport noise, not substance). Durable signal = Claude Science reframed from "product to try" → "narrative PARCC's RSE services should respond to"; audience = grad students. claude-science stays tentative.

## [2026-07-01] ingest | Teams digest digest_20260701T122459 (PARCC Group — Dell reframe + lwhyc)
- Source: PARCC Group chat, 2026-07-01T15:55–16:18Z (6 new msgs). Other 8 chats had 0 new. 4th pull of the day; both threads revise earlier 7/1 items.
- Updated: [[2026-07-01-teams-chats-digest]] (new "Fourth pull — 12:24" section), [[betty-cluster]] (Incoming hardware — Dell reframe: 4× R6725 ~99% Penn Medicine's not PARCC's; PARCC's unit is the R7725; service tag 8FVY3J4; correction to the "rack to avoid Flexential charges" plan).
- Tasks: appended UPDATE sub-bullets in `knowledge/tasks.md` under the Dell wrong-server item (Dell call: boxes are Penn Medicine's, route accordingly; give Brendan the tag; confirm R7725) and under the lwhyc runaway item (Ken questions the 23-day premise — reboots should have cleared it; pin down the node).
- Notes: no new entity/concept pages. Fast-moving procurement logistics kept tentative. Key reframe: the mis-shipped R6725s likely aren't PARCC's at all.

## [2026-07-01] ingest | Teams digest digest_20260701T132836 (Bradley 1:1 — rachitk GPU case-study distillation)
- Source: Bradley↔Vadala 1:1 Teams chat, 2026-07-01T17:15–17:28Z (9 new msgs, all Jeffrey outbound) + PARCC Group (1, chit-chat). 5th pull of the day.
- Created: [[gpu-host-gather-bottleneck]] — dedicated technical case study of the rachitk GPU-starvation debug (first in-depth record; 6/29 digest had only the high-level decode-on-GPU summary).
- Updated: [[2026-07-01-teams-chats-digest]] (new "Fifth pull — 13:28" section + frontmatter tags/related), [[index]] (new concept line + 7/1 source-line extension).
- Key facts: "transfer-bound" was really a host-side `ascontiguousarray` gather (~97% of cost); PCIe HtoD = 38ms per nsys. Microbench: contiguous 9.3 / strided 2.0 / pinned 55.7 GB/s. Fix = contiguous int8 → transpose/cast on GPU (memory-careful to dodge CuPy-pool OOM): util 13.6→53%, transfer 68.9s→3.05s (~22×), numerically identical. Env gotchas: single-node MPI (ob1/self,vader,sm), HPCX-vs-conda MPI (OPAL_PREFIX), NVRTC headers (CUDA_PATH), Zarr >2GB chunk (compressor=None). Methodology: falsification loop; 3 wrong turns (VAST-contention/compute-bound/multi-node) each killed by a test; synthetic-proxy trap validated the wrong bottleneck; CuPy async needs device-sync around compute timers.
- Tasks: no new standalone task — this distillation fulfills the existing "Clarify the rachitk OOM advice for Ryan in writing" item; appended a brief UPDATE sub-bullet there. No new action items (messages are Jeffrey sharing, not tasking).
- Notes: PARCC Group message ("ah so PARCC !!!") was chit-chat, skipped.

## [2026-07-02] ingest | Teams digest digest_20260702T091255 (cli_filter/job_submit deployment + Ken PennKey)
- Source: 12 new msgs across 3 chats. Substance: (1) Ken's meeting **"Deploy cli_filter and job_submit plugins"** (started ~8:59am; AHEAD guests Swapnil Ninave/Rahul Tiwari/Ryan Heath + Jamie Schnaitter; Swapnil posted prod path `/cm/shared/apps/slurm/etc/slurm/slurm.conf`); (2) Chaney 1:1 — "I need a PennKey / And I will secure share it over" (terse, context tentative). PennKey/root-password PARCC-Group thread already ingested this morning (unchanged).
- Updated: [[slurm-cli-filter]] (new "Server-side deployment (2026-07-02)" section — cli_filter=client-side bashrc plugin vs job_submit=server-side `JobSubmitPlugins=` in slurm.conf; AHEAD meeting; prod slurm.conf path; frontmatter updated/sources/tags/related +kenneth-chaney/jamie-schnaitter), [[2026-07-02-teams-chats-digest]] (two new sections + one-line summary + tags/related), [[index]] (slurm-cli-filter line → 2 sources + deployment note; 7/2 source line extended).
- Key facts: `job_submit` plugin (server-side, central enforcement) being deployed alongside the previously bashrc-distributed `cli_filter`; prod `slurm.conf` lives under the BCM `cm`-shared tree. Status tentative — deployment in progress, outcome unconfirmed.
- Tasks: appended 1 FYI item (plugin-deployment meeting) under Others/FYI and 1 sub-bullet under the tokens-as-a-service beta item (Ken PennKey, context tentative). No new standalone For-me tasks.
- Notes: the "Deploy…" chat was mostly meeting-system lines (invites/join/leave); only Swapnil's slurm.conf path carried data. No new entity/concept pages.

## [2026-07-02] ingest | Teams digest digest_20260702T155709 (afternoon — CLI memory, GLM 413, jury duty, seed node)
- Source: 14 new msgs across 2 chats — Chaney 1:1 (7, all Jeffrey outbound) + PARCC Group (7). Later cycle same day.
- Updated: [[glm-5.2]] (served endpoint `413 Request Entity Too Large`/~100k context ceiling; LiteLLM group still labeled `zai-org/GLM-5.2-FP8` post-NVFP4-migration; +Content bullet, Our-experience, Sources, frontmatter updated/sources), [[slurm-cli-filter]] (new "Default-memory contract (2026-07-02)": CPU 5.5/15.5 GB per core, GPU 8 GB per thread, per Ryan; Jaime's partition-independent-memory request), [[2026-07-02-teams-chats-digest]] (new "Later cycle" section + frontmatter/See-also), [[index]] (glm-5.2 → 6 sources + 413 note; slurm-cli-filter default-memory note; 7/2 source line extended).
- Key facts: PARCC's served GLM-5.2 imposes ~100k / request-body ceiling → oversized agent prompts fail as hard nginx 413, "gets stuck." cli_filter default memory: 5.5 or 15.5 GB/core (CPU), 8 GB/thread (GPU) — Ryan says working as designed; Jaime wants old tasks×MemPerCPU behavior, partition-independent.
- Tasks: 2 For-me (GLM-5.2-FP8 413/context diagnosis; jury duty 7/9 vs training day) + 2 FYI (CLI default-memory Jaime-vs-Ryan; Cadence-license follow-up) + 1 sub-bullet under the Dell R6725/R7725 thread (unresolved "seed node").
- Notes: Cadence follow-up and seed-node question left as open FYI threads (no durable facts yet). No new entity/concept pages.

## [2026-07-02] ingest | Teams digest digest_20260702T163204 (late afternoon — GLM 800k regression + Flex seed-node empty)
- Source: 5 new msgs across 2 chats — Chaney 1:1 (4: Ken "booo"/"I'll have to take a look"/"I got it up to 800k before"; Jeffrey "That was with zcode") + PARCC Group (1: Ken "He wasn't able to find anything at Flex").
- Updated: [[glm-5.2]] (served-ceiling section + Our-experience + Sources: **~100k is a REGRESSION from ~800k before**, per Ken — favors config/proxy cap over model limit; Jeffrey ties prior 800k to ZCode, tentative), [[2026-07-02-teams-chats-digest]] (Later-cycle: Ken's 800k-regression reply + Flex seed-node-empty note; Pages-touched refreshed).
- Key facts: PARCC's served GLM context was **~800k before** and dropped to ~100k across a redeploy → the 413 ceiling is a config regression Ken will look at, not a hard model limit. Flexential-colo search for the R7725 seed node came up **empty** ("He wasn't able to find anything at Flex").
- Tasks: updated 2 existing items — GLM-5.2 413/context (Ken ack + 800k regression) and the Dell/seed-node sub-bullet (Flex search empty). No new tasks; "booo" was pure reaction (skipped).
- Notes: no new entity/concept/source pages (glm-5.2 + today's source page already existed).
