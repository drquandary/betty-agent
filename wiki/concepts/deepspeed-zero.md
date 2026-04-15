---
type: concept
tags: [llm, training, distributed, deepspeed, zero]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [lora-fine-tuning, qlora, dgx-b200-partition, llama-3-70b, deepseek-v3]
status: current
---

# DeepSpeed ZeRO

## One-line summary
Zero Redundancy Optimizer — data-parallel training strategies that progressively shard optimizer state, gradients, and parameters across GPUs so you can train models much larger than a single GPU holds.

## The stages
| Stage | Shards | Memory saving | When to use |
|-------|--------|---------------|-------------|
| **ZeRO-1** | Optimizer states | ~4x | Model already fits on 1 GPU |
| **ZeRO-2** | +gradients | ~8x | Default for mid-size full fine-tune (7-14B) |
| **ZeRO-3** | +parameters | Nx | Large models (70B+), required for 405B |
| **ZeRO-3 + offload** | +CPU/NVMe | Bigger still | When ZeRO-3 alone isn't enough; slower |

## Configs in this repo
DeepSpeed JSON configs live in `betty-ai/templates/`:
- `ds_zero2.json`
- `ds_zero3.json`
- `ds_zero3_offload.json`

Referenced from `betty-ai/models/model_registry.yaml` per model/method.

## Betty guidance
- **7B full fine-tune** → ZeRO-2 on 1x B200 ([[dgx-b200-partition]])
- **70B full fine-tune** → ZeRO-3 on 8x B200 (1 full DGX node)
- **405B full fine-tune** → ZeRO-3 + offload across 48 GPUs (6 nodes)
- **DeepSeek-V3 671B** → ZeRO-3 + offload across 64 GPUs ([[deepseek-v3]])

## Alternatives
- **PyTorch FSDP** — native, similar sharding semantics
- **LoRA / QLoRA** — avoid ZeRO entirely if you don't need to update all weights
  - See [[lora-fine-tuning]], [[qlora]]

## Launch pattern
```bash
accelerate launch --use_deepspeed \
    --deepspeed_config ds_zero3.json \
    finetune.py
```

## See also
- [[dgx-b200-partition]]
- [[lora-fine-tuning]]
- [[qlora]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
