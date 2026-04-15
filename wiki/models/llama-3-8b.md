---
type: model
tags: [model, llama, meta, 7b-class]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [llama-3-70b, mistral-7b, lora-fine-tuning, qlora, b200-mig45-partition, dgx-b200-partition]
status: current
---

# Llama 3 8B

## One-line summary
Meta's 8B dense decoder LLM (Llama 3 family), gated, strong baseline for 7B-class fine-tuning work on Betty. **Not yet used by us.**

## Basics
- **HF ID**: `meta-llama/Meta-Llama-3-8B` (and `-Instruct`)
- **Params**: 8.0B
- **Architecture**: `llama`
- **Gated**: yes — request access on HuggingFace, set `HF_TOKEN`
- **License**: Meta Llama 3 Community License

See `betty-ai/models/model_registry.yaml`.

## VRAM (rough)
| Mode | VRAM | Betty fit |
|------|------|-----------|
| FP16 inference | ~19 GB | 1 MIG-45 slice |
| LoRA FP16 | ~22 GB | 1 MIG-45 slice |
| QLoRA 4-bit | ~7 GB | 1 MIG-45 slice |
| Full fine-tune FP16 | ~140 GB | 1 full B200 |

## Recommended Betty setup
| Method | Partition | GPUs |
|--------|-----------|------|
| Inference (vLLM) | [[b200-mig45-partition]] | 1 |
| LoRA | [[b200-mig45-partition]] | 1 |
| Full fine-tune | [[dgx-b200-partition]] | 1 (ZeRO-2) |

## Our experience
Not yet used. Likely baseline for any text-only LLM work we start.

## See also
- [[llama-3-70b]]
- [[mistral-7b]]
- [[lora-fine-tuning]]
- [[qlora]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
