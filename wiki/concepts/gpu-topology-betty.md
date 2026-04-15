---
type: concept
tags: [betty, gpu, networking, nvlink, infiniband, hardware]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-cluster, dgx-b200-partition, b200-mig45-partition, betty-network-architecture, betty-storage-architecture]
status: current
---

# GPU Topology on Betty

## One-line summary
DGX B200 nodes have 16 Mellanox ConnectX-7 NICs with PCIe-bridge and NUMA-aware GPU affinity, plus 1.8TB local NVMe RAID scratch.

## NIC configuration (dgx028, B200 MIG node)

- **16 NICs**: NIC0 through NIC15
- **All Mellanox ConnectX-7** (`mlx5_0` through `mlx5_11+`)
- **CA type**: MT4129 (ConnectX-7)

## GPU-NIC affinity

From `nvidia-smi topo -m` on dgx028:

- **NIC0-NIC3**: PIX-connected (single PCIe bridge) to nearby GPUs -- lowest latency for GPU-direct RDMA
- **NIC4+**: NODE-connected -- cross-socket, higher latency
- **CPU Affinity** and **NUMA Affinity** columns present -- GPUs are split across NUMA nodes

## NVLink topology

- PIX connections visible between nearby NICs
- NODE connections for cross-socket pairs
- No direct NV# (NVLink) links visible in `nvidia-smi topo` output from MIG context
- **Note**: MIG node topology may differ from full GPU node topology -- MIG slices expose a restricted view

## MIG behavior

- `nvidia-smi` shows "No devices found" when run without a Slurm GPU allocation
- MIG is managed at the Slurm level via GRES -- users get pre-sliced MIG instances
- Partitions: [[b200-mig45-partition]] (45GB slices), [[b200-mig90-partition]] (90GB slices)

## Local storage

- **Device**: `/dev/md0` (RAID array, likely NVMe)
- **Filesystem**: ext4, 1.8TB capacity
- **Usage**: ~3% used (mostly empty scratch space)
- **Purpose**: fast local scratch for jobs -- use for checkpoints, temp data, shuffled datasets
- **Warning**: local storage is ephemeral -- data does not persist between job allocations

## Implications for training

- For multi-GPU jobs, prefer GPUs on the same NUMA node for best NIC affinity
- GPU-direct RDMA works best with PIX-connected NICs (NIC0-NIC3)
- Use local `/dev/md0` scratch for checkpoint staging to avoid VAST NFS bottlenecks
- DeepSpeed and NCCL will auto-detect topology via `nvidia-smi topo` -- no manual tuning needed for most workloads

## See also
- [[betty-cluster]]
- [[dgx-b200-partition]]
- [[b200-mig45-partition]]
- [[deepspeed-zero]]

## Sources
- Live `nvidia-smi topo -m` output from dgx028 (OOD session 5207320, 2026-04-10)
