---
type: concept
tags: [llm, fine-tuning, peft, lora, quantization]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [lora-fine-tuning, deepspeed-zero, b200-mig45-partition, llama-3-70b]
status: current
---

# QLoRA

## One-line summary
LoRA where the frozen base model is loaded in **4-bit NF4** quantization, slashing VRAM ~4x so 70B models fit on a single GPU (or MIG slice).

## How it works
Base weights quantized to **NF4 (4-bit NormalFloat)** via `bitsandbytes`, with double quantization and paged optimizers. LoRA adapters stay in BF16/FP16 and receive gradients. Forward pass dequantizes on-the-fly.

Key libraries: `bitsandbytes` + `peft` + `transformers` + `trl`.

## VRAM rule of thumb
~0.5 bytes/param for weights + 0.5-1 GB adapter/overhead + 2-4 GB activations & KV cache.

| Model | QLoRA VRAM | Betty fit |
|-------|-----------|-----------|
| 7B | ~7 GB | 1 MIG-45 slice |
| 13B | ~11 GB | 1 MIG-45 slice |
| 70B | ~40 GB | 1 MIG-45 (tight) or 1 B200 |
| 405B | ~210 GB | 2 B200 |

See `betty-ai/models/model_registry.yaml` for per-model numbers.

## Trade-offs vs full-precision [[lora-fine-tuning]]
- **Pro**: 4x less VRAM, enables 70B+ on small allocations
- **Con**: slightly slower training (dequant overhead), small quality hit on the base forward
- **Con**: merging adapters back into a quantized model is non-trivial

## When to use on Betty
- Dev-budget work on [[b200-mig45-partition]] (4x cheaper billing)
- Fine-tuning 70B-class models without multi-GPU DeepSpeed — see [[llama-3-70b]]
- Any scenario where you are VRAM-bound before you are compute-bound

## See also
- [[lora-fine-tuning]]
- [[deepspeed-zero]]
- [[b200-mig45-partition]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
