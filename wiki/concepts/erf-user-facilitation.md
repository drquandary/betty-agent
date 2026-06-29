---
type: concept
tags: [facilitation, ci, hpc-culture, erf, onboarding, github, workflow, betty]
created: 2026-06-16
updated: 2026-06-29
sources: [2026-06-16-teams-chats-digest, 2026-06-29-teams-chats-digest]
related: [betty-cluster, gromacs-on-betty, betty-software-deployment, ryan-bradley, jeffrey-vadala, bhuv-jain]
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

## Role definitions: facilitation vs "AI consultant" vs RSE (2026-06-29)
ryb wants the team **consistent about what each engagement is called**, because the boundary has cost/funding implications:
- **The trigger case:** when Jeffrey **reads a research group's code and helps optimize it** (e.g. the rachitk OOM work — see [[parcc-skills-modules]]), is that **basic facilitation**, an **"AI consultant"** engagement, or **RSE**? If routine facilitation already includes code-optimization, it may **overlap with a *funded* PARCC consulting service** — which is exactly the line ryb wants drawn cleanly.
- **"Consulting" framing:** a **time-limited engagement** with **varying levels of accountability** — from actually building something, to just telling postdocs "do this instead." Jeffrey's read: it fits labs with **tech-savvy postdocs who just need direction** (cited "that kidney group" — postdocs who "didn't need anything really made for them").
- **Resource:** ryb pointed Jeffrey at **USRSE materials** on how other institutions structure these engagements ("pretty thoughtful about how to structure this stuff") — to browse before the [[bhuv-jain]] meeting, which is itself a live test of the classification.
- **Practice ask (carries over from the rachitk thread):** when giving technical advice, **spell out the reasoning/method** so ryb can follow how a conclusion was reached.

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
- [[2026-06-29-teams-chats-digest]] — facilitation vs "AI consultant" vs RSE role definitions; funded-service overlap; USRSE materials; the [[bhuv-jain]] test case
