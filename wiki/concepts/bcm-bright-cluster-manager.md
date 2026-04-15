---
type: concept
tags: [betty, bcm, infrastructure, slurm, lmod]
created: 2026-04-10
updated: 2026-04-10
sources: [2026-04-10-jaime-modules-sh-fix, 2026-04-10-ryb-overspack-deployment-docs]
related: [betty-lmod-architecture, betty-cluster, slurm-on-betty, betty-software-deployment]
status: current
---

# BCM (Bright Cluster Manager)

## One-line summary
Betty uses Bright Cluster Manager 11.0 for compute node image provisioning, `/etc/profile.d/` script management, and Slurm orchestration.

## Package details

- **Package**: `cm-apt-conf-image 11.0-100004-cm11.0-6e48d5ca15`
- **Role**: manages compute node OS images, startup scripts, and Slurm configuration
- **Slurm accounting backup host**: `bcm-02`

## What BCM controls

1. **Compute node images** -- the base OS image deployed to every compute node
2. **`/etc/profile.d/` scripts** -- shell initialization scripts sourced at login, including `modules.sh`
3. **Slurm configuration** -- scheduler setup, accounting, node definitions
4. **Its own lmod** -- bundled at `/usr/share/lmod/lmod`

## BCM vs PARCC lmod conflict

BCM bundles its own lmod installation at `/usr/share/lmod/lmod`. PARCC maintains a separate, custom lmod at `/vast/parcc/sw/lmod/Lmod`. These two competed for control of the module system until Jaime's fix on 2026-04-10.

**Before the fix**: `/etc/profile.d/modules.sh` on compute nodes sourced BCM's bundled lmod. When the site spider cache became corrupt (2026-04-08), BCM's lmod crashed on every `module avail` call cluster-wide.

**After the fix**: `/etc/profile.d/modules.sh` on compute nodes now does:
```bash
source /vast/parcc/sw/lmod/Lmod
```
This redirects all module initialization through PARCC's custom lmod, bypassing BCM's bundled copy entirely.

## Key lesson

BCM is invisible infrastructure that can silently interfere with site-custom software. When debugging module or environment issues on Betty:

1. **Always check `/etc/profile.d/`** -- BCM may have overwritten scripts during an image update
2. **Check which lmod binary is running** -- `echo $LMOD_DIR` reveals whether BCM's or PARCC's lmod is active
3. **Don't assume the site-custom tool is the one executing** -- BCM clusters have their own copies of common tools

## See also
- [[betty-lmod-architecture]] -- full lmod init chain and the 2026-04-08 crash story
- [[betty-software-deployment]] -- how PARCC deploys software independently of BCM
- [[betty-cluster]]
- [[slurm-on-betty]]

## Sources
- [[2026-04-10-jaime-modules-sh-fix]]
- [[2026-04-10-ryb-overspack-deployment-docs]]
