---
type: entity
tags: [betty, storage, nfs, vast, infiniband, rdma]
created: 2026-04-08
updated: 2026-04-21
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide, 2026-04-21-parcc-ops-discussion]
related: [betty-cluster, betty-storage-architecture, parcc-helper-tools, huggingface-cache-management, runai-betty]
status: current
---

# VAST Storage

## One-line summary
Betty's primary filesystem: NFS 4.2 over RDMA on InfiniBand, served by `infiniband.vast01.hdc.parcc.private.upenn.edu`, with 1 MB block I/O across 40 storage endpoints.

## Protocol details
- **Protocol**: NFS 4.2 over RDMA (`proto=rdma`) -- InfiniBand-native, not TCP NFS
- **Server**: `infiniband.vast01.hdc.parcc.private.upenn.edu`
- **Block sizes**: rsize=wsize=1048576 (1 MB) -- large block I/O for throughput
- **Client addressing**: `clientaddr=10.218.152.28` on IB fabric (dgx028 example)
- **Remote endpoints**: 10.218.159.11 through 10.218.159.50 (40 storage endpoints)
- **Mount options**: hard, forcerdirplus, sec=sys, timeo=600, retrans=2

## Mount points
| Mount | Purpose | Notes |
|-------|---------|-------|
| `/vast/home` | User home dirs | 50 GB quota, 250K inodes per user |
| `/vast/projects` | Project shared data | Multi-TB per project, PI-managed |
| `/vast/parcc` | PARCC system software | lmod, spack, sw trees |
| `/mnt/vast/runai` | [[runai-betty]] platform | AI job scheduling infrastructure |

## Jeff's paths
- Home: `/vast/home/j/jvadala` -- 50 GB quota
- Project: `/vast/projects/<your-project>` (set in `betty-ai/configs/team.yaml`)

## Critical rules
- **Home is for configs and code only.** 50 GB fills instantly with HuggingFace model downloads.
- **Always set `HF_HOME`** to a project path -- see [[huggingface-cache-management]].
- All compute and login nodes see the same namespace (no staging needed).

## Quota tools
```bash
parcc_quota.py                        # overall quota check
parcc_du.py /vast/projects/<project>  # directory usage
```
See [[parcc-helper-tools]].

## Performance
- NFS 4.2 over RDMA on InfiniBand -- high throughput, kernel-bypass
- 1 MB read/write blocks optimize for large sequential I/O (model weights, datasets)
- 40 remote storage endpoints provide parallel throughput
- All compute nodes mount identically

## Open threads
- **Tenant-level setting (2026-04-21)**: Jeff noted VAST support told him a certain configuration needs to be applied at the **tenant** level (not cluster-wide / not per-user). Specific setting not yet recorded. Follow up with VAST support + capture the setting name here once identified. Context: [[2026-04-21-parcc-ops-discussion]].

## See also
- [[betty-storage-architecture]] -- full storage architecture including Ceph and local NVMe
- [[betty-cluster]]
- [[huggingface-cache-management]]
- [[parcc-helper-tools]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
