---
type: experiment
status: planned
job_id: null
name: Llama 3 8B LoRA Smoke Test
description: Fine-tune Llama 3 8B with LoRA on 500 instruction examples (3 epochs) on b200-mig45 partition
created: 2026-04-19
updated: 2026-04-19
model: meta-llama/Meta-Llama-3-8B
method: lora
dataset_size: 500
total_tokens: 750000
partition: b200-mig45
---

# Llama 3 8B LoRA Smoke Test

## Goal

Validate LoRA fine-tuning workflow on Betty by training **Llama 3 8B** on a small 500-example instruction dataset for 3 epochs.

**Objectives:**
1. Confirm VRAM usage (~22 GB predicted) fits comfortably in a single `b200-mig45` MIG slice (45 GB available)
2. Benchmark actual training throughput (tokens/sec) to inform future job time estimates
3. Verify HuggingFace cache setup on `/vast/projects/` storage
4. Test `peft` + `trl` integration for LoRA training
5. Establish baseline cost/performance for 7-8B model LoRA jobs

**Dataset**: 500 instruction examples × ~500 tokens/example = 250k tokens/epoch × 3 epochs = 750k total training tokens

**Success criteria**: Job completes without OOM, produces valid adapter weights, establishes throughput baseline for scaling to larger datasets.

## Status

<!-- betty:auto-start -->
**Current status**: Planned (not yet submitted)

**Resource allocation** (from `gpu_calculate`):
- **Partition**: `b200-mig45` (MIG-45 slices, 4x cheaper than full B200)
- **GPUs**: 1 × 45 GB VRAM
- **VRAM required**: 22 GB (48% utilization, healthy headroom)
- **CPUs/task**: 7
- **Host RAM**: 56 GB
- **QOS**: `mig`
- **Estimated time**: TBD (requires test run to benchmark)
- **Estimated cost**: TBD (requires test run to benchmark)

**Calculator comparison**: Manual estimate (22-26 GB VRAM, `b200-mig45`, 1 GPU) matches calculator output ✅

**Gated model**: Llama 3 requires HuggingFace access token (`HF_TOKEN` env var)

**Next steps**:
1. Draft sbatch script using recommended LoRA template
2. Submit short test run (1 epoch, 100 examples, 30 min limit) to validate VRAM usage and measure tokens/sec
3. Scale to full 3-epoch job once throughput is confirmed
<!-- betty:auto-end -->

## Runtime

<!-- betty:auto-start -->
<!-- betty:auto-end -->

## Lessons

*(To be filled in after the experiment completes)*
