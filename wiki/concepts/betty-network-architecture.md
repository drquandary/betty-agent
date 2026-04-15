---
type: concept
tags: [betty, networking, infiniband, rdma, ethernet, hardware]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-cluster, vast-storage, betty-storage-architecture, gpu-topology-betty]
status: current
---

# Betty Network Architecture

## One-line summary
DGX B200 nodes use InfiniBand (ConnectX-7) for RDMA storage and GPU communication, bonded Ethernet for management, and Redfish BMC for out-of-band control.

## InfiniBand fabric
- **NICs**: Mellanox ConnectX-7 (MT4129), mlx5 driver
- **Interfaces per DGX node**: 6 IB interfaces observed on dgx028
  - `ibs14f0` through `ibs14f3` -- DOWN (4 ports, possibly inter-node GPU Direct)
  - `ibp24s0` -- UP (active, storage/compute traffic)
  - `ibp41s0f0` -- UP (active)
- **2 active IB ports per node** for RDMA traffic
- **Primary use**: NFS 4.2 over RDMA to [[vast-storage]], inter-node GPU communication (NCCL)

## Ethernet
- **Interfaces**: 4 Ethernet ports on dgx028
  - `ens6f0np0`, `eno3`, `ens6f1np1` -- DOWN
  - 2 bonded slaves: `enp41s0f1np1` + `enp170s0f1np1` -- UP
- **Bonded pair** carries management traffic (SSH, Slurm control, DNS, NTP)
- Ethernet is NOT used for storage or GPU-to-GPU communication

## Out-of-band management
- **BMC interface**: `bmc_redfish0` -- Redfish/IPMI
- Used for remote power control, health monitoring, BIOS configuration
- Standard NVIDIA DGX BMC with Redfish API

## IP address ranges
| Range | Network | Purpose |
|-------|---------|---------|
| 10.218.152.x | InfiniBand client | Compute node IB addresses |
| 10.218.159.x | VAST storage | 40 NFS endpoints (.11 through .50) |
| 10.218.21.x | Ceph cluster | 3 Ceph monitor nodes |

## Architecture summary
```
DGX B200 node
  |-- InfiniBand (ConnectX-7, RDMA)
  |     |-- VAST NFS 4.2 (10.218.159.x)
  |     |-- Inter-node GPU traffic (NCCL)
  |
  |-- Ethernet (bonded pair)
  |     |-- Slurm control plane
  |     |-- SSH, DNS, NTP
  |
  |-- BMC/Redfish
        |-- Out-of-band management
```

## See also
- [[gpu-topology-betty]] -- NIC-to-GPU affinity and PCIe topology
- [[vast-storage]] -- RDMA NFS protocol details
- [[betty-storage-architecture]] -- full storage tier overview
- [[betty-cluster]]

## Sources
- Part 2 dgx028 architecture exploration (2026-04-10)
