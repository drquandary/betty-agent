---
type: entity
tags: [people, parcc, director, ryb, gromacs, molecular-dynamics]
created: 2026-04-21
updated: 2026-06-29
sources: [2026-04-07-ryb-ood-bc-desktop-investigation, 2026-04-10-ryb-overspack-deployment-docs, 2026-06-16-teams-chats-digest, 2026-06-29-teams-chats-digest]
related: [betty-cluster, gromacs-on-betty, betty-software-deployment, open-ondemand-betty, vast-storage, slurm-cli-filter, kerberos-ssh-macos-fix, erf-user-facilitation, jeffrey-vadala]
status: current
---

# Ryan Bradley (ryb)

## One-line summary
Director at PARCC; drives Betty's software-deployment stack (overspack, lmod layout) and is the stakeholder for bringing molecular-dynamics workloads — starting with GROMACS — onto the cluster.

## Role
- **Director, PARCC** (Penn's Advanced Research Computing Center)
- Primary Betty PennKey: `ryb`
- **GitHub username: `bradleyrp`** (confirmed 2026-06-29). Jeffrey tried to add him as a collaborator on [[parcc-skills-modules|ParccSkills]] but the invite failed ("it wont let me add you") — unresolved as of 6/29.
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

## Facilitation work with jvadala (Teams, June 2026)
ryb mentors [[jeffrey-vadala]] on user facilitation and owns several threads from the [[2026-06-16-teams-chats-digest]]:
- **[[slurm-cli-filter]]** — ryb owns the Lua `cli_filter`; jvadala found a `--mem`-propagation bug, ryb is patching it (prevent `--mem` propagating unless it disagrees with `--mem-per-cpu`, add a test, then jvadala retests). ryb wants it solid before [[jaime-combariza]] tests heavily; recommends putting the invocation in `~/.bashrc`.
- **GROMACS onboarding** — ryb completed a 1.5M-water-molecule compile-and-run exercise himself and wants jvadala to do the same *without AI assistance* because it covers cluster basics and generalizes. Benchmark data at `https://ftp.gromacs.org/pub/benchmarks/`. See [[gromacs-on-betty]].
- **Repo/branch workflow** — prefers separate directories + a shared GitHub repo testable in complete isolation, with a branch-and-merge loop; tinkering:producing ratio ~10:1. See [[erf-user-facilitation]].
- **macOS Kerberos SSH** — co-diagnosed the Heimdal-vs-MIT failures and maintains the diagnostic checklist; see [[kerberos-ssh-macos-fix]].
- **Schedule note:** conference Tue–Wed (week of 6/15), then **PTO 19–25 June 2026**; was busy on the "Zahn" project.
- **AI-coding views (2026-06-29):** uses opencode for **Q&A → markdown/diffs he implements himself**, finds fully-agentic flows "too hands-off." Wary of LLM-tool "debt" — fine-tooth-combs output; notes that in **long conversations (>80K tokens) important instructions get dropped even before compaction**, and that `CLAUDE.md` formatting rules fell off the context window in his ORM work. Open to a **co-developed fall workshop "using GLM 5.2 and AI Coders"** (Jeffrey's pitch) and to **assisting with a tutorial** for an MWE/check-your-work skill. See [[parcc-skills-modules]].

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
- [[slurm-cli-filter]]
- [[kerberos-ssh-macos-fix]]
- [[erf-user-facilitation]]
- [[jeffrey-vadala]]

## Sources
- [[2026-04-07-ryb-ood-bc-desktop-investigation]]
- [[2026-04-10-ryb-overspack-deployment-docs]]
- [[2026-06-16-teams-chats-digest]] — CLI-filter bug, GROMACS onboarding, branch/PR workflow, Kerberos diagnostics
- [[2026-06-29-teams-chats-digest]] — role definitions, rachitk harness, GitHub `bradleyrp`, AI-coding views, fall-workshop idea
