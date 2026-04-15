---
type: source
tags: [source, guide, llm, workflows]
created: 2026-04-08
updated: 2026-04-08
sources: []
related: [lora-fine-tuning, qlora, deepspeed-zero, vllm-serving, vision-language-models, huggingface-cache-management, qwen2.5-vl-7b-instruct, llama-3-8b, llama-3-70b, mistral-7b, deepseek-v3]
status: current
---

# Source: 2026-04-08 — BETTY_LLM_AND_WORKFLOWS_GUIDE.md

## What it is
Companion to [[2026-04-08-betty-system-guide]] focused on **how to actually do LLM / AI / ABM work** on Betty. Lives at `BETTY_LLM_AND_WORKFLOWS_GUIDE.md` in the repo root.

## Table of contents
1. What you need to know first (B200 hardware, shared env inventory)
2. Fine-tuning LLMs on Betty
3. Running / serving LLMs (inference)
4. Agent-based modeling (CPU classical + LLM-powered)
5. Environment setup recipes
6. What's missing & improvement opportunities
7. Cost / billing awareness

## Key findings
- **B200 VRAM ~192 GB** → 70B model in FP16 fits on 1 GPU, 405B across 4 GPUs
- **Shared `pytorch` env is outdated and missing**: accelerate, peft, bitsandbytes, deepspeed, vllm, trl, flash-attention, xformers — all user-installed
- **`HF_HOME` not configured by default** — critical footgun for 50 GB home quota
- Per-model fit chart: 7B → MIG-45; 70B FP16 → 1 B200; 405B → 4-5 B200 (TP); 671B DeepSeek-V3 → 8 B200
- vLLM, Ollama, TGI, raw transformers — all viable inference paths
- ABM: Mesa / NetLogo / Repast HPC → Genoa CPU; FLAME GPU / LLM-powered → dgx-b200
- LLM-agent pattern: vLLM server + LangGraph/CrewAI/AutoGen/DSPy in one job
- Cost table: 1 B200-hour = ~17 PC (12,000 PC = ~700 hours on 1 B200)

## Listed improvement opportunities
1. Update shared pytorch env
2. Add LLM packages cluster-wide
3. Pre-built NGC containers at `/vast/parcc/sw/containers/`
4. Configure `HF_HOME` per user automatically
5. Add NCCL module
6. Fix `interact` helper
7. Add OOD apps: JupyterLab, VS Code Server, file browser
8. Provide LLM quickstart guide
9. Shared model cache at `/vast/parcc/shared/models/`
10. Example job scripts in a common location

## Wiki pages created from this source
**Concepts**
- [[lora-fine-tuning]]
- [[qlora]]
- [[deepspeed-zero]]
- [[vision-language-models]]
- [[vllm-serving]]
- [[huggingface-cache-management]]

**Models**
- [[qwen2.5-vl-7b-instruct]]
- [[llama-3-8b]]
- [[llama-3-70b]]
- [[mistral-7b]]
- [[deepseek-v3]]

## See also
- [[2026-04-08-betty-system-guide]]
- [[2026-04-08-betty-initial-exploration]]
