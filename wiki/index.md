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
- [[ryan-bradley]] — PARCC director (ryb); owns overspack and sponsors the GROMACS workflow on Betty (2 sources)

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
- [[interact-script-vs-salloc]] — why `interact` reloads the profile and `salloc --pty bash` doesn't
- [[gromacs-on-betty]] — GPU-accelerated molecular dynamics on B200 / MIG slices; partition cheat-sheet + Slurm template (tentative, pending `module spider` confirmation)

## Models
- [[qwen2.5-vl-7b-instruct]] — Vision-language, 7B params — **our current focus**
- [[llama-3-8b]] — Text-only baseline for comparison
- [[llama-3-70b]] — Larger text-only, fits on 1 B200 with LoRA
- [[mistral-7b]] — Efficient 7B baseline
- [[deepseek-v3]] — 671B MoE, requires 8+ B200 GPUs

## Experiments
<!-- Populated as experiments are run. See [[experiments/TEMPLATE]] for the page template. -->
- [[experiments/TEMPLATE]] — Canonical template for new experiment pages (agent-owned `## Status` / `## Runtime`, user-owned `## Goal` / `## Lessons`)

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
