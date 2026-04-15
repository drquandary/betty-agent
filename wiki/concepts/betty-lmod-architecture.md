---
type: concept
tags: [betty, lmod, modules, bcm, architecture]
created: 2026-04-10
updated: 2026-04-10
sources: [2026-04-10-jaime-modules-sh-fix, 2026-04-10-ryb-overspack-deployment-docs]
related: [ood-troubleshooting, open-ondemand-betty, betty-cluster, slurm-on-betty]
status: current
---

# Betty Lmod Architecture

## One-line summary
Betty has two competing lmod installations -- BCM's bundled one and PARCC's custom one -- and `/etc/profile.d/modules.sh` on compute nodes controls which one initializes.

## The two lmod installations

### BCM's bundled lmod
- Ships with Bright Cluster Manager (BCM), the cluster provisioning system
- Binary at `/usr/share/lmod/lmod`
- Init script: `/etc/profile.d/modules.sh` (when pointing at BCM's lmod)
- Reads the site spider cache at `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
- This is the lmod that was crashing cluster-wide from 2026-04-08 to 2026-04-10

### PARCC's custom lmod
- Maintained by PARCC admins (Jaime, ryb)
- Located at `/vast/parcc/sw/lmod/lmod`
- Uses its own init chain that does NOT read the site spider cache the same way BCM's does
- This is the lmod that should always be used on Betty

## The init chain

1. User logs in or Slurm starts a job
2. Bash sources `/etc/profile.d/modules.sh`
3. That script initializes whichever lmod it points to
4. Lmod reads its config from `/vast/parcc/sw/lmod/site/lmodrc.lua`
5. `lmodrc.lua` tells lmod where to find the spider cache

**Before Jaime's fix (2026-04-10)**: `/etc/profile.d/modules.sh` on compute nodes pointed at BCM's bundled lmod. BCM's lmod followed the config chain to `/vast/parcc/sw/lmod/site/cache/spiderT.lua`, which was missing `mrcT`, causing the crash.

**After Jaime's fix**: `/etc/profile.d/modules.sh` sources PARCC's custom lmod at `/vast/parcc/sw/lmod/lmod`. PARCC's lmod uses its own init chain that bypasses the broken cache file.

## Site spider cache

- **Path**: `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
- **Regeneration script**: `/vast/parcc/sw/lmod/site/cache/update.sh`
- **Permissions**: owned by `ryb:bettySWAdmin`, read-only for normal users
- **Config**: `/vast/parcc/sw/lmod/site/lmodrc.lua` tells lmod where to find this cache
- **Bug (2026-04-08)**: regeneration produced a file with `mrcMpathT` and `timestampFn` but missing `mrcT`, causing `next(false)` crash in BCM's lmod

## ryb's overspack deployments

ryb uses an `overspack` tool to deploy new software trees on Betty:

- **Current deployment**: `26.1.zen4` -- an experimental module tree for AMD Zen4 architecture
- **Install root**: `/vast/parcc/sw/lmod/alt/26.1.zen4`
- **MODULEPATH_ROOT**: `/vast/parcc/sw/lmod/alt/26.1.zen4`
- **Bridge module**: `arch/zen4/26.1` -- loads the alt tree into MODULEPATH
- **SitePackage.lua**: `/vast/parcc/sw/lmod/site/SitePackage.lua` has an arch-exclusivity guard that ensures only one architecture's modules are active at a time

When ryb deployed `26.1.zen4`, they ran `update.sh` to regenerate the site spider cache to include the new module tree. That regeneration (Apr 8 16:45) produced the broken `spiderT.lua` file.

## The 2026-04-08 to 2026-04-10 bug chain

1. ryb deployed `26.1.zen4` using `overspack`
2. ryb ran `/vast/parcc/sw/lmod/site/cache/update.sh` to regenerate the spider cache (Apr 8 16:45)
3. The regeneration produced `spiderT.lua` with `mrcMpathT` and `timestampFn` but **missing `mrcT`**
4. Compute nodes were sourcing BCM's bundled lmod from `/etc/profile.d/modules.sh`
5. BCM's lmod read the broken cache and called `next(_G.mrcT)` on a boolean sentinel
6. This crashed `module avail` for every user on every compute node
7. Jaime fixed `/etc/profile.d/modules.sh` to source PARCC's lmod instead (2026-04-10)
8. The broken file still exists but nobody hits it anymore

## Key lesson

**Always check which lmod binary is actually running before debugging cache issues.** On BCM clusters, `/etc/profile.d/modules.sh` may point at the system-bundled lmod instead of the site-custom one. If so, you get the wrong init chain and the wrong cache resolution. Jaime's fix was at the architecture level; the file-level investigation was correct but one layer too deep.

Diagnostic command to check which lmod is active:
```bash
type -a module    # shows the shell function
echo $LMOD_DIR    # shows the lmod installation directory
echo $LMOD_CMD    # shows the lmod command path
```

## See also
- [[ood-troubleshooting]]
- [[open-ondemand-betty]]
- [[betty-cluster]]
- [[slurm-on-betty]]

## Sources
- [[2026-04-10-jaime-modules-sh-fix]]
- [[2026-04-10-ryb-overspack-deployment-docs]]
