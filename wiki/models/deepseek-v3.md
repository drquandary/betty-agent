---
type: model
tags: [model, deepseek, moe, frontier]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [llama-3-70b, deepspeed-zero, vllm-serving, dgx-b200-partition, qlora]
status: current
---

# DeepSeek-V3

## One-line summary
DeepSeek's frontier 671B-total / ~37B-active Mixture-of-Experts LLM with multi-head latent attention — the largest model in our registry. **Not yet used by us.**

## Basics
- **HF ID**: `deepseek-ai/DeepSeek-V3`
- **Params**: 671B total, ~37B active per token
- **Architecture**: `deepseek-moe` (multi-head latent attention)
- **Gated**: no
- **License**: DeepSeek License (permissive)

See `betty-ai/models/model_registry.yaml`.

## VRAM (rough)
| Mode | VRAM | Betty fit |
|------|------|-----------|
| FP16 inference | ~1346 GB | 8 B200 (1 full DGX, TP=8) |
| QLoRA 4-bit | ~342 GB | 2 B200 |
| LoRA FP16 | ~1380 GB | 8+ B200 |
| Full fine-tune FP16 | ~11,400 GB | 64 B200 + ZeRO-3 offload |

## Recommended Betty setup
| Method | Partition | GPUs | Stack |
|--------|-----------|------|-------|
| Inference | [[dgx-b200-partition]] | 8 (TP=8) | [[vllm-serving]] |
| LoRA / QLoRA | [[dgx-b200-partition]] | 2 | peft + [[deepspeed-zero]] ZeRO-3 |
| Full fine-tune | [[dgx-b200-partition]] | 64 | ZeRO-3 + offload |

## Notes
- **FP8 inference** recommended where supported (B200 has native FP8)
- Throughput: ~200 tok/s on 8 B200 (vLLM estimate)
- Needs `--qos=dgx` or `--qos=gpu-max` for any realistic config
- Our 12,000 PC allocation allows ~90 hours of single-node inference — budget carefully

## Our experience
Not yet used. Aspirational — would require a clear research case.

## See also
- [[llama-3-70b]]
- [[deepspeed-zero]]
- [[vllm-serving]]
- [[dgx-b200-partition]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
