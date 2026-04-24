---
type: entity
tags: [people, parcc, director, ryb, gromacs, molecular-dynamics]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-07-ryb-ood-bc-desktop-investigation, 2026-04-10-ryb-overspack-deployment-docs]
related: [betty-cluster, gromacs-on-betty, betty-software-deployment, open-ondemand-betty, vast-storage]
status: current
---

# Ryan Bradley (ryb)

## One-line summary
Director at PARCC; drives Betty's software-deployment stack (overspack, lmod layout) and is the stakeholder for bringing molecular-dynamics workloads — starting with GROMACS — onto the cluster.

## Role
- **Director, PARCC** (Penn's Advanced Research Computing Center)
- Primary Betty PennKey: `ryb`
- Admin-level access (SSH to `ood01` observed in [[2026-04-07-ryb-ood-bc-desktop-investigation]], overspack maintainership in [[2026-04-10-ryb-overspack-deployment-docs]])
- Project path: `/vast/projects/ryb/parcc-data-science` (and a provisioned-but-empty `/ceph/projects/ryb/parcc-data-science`)

## What ryb owns on Betty
- **overspack** — PARCC's Spack overlay and deployment tooling. See [[betty-software-deployment]] and the overspack docs source.
- **lmod/software stack** — the 26.1.zen4 deployment is his; lmod cache regeneration is on his plate (open thread from the 2026-04-16 handoff).
- **OOD debugging** — observed investigating `bc_desktop` failures on `ood01` ([[ood-troubleshooting]]).

## GROMACS push
As of 2026-04-21, ryb is the sponsor for getting GROMACS to first-class status on Betty. See [[gromacs-on-betty]] for the workflow concept page and `betty-ai/templates/slurm/gromacs_mdrun.sbatch.j2` for the ready-to-run Slurm template.

Open items for ryb specifically:
1. Confirm whether a `gromacs` module will ship via overspack or whether users should rely on the NGC container.
2. Provide a blessed benchmark set (likely `benchMEM` / `benchRIB` from the Max Planck suite) for acceptance testing.
3. Identify which project account(s) the MD group should bill against — see [[betty-billing-model]].
4. Decide retention policy for trajectory files on VAST vs Ceph.

## Storage notes (from audits)
- `/vast/home/r/ryb` — inode usage was at **88%** on 2026-04-07; watch this, especially if GROMACS trajectories ever land in `$HOME`.
- `/ceph/projects/ryb/parcc-data-science` exists but was empty as of 2026-04-07 — candidate location for large trajectory archives.

## Contacting / working with ryb
- Admin-side ops discussions typically happen in the PARCC ops chat (see [[2026-04-21-parcc-ops-discussion]] for an example transcript format).
- For deployment requests (new module, new container), route through the overspack workflow he maintains.

## See also
- [[betty-cluster]]
- [[gromacs-on-betty]]
- [[betty-software-deployment]]
- [[open-ondemand-betty]]

## Sources
- [[2026-04-07-ryb-ood-bc-desktop-investigation]]
- [[2026-04-10-ryb-overspack-deployment-docs]]
