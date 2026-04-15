---
type: model
tags: [model, llama, meta, 70b-class]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [llama-3-8b, deepseek-v3, lora-fine-tuning, qlora, deepspeed-zero, dgx-b200-partition, vllm-serving]
status: current
---

# Llama 3 70B

## One-line summary
Meta's 70B dense LLM — the largest model that fits in FP16 on a **single** Betty B200 for inference. **Not yet used by us.**

## Basics
- **HF ID**: `meta-llama/Meta-Llama-3-70B` (and `-Instruct`)
- **Params**: 70.0B
- **Architecture**: `llama`
- **Gated**: yes
- **License**: Meta Llama 3 Community License

See `betty-ai/models/model_registry.yaml`.

## VRAM (rough)
| Mode | VRAM | Betty fit |
|------|------|-----------|
| FP16 inference | ~144 GB | 1 full B200 |
| LoRA FP16 | ~152 GB | 1 full B200 |
| QLoRA 4-bit | ~40 GB | 1 MIG-45 slice |
| Full fine-tune FP16 | ~1190 GB | 8 B200 + ZeRO-3 |

## Recommended Betty setup
| Method | Partition | GPUs | Stack |
|--------|-----------|------|-------|
| Inference | [[dgx-b200-partition]] | 1 | [[vllm-serving]] |
| QLoRA | [[b200-mig45-partition]] | 1 | peft + bitsandbytes |
| LoRA (FP16) | [[dgx-b200-partition]] | 1 | peft |
| Full fine-tune | [[dgx-b200-partition]] | 8 | [[deepspeed-zero]] ZeRO-3 |

## Our experience
Not yet used. Candidate for any task needing a strong general-purpose chat/reasoning base.

## Notes
- Throughput on 1 B200: ~2200 tok/s (vLLM estimate)
- Gated — need HF access approval before first download

## See also
- [[llama-3-8b]]
- [[deepseek-v3]]
- [[vllm-serving]]
- [[deepspeed-zero]]
- [[qlora]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
