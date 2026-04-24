---
type: concept
tags: [gromacs, md, molecular-dynamics, gpu, biomolecular, hpc]
created: 2026-04-21
updated: 2026-04-21
sources: []
related: [ryan-bradley, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, vast-storage, slurm-on-betty, gpu-topology-betty, betty-software-deployment]
status: tentative
---

# GROMACS on Betty

## One-line summary
GROMACS is a GPU-accelerated molecular-dynamics engine; on Betty it maps naturally onto a single B200 (or MIG slice) for most biomolecular systems, with CPU-only runs reserved for energy minimization, small topologies, or Genoa nodes.

## Why GROMACS belongs on Betty
- **B200 GPUs** handle the nonbonded force kernels, PME, and update steps — typical speedups of 10–50× over CPU-only on membrane/protein systems.
- **MIG slices** ([[b200-mig45-partition]], [[b200-mig90-partition]]) are ideal for small systems (<100k atoms) and parameter sweeps — cheaper PC-minutes than a full GPU and usually queue faster.
- **Genoa CPU nodes** ([[genoa-std-mem-partition]]) are appropriate for `gmx grompp`, `gmx trjconv`, analysis (`gmx rms`, `gmx gyrate`), and non-accelerated steps.
- **VAST** ([[vast-storage]]) provides the bandwidth needed for trajectory writes; always write `.xtc` / `.trr` into `/vast/projects/<project>/` not `$HOME`.

## Availability on Betty (verify before relying on)

> **Status: tentative.** This page was written before a confirmed `module spider gromacs` run on Betty post-lmod fix. Before a production run, check:
> ```bash
> module spider gromacs
> module avail gromacs
> ```
> If no module exists, the fallbacks (in order of preference) are:
> 1. NGC container: `nvcr.io/hpc/gromacs:<tag>` via Apptainer/Enroot — see [[betty-software-deployment]] for runtime details.
> 2. Spack install into a project env (ask [[ryan-bradley]] about overspack — see `2026-04-10-ryb-overspack-deployment-docs`).
> 3. Conda: `conda install -c bioconda gromacs` — works but loses CUDA/NCCL tuning.

## Core command shape
```bash
# CPU preprocessing (fast — do this on a login node or genoa-std-mem)
gmx grompp -f md.mdp -c system.gro -p topol.top -o md.tpr -maxwarn 1

# GPU production run (single B200)
gmx mdrun -deffnm md -nb gpu -pme gpu -bonded gpu -update gpu \
          -ntmpi 1 -ntomp $SLURM_CPUS_PER_TASK -pin on
```

Key flags:
- `-nb gpu -pme gpu -bonded gpu -update gpu` — put everything on the GPU that GROMACS ≥ 2023 supports. On B200, `-update gpu` is the big win for small systems because it keeps the integrator on-device between steps.
- `-ntmpi 1 -ntomp N` — one thread-MPI rank, N OpenMP threads. Match `-ntomp` to `--cpus-per-task`.
- `-pin on -pinoffset 0 -pinstride 1` — avoid thread migration; matters on shared Genoa CPUs.
- `-nsteps -1` with `-cpi` for automatic restart from checkpoint on requeue.

## Partition selection cheat-sheet

| System size (atoms)            | Suggested partition              | Why                                              |
|--------------------------------|----------------------------------|--------------------------------------------------|
| < 50k (small peptide, ligand)  | [[b200-mig45-partition]]         | 45 GB plenty; MIG is cheap and queues fast       |
| 50k – 300k (soluble protein)   | [[b200-mig90-partition]]         | 90 GB fits longer cutoffs / larger neighbor list |
| 300k – 2M (membrane, complex)  | [[dgx-b200-partition]] 1 GPU     | Full B200 for throughput, NVLink not yet needed  |
| > 2M (multi-GPU DD)            | [[dgx-b200-partition]] 2–4 GPUs  | Domain decomposition via thread-MPI or MPI       |
| preprocessing / analysis only  | [[genoa-std-mem-partition]]      | No GPU cost; `gmx trjconv`/`gmx rms` are CPU-bound |

## Multi-GPU scaling notes
- GROMACS scales poorly past 4 GPUs for a single replica — **prefer multiple replicas** (array jobs) over pushing one simulation to 8 GPUs.
- For domain decomposition across GPUs on one node, use MPI not thread-MPI: `mpirun -np N gmx_mpi mdrun ...`. See [[gpu-topology-betty]] for NIC affinity if you ever cross nodes (generally don't for GROMACS).
- `-dlb auto` on; `-npme 1` if PME bottlenecks appear in `md.log`.

## Replica / ensemble patterns
- **Independent replicas** → Slurm `--array=1-N`, each task one GPU on `dgx-b200` or a MIG slice. Cleanest for sampling or reruns with different seeds.
- **Replica exchange (REMD)** → `gmx_mpi mdrun -multidir rep00 rep01 ... -replex 1000`. Needs MPI build; all replicas must launch in one job step.
- **Free energy (FEP)** → lambda windows as array tasks; post-process with `gmx bar` on a Genoa node.

## Storage discipline (same rules as any Betty workload)
- `HF_HOME`-style lesson applies: **never** run with default `$HOME` as the working dir — inode caps bite hard ([[vast-storage]]).
- Write trajectories to `/vast/projects/<project>/runs/<exp>/`; keep a compressed `.xtc` stride for sharing, full `.trr` only if needed.
- For very large trajectories, consider per-node local NVMe scratch, then rsync back at job end — see [[gpu-topology-betty]] for the local NVMe RAID.

## Template
A ready-to-use Slurm template lives at `betty-ai/templates/slurm/gromacs_mdrun.sbatch.j2`. Render it with the standard Betty AI variable set plus `tpr_file`, `deffnm`, and `mdrun_extra_flags`.

## Common pitfalls
- **`gmx grompp` warnings** are easy to `-maxwarn` past but frequently hide real issues (mis-parameterized LJ, missing constraints). Treat each warning on its own.
- **`update gpu` + virtual sites / free-energy + constraints** was unsupported in older GROMACS — check your version's release notes.
- **PME on GPU with small boxes** can be slower than CPU PME; benchmark both for your system before committing to long runs.
- **`-pin on` without exclusive CPUs** can fight other jobs — use `--exclusive` only when justified, and match `--cpus-per-task` to what `-ntomp` asks for.

## Validation / benchmarking
When a new GROMACS module/container appears, run the standard PME benchmark set before production:
- `benchMEM` (82k atoms, membrane) — sanity check single-GPU
- `benchPEP` (12k atoms) — small-system latency
- `benchRIB` (2M atoms) — stresses multi-GPU / PME split
Archive `md.log` under `wiki/experiments/` so future users can compare.

## See also
- [[ryan-bradley]] — directing the GROMACS workflow push on Betty
- [[dgx-b200-partition]]
- [[b200-mig45-partition]]
- [[b200-mig90-partition]]
- [[genoa-std-mem-partition]]
- [[vast-storage]]
- [[gpu-topology-betty]]
- [[betty-software-deployment]]

## Sources
<!-- No cited sources yet — page seeded from general GROMACS + Betty cluster knowledge.
     Next ingest should attach a real `module spider gromacs` capture or an NGC container run log. -->
