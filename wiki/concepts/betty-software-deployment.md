---
type: concept
tags: [betty, spack, modules, containers, software, infrastructure]
created: 2026-04-10
updated: 2026-04-10
sources: [2026-04-10-ryb-overspack-deployment-docs]
related: [betty-lmod-architecture, bcm-bright-cluster-manager, betty-cluster]
status: current
---

# Betty Software Deployment

## One-line summary
Software on Betty is deployed via `overspack` (a Spack wrapper by ryb), compiled into `/vast/parcc/sw/`, with modules generated for lmod and a bridge module for the new architecture-specific tree.

## overspack tool

- **Author**: ryb (PARCC admin)
- **What it does**: wraps Spack to build, install, and generate lmod modules for Betty
- **Current deployment**: `26.1.zen4` -- optimized for AMD Zen4 (EPYC Genoa) architecture

## Directory layout

| Path | Contents |
|------|----------|
| `/vast/parcc/spack/` | Junk dir + `sw/` (the Spack install tree) |
| `/vast/parcc/sw/` | Production software tree |
| `/vast/parcc/sw/build` | Build artifacts |
| `/vast/parcc/sw/cache` | Package caches |
| `/vast/parcc/sw/etc` | Configuration |
| `/vast/parcc/sw/extern` | External dependencies |
| `/vast/parcc/sw/lmod` | Module files and lmod infrastructure |
| `/vast/parcc/sw/26.1.zen4` | Spack environments compiled for Zen4 |

## Module generation

- Modules generated at `/vast/parcc/sw/lmod/alt/26.1.zen4/Core`
- **Bridge module**: `arch/zen4/26.1` at `/vast/parcc/sw/lmod/linux-ubuntu24.04-x86_64/Core/arch/zen4/26.1.lua`
  - Running `module load arch/zen4/26.1` adds the new tree to `MODULEPATH`
  - Bridges the old module tree to the new architecture-specific one

## SitePackage.lua

- **Path**: `/vast/parcc/sw/lmod/site/SitePackage.lua`
- **Key feature**: arch-exclusivity guard -- ensures only one architecture's modules are active at a time (e.g., loading `arch/zen4/26.1` unloads any other arch module)
- **Design**: ryb
- **Implementation**: Claude Code Opus 4.6

## Spider cache management

- **Regeneration script**: `/vast/parcc/sw/lmod/site/cache/update.sh`
- **Cache file**: `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
- **Owned by**: `ryb:bettySWAdmin`
- **Lesson**: running `update.sh` after a new deployment is critical, but the 2026-04-08 run produced a corrupt cache missing `mrcT` -- see [[betty-lmod-architecture]] for the full story

## Container runtimes

Two container runtimes are available on Betty:

1. **enroot** -- available at `/usr/bin/enroot`, NVIDIA's container runtime for HPC
   - Lightweight, designed for Slurm integration
   - Can import Docker/NGC images directly
2. **Apptainer** -- available via `module load apptainer`
   - Successor to Singularity
   - Better for complex container workflows

## CUDA

- **CUDA is NOT system-installed** -- `$CUDA_HOME` is empty by default
- Must load via modules: `module load cuda/...`
- This is intentional -- different jobs may need different CUDA versions
- Always `module load cuda` before compiling or running GPU code

## See also
- [[betty-lmod-architecture]] -- the lmod init chain and cache corruption incident
- [[bcm-bright-cluster-manager]] -- BCM's role in node provisioning vs PARCC's software stack
- [[betty-cluster]]

## Sources
- [[2026-04-10-ryb-overspack-deployment-docs]]
- Live inspection of `/vast/parcc/sw/` on dgx028 (OOD session 5207320, 2026-04-10)
