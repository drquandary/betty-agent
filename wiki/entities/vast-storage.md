---
type: entity
tags: [betty, storage, nfs, vast, infiniband, rdma]
created: 2026-04-08
updated: 2026-07-06
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide, 2026-04-21-parcc-ops-discussion, 2026-07-01-teams-chats-digest, 2026-07-06-teams-chats-digest]
related: [betty-cluster, betty-storage-architecture, parcc-helper-tools, huggingface-cache-management, runai-betty, vast-group-permissions, jamie-schnaitter, kenneth-chaney, parcc-tokens-as-a-service]
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

## Permissions & ACLs
Because VAST is exported as **NFS 4.2**, its ACL layer is **NFSv4, not POSIX**. Use the `nfs4_`-prefixed tools — `nfs4_setfacl`, `nfs4_getfacl`, `nfs4_editfacl` — not `setfacl`/`getfacl`. Same workflow as POSIX draft ACLs, but the ACEs and permission bits differ (per [[jamie-schnaitter]], 2026-07-01). This is the way to make a **group read-write shared folder** on VAST. Full playbook in [[vast-group-permissions]].

## Snapshots & protected paths
As of **2026-07-06** ([[kenneth-chaney]]), VAST has a **per-project protected-paths** setup deployed:
- **Controllable in ColdFront** — snapshot/protected-path policy is managed per project through the ColdFront allocation UI, not by hand on the filesystem.
- **Surfaced via `parcc_quota.py --snapshots`** — the `--snapshots` flag is **off by default** and stays quiet **until the snapshots actually populate**.
- **Ramp-up ~2 weeks** — it takes about two weeks to reach the full number of snapshots in each individual protected path, so early `--snapshots` output will show partial counts.

This gives projects point-in-time recovery on their protected paths — relevant to backup posture for the [[parcc-tokens-as-a-service]] beta labs and any data the lab agent touches.

## Quota tools
```bash
parcc_quota.py                        # overall quota check
parcc_quota.py --snapshots            # per-project protected-path snapshots (off by default; populates over ~2 wks)
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
- [[2026-07-06-teams-chats-digest]] — per-project protected-paths / `parcc_quota.py --snapshots` deployed
