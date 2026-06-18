---
type: concept
tags: [betty, cuda, nvidia-driver, spack, modules, gpu, compat]
created: 2026-06-18
updated: 2026-06-18
sources: [2026-06-18-teams-chats-digest]
related: [betty-software-deployment, betty-lmod-architecture, dgx-b200-partition, ryan-bradley, kenneth-chaney]
status: current
---

# CUDA Forward Compatibility on Betty

## One-line summary
How PARCC keeps CUDA "ahead of the driver" on Betty: the hardware sets a minimum CUDA, the NVIDIA driver sets a maximum, and `cuda-compat-*` packages stretch the ceiling without a driver upgrade — strategy worked out by Ryan Bradley and Ken Chaney (PARCC Group, 2026-06-18).

## The compatibility model

- **Hardware sets the MINIMUM CUDA.** A B200 (compute capability 10.0) requires at least CUDA 12.8.
- **The NVIDIA driver sets the MAXIMUM CUDA.** e.g. driver 580 locks you to a max of ~CUDA 13.1.
- **A `cuda-compat` package raises the ceiling without changing the driver.** Installing `cuda-compat-13-2` lets CUDA 13.2 run while staying on driver 580. The compat layer ships `compat/libcuda.so`; as long as that appears in `LD_LIBRARY_PATH`, forward-compat works.
- **Minor-version forward compat may "just work" if code touches no new features.** Open question (as of 6/18): does NVIDIA guarantee minor-version forward compatibility, or does it require the compat layer? `pytorch@2.12 ^cuda@13.1` tests pass on driver 580, but only because PyTorch doesn't use 13.1-unique symbols — not proof the guarantee holds.

## Spack vs OS-image strategy

- **Spack does NOT ship the compat layer.** There is no `<cuda-version>/compat` folder in Betty's spack-installed CUDA. Ryan compiles "ahead of the driver" (current tree is 0.1 ahead) so that when the driver is later upgraded, features previously squelched by the missing compat layer unlock automatically.
- **Ken's plan: install `cuda-compat-13-1` … `cuda-compat-13-3` in the OS image (July 2026)** to cover everything *outside* spack — conda environments, user-built binaries, etc. Spack stays decoupled and is fine without the compat folder as long as it doesn't strictly need it.
- **Proposed negative test**: a small program that calls a 13.1-only symbol so that the OS-image compat install can be verified when it lands. Candidate symbols missing from an older driver include `cuMulticastBindMem_v2`, `cuMulticastBindAddr_v2`, `cuGraphGetId`, `cuGraphExecGetId`, `cuStreamGetDevResource`, `cuDevSmResourceSplit`.

## Default modules and refresh cadence

- **Default stack: `arch/26.1` + `cuda/13.1.1`.** Ryan deliberately keeps these pinned as long as possible (longer than recompile cycles) so every research group sees the same environment.
- **Refresh model (Ryan's proposal)**: ~1–2 year cadence for a full tree refresh; put the high-traffic software (PyTorch) on the newest drivers, but keep niche codes (genomics, etc.) on the main default tree so it stays well-populated. Don't chase upgrades for low-user-count software without a measured performance MWE to justify it.
- **Per-version pinning gotcha**: `ml beast1` unloads everything built against cuda 13.1 because beast1 (like gurobi) is pinned to a specific CUDA (13.0). Functionally equivalent to an Lmod hierarchy without putting CUDA literally in the modulepath. Jamie floated using Lmod's hierarchy (`CUDA/13.3/` subdirs added to MODULEPATH when `cuda/13.3` loads); compatibility with spack/overspack is unconfirmed.

## Driver upgrade outlook (as of 2026-06-18)

- **595** is the most recent driver under NVIDIA AI Enterprise Infra 8.
- **SuperPOD release matrix still pins 580.126.16** — newer CUDA support lags because drivers must clear general Enterprise Infra testing *and* SuperPOD testing.
- **OFED blocker**: Betty is still on `mlnx-ofed` (confirmed at least on dgx029), not `DOCA-OFED`. Moving to DOCA-OFED would be a prerequisite/blocker for upgrading and is flagged to look at in July.
- Goal is to reach a newer driver "soon-ish" to natively support CUDA 13.3 and build against it.

## Related quirks surfaced in the same thread

- **Gurobi 13** was compiled against a driver-locked package "for no reason," so it only works with NVIDIA driver 570 (not, as first assumed, a CUDA-12-driver requirement). The `13.1-gpu` build is still beta; only the Radway group has asked for it. See the Gurobi token-server notes in `knowledge/tasks.md`.
- **RELION** was patched to build with **gcc 15** to work around a bug that surfaced under gcc 13 (bug in RELION, not the compiler).
- **fp emulation is a growing reason to move forward**: CUDA 13.2 adds more fp64-emulated capability to cuSOLVERDx. Ken's GEMM microbench on a B200 (16384², 100 iters) — see [[dgx-b200-partition]] for the numbers — showed fp32 emulated (BF16x9) at ~2.24× native and fp64 emulated (fixed-point) at ~1.60× native.

## See also
- [[betty-software-deployment]] — overspack/spack tree, CUDA modules
- [[betty-lmod-architecture]] — module init chain and hierarchy
- [[dgx-b200-partition]] — B200 hardware (cc 10.0, min CUDA 12.8) + fp-emulation GEMM numbers
- [[ryan-bradley]] — owns the spack tree and ahead-of-driver compile strategy
- [[kenneth-chaney]] — driving OS-image compat installs and driver upgrade planning

## Sources
- [[2026-06-18-teams-chats-digest]]
