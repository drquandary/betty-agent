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
- [[vast-storage]] — NFS 4.2 over RDMA on InfiniBand, 40 storage endpoints (2 sources)
- [[runai-betty]] — RunAI AI job scheduling platform, VAST mount at /mnt/vast/runai (tentative)
- [[parcc-helper-tools]] — `parcc_*.py` scripts for quota, queue, debug (1 source)
- [[open-ondemand-betty]] — Web portal at ood.betty.parcc.upenn.edu (1 source)
- [[slurm-on-betty]] — Slurm 24.11.7 with backfill scheduler (1 source)
- [[ryan-bradley]] — PARCC director (ryb); owns overspack/cli_filter, sponsors GROMACS + facilitation onboarding (3 sources)
- [[jeffrey-vadala]] — PARCC user-facilitation hire (jvadala); builds the Betty AI agent, owns ERF/GROMACS onboarding (1 source)
- [[jaime-combariza]] — senior PARCC staff (jcombar1); drives ops, accounts, hardware, licensing; heavy cli_filter tester (2 sources)
- [[kenneth-chaney]] — PARCC systems engineer; built `parcc_sandbox`, owns `parcc_sfree.py`, deploys quantized LLMs (1 source)
- [[jamie-schnaitter]] — PARCC systems engineer; Kerberos/SSH authority, authored the macOS `KRB5CCNAME` fix (1 source)

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
- [[betty-auth-architecture]] — Kerberos + Duo 2FA for SSH, pam_slurm_adopt on compute nodes
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
- [[slurm-cli-filter]] — ryb's Lua `cli_filter` (defaults `--qos=dgx`); the `--mem`-propagation bug + bashrc rollout (1 source)
- [[kerberos-ssh-macos-fix]] — macOS Heimdal-vs-MIT SSH failures; the `KRB5CCNAME="API:"` fix (1 source)
- [[surgical-tool-id-vlm]] — jvadala's surgical-implement-ID VLM; hosting-on-Betty idea (tentative, 1 source)
- [[erf-user-facilitation]] — ERF code task + CI-facilitation onboarding; ryb's repo/branch workflow + HPC-culture resources (1 source)
- [[betty-ai-agent]] — jvadala's Betty assistant (dashboard + pi/Claude agent), proxy/API-key design (1 source)
- [[cuda-forward-compatibility-betty]] — CUDA/driver ceiling model, `cuda-compat` OS-image plan, default `arch/26.1`+`cuda/13.1.1`, driver-upgrade outlook (1 source)
- [[templeton-religious-trust-project]] — jvadala's 120B-LLM classification → knowledge-graph/SNA research project (tentative, 1 source)

## Models
- [[qwen2.5-vl-7b-instruct]] — Vision-language, 7B params — **our current focus**
- [[llama-3-8b]] — Text-only baseline for comparison
- [[llama-3-70b]] — Larger text-only, fits on 1 B200 with LoRA
- [[mistral-7b]] — Efficient 7B baseline
- [[deepseek-v3]] — 671B MoE, requires 8+ B200 GPUs

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
- [[2026-06-25-teams-chats-digest]] — Ken 1:1: PARCC lacks defined success metrics; BioNeMo agent toolkit shared; coffee-scheduling commitment
