---
type: concept
tags: [llm, fine-tuning, peft, lora]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [qlora, deepspeed-zero, vision-language-models, qwen2.5-vl-7b-instruct, llama-3-8b, b200-mig45-partition]
status: current
---

# LoRA Fine-Tuning

## One-line summary
Low-Rank Adaptation — freezes base model weights and trains small rank-`r` matrices injected into attention/MLP layers, cutting trainable params ~100x-1000x.

## How it works
For a frozen weight `W (d x k)`, LoRA learns `A (d x r)` and `B (r x k)` with `r << min(d, k)`. Effective update: `W + BA`. At inference you can merge or keep adapters separate.

Key knobs:
- **`r`** (rank): 4-64 typical; higher = more capacity, more VRAM
- **`alpha`**: scaling factor, often `2 * r`
- **Target modules**: `q_proj`, `k_proj`, `v_proj`, `o_proj`, sometimes MLP
- **Dropout**: 0.0-0.1

Standard library: `peft` from HuggingFace, usually paired with `trl` for SFT/DPO.

## Trade-offs
| | LoRA | Full fine-tune |
|---|---|---|
| VRAM | base + ~5-10% | ~8x base (Adam states) |
| Quality on target task | ~95% of full | 100% baseline |
| Catastrophic forgetting | minimal | significant |
| Multiple adapters | trivial (hot-swap) | one model per task |

## When to use on Betty
- **7B-14B model, 1 GPU**: LoRA on [[b200-mig45-partition]] (4x cheaper than full B200)
- **70B model, 1 GPU**: LoRA in FP16 needs ~152 GB — fits on a full B200, see [[dgx-b200-partition]]
- **>70B model or tight VRAM**: use [[qlora]] instead
- **Vision-language**: works for [[qwen2.5-vl-7b-instruct]] via LLaMA-Factory

## When NOT to use
- You actually need to change the base model's world knowledge — use full fine-tune
- Your task requires a fundamentally different tokenizer/architecture

## See also
- [[qlora]]
- [[deepspeed-zero]]
- [[vision-language-models]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
