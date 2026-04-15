---
type: entity
tags: [betty, partition, gpu, mig, b200]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, dgx-b200-partition, b200-mig45-partition, qlora, betty-billing-model]
status: current
---

# b200-mig90 Partition

## One-line summary
Single DGX node (dgx029) sliced into 16 MIG instances of 90 GB VRAM each — mid-tier GPU fragment for 27-32B model work.

## Key specs
- **Nodes**: 1 (`dgx029`)
- **GPUs**: 16 MIG slices, 90 GB each
- **CPUs/node**: 224
- **RAM/node (Slurm)**: ~186 GB
- **Max nodes/job**: 1
- **Allowed QOS**: `normal`, `mig`, `mig-max`, `wharton`
- **Billing weight**: GPU=500 (half the cost of a full B200)

See `betty-ai/configs/betty_cluster.yaml`.

## When to use
- FP16 inference for Qwen2.5-32B (~68 GB), Gemma 2 27B (~58 GB)
- LoRA fine-tuning of 13-32B models
- Mid-sized experiments where MIG-45 is too tight but a full B200 is overkill

## Typical usage
```bash
srun -p b200-mig90 --gpus=1 -t 01:00:00 --pty bash
```

## See also
- [[b200-mig45-partition]]
- [[dgx-b200-partition]]
- [[betty-billing-model]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
