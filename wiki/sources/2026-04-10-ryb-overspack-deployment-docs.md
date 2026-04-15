---
type: source
tags: [betty, lmod, overspack, spack, modules, admin]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-lmod-architecture, ood-troubleshooting]
status: current
---

# ryb's Overspack Deployment Documentation (2026-04-10)

## One-line summary
Documentation of ryb's `overspack` tool and the `26.1.zen4` software deployment that triggered the spider cache regeneration leading to the cluster-wide lmod crash.

## Key facts

### The overspack tool
- `overspack` is ryb's custom deployment tool for managing software stacks on Betty
- Used to build and deploy module trees under `/vast/parcc/sw/lmod/alt/`

### The 26.1.zen4 deployment
- **Software tree**: `26.1.zen4` -- optimized for AMD Zen4 architecture (EPYC Genoa CPUs in Betty's DGX B200 nodes)
- **INSTALL_ROOT**: under `/vast/parcc/sw/lmod/alt/26.1.zen4`
- **MODULEPATH_ROOT**: `/vast/parcc/sw/lmod/alt/26.1.zen4`
- **Core modules path**: `/vast/parcc/sw/lmod/alt/26.1.zen4/Core`

### Bridge module
- `arch/zen4/26.1` is a bridge module that adds the alt tree to the user's MODULEPATH
- Loading this module makes the zen4-optimized software available alongside the default modules

### SitePackage.lua guard
- `/vast/parcc/sw/lmod/site/SitePackage.lua` contains an architecture-exclusivity guard
- Ensures only one architecture's module tree is active at a time
- Prevents conflicts between default and alt module trees

### Cache update
- `/vast/parcc/sw/lmod/site/cache/update.sh` regenerates the site spider cache
- ryb ran this script on Apr 8 at 16:45 after deploying `26.1.zen4`
- The regeneration produced `spiderT.lua` that included `mrcMpathT` entries for the new alt tree but **failed to produce a `mrcT` table**
- This missing `mrcT` was the direct cause of the cluster-wide `module avail` crash

## Why this matters
This source explains the WHY behind the spider cache regeneration:
1. ryb was deploying a legitimate new software tree
2. The deployment required updating the cache to include the new modules
3. The cache update script (`update.sh`) has a bug that drops the `mrcT` stanza
4. That bug needs to be fixed before ryb does the next overspack deployment

## The alt/ directory structure
The `/vast/parcc/sw/lmod/alt/` directory holds alternative module trees that are not in the default MODULEPATH. They are activated via bridge modules (like `arch/zen4/26.1`). This is a standard Lmod pattern for supporting multiple architectures or software versions on the same cluster.

## See also
- [[betty-lmod-architecture]]
- [[ood-troubleshooting]]
