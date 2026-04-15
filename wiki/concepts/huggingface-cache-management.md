---
type: concept
tags: [huggingface, storage, environment, hpc]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [vast-storage, betty-cluster, vllm-serving, lora-fine-tuning]
status: current
---

# HuggingFace Cache Management on HPC

## One-line summary
On Betty you MUST redirect HuggingFace caches to `/vast/projects/...` — otherwise the first `from_pretrained(...)` call will blow through your 50 GB home quota.

## Why it matters
- Home on Betty: **50 GB quota** (see [[vast-storage]])
- A single Llama 3 70B checkpoint: ~140 GB
- A single Qwen2.5-VL-7B: ~15 GB
- Datasets cache can balloon into hundreds of GB
- Default `HF_HOME` = `~/.cache/huggingface` = instant quota failure

## The fix
Add to `~/.bashrc` (or export in job scripts):
```bash
export HF_HOME=/vast/projects/<your-project>/hf_cache
export TRANSFORMERS_CACHE=/vast/projects/<your-project>/hf_cache
export HF_DATASETS_CACHE=/vast/projects/<your-project>/hf_datasets_cache

mkdir -p "$HF_HOME" "$HF_DATASETS_CACHE"
```

In Python you can also pass `cache_dir=` to `from_pretrained(...)`, but env vars are the reliable global fix.

## Gated models
Some models ([[llama-3-8b]], [[llama-3-70b]], Gemma) require:
1. Accept license on huggingface.co
2. Create a HF token
3. `export HF_TOKEN=hf_...` or `huggingface-cli login`

## Shared cache idea
Betty does not currently have a `/vast/parcc/shared/models/` pre-populated with common LLMs. Each user/project redownloads. A group cache would save significant duplication — see improvement list in [[2026-04-08-betty-llm-workflows-guide]].

## See also
- [[vast-storage]]
- [[vllm-serving]]
- [[lora-fine-tuning]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
