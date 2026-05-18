---
type: concept
tags: [cuda, gpu, mps, dgx-b200, beast, mcmc, multi-process]
created: 2026-05-15
updated: 2026-05-15
sources: [2026-05-15-beast2-ha-wild-aves-bench]
related: [beast2-on-betty, beagle-tuning, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition]
status: current
---

# CUDA Multi-Process Service (MPS) on Betty

## One-line summary
NVIDIA CUDA MPS lets multiple processes share one GPU without serializing on the CUDA context — useful on Betty whenever a workload doesn't saturate a B200 by itself but you want to run several copies in parallel (multi-chain MCMC, ensemble inference, parameter sweeps).

## When to use

- Single-process GPU utilization < ~50% (check `nvidia-smi dmon`)
- N independent processes that should share 1 GPU with predictable allocation
- Workload is *inherently embarrassingly parallel*: N independent BEAST chains, N independent inference batches, etc.

**Don't use** for:
- A single training job (use plain CUDA)
- Single-process inference servers (use `--gpu-memory-utilization` instead)
- Workloads with inter-process GPU communication (MPS doesn't help)

## How to start MPS in user-mode on a Betty job

You **do not need root** on a SLURM-allocated GPU node. The daemon runs as you, using a per-job pipe directory:

```bash
export CUDA_MPS_PIPE_DIRECTORY=$(pwd)/mps_pipe_$SLURM_JOB_ID
export CUDA_MPS_LOG_DIRECTORY=$(pwd)/mps_log_$SLURM_JOB_ID
mkdir -p $CUDA_MPS_PIPE_DIRECTORY $CUDA_MPS_LOG_DIRECTORY
nvidia-cuda-mps-control -d
sleep 3   # give the daemon a moment
```

Tear down at end of job:

```bash
echo quit | nvidia-cuda-mps-control || true
```

The `|| true` matters — if all clients already exited cleanly, the control endpoint may already be gone.

## Allocating SM partitions per client

Set `CUDA_MPS_ACTIVE_THREAD_PERCENTAGE` in each child process's env to cap the fraction of GPU SMs that client may use. 4 clients × 25% saturates a full B200, isolated:

```bash
for i in 1 2 3 4; do
  ( CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25 \
    my-cuda-program --seed $((42 + i*100)) \
  ) &
done
wait
```

For VRAM, additionally set `CUDA_MPS_PINNED_DEVICE_MEM_LIMIT` per client.

## BEAST2 4-chain MPS recipe (full example)

Benchmarked on the wild-aves HA XML — **16.2 min/Msample per chain, 4.05 min/Msample aggregate** (4 chains in parallel). Compared to 4× single-core CPU which gives 4.48 min/Msample aggregate, MPS wins by ~10% on aggregate throughput and frees CPU billing. See [[2026-05-15-beast2-ha-wild-aves-bench]] rows 9 vs 10 for the comparison.

```bash
#!/bin/bash
#SBATCH -p dgx-b200
#SBATCH --gres=gpu:1
#SBATCH -c 16
#SBATCH -t 3-00:00:00
#SBATCH --qos=dgx
#SBATCH -J beast-4mps
#SBATCH -o slurm-%j.out

source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast1 beast2

export CUDA_MPS_PIPE_DIRECTORY=$(pwd)/mps_pipe_$SLURM_JOB_ID
export CUDA_MPS_LOG_DIRECTORY=$(pwd)/mps_log_$SLURM_JOB_ID
mkdir -p $CUDA_MPS_PIPE_DIRECTORY $CUDA_MPS_LOG_DIRECTORY
nvidia-cuda-mps-control -d
sleep 3

XML=run.xml
PIDS=()
for i in 1 2 3 4; do
  mkdir -p chain$i
  cp $XML chain$i/
  ( cd chain$i
    CUDA_MPS_ACTIVE_THREAD_PERCENTAGE=25 \
      beast -beagle -beagle_GPU -overwrite -threads 1 -seed $((42 + i * 100)) \
      $XML > beast_chain${i}.log 2>&1
  ) &
  PIDS+=($!)
done

wait "${PIDS[@]}"
echo quit | nvidia-cuda-mps-control || true
```

Each chain gets its own subdir so the per-chain `.log` / `.trees` / `.state` files don't collide.

## Why MPS beats 4× single-core CPU on this workload

CPU-side, 4 parallel BEAST processes hit ~26%/chain slowdown from shared L3 + DRAM bandwidth contention (measured: 14.2 → 17.9 min/Msample/chain when 4 are co-resident on the same node).

GPU-side via MPS, 4 isolated SM partitions only slow each chain ~3% (16.2 stays ~16.2 min/Msample/chain). The B200's HBM3e bandwidth is plenty for 4 BEAST instances at this dataset size.

## Gotchas

- **`taskset -c 0..3` does not work** inside a SLURM cgroup-constrained job — the cgroup hides absolute CPU IDs. Drop taskset; the OS scheduler spreads threads correctly within the allocation.
- **Don't run MPS on shared nodes.** [[b200-mig45-partition]] / [[b200-mig90-partition]] slices are isolated, so MPS-inside-a-MIG is fine. [[dgx-b200-partition]] requires exclusive allocation (`--gres=gpu:1` on a full DGX node is typically exclusive but verify with `scontrol show job`).
- **One MPS daemon per node.** If two of your jobs land on the same node and both try to start MPS with the default pipe path, the second fails. Always namespace the pipe dir by `$SLURM_JOB_ID` as shown above.
- **CUDA_VISIBLE_DEVICES interactions.** If your script also sets `CUDA_VISIBLE_DEVICES`, set it *before* `nvidia-cuda-mps-control -d`, not after. Late changes won't propagate to the daemon.

## See also
- [[beast2-on-betty]] — when multi-chain BEAST workflows make sense
- [[beagle-tuning]] — BEAGLE flag reference (the BEAST-specific flags this recipe uses)
- [[2026-05-15-beast2-ha-wild-aves-bench]] — empirical comparison vs CPU multiproc
- [[dgx-b200-partition]] — full-B200 partition reference
- [[b200-mig45-partition]] / [[b200-mig90-partition]] — MIG slice partitions

## Sources
- [[2026-05-15-beast2-ha-wild-aves-bench]] — 4×MPS vs 4×CPU multiproc head-to-head
