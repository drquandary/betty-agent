# Betty Cluster — Complete System Guide

> **Last updated**: 2026-04-08 | **Explored by**: jvadala via Open OnDemand shell
> **Cluster**: Betty — PARCC's first university-wide HPC/AI supercomputer at the University of Pennsylvania

---

## 1. System Overview

| Property | Value |
|----------|-------|
| **OS** | Ubuntu 24.04.4 LTS (Noble Numbat) |
| **Slurm version** | 24.11.7 |
| **Scheduler** | sched/backfill, 30-sec time slices |
| **OnDemand** | Open OnDemand 4.1.4 (BETA) at `ood.betty.parcc.upenn.edu` |
| **Storage** | VAST (InfiniBand-attached NFS) |
| **Interconnect** | InfiniBand (ibp180s0, MTU 4000) |
| **Login nodes** | login01, login02 — Intel Xeon Gold 6548Y+ (128 CPUs, 503 GB RAM) |
| **Max jobs** | 100,000 cluster-wide; MaxArraySize = 15,001 |

---

## 2. Hardware — Compute Partitions

### 2.1 GPU Partitions

#### dgx-b200 (Main GPU partition)
| Property | Value |
|----------|-------|
| **Nodes** | 27 (dgx001–dgx027) |
| **CPUs/node** | 224 (2 sockets, 56 cores/socket, 2 threads/core) |
| **RAM/node** | ~202 GB (206,391 MB) |
| **GPUs/node** | 8x NVIDIA B200 |
| **Total GPUs** | 216 |
| **Max nodes/job** | 8 |
| **Max walltime** | 7 days |
| **Default walltime** | 1 hour |
| **Default per GPU** | 28 CPUs, ~224 GB memory |
| **Allowed QOS** | normal, dgx, wharton, gpu-max |
| **Billing weight** | CPU=35.7, GPU=1000 |

#### b200-mig45 (MIG 45GB slices)
| Property | Value |
|----------|-------|
| **Nodes** | 1 (dgx028) |
| **GPUs** | 32 MIG slices (45GB each) |
| **Max nodes/job** | 1 |
| **Default per GPU** | 7 CPUs, ~56 GB memory |
| **Allowed QOS** | normal, mig, wharton, mig-max |
| **Billing weight** | GPU=250 |

#### b200-mig90 (MIG 90GB slices)
| Property | Value |
|----------|-------|
| **Nodes** | 1 (dgx029) |
| **GPUs** | 16 MIG slices (90GB each) |
| **Max nodes/job** | 1 |
| **Default per GPU** | 7 CPUs (est.) |
| **Allowed QOS** | normal, mig, wharton, mig-max |
| **Billing weight** | GPU=500 |

### 2.2 CPU Partitions

#### genoa-std-mem (Default partition)
| Property | Value |
|----------|-------|
| **Nodes** | 64 (epyc-1-[1-11], epyc-2-[1-8], ..., epyc-6-[1-10]) |
| **CPU** | AMD EPYC Genoa, 64 cores/node (2 sockets, 32 cores/socket) |
| **RAM/node** | ~340 GB (347,851 MB) |
| **Max nodes/job** | 15 |
| **Max walltime** | 7 days |
| **Default memory** | 5,120 MB/CPU (max 6,144 MB/CPU) |
| **Allowed QOS** | normal, genoa-std, wharton, cpu-max |
| **Billing weight** | CPU=10 |

#### genoa-lrg-mem (Large memory)
| Property | Value |
|----------|-------|
| **Nodes** | 10 (epyc-lg-[1-10]) |
| **CPU** | AMD EPYC Genoa, 64 cores/node |
| **RAM/node** | ~1 TB (104,458 MB per... likely 1,044 GB) |
| **Max nodes/job** | 2 |
| **Max walltime** | 7 days |
| **Default memory** | 15,872 MB/CPU (max 18,432 MB/CPU) |
| **Allowed QOS** | normal, genoa-lrg, wharton |
| **Billing weight** | CPU=15 |

---

## 3. QOS (Quality of Service) Limits

Your account (`jcombar1-betty-testing`) has access to these QOS levels:

| QOS | Max CPUs | Max GPUs | Max Mem | Max Jobs | Use Case |
|-----|----------|----------|---------|----------|----------|
| **normal** | 160 | 8 | — | — | Default, general use |
| **dgx** | — | 32 | — | — | Large GPU jobs |
| **genoa-std** | 640 | — | — | — | CPU-only standard |
| **genoa-lrg** | 128 | — | — | — | Large-memory CPU |
| **cpu-max** | 960 | — | — | — | Maximum CPU allocation |
| **gpu-max** | — | 40 | — | — | Maximum GPU allocation |
| **mig** | — | 8 | — | — | MIG GPU slices |
| **mig-max** | — | 40 | — | — | Maximum MIG allocation |

**Special QOS** (likely PI/group-specific):
- `wharton` — Wharton School allocation
- `icml-2026` — Conference deadline allocation

### Billing
- **Units**: PC minutes (billing converted to PC)
- **Your allocation**: 12,000 PC (used 27.64 PC = 0.2%)
- **Billing window**: Monthly (2026-04-01 to present)

---

## 4. Storage

### 4.1 Filesystem Layout

| Mount | Filesystem | Total | Used | Purpose |
|-------|-----------|-------|------|---------|
| `/vast/home` | InfiniBand VAST NFS | 14 TB | 44% | User home directories |
| `/vast/projects` | InfiniBand VAST NFS | 1.8 PB | 49% | Project/group shared data |

### 4.2 Your Storage

| Path | Quota | Used | INodes | State |
|------|-------|------|--------|-------|
| `/vast/home/j/jvadala` | 50 GB | 5.67 KB | 10 / 250K | OK |

### 4.3 Storage Best Practices
- **Home** (`/vast/home/j/jvadala`): configs, code, light data — 50 GB limit
- **Projects** (`/vast/projects/<name>`): shared research data, large datasets — PI-managed quotas
- Check quotas: `parcc_quota.py`
- Check directory usage: `parcc_du.py /vast/projects/<project>`
- **No scratch/tmp filesystem** was observed — use project storage for working data

---

## 5. Software Environment

### 5.1 Module System (Lmod)

Pre-loaded modules: `gcc/13.3.0`, `helpers/0.0.1`, `lua/5.3.6`

```bash
module avail              # List all available modules
module spider <name>      # Search for a module
module load <name>        # Load a module
module list               # Show loaded modules
module purge              # Unload all modules
```

### 5.2 Key Software Available

#### Python
| Version | Module |
|---------|--------|
| 2.7.2–2.7.18 | `python/2.7.x` |
| 3.6.0–3.13.2 | `python/3.x.x` |
| Anaconda3 | `anaconda3/2023.09-0` |

**Note**: PyTorch is NOT available as a module. Use Conda environments instead:
```bash
module load anaconda3/2023.09-0
conda create -n myenv python=3.11 pytorch torchvision torchaudio pytorch-cuda=12.1 -c pytorch -c nvidia
```

#### CUDA
| Versions | Notes |
|----------|-------|
| 11.0–11.6.2 | Legacy support |
| 12.8.1, 12.9.0 | Current production |
| **13.1.0** | Latest available |

#### cuDNN
- `cudnn/8.9.7.29-12`

#### MPI (OpenMPI)
| Versions | Notes |
|----------|-------|
| 1.4.2–1.10.7 | Legacy |
| 2.0.2–2.1.3 | Stable |
| 3.1.0, 3.1.6 | Current (Slurm-compatible) |

#### Containers
- **Apptainer 1.4.1** (requires `gcc/13.3.0`)
```bash
module load gcc/13.3.0
module load apptainer/1.4.1
apptainer pull docker://nvcr.io/nvidia/pytorch:24.01-py3
```

#### Compilers
- GCC 13.3.0 (default)
- AOCC 5.0.0 (AMD Optimizing C/C++ Compiler)

#### Build Tools
- CMake 3.31.6
- Bazel 6.5.0
- Autoconf 2.72, Automake 1.16.5

#### Other Notable Software
- `bowtie/1.3.1` (bioinformatics)
- `bbmap/39.01` (bioinformatics)
- `bcftools/1.21` (genomics)
- Boost 1.88.0
- `vina-cuda` (molecular docking)
- Many `py-*` packages (matplotlib, numpy ecosystem via Spack)

---

## 6. PARCC Helper Tools

Located in `/vast/parcc/sw/bin/`:

| Tool | Purpose | Example |
|------|---------|---------|
| `parcc_quota.py` | Check your storage quotas | `parcc_quota.py` |
| `parcc_du.py` | Directory disk usage | `parcc_du.py /vast/projects/<proj>` |
| `parcc_sfree.py` | Available partitions, nodes, GPUs | `parcc_sfree.py` |
| `parcc_sqos.py` | Your QOS limits and current usage | `parcc_sqos.py` |
| `parcc_sreport.py` | Usage/billing summary | `parcc_sreport.py --user jvadala` |
| `parcc_sdebug.py` | Debug failed jobs or nodes | `parcc_sdebug.py --job <JOBID>` |
| `parcc_free.py` | Free resources overview | `parcc_free.py` |
| `interact` | Quick interactive session | `interact` (defaults: 1 core, 30 min) |
| `betty-jupyter.sh` | Launch Jupyter on compute node | `betty-jupyter.sh` |
| `spackon` / `p-spackon` | Spack package management | `spackon` |
| `lmod` | Module management helper | `lmod` |

---

## 7. Open OnDemand (Web Portal)

**URL**: `https://ood.betty.parcc.upenn.edu`
**Status**: BETA (v4.1.4)
**Auth**: PennKey + Duo 2FA (SSO via Penn WebLogin)

### Available Features

| Feature | Location | Description |
|---------|----------|-------------|
| **Betty Shell Access** | Clusters menu | Web-based SSH terminal |
| **System Status** | Clusters menu | Cluster health dashboard |
| **Interactive Desktop** | Interactive Apps | Full GUI desktop on compute node |
| **Active Jobs** | Jobs menu | Monitor/manage running jobs |
| **My Interactive Sessions** | Top nav | Manage OOD sessions |

### What's Missing (Opportunities for Improvement)
- No JupyterLab/Notebook app (use `betty-jupyter.sh` CLI instead)
- No RStudio app
- No VS Code Server app
- No file browser (common in other OOD installations)
- Limited interactive apps — only desktop so far

---

## 8. Access & Authentication

### Methods
1. **SSH** (primary): `ssh jvadala@login.betty.parcc.upenn.edu`
   - Requires Kerberos ticket (`kinit jvadala@UPENN.EDU`) or password auth
   - Duo 2FA required
2. **Open OnDemand** (web): `https://ood.betty.parcc.upenn.edu`
   - PennKey + Duo via browser
   - Shell, desktop, job management

### Prerequisites
- Penn campus network or VPN
- Active ColdFront allocation (managed by PI)
- PennKey credentials
- Duo 2FA device

---

## 9. Job Submission Quick Reference

### Interactive GPU Session
```bash
# Quick test — 1 GPU, 30 minutes
srun -p dgx-b200 --gpus=1 -t 00:30:00 --pty bash

# With specific resources
srun -p dgx-b200 --gpus=2 -c 56 --mem=100G -t 02:00:00 --pty bash
```

### Batch Job Script Template
```bash
#!/bin/bash
#SBATCH --job-name=my-job
#SBATCH --partition=dgx-b200
#SBATCH --gpus=1
#SBATCH --cpus-per-task=28
#SBATCH --mem=224G
#SBATCH --time=04:00:00
#SBATCH --output=logs/%j.out
#SBATCH --error=logs/%j.err

module load cuda/12.9.0
module load anaconda3/2023.09-0
conda activate myenv

python train.py
```

### MIG GPU Job
```bash
# Single MIG slice (45GB VRAM)
srun -p b200-mig45 --gpus=1 -t 01:00:00 --pty bash

# Single MIG slice (90GB VRAM)
srun -p b200-mig90 --gpus=1 -t 01:00:00 --pty bash
```

### CPU-Only Job
```bash
#SBATCH --partition=genoa-std-mem
#SBATCH --nodes=1
#SBATCH --ntasks=64
#SBATCH --mem=300G
#SBATCH --time=24:00:00
```

### Large Memory Job
```bash
#SBATCH --partition=genoa-lrg-mem
#SBATCH --nodes=1
#SBATCH --ntasks=64
#SBATCH --mem=900G
#SBATCH --time=12:00:00
```

### Multi-Node GPU Job
```bash
#SBATCH --partition=dgx-b200
#SBATCH --nodes=2
#SBATCH --gpus-per-node=8
#SBATCH --ntasks-per-node=8
#SBATCH --cpus-per-task=28
#SBATCH --time=24:00:00
#SBATCH --qos=dgx

srun torchrun --nproc_per_node=8 --nnodes=2 train.py
```

### Job Monitoring
```bash
squeue -u jvadala                    # Your jobs
squeue -u jvadala -o "%.18i %.9P %.30j %.8u %.8T %.10M %.9l %.6D %R"  # Detailed
scancel <JOBID>                      # Cancel a job
scontrol show job <JOBID>            # Job details
sacct -j <JOBID> --format=JobID,Elapsed,MaxRSS,MaxVMSize,State  # Post-job stats
```

---

## 10. Network & Architecture

### Login Nodes
- **CPU**: Intel Xeon Gold 6548Y+ (Emerald Rapids)
  - 2 sockets, 32 cores/socket, 2 threads/core = 128 logical CPUs
  - Max clock: 4.1 GHz
  - AVX-512 support
- **RAM**: 503 GB
- **Network**:
  - 2x Ethernet (eno8303, eno8403) — 1500 MTU, DOWN (management)
  - 2x Ethernet (eno12399np0, eno12409np1) — 9000 MTU, bonded (bond0)
  - 1x InfiniBand (ibp180s0) — 4000 MTU, UP (storage + MPI)

### DGX B200 Nodes (dgx001–dgx027)
- 224 CPUs per node
- ~202 GB RAM per node
- 8x NVIDIA B200 GPUs per node
- InfiniBand interconnect

### EPYC CPU Nodes
- AMD EPYC Genoa processors
- 64 cores per node
- Standard: ~340 GB RAM
- Large memory: ~1 TB RAM

---

## 11. Current Cluster Usage Snapshot (2026-04-08)

- **Total jobs in queue**: ~406
- **dgx-b200**: Most nodes in "mixed" state (partially allocated)
  - 5 nodes idle (dgx023–dgx027)
  - 1 node down (dgx015)
  - 1 node invalid (dgx022 — GRES count issue)
- **genoa-std-mem**: Many nodes idle, some allocated
- **genoa-lrg-mem**: Almost all idle
- **Active users**: zchen959, ccb, rakshrma, zysong, seh1205, singhalp, jiaheng, ryb, viveksh, and others

---

## 12. Workflow Recommendations

### For ML/Deep Learning Users
1. Start with MIG slices for development (`b200-mig45` or `b200-mig90`)
2. Scale to full B200 GPUs on `dgx-b200` for training
3. Use `--qos=dgx` for multi-GPU jobs (up to 32 GPUs)
4. Use `--qos=gpu-max` for up to 40 GPUs

### For CPU-Heavy Workloads
1. Default to `genoa-std-mem` (it's the default partition)
2. Use `genoa-lrg-mem` only when you need >340 GB RAM
3. Max 15 nodes on genoa-std, 2 nodes on genoa-lrg

### For Bioinformatics
- Genoa CPU nodes with large memory for alignment, assembly
- MIG slices for GPU-accelerated tools (GROMACS, AlphaFold)

### General Best Practices
- **Don't train on login nodes** — use `srun` or `sbatch`
- Check availability first: `parcc_sfree.py`
- Check your limits: `parcc_sqos.py`
- Monitor billing: `parcc_sreport.py --user jvadala`
- Debug failures: `parcc_sdebug.py --job <JOBID>`
- Release interactive sessions when done
- Use `--time` wisely — shorter jobs get scheduled faster (backfill)

---

## 13. Key URLs & Contacts

| Resource | URL/Contact |
|----------|-------------|
| PARCC Documentation | https://parcc.upenn.edu |
| Open OnDemand | https://ood.betty.parcc.upenn.edu |
| ColdFront (allocations) | https://coldfront.parcc.upenn.edu |
| Support | https://parcc.upenn.edu/support |
| SSH Login | `login.betty.parcc.upenn.edu` |

---

## 14. Known Issues & Observations

1. **OOD is BETA** — expect configuration changes; report issues at parcc.upenn.edu/support
2. **`interact` script** uses partition "defq" which doesn't seem to exist (fails with "Invalid node name")
3. **dgx015** is down ("Node was stopped by")
4. **dgx022** has GRES/GPU count reporting issue
5. **PyTorch not available as module** — must use Conda or containers
6. **Limited OOD interactive apps** — only Interactive Desktop; no JupyterLab, RStudio, or VS Code
7. **MIG nodes** are single-node only — no multi-node MIG jobs
8. **No observed scratch filesystem** — all working data goes to VAST

---

## Appendix A: Node Inventory

### DGX B200 Nodes
| Node | Partition | CPUs | Memory (MB) | GPUs | State |
|------|-----------|------|-------------|------|-------|
| dgx001–dgx027 | dgx-b200 | 224 | 206,391 | 8 | mixed/idle |
| dgx028 | b200-mig45 | 224 | 185,752 | 32 (MIG) | mixed |
| dgx029 | b200-mig90 | 224 | 185,752 | 16 (MIG) | mixed |

### EPYC Standard Memory Nodes
| Nodes | Partition | CPUs | Memory (MB) | Count |
|-------|-----------|------|-------------|-------|
| epyc-1-[1-11] | genoa-std-mem | 64 | 347,851 | 11 |
| epyc-2-[1-8] | genoa-std-mem | 64 | 347,851 | 8 |
| epyc-3-[1-11]* | genoa-std-mem | 64 | 347,851 | ~11 |
| epyc-4-[2-11] | genoa-std-mem | 64 | 347,851 | ~10 |
| epyc-5-[1-10] | genoa-std-mem | 64 | 347,851 | 10 |
| epyc-6-[1-10] | genoa-std-mem | 64 | 347,851 | 10 |

### EPYC Large Memory Nodes
| Nodes | Partition | CPUs | Memory (MB) | Count |
|-------|-----------|------|-------------|-------|
| epyc-lg-[1-10] | genoa-lrg-mem | 64 | 104,458* | 10 |

*Note: 104,458 MB seems low for "large memory" — may be a reporting artifact; likely ~1 TB actual*

### Total Cluster Resources
| Resource | Count |
|----------|-------|
| DGX B200 nodes | 29 (27 full + 2 MIG) |
| EPYC CPU nodes | ~64 standard + 10 large |
| Total B200 GPUs | 216 full + 32 MIG-45 + 16 MIG-90 |
| Total CPU cores | ~11,000+ |
