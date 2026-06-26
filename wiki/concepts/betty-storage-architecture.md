---
type: concept
tags: [betty, storage, vast, ceph, nvme, architecture]
created: 2026-04-10
updated: 2026-06-26
sources: [2026-06-24-teams-chats-digest, 2026-06-26-teams-chats-digest]
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
- **Known issue (status: tentative, 2026-06-24)**: `/ceph` is **not mounted on the DTN (data-transfer) nodes**, so Ceph-backed data cannot be staged via the DTNs. Reported by Jaime Combariza; a vendor ticket was opened with Ahead by Ken Chaney. Tracking resolution — see [[2026-06-24-teams-chats-digest]].
  - **Remediation plan (status: tentative, 2026-06-26)**: the fix is expected to require a **coordinated downtime**. AHEAD has been asked for timing and downtime duration; **groups that hold /ceph data must be contacted and coordinated**, and faculty are to be looped in. Per AHEAD (call 6/25 night) it's a **"sooner vs later"** situation. Team set an **earlier 9 AM meeting** (Jaime + Ken confirmed) on top of the 2pm sync; full group Ceph discussion still deferred to **Mon 6/29** when everyone is back. See [[2026-06-26-teams-chats-digest]].
  - **Ceph PG (placement-group) scaling (status: tentative, 2026-06-26)**: the remediation involves an in-progress **PG count increase** on the Ceph cluster. As of 6/26 they had **"just barely got over the hump" scaling from 256 → 512 PGs**, with **"a good bit to go"** toward a target of **~2048 PGs**. PG scaling rebalances data placement across OSDs and is I/O-intensive, which is part of why a coordinated downtime is needed. (Ken Chaney)
  - **Downtime scheduled — START 2026-06-27 @ 6:00am (status: tentative, 2026-06-26)**: a dedicated "Ceph" working session ran 6/26 ~1:55pm with **AHEAD/vendor guests (Ryan Heath, Swapnil Ninave)** + PARCC staff. The maintenance window is set to **begin 6/27 6am**. Pre-window drain procedure being staged: **`ceph osd pause`** (halt OSD scheduling), a **contact list of ~31 accounts holding /ceph data** (incl. ksusztak, ryb, jcombar1, zives, vidalr, …), and a **`squeue … | grep /ceph` hunt for running jobs** to evacuate (e.g. job 6850091 on epyc-2-2 under `/ceph/projects/ksusztak/...`). Live `ceph status` showed the cluster still actively recovering/rebalancing (~52 MiB/s recovery). See [[2026-06-26-teams-chats-digest]].

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
