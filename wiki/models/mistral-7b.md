---
type: model
tags: [model, mistral, 7b-class, apache]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [llama-3-8b, lora-fine-tuning, qlora, b200-mig45-partition]
status: current
---

# Mistral 7B (v0.3)

## One-line summary
Mistral AI's 7.3B dense LLM under permissive Apache-2.0 — the go-to ungated 7B baseline. **Not yet used by us.**

## Basics
- **HF ID**: `mistralai/Mistral-7B-v0.3`
- **Params**: 7.3B
- **Architecture**: `mistral` (sliding-window attention, 4096 window)
- **Gated**: no
- **License**: Apache-2.0

See `betty-ai/models/model_registry.yaml`.

## VRAM (rough)
| Mode | VRAM | Betty fit |
|------|------|-----------|
| FP16 inference | ~18 GB | 1 MIG-45 slice |
| LoRA FP16 | ~20 GB | 1 MIG-45 slice |
| QLoRA 4-bit | ~7 GB | 1 MIG-45 slice |
| Full fine-tune FP16 | ~128 GB | 1 full B200 |

## Recommended Betty setup
| Method | Partition | GPUs |
|--------|-----------|------|
| Inference / LoRA / QLoRA | [[b200-mig45-partition]] | 1 |
| Full fine-tune | [[dgx-b200-partition]] | 1 (ZeRO-2) |

## Why pick Mistral over [[llama-3-8b]]
- **No gating** — no HF access request dance
- **Apache-2.0** — commercial use unrestricted
- Solid baseline quality at the 7B tier

## Our experience
Not yet used.

## See also
- [[llama-3-8b]]
- [[lora-fine-tuning]]
- [[qlora]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
