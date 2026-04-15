---
type: model
tags: [model, vlm, qwen, current-focus]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [vision-language-models, lora-fine-tuning, qlora, b200-mig45-partition, dgx-b200-partition, huggingface-cache-management]
status: current
---

# Qwen2.5-VL-7B-Instruct

## One-line summary
**Our current working model.** Apache-2.0 vision-language model from Alibaba (~7.6B params) used for surgical tool identification on Betty.

## Basics
- **HF ID**: `Qwen/Qwen2.5-VL-7B-Instruct`
- **Params**: 7.6B (LLM decoder) + vision encoder
- **Architecture**: `qwen2_vl`
- **Gated**: no
- **License**: Apache-2.0
- **Category**: [[vision-language-models]]

See `betty-ai/models/model_registry.yaml` for full VRAM table.

## VRAM (rough)
| Mode | VRAM | Betty fit |
|------|------|-----------|
| FP16 inference | ~18 GB | 1 MIG-45 slice |
| LoRA FP16 | ~21 GB | 1 MIG-45 slice |
| QLoRA 4-bit | ~7 GB | 1 MIG-45 slice |
| Full fine-tune FP16 | ~130 GB | 1 full B200 |

## Our usage — current
- **Task**: surgical tool identification (classification via VL chat format)
- **Dataset**: `data/curated_v2_train.jsonl` — 6480 samples, ShareGPT format with images
- **Config**: `configs/train_v2.yaml`
- **Training tool**: **LLaMA-Factory** (`llamafactory-cli`)
- **Status**: in active development, no baseline experiment page yet

## Recommended Betty setup
| Method | Partition | GPUs |
|--------|-----------|------|
| Inference (vLLM) | [[b200-mig45-partition]] | 1 |
| LoRA | [[b200-mig45-partition]] | 1 |
| Full fine-tune | [[dgx-b200-partition]] | 1 |

## Notes / gotchas
- VL preprocessing is CPU-heavy — give it enough `--cpus-per-task`
- Always set `HF_HOME` correctly — [[huggingface-cache-management]]
- Image tokens inflate sequence length — watch OOMs when reusing text-LLM configs

## See also
- [[vision-language-models]]
- [[lora-fine-tuning]]
- [[qlora]]
- [[b200-mig45-partition]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
