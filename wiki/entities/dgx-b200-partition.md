---
type: entity
tags: [betty, partition, gpu, dgx, b200]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [betty-cluster, b200-mig45-partition, b200-mig90-partition, slurm-on-betty, betty-billing-model, vllm-serving, deepspeed-zero]
status: current
---

# dgx-b200 Partition

## One-line summary
Betty's main GPU partition: 27 DGX B200 nodes with 216 full NVIDIA B200 GPUs (~192 GB VRAM each).

## Key specs
- **Nodes**: 27 (`dgx001`-`dgx027`)
- **GPUs/node**: 8x NVIDIA B200 (~192 GB HBM3e each)
- **CPUs/node**: 224 (2x Intel, 56c/socket, HT on)
- **RAM/node (Slurm)**: ~202 GB (physical ~2 TB, most reserved for OS/GPU)
- **Interconnect**: InfiniBand + 5th-gen NVLink (1.8 TB/s intra-node)
- **Max nodes/job**: 8
- **Max walltime**: 7 days (default 1 hour)
- **Default per GPU**: 28 CPUs, ~224 GB memory
- **Allowed QOS**: `normal` (8 GPU), `dgx` (32 GPU), `gpu-max` (40 GPU), `wharton`

See `betty-ai/configs/betty_cluster.yaml` for the machine-readable spec.

## Billing
- CPU weight = 35.7, GPU weight = 1000
- ~17 PC per B200-hour (see [[betty-billing-model]])

## Known issues (2026-04-08)
- **dgx015**: down
- **dgx022**: invalid state (GRES/GPU count mismatch)

## What fits
A single B200 holds:
- Llama 3 70B FP16 inference (~144 GB) — see [[llama-3-70b]]
- Qwen2.5-72B FP16 inference (~149 GB)
- Llama 3 8B / Mistral 7B full fine-tune — see [[llama-3-8b]], [[mistral-7b]]
- Qwen2.5-VL-7B full fine-tune — [[qwen2.5-vl-7b-instruct]]

Multi-GPU jobs (DeepSpeed ZeRO-3, FSDP) unlock 405B+ models — see [[deepspeed-zero]].

## Typical usage
```bash
srun -p dgx-b200 --gpus=1 -t 00:30:00 --pty bash
```

## See also
- [[betty-cluster]]
- [[b200-mig45-partition]]
- [[b200-mig90-partition]]
- [[slurm-on-betty]]
- [[vllm-serving]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
