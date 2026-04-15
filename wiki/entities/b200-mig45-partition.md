---
type: entity
tags: [betty, partition, gpu, mig, b200]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, dgx-b200-partition, b200-mig90-partition, qlora, lora-fine-tuning, betty-billing-model]
status: current
---

# b200-mig45 Partition

## One-line summary
Single DGX node (dgx028) sliced into 32 MIG instances of 45 GB VRAM each — cheap, shareable B200 fragments for dev and small-model work.

## Key specs
- **Nodes**: 1 (`dgx028`)
- **GPUs**: 32 MIG slices, 45 GB each
- **CPUs/node**: 224
- **RAM/node (Slurm)**: ~186 GB
- **Max nodes/job**: 1 (single-node only)
- **Default per GPU**: 7 CPUs, ~56 GB host memory
- **Allowed QOS**: `normal`, `mig` (8 GPU), `mig-max` (40 GPU), `wharton`
- **Billing weight**: GPU=250 (4x cheaper than full B200)

See `betty-ai/configs/betty_cluster.yaml` for full specs.

## When to use
- Development and debugging before scaling to full [[dgx-b200-partition]]
- 7-8B model inference (Llama 3 8B, Mistral 7B, Qwen2.5-VL-7B) — see [[qwen2.5-vl-7b-instruct]]
- [[qlora]] on up to ~70B models
- LoRA fine-tuning for 7-14B models ([[lora-fine-tuning]])

## When NOT to use
- Full fine-tunes needing >45 GB VRAM
- Multi-GPU communication (MIGs can't NVLink across slices)
- Anything needing >1 node

## Typical usage
```bash
srun -p b200-mig45 --gpus=1 -t 01:00:00 --pty bash
```

## See also
- [[dgx-b200-partition]]
- [[b200-mig90-partition]]
- [[betty-billing-model]]
- [[qwen2.5-vl-7b-instruct]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
