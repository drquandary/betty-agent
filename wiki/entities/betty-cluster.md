---
type: entity
tags: [betty, hpc, cluster, parcc, upenn]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration]
related: [dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, vast-storage, slurm-on-betty, open-ondemand-betty, parcc-helper-tools]
status: current
---

# Betty Cluster

## One-line summary
PARCC's first university-wide HPC/AI supercomputer at UPenn, centered on 27 NVIDIA DGX B200 nodes with 216 total B200 GPUs.

## Basics
- **Login host**: `login.betty.parcc.upenn.edu`
- **Web portal**: [[open-ondemand-betty]] at `ood.betty.parcc.upenn.edu`
- **Organization**: Penn Advanced Research Computing Center (PARCC)
- **Auth**: PennKey + Duo 2FA (Kerberos or password SSH)
- **OS**: Ubuntu 24.04.4 LTS
- **Scheduler**: [[slurm-on-betty]] 24.11.7, backfill policy

## Compute
| Partition | Nodes | Purpose | Page |
|-----------|-------|---------|------|
| dgx-b200 | 27 | Main GPU — 216 full B200s | [[dgx-b200-partition]] |
| b200-mig45 | 1 | 32x 45GB MIG slices | [[b200-mig45-partition]] |
| b200-mig90 | 1 | 16x 90GB MIG slices | [[b200-mig90-partition]] |
| genoa-std-mem | 64 | AMD EPYC CPU | [[genoa-std-mem-partition]] |
| genoa-lrg-mem | 10 | AMD EPYC, ~1TB RAM | [[genoa-lrg-mem-partition]] |

## Storage
See [[vast-storage]].
- Home: 50 GB quota — **configs and code only, never models/datasets**
- Projects: multi-TB quotas managed by PI
- **Critical rule**: always set `HF_HOME` to project storage (see [[huggingface-cache-management]])

## Access methods
1. **SSH** (primary): `ssh <pennkey>@login.betty.parcc.upenn.edu`
2. **Open OnDemand** (web): [[open-ondemand-betty]] — provides browser-based shell and interactive desktop
3. **OOD shell via Chrome MCP** — how this agent currently drives the cluster

## Our account
- **Account**: `jcombar1-betty-testing`
- **Allocation**: 12,000 PC (as of 2026-04-08)
- **Primary user**: jvadala
- Billing model: see [[betty-billing-model]]

## Known issues
- `interact` helper script references a nonexistent `defq` partition — broken
- **dgx015** node is in `down` state (as of 2026-04-08)
- **dgx022** has a GRES/GPU count mismatch (invalid state)
- Shared `pytorch` conda env has outdated transformers (4.32) — don't use directly
- No pre-built NGC containers or shared model cache

## Workflows we use
- LLM fine-tuning: see [[lora-fine-tuning]], [[qlora]], [[deepspeed-zero]]
- LLM inference: see [[vllm-serving]]
- Vision-language training: see [[vision-language-models]], [[qwen2.5-vl-7b-instruct]]

## Sources
- [[2026-04-08-betty-initial-exploration]] — First full audit
- [[2026-04-08-betty-system-guide]] — Written guide
