---
type: entity
tags: [betty, runai, scheduling, ai-platform]
created: 2026-04-10
updated: 2026-06-26
sources: [2026-06-26-teams-chats-digest]
related: [betty-cluster, vast-storage, betty-storage-architecture, slurm-on-betty, dflash, vllm-serving]
status: tentative
---

# RunAI on Betty

## One-line summary
RunAI AI job scheduling platform is present on Betty with a VAST mount at `/mnt/vast/runai`, but its relationship to Slurm and user-facing availability are not yet explored.

## What we know
- **Mount point**: `/mnt/vast/runai` on VAST storage (NFS 4.2 over RDMA, same as other VAST mounts)
- **Discovery**: found during Part 2 storage exploration on dgx028 (2026-04-10)
- **RunAI** is NVIDIA's AI workload scheduling platform, typically used for GPU cluster management, fractional GPU allocation, and ML pipeline orchestration
- **Actively serving inference (6/26):** Ken Chaney stood up a test inference endpoint **`https://sglang-gpt-oss-120b-dflash-runai-test.inference.betty.parcc.upenn.edu`** (reachable on the PARCC VPN). The `-runai-` segment and the `inference.betty.parcc.upenn.edu` domain indicate RunAI is **actively scheduling/serving model inference on Betty** (here an sglang + gpt-oss-120b + [[dflash]] test), alongside [[slurm-on-betty]]. First concrete evidence RunAI is in real use, not just a mount. (`status: tentative` retained — only one deployment observed.)
- **Throughput observed (6/26):** after stabilizing, that RunAI-served endpoint hit **~5k tok/s/GPU at concurrency 100** and **~300 tps single-stream** — so RunAI inference on Betty can deliver production-scale throughput. Ken plans to front it with **LiteLLM**. See [[dflash]].
- **Access path = LiteLLM, not the raw URL (6/26 update):** the direct `…-runai-test…` hostname returned **404 on everything** (incl. `/v1/chat/completions`, `/v1/models`) even after "stabilized" — the SGLang OpenAI server wasn't serving behind it. Ken put the model on **LiteLLM** instead (`openai/gpt-oss-120b`). So RunAI-served inference is exposed to users via the LiteLLM gateway, not the per-deployment URL. See [[dflash]].

## What we don't know
- ~~Whether RunAI is actively used or is a legacy/pilot installation~~ → at least used for **test inference serving** as of 6/26 (see above); breadth of use still unknown
- How it interacts with [[slurm-on-betty]] -- does it replace Slurm for some workloads, or run alongside it?
- Whether regular users can access RunAI, or if it is admin-only
- What configuration or data lives under `/mnt/vast/runai`
- Whether RunAI provides features not available through Slurm (e.g., fractional GPU, gang scheduling)

## Next steps
- Investigate contents of `/mnt/vast/runai` (if readable)
- Ask PARCC admins about RunAI availability and intended use
- Check if any RunAI CLI tools are installed (`runai` command)

## See also
- [[betty-cluster]]
- [[slurm-on-betty]]
- [[vast-storage]]
- [[betty-storage-architecture]]

## Sources
- Part 2 dgx028 architecture exploration (2026-04-10)
