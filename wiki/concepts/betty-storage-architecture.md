---
type: concept
tags: [betty, storage, vast, ceph, nvme, architecture]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [vast-storage, betty-cluster, runai-betty, gpu-topology-betty, betty-network-architecture]
status: current
---

# Betty Storage Architecture

## One-line summary
Betty has three storage tiers: VAST NFS over RDMA (primary), CephFS (mirrored + local), and per-node local NVMe RAID for scratch.

## Tier 1: VAST (primary filesystem)
- **Protocol**: NFS 4.2 over RDMA on InfiniBand
- **Server**: `infiniband.vast01.hdc.parcc.private.upenn.edu`
- **Mounts**: `/vast/home`, `/vast/projects`, `/vast/parcc`, `/mnt/vast/runai`
- **Use for**: all regular work -- code, datasets, model weights, checkpoints, shared project data
- See [[vast-storage]] for full protocol details and mount options.

## Tier 2: Ceph (CephFS)
- **Cluster**: 3 monitor nodes at 10.218.21.35, 10.218.21.39, 10.218.21.44 (port 6789)
- **Auth**: `/etc/ceph/admin.secret`, user=admin
- **Mount options**: rw, relatime, acl

| Mount | Namespace | Capacity | Used | Use% |
|-------|-----------|----------|------|------|
| `/ceph/projects` | CephFS-Prod-Mirrored | 1.1 PB | 130 TB | 13% |
| `/ceph/local` | CephFS-Prod-Local | 936 TB | 2.3 GB | ~0% |

- **CephFS-Prod-Mirrored**: data replication for durability -- use for data that needs extra protection
- **CephFS-Prod-Local**: local-only namespace, nearly empty, purpose unclear

## Tier 3: Local NVMe (per-node)
- `/dev/md0` -- ext4, 1.8 TB RAID array, mounted at `/`
- `/var/nvme/scratch` -- ext4 on NVMe, fstab options `nobarrier,noatime,nodiratime` (optimized for temp I/O)
- **Not shared** -- data here is local to the compute node and lost when the job ends
- See [[gpu-topology-betty]] for NVMe RAID details.

## How to choose
| Workload | Best tier | Why |
|----------|-----------|-----|
| Code, configs, small files | `/vast/home` | Persistent, backed up, 50 GB quota |
| Datasets, model weights, checkpoints | `/vast/projects` | High throughput, shared, multi-TB |
| Data needing replication | `/ceph/projects` | CephFS-Prod-Mirrored provides redundancy |
| Temp scratch during a job | `/var/nvme/scratch` | Fastest I/O, no network overhead |
| PARCC software/modules | `/vast/parcc` | System-managed, read-only for users |

## Key insight
There is **no dedicated scratch filesystem** shared across nodes. For high-speed temp I/O during jobs, use local NVMe (`/var/nvme/scratch`), but remember it is ephemeral and node-local. For persistent scratch, use `/vast/projects`.

## See also
- [[vast-storage]]
- [[betty-network-architecture]]
- [[gpu-topology-betty]]
- [[runai-betty]]
- [[betty-cluster]]

## Sources
- Part 2 dgx028 architecture exploration (2026-04-10)
