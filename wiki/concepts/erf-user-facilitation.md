---
type: concept
tags: [facilitation, ci, hpc-culture, erf, onboarding, github, workflow, betty]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest]
related: [betty-cluster, gromacs-on-betty, betty-software-deployment, ryan-bradley, jeffrey-vadala]
status: current
---

# ERF & User Facilitation

## One-line summary
[[jeffrey-vadala]]'s onboarding into cyberinfrastructure (CI) facilitation — the catch-all term for academic HPC user support — anchored by a concrete ERF code-compilation exercise and a shared-repo/branch workflow agreed with [[ryan-bradley]].

## ERF code task
- Goal: **compile the codes that work with ERF** as a "user facilitator" acclimatization exercise.
- Owner: jvadala. Self-imposed timeline: finish mid next week (stated ~2026-06-11).
- Caveat: jvadala must also "crank with the simulation group," who need a prototype out for a grant — and **the grant will pay into PARCC**.
- *Tentative:* ERF is likely the AMReX "Energy Research and Forecasting" model (CPU/GPU exascale code), consistent with Betty's GPU focus — **inferred, not stated in the chat.**

## Working agreement with Ryan (repo/branch workflow)
- ryb prefers **separate directories + a shared GitHub repo testable in complete isolation** — to avoid hardcoding and "naturalizing" a directory structure.
- Branch-and-merge loop: ryb branches → jvadala tests → jvadala branches → ryb tests → merge until the tool works.
- jvadala's repo was initially **private (404 for ryb)**; he fixed access and added ryb as a collaborator. He restarted a more **modular** version from scratch to address ryb's concerns.
- ryb's philosophy: fix/iterate on code even if it never ships — his tinkering-to-producing ratio is ~10:1; "these things require a lot of iteration."

## CI-culture resources ryb recommended
- **Henry Neeman / OSCER Virtual Residency** — free virtual talks, good for academic-HPC lingo: `https://www.oscer.ou.edu/virtualresidency2026.php` (happening the week after ~6/16). Neeman is a national CI-facilitation leader.
- **LLNL HPCIC free tutorials** (Jul–Sep): Spack (Jul 7–8), BLT, Flux, Caliper/Thicket, Axom, Ascent, Benchpark, RAJA/Umpire, MFEM, etc.: `https://hpcic.llnl.gov/tutorials/2026-hpc-tutorials`. ryb specifically advertised the Spack session (relevant to [[betty-software-deployment]]).
- PARCC training pages shared: Multi-Node Training (PyTorch Lightning + Slurm + micromamba) `https://parcc.upenn.edu/training/slurm/multi-node-training/` and Zero-to-MPI `https://parcc.upenn.edu/training/getting-started/zero-to-mpi/`.

## Related onboarding work
- The [[gromacs-on-betty]] 1.5M-water benchmark is a parallel hands-on onboarding exercise ryb assigned — see that page.

## See also
- [[gromacs-on-betty]] — the companion onboarding exercise
- [[betty-software-deployment]] — Spack/overspack context for the tutorials
- [[ryan-bradley]] — mentor and workflow author
- [[jeffrey-vadala]] — owner of the ERF task
- [[betty-cluster]]

## Sources
- [[2026-06-16-teams-chats-digest]] — the ryb facilitation/repo-workflow thread and resource links
