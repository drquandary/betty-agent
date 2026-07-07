# Wiki Index

> Catalog of all wiki pages. Agent updates this on every ingest.
> Format: `[[page-name]] — one-line summary (N sources)`

## Entities
- [[betty-cluster]] — PARCC's DGX B200 supercomputer at UPenn (1 source)
- [[dgx-b200-partition]] — Main GPU partition: 27 nodes, 216 B200 GPUs (1 source)
- [[b200-mig45-partition]] — 32x 45GB MIG slices for cheap dev/small models (1 source)
- [[b200-mig90-partition]] — 16x 90GB MIG slices (1 source)
- [[genoa-std-mem-partition]] — 64 AMD EPYC CPU nodes, standard memory (1 source)
- [[genoa-lrg-mem-partition]] — 10 AMD EPYC CPU nodes, ~1TB RAM each (1 source)
- [[vast-storage]] — NFS 4.2 over RDMA on InfiniBand, 40 storage endpoints; NFSv4 ACLs via `nfs4_setfacl`; **per-project protected-path snapshots (ColdFront-controlled, `parcc_quota.py --snapshots`, deployed 7/6, populating 7/7)** (5 sources)
- [[runai-betty]] — RunAI AI job scheduling platform; now seen serving test inference (sglang/gpt-oss-120b/dflash endpoint, 6/26); VAST mount at /mnt/vast/runai (tentative, 1 source)
- [[parcc-helper-tools]] — `parcc_*.py` scripts for quota, queue, debug (1 source)
- [[open-ondemand-betty]] — Web portal at ood.betty.parcc.upenn.edu; **Jupyter GA (out of Beta 7/1); curated envs by default but users CAN register a custom ipykernel (confirmed 7/7); OOD terminal = login-trouble workaround** (7 sources)
- [[slurm-on-betty]] — Slurm 24.11.7 with backfill scheduler; **b200 "license" gating (desync stranded 8 idle nodes 7/7)** (2 sources)
- [[ryan-bradley]] — PARCC director (ryb); owns overspack/cli_filter, sponsors GROMACS + facilitation onboarding (3 sources)
- [[jeffrey-vadala]] — PARCC user-facilitation hire (jvadala); builds the Betty AI agent, owns ERF/GROMACS onboarding (1 source)
- [[jaime-combariza]] — senior PARCC staff (jcombar1); drives ops, accounts, hardware, licensing; heavy cli_filter tester (2 sources)
- [[kenneth-chaney]] — PARCC systems engineer; built `parcc_sandbox`, owns `parcc_sfree.py`, deploys quantized LLMs (1 source)
- [[z.ai]] — External AI vendor; "Advanced AI Chatbot & Agent" powered by GLM-5.2; ships **ZCode**, the official GLM-5.2 coding harness (tentative, 2 sources)
- [[jamie-schnaitter]] — PARCC systems engineer; Kerberos/SSH authority, authored the macOS `KRB5CCNAME` fix (1 source)
- [[bhuv-jain]] — UPenn physics prof, AI-in-education interest; upcoming engagement test case (facilitation vs consultant vs RSE) (tentative, 1 source)

## Concepts
- [[lora-fine-tuning]] — Low-Rank Adaptation, parameter-efficient fine-tuning
- [[qlora]] — 4-bit quantized LoRA, fits large models on small GPUs
- [[deepspeed-zero]] — Sharded training (stages 1/2/3) for multi-GPU scaling
- [[vision-language-models]] — Multi-modal LLMs that accept images (Qwen-VL, LLaVA)
- [[vllm-serving]] — High-throughput LLM inference server
- [[huggingface-cache-management]] — Why HF_HOME matters on HPC systems
- [[betty-billing-model]] — PC-minutes, GPU/CPU weights, budget planning
- [[ood-troubleshooting]] — Diagnostic decision tree for OOD failures + lmod cache fixes
- [[betty-lmod-architecture]] — Two competing lmod installations on Betty (BCM vs PARCC) and how they interact
- [[bcm-bright-cluster-manager]] — BCM 11.0 node image management and Slurm orchestration
- [[gpu-topology-betty]] — DGX B200 NIC topology, GPU-NIC affinity, local NVMe RAID
- [[betty-auth-architecture]] — Kerberos + Duo 2FA for SSH, pam_slurm_adopt on compute nodes; **PennKey deprovisioning cascade (NOT_ACTIVE → /sbin/nologin, contact PMACS/LSP) + root-password rotation policy (event-driven, NIST 800-63)** (4 sources)
- [[betty-software-deployment]] — overspack, Spack environments, container runtimes, CUDA modules
- [[betty-storage-architecture]] — Dual VAST+Ceph architecture with local NVMe scratch
- [[betty-network-architecture]] — InfiniBand RDMA, bonded Ethernet, BMC/Redfish, IP ranges
- [[slurm-gres-conf]] — `gres.conf` role, fields, and Betty's missing-file + null-UniqueId anomaly
- [[slurm-node-state-modifiers]] — `sinfo` suffix glossary (`*`, `~`, `-`, etc.); what `mix-` means
- [[slurm-select-type-parameters]] — `CR_Core_Memory` vs `CR_Pack_Nodes` tradeoff (tentative)
- [[slurm-advisor]] — Constraint-solver-backed SLURM job-shape recommender; four `slurm_*` tools, five safety contracts, 128 tests (3 sources)
- [[interact-script-vs-salloc]] — why `interact` reloads the profile and `salloc --pty bash` doesn't
- [[gromacs-on-betty]] — GPU-accelerated molecular dynamics on B200 / MIG slices; partition cheat-sheet + Slurm template (tentative, pending `module spider` confirmation)
- [[beast2-on-betty]] — Bayesian phylogenetics MCMC on Genoa CPU / MIG GPU; checkpoint-and-chain pattern for multi-week chains, Slurm template (current, GPU validated 2026-05-13, ladder completed 2026-05-15)
- [[beast1-on-betty]] — BEAST v1.10 specifics: explicit `-save_every` checkpointing (must be on initial run), measured 1.73× GPU speedup
- [[beast-phylonco]] — Single-cell phylogenetics package on top of BEAST2; install via packagemanager, replica-array workflow recipe (tentative)
- [[beagle-gpu-tuning]] — When BEAGLE-GPU actually helps (pattern count, FP64, threads=1, `arch/b200`, qos=mig-max) — measured 1.73× speedup on BEAST1 deep tree; full BEAST2 ladder added 2026-05-18
- [[beagle-tuning]] — General BEAGLE flag reference (`-beagle_CPU/SSE/GPU`, `-threads`, `-beagle_double`, scaling) + the `-openmpi` module gotcha; companion to [[beagle-gpu-tuning]]
- [[cuda-mps]] — CUDA Multi-Process Service: user-mode setup on Betty, per-client SM partitioning, full BEAST2 4-chain MPS recipe (1 source)
- [[beast-checkpointing]] — Restart procedures comparison: BEAST2 auto `.xml.state` + `-resume` vs BEAST1 must-opt-in `-save_every` / `-load_state` (companion to [[beast1-on-betty]] which has the BEAST1 deep dive)
- [[vast-group-permissions]] — Cross-group file access on VAST: chgrp/chmod/setgid/ACLs diagnostic playbook (1 source)
- [[top-10-betty-commands]] — Facilitation cheat-sheet of the ~10 commands that handle most Betty user friction (1 source)
- [[monitoring-tab]] — Datadog-style live Slurm monitoring tab in the Betty AI dashboard; six cards, five Wave 2D routes, four SVG chart primitives, JSONL ringbuffer history
- [[slurm-cli-filter]] — ryb's Lua `cli_filter` (defaults `--qos=dgx`); the `--mem`-propagation bug + bashrc rollout; **7/2: central deployment of cli_filter + server-side `job_submit` plugin (AHEAD meeting; prod `slurm.conf` at `/cm/shared/apps/slurm/etc/slurm/`); default-memory contract (5.5/15.5 GB per core CPU, 8 GB per thread GPU) + Jaime's partition-independent-memory ask** (2 sources)
- [[kerberos-ssh-macos-fix]] — macOS Heimdal-vs-MIT SSH failures; the `KRB5CCNAME="API:"` fix (1 source)
- [[surgical-tool-id-vlm]] — jvadala's surgical-implement-ID VLM; hosting-on-Betty idea (tentative, 1 source)
- [[erf-user-facilitation]] — ERF code task + CI-facilitation onboarding; ryb's repo/branch workflow + HPC-culture resources (1 source)
- [[betty-ai-agent]] — jvadala's Betty assistant (dashboard + pi/Claude agent), proxy/API-key design (1 source)
- [[cuda-forward-compatibility-betty]] — CUDA/driver ceiling model, `cuda-compat` OS-image plan, default `arch/26.1`+`cuda/13.1.1`, driver-upgrade outlook (1 source)
- [[multi-token-prediction]] — MTP inference speedup vs. classic draft/verify speculative decoding; GLM-5.2's "faster MTP" (tentative, 1 source)
- [[templeton-religious-trust-project]] — jvadala's 120B-LLM classification → knowledge-graph/SNA research project (tentative, 1 source)
- [[parcc-skills-modules]] — agent "skills" as discoverable units: Ken's skills-from-Spack generator + Lmod-loadable tree, jvadala's ParccSkills repo (+ roadmap: data-packaging & MWE skills, skill-lint, rule-via-hooks-not-CLAUDE.md lore); **skill anatomy = text + `.sh` hooks; Ryan's human-legible-vs-machine-readable "parity" standards proposal; front-end/interface strategy (BYO vim/nvim, "VSCode problem"); harness deep-research phase + "gates" implemented (7/1)** (tentative, 4 sources)
- [[dflash]] — Ken's sglang-served inference acceleration on gpt-oss-120b via RunAI; ~5k tok/s/GPU @ conc.100, ~300 tps single-stream; on **LiteLLM** as `openai/gpt-oss-120b` (raw VPN endpoint 404s — use LiteLLM); **unstable — crash-looped then REVERTED to standard serving 6/26 ~4:21pm (shelved)**; 20b WIP (tentative, 2 sources)
- [[workweave-router]] — third-party "model router for agentic systems" (github.com/workweave/router); <50ms per-prompt routing, claims 40-70% cost cuts; Jeffrey eyes it as a front-end for dflash/fast sub-agent dispatch; PARCC now also wants a router for "consistent models" (tentative, 1 source)
- [[parcc-tokens-as-a-service]] — PARCC's emerging API-key-gated LLM service over LiteLLM; Ken mints keys on demand + wants a router; **first beta lab named 7/1: Dr. Anjan Chatterjee (Neurology)** + a downtime-broadcast requirement; **lab-agent build underway 7/6 + model-fallback / served-model failure-independence question**; TUI/RAG client idea (tentative, 4 sources)
- [[gpu-host-gather-bottleneck]] — rachitk LD case study: a "transfer-bound" CuPy job (80% mem/18% util) was really a **host-side `ascontiguousarray` gather** (~97% of cost; PCIe copy only 38ms per nsys); fix = contiguous int8 to GPU + transpose-on-GPU → util 13.6→53%, ~22× transfer, identical output; + env-rebuild gotchas & falsification-discipline lessons (current, 2 sources)
- [[claude-science]] — Anthropic product (announced 6/30): inbuilt agent "skills" for HPC/science, runs "jobs"; auto-profiled GPU benchmarks on Betty but assumed H100 not B200; reference point for ParccSkills/betty-toolkit; **+RSE positioning (7/1): Ryan wants PARCC's RSE services to respond to the "grad students 10x with Claude Science" claim** (tentative, 2 sources)

## Models
- [[qwen2.5-vl-7b-instruct]] — Vision-language, 7B params — **our current focus**
- [[llama-3-8b]] — Text-only baseline for comparison
- [[llama-3-70b]] — Larger text-only, fits on 1 B200 with LoRA
- [[mistral-7b]] — Efficient 7B baseline
- [[deepseek-v3]] — 671B MoE, requires 8+ B200 GPUs
- [[glm-5.2]] — z.ai flagship LLM; fast inference via MTP; served for coding on PARCC (Kimi alternative); **migrated to NVFP4 (B200-native 4-bit) serving 6/30 to cut token cost**; fp8 build (prior) lacked vision; **served endpoint hits nginx `413`/~100k context ceiling (7/2); 413 root-caused 7/3 to nginx `client_max_body_size` ~1 MB — separate axis from the context-window cap; **nginx proxy Ken-CONFIRMED 7/6** (stack changes at production)** (tentative, 8 sources)

## Experiments
<!-- Populated as experiments are run. See [[experiments/TEMPLATE]] for the page template. -->
- [[experiments/TEMPLATE]] — Canonical template for new experiment pages (agent-owned `## Status` / `## Runtime`, user-owned `## Goal` / `## Lessons`)
- [[2026-05-15-beast2-ha-wild-aves-bench]] — BEAST2 + BEAGLE 15-cell bench on 690-pattern DNA: CPU `-threads 1` wins single-chain, GPU MPS wins 4-chain workflows
- [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 5535-taxa deep tree: GPU 1.73× over CPU with `-beagle_double` (FP32 underflows in 3s)

## Sources
- [[2026-04-08-betty-initial-exploration]] — Full cluster audit via OOD shell
- [[2026-04-08-betty-system-guide]] — Written guide from exploration
- [[2026-04-08-betty-llm-workflows-guide]] — LLM workflow recipes and gotchas
- [[2026-04-07-ryb-ood-bc-desktop-investigation]] — ryb's admin-side debugging on ood01
- [[2026-04-09-jvadala-ood-bug-reproduction]] — Live reproduction of 3 OOD bugs
- [[2026-04-10-jaime-modules-sh-fix]] — Jaime's fix to /etc/profile.d/modules.sh resolving lmod crash
- [[2026-04-10-ryb-overspack-deployment-docs]] — ryb's overspack tool and 26.1.zen4 deployment context
- [[2026-04-17-dgx002-gpu5-oversubscription]] — two jobs double-booked GPU-5 on dgx002 (tentative root cause)
- [[2026-04-21-parcc-ops-discussion]] — ops chat: GPU oversub, SLURM states, `interact` vs salloc, VAST tenant setting, SelectTypeParameters
- [[2026-04-27-slurm-advisor-report-ryb]] — Status report to ryb introducing the four `slurm_*` tools and TRES coverage matrix
- [[2026-04-27-slurm-advisor-evidence-report-ryb]] — End-to-end validation of the advisor tools against live cluster data
- [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]] — Architecture deep-dive (data flow, verbatim-paste contract) + reply to Ryan's review asks
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] — measured BEAST + BEAGLE-CUDA on Betty (1.73× GPU speedup); cross-group permissions facilitation lesson from ryb
- [[2026-06-16-teams-chats-digest]] — 8 Teams chats (Apr–Jun 2026): cli_filter `--mem` bug, GROMACS onboarding, macOS Kerberos fix, libhwloc outage, VLM hosting, betty-ai proxy design
- [[2026-06-18-teams-chats-digest]] — Jamie confirms `pam_slurm_adopt` live on Betty + multi-job-per-node cgroup caveat
- [[2026-06-23-teams-chats-digest]] — Ken: account sync paused; manual home-folder workaround run + verified (groups/VAST/Ceph/Slurm); root cause still open; evening LiteLLM model-contention pause + GLM-down incident
- [[2026-06-24-teams-chats-digest]] — `/ceph` not mounted on DTN nodes; Ken submitted a vendor ticket to Ahead
- [[2026-06-25-teams-chats-digest]] — Ken 1:1: PARCC lacks defined success metrics; BioNeMo agent toolkit shared; jvadala's "betty-toolkit" tool-discovery idea; coffee confirmed 3pm; dflash to be tested on GPT-OSS. PARCC Group: ColdFront projects 269/270 failed to activate — Ken suspects his user patch
- [[2026-06-29-teams-chats-digest]] — Ryan/Jeffrey 1:1: role definitions (facilitation vs "AI consultant" vs RSE; funded-service overlap; USRSE materials); upcoming Prof. Bhuv Jain (AI-education) meeting; rachitk OOM fix = decode-on-GPU, found via a multi-day Opus-4.8 agent harness (ParccSkills, now w/ Nsight CLI), verified by Google; LLM cost (GLM-5.2 "beating opus 4.8" on long tasks, `npx ccusage`, subscription-subsidy concern → on-prem); late-afternoon: rule-via-hooks-not-CLAUDE.md lore + skill-lint, fall GLM-5.2 workshop, ParccSkills roadmap (MWE & data-packaging skills), Ryan's GitHub `bradleyrp` (collaborator add blocked)
- [[2026-06-30-teams-chats-digest]] — Ken **migrated GLM-5.2 serving to NVFP4** (cut token cost); Ken's reliability/human-time criteria for the research-loop harness; ParccSkills went private → Ken added (`k-chaney`); Ken to **lead a Betty field trip**; curation to be hashed out PARCC-wide; **2nd digest: "Claude Science" announced** (inbuilt HPC/science skills, auto-profiled Betty GPU bench but assumed H100 not B200); **3rd digest:** LiteLLM gateway reboot (GLM-5.2 briefly unreachable) + Jeffrey's "chatbot for a lab"; Jaime re-asked Ken to upgrade non-PI user `rheer` (Ken: Thu 7/2 live-login meeting)
- [[2026-07-01-teams-chats-digest]] — Bradley 1:1: ParccSkills 404 for Ryan still unresolved ("idk why"); **Claude Science RSE-positioning** — respond to the "grad-students 10x" claim, demo at next sync. **2nd pull (10:12):** first tokens-as-a-service beta lab named (Dr. Anjan Chatterjee, Neurology) + downtime-broadcast need; **HOME-dir perms policy** (0750 default, 0700/0750 only, nothing in "other", share via project dirs). **3rd pull (11:19, PARCC Group):** VAST **NFSv4 ACL** tooling (`nfs4_setfacl`/`nfs4_editfacl`) for a group-RW shared folder; Dell shipped **4× R6725 (dual EPYC 9655 / 1.5TB / 4×3.2TB NVMe) vs 1× R7725**; OOD Jupyter kernel — Ryan will re-fix; MIG-slice oversubscription + `lwhyc` 23-day runaway procs. **5th pull (13:28):** Jeffrey's full **rachitk GPU case-study** distillation → new [[gpu-host-gather-bottleneck]] page (host-gather not PCIe; contiguous-int8→transpose-on-GPU fix). **6th pull (14:02):** skill anatomy (text + `.sh` hooks; resume-session, 3-command harness looper) + Ryan's **human-legible-vs-machine-readable "parity"** skill-standards proposal → [[parcc-skills-modules]]. **8th pull (17:13):** **front-end/interface strategy** (BYO vim/nvim, "VSCode problem", opencode-on-Betty), **ZCode** = desktop app for GLM long tasks w/ one-click skills, harness **deep-research phase + "gates" IMPLEMENTED**
- [[2026-07-02-teams-chats-digest]] — PARCC Group thread: **PennKey deprovisioning cascade** (user Gangaram/Vineeth — `NOT_ACTIVE` → `/sbin/nologin`, HR role change, OMA auto-flip w/ gap, fix via PMACS not PARCC, also loses PennVPN/AirPennNet, adjunct = no upgrade) + **root-password rotation policy** (Jaime 3-mo vs Jamie's event-driven/NIST-800-63; AHEAD reset ticket today); **+ Ken's "Deploy cli_filter and job_submit plugins" meeting** (AHEAD guests; prod `slurm.conf` path) + terse Ken-needs-a-PennKey 1:1; **afternoon cycle:** CLI default-memory contract (Jaime vs Ryan), Cadence-license follow-up, Jeffrey's jury duty 7/9, unresolved "seed node" (R7725), and served GLM-5.2 **nginx 413 / ~100k context ceiling**
- [[2026-07-03-teams-chats-digest]] — small cycle (Chaney 1:1): Jeffrey's **root-cause diagnosis of the served GLM-5.2 `413`** — it's the **nginx `client_max_body_size` (~1 MB default)** on the vLLM reverse proxy, *not* a model/litellm bug (`retryable=false`); GLM's real 200K window makes big bodies legitimate → server-side fix `client_max_body_size 100m` (tentative — his agent's read). Body-size cap is a separate axis from the context-window regression.
- [[2026-07-06-teams-chats-digest]] — Chaney 1:1: Ken **confirms the nginx reverse proxy** ("we do run a reverse proxy with nginx to get https functionality"), corroborating the 7/3 `413` diagnosis; the **whole stack changes at production** (current specs transient); Ken offers a serving-stack session. **Chatterjee lab agent build underway** + fallback question (does a GLM outage down the other served models?); GLM up ~2pm. PARCC Group: Jaime tracking an inbound **demo unit** (ETA this week, AIT Worldwide Logistics). **Cycle 2 (PARCC Group):** `MaxMemPerCPU=18432` left unset ("oversight") → over-default requests warn (non-blocking) via the CLI filter, not hard-fail (Ryan offered to lower it to match `DefMemPerCPU`); **PARCC training sessions scheduled** — "Best Practices for Navigating the Betty Environment" **Thu 7/9 9 AM & Mon 7/13 2 PM** (Zoom reg, link tested-working; 7/9 conflicts w/ Jeffrey's jury duty) + `parcc-info@lists.upenn.edu` listserv send/approval ("OK" reply, Reply-To to self/no-reply). **Cycle 3:** Ken deployed **VAST per-project protected-paths / snapshots** (ColdFront-controlled, `parcc_quota.py --snapshots` off-by-default, ~2-wk ramp).
- [[2026-07-07-teams-chats-digest]] — **2 pulls.** (1) Ken: **VAST snapshots starting to populate** — visible via `/usr/bin/python3 $(which parcc_quota.py) --snapshots` (adds a Snapshots column; chaneyk/test 13.18 GB, others ramping). (2) Bradley 1:1: **GROMACS onboarding bench ran** ("worked fine"); **custom Jupyter kernels ARE user-addable on OOD** — install a separate env independent of the curated "PyTorch 2.10 (Zen4)" default + register as ipykernel; Ryan to feature it in the **7/9 training deck** (pending perf numbers).
- [[2026-06-26-teams-chats-digest]] — GLM-5.2 NVFP4 (NVIDIA HF build) shared, Ken weighing it on 8 GPUs; Ceph downtime SCHEDULED 6/27 6am (dedicated Ceph session w/ AHEAD guests; `ceph osd pause`, /ceph-data contact list, job-drain hunt); + Ken/Jeffrey 1:1: GLM fp8 no-vision, GLM-5.2 served for coding, skills-from-Spack + ParccSkills merge, dflash served via sglang+RunAI on gpt-oss-120b (on LiteLLM as openai/gpt-oss-120b; unstable — crash-looped ~3:56pm then reverted to standard ~4:21pm); workweave/router shared as a possible dflash front-end; tokens-as-a-service (Ken mints keys now + wants a router; Jeffrey recruiting two labs); Ken's 40 kHz event-camera structured-light background)
