---
type: entity
tags: [people, parcc, systems, infra, ken, sandbox, model-serving]
created: 2026-06-16
updated: 2026-06-26
sources: [2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest, 2026-06-23-teams-chats-digest, 2026-06-25-teams-chats-digest, 2026-06-26-teams-chats-digest]
related: [betty-cluster, parcc-helper-tools, betty-ai-agent, surgical-tool-id-vlm, vast-storage, bcm-bright-cluster-manager, jaime-combariza, jamie-schnaitter, jeffrey-vadala, glm-5.2, multi-token-prediction, parcc-skills-modules, parcc-tokens-as-a-service, workweave-router]
status: current
---

# Kenneth Chaney (ken / kchaney)

## One-line summary
PARCC systems/infrastructure engineer who builds cluster tooling (`parcc_sandbox`, `parcc_sfree.py`), deploys quantized LLMs, and handles VAST/BCM/NFSv4 operations.

## Role
- Systems / infra engineer at PARCC
- Owns provisioning and model-serving infrastructure; partners with [[jaime-combariza]] and [[jamie-schnaitter]] on incidents; friendly working relationship with [[jeffrey-vadala]] (coffee/lunch, AI chat)

## What he owns / built
- **`parcc_sandbox`** — a sandboxing wrapper that runs a tool (e.g. `pi` / Claude code) with RW to the current dir and RO elsewhere; `parcc_sandbox -- pi`, add writable dirs with `-w ${OTHER_DIR}`. Deployed on login03. See [[parcc-helper-tools]].
- **`parcc_sfree.py`** — free/used node reporting; `--by node` for per-node granularity, `--json` for machine-readable output. Canonical data source he wants the [[betty-ai-agent]] dashboard to use.
- **Model serving** — deploys Unsloth quantized models on the B200 hardware, targeting native NVFP4 tensors. Interested in following Kimi-code.
  - **GLM-DSA deployment (in progress, 2026-06-18):** working out issues with the `glm-dsa` architecture. sglang did **not** provide day-zero support this release (a change from past releases). Serving at **Q4 quantization** with a measured **~2% performance hit**. Status: tentative/ongoing.
  - **Model-contention incident (2026-06-23 evening, ~20:19Z):** asked jvadala to **pause requests to the PARCC LiteLLM gateway** while resolving model-contention issues; jvadala stopped his jobs. The served **GLM model went down** during this window. Transient incident — resume traffic only on Ken's all-clear.
  - **GLM-5.2 / z.ai interest (2026-06-25):** when jvadala shared [[z.ai]]'s GLM-5.2, Ken signalled intent to try it — *"Not yet, but we will!"* — and noted its speed comes from **MTP (multi-token prediction)**, *"a much faster MTP"* (not classic draft-model speculative decoding). See [[glm-5.2]], [[multi-token-prediction]]. Extends the GLM-family serving thread.
  - **GLM-5.2 now served for coding (2026-06-26):** told jvadala *"you can move any of your coding from kimi over to glm 5.2"* — so GLM-5.2 is live on PARCC's coding stack alongside **Kimi-code**. Re: vision, agreed it's missing on the **fp8** build (jvadala: full model is supposed to do vision). See [[glm-5.2]].
  - **dflash test on GPT-OSS (2026-06-25, tentative):** plans to "get it tested on gpt oss today" after jvadala flagged "dflash might be killer for this other project." Suggests dflash is an inference/serving-side tool Ken is evaluating against a GPT-OSS stack; identity still unconfirmed.
- **VAST / BCM / NFSv4 ops** — leads triage on the 6/16 `libhwloc.so.15` outage (restored the library) and the BCM→VAST new-user home-dir creation failure after the NFSv4+idmap switch (see [[betty-cluster]], [[bcm-bright-cluster-manager]]).
  - **Account sync paused (2026-06-23):** user creation and the remainder of the account sync are currently paused — this is what leaves new home folders broken. Plan: after the pending **Palo Alto TAC** firewall-support session, run one round of syncs and manually fix all home folders that get made.
  - **Midday escalation (2026-06-23):** with 3 new PIs onboarded, Jaime flagged this top priority. Ken is manually running a workaround while awaiting BCM and/or VAST, targeting ~1pm. Key insight: **paused user creation blocks all downstream automations** — they assume users are already provisioned. Approved projects/allocations won't propagate to Betty until the sync resumes. Also handling an emergency Slack request to raise `wharton_lliu1` storage to 4TB.
  - **Workaround verified (2026-06-23, ~16:33–16:40Z):** manual fix confirmed **good for users**; remaining syncs (groups, VAST, Ceph, Slurm) **verified**. Ken's framing: dislikes needing the workaround, but it **should always be safe even after the root cause is fixed**. New-user provisioning unblocked via the manual path; paused-sync root cause still open.
  - **Workaround side effect on project activation (2026-06-25):** Jaime reported (6/24) that two ColdFront projects had not activated to Betty (users `recha`/`surbhig`, projects 269/270). Ken is investigating and **suspects his user patch** is the cause — i.e. the manual user-creation workaround appears to break ColdFront→Betty *project/allocation* propagation even where it unblocked user provisioning. Status: tentative, root cause being confirmed.
- **Agent skills from Spack modules (2026-06-26, in progress)** — having an agent *"write a skill to create skills from modules in spack"*; plans to then auto-generate a skill for **every module in Ryan's Spack software tree** and make them **Lmod-loadable** (`ml parcc/skills/bio/0.1`). Wants to validate usefulness before merging skill repos with jvadala (who shared `drquandary/ParccSkills`). See [[parcc-skills-modules]], [[betty-software-deployment]].
- **Tokens-as-a-service (2026-06-26)** — wants PARCC's LLM offering "fully going" and can **mint API keys on demand** (*"if you find people who want to use it, I can make them keys now"*). Sees a coming need for a **router** to "get people going to consistent models." See [[parcc-tokens-as-a-service]], [[workweave-router]].
- **Prior research background (event cameras):** built a **structured-light 3D system that ran up to 40 kHz** — *"That was a fun project."* (Came up when jvadala shared Prophesee's event-camera structured-light EVK3D and asked about per-pixel volumetrics.) Explains his event-camera/vision-hardware depth.
- **Identity / EULA** — built first-pass EULA functionality in Grouper.
- Floated hosting jvadala's [[surgical-tool-id-vlm]] on the cluster for higher throughput.
- **Model recommendation to jvadala** — suggested the 120B open model jvadala now uses for the [[templeton-religious-trust-project]]; both wish for a published update to that model family.

## Views / interests
- **On assessing PARCC (tentative, 2026-06-25):** comfortable with an outside party (the Betty/PARCC anthropology study) gathering info — "we should be encouraging her." Holds that the deeper problem is PARCC has **no defined success metrics** ("What metric are we gauging ourselves against? What is good? None of that is defined right now"), and notes this opinion **differs from most of the group**.
- **Shares the most AI/LLM overlap with jvadala** among the PARCC staff (vs. Ryan/Jamie). Pointed jvadala to the **NVIDIA BioNeMo agent toolkit** (`github.com/NVIDIA-BioNeMo/bionemo-agent-toolkit`, "turn any agent into a life-science expert"). Committed to scheduling regular coffees.

## API-key / agent guidance (to jvadala)
- Use `parcc_sfree.py` as the dashboard data source; add a "booting AI in progress" label.
- A webserver with a **local proxy** is the agreed way to protect the provider API key (`user/agent → localhost proxy → PARCC LiteLLM gateway → provider model`).

## See also
- [[betty-cluster]]
- [[parcc-helper-tools]]
- [[betty-ai-agent]]
- [[surgical-tool-id-vlm]]
- [[jaime-combariza]]
- [[jamie-schnaitter]]

## Sources
- [[2026-06-16-teams-chats-digest]] — sandbox, dashboard, model-serving, and ops threads
- [[2026-06-18-teams-chats-digest]] — GLM-DSA deployment (Q4, no sglang day-zero support); 110 dB server-room note; 120B model recommendation to jvadala
- [[2026-06-23-teams-chats-digest]] — account sync paused; manual home-folder fixes planned after Palo Alto TAC session
- [[2026-06-25-teams-chats-digest]] — "no defined success metrics" view; BioNeMo agent toolkit; coffee-scheduling commitment; ColdFront project-activation failure suspected to stem from his user patch
- [[2026-06-26-teams-chats-digest]] — skills-from-Spack generator + Lmod-loadable skills; GLM-5.2 served for coding (move from Kimi); fp8 GLM lacks vision; tokens-as-a-service (mints keys on demand, wants a router); built a 40 kHz structured-light 3D event-camera system
