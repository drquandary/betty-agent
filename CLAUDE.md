# PARCC / Betty Cluster — Claude Code Context

## Who the user is
- **PennKey**: `jvadala`
- Works on the **Betty** cluster at Penn's Advanced Research Computing Center (PARCC)
- Primary workspace: `C:\Users\jeffr\parcc1`

## What Betty is
Betty (`login.betty.parcc.upenn.edu`) is PARCC's HPC/GPU cluster at the University of Pennsylvania. It uses:
- **Slurm** for job scheduling
- **Lmod** (environment modules) for software
- **VAST** for storage (`/vast/home/` and `/vast/projects/`)
- **Kerberos + PennKey + Duo 2FA** for authentication

## Connecting to Betty

### Prerequisites
- On Penn campus OR connected to Penn VPN
- PennKey + Duo 2FA ready
- Kerberos ticket (`kinit jvadala@UPENN.EDU`)

### SSH command
```bash
ssh jvadala@login.betty.parcc.upenn.edu
```

### Windows options (in order of preference)
1. **WSL2** (recommended — Linux-native, includes `kinit`)
2. **MobaXterm** — enable GSSAPI Kerberos, domain `UPENN.EDU`
3. **SecureCRT** — SSH2, GSSAPI Kerberos

### MobaXterm settings
- Remote host: `login.betty.parcc.upenn.edu`
- Username: `jvadala`
- Enable GSSAPI Kerberos, Domain: `UPENN.EDU`

## First things after login
```bash
whoami
hostname
pwd       # expect: /vast/home/j/jvadala
date
```

## Storage layout
| Path | Purpose |
|------|---------|
| `/vast/home/j/jvadala` | Personal configs, code, light data |
| `/vast/projects/<project>` | Shared research/group data |

### Quota tools
```bash
parcc_quota.py                        # overall quota check
parcc_du.py /vast/projects/<project>  # directory-level usage
```

## Modules
```bash
module avail
module spider anaconda3
module load anaconda3
conda env list
```

## Slurm quick reference
```bash
sinfo                                     # cluster state
parcc_sfree.py                            # simplified partition/GPU availability
squeue -u jvadala                         # your jobs
squeue | wc -l                            # total queue depth

# Quick GPU sanity test
srun -p dgx-b200 --gpus=1 -t 00:01:00 nvidia-smi

# Transfer files to project storage
scp <local-file> jvadala@login.betty.parcc.upenn.edu:/vast/projects/<project>
```

## PARCC helper scripts
| Script | Purpose |
|--------|---------|
| `parcc_quota.py` | Storage quota overview |
| `parcc_du.py <path>` | Directory disk usage |
| `parcc_sfree.py` | Available partitions, nodes, GPUs |
| `parcc_sqos.py` | Your QOS limits |
| `parcc_sreport.py --user jvadala` | Usage/billing summary |
| `parcc_sdebug.py --job <JOBID>` | Debug failed jobs |
| `parcc_sdebug.py --node <NODE>` | Debug node issues |

## Access / account notes
- Project membership is managed in **ColdFront** by the PI
- Changes can take up to **1 hour** to propagate
- If login fails, confirm ColdFront membership with your PI first

## Beginner workflows
- **ML/GPU**: Zero to MNIST path
- **Multi-node/MPI**: Zero to MPI path (`mpicc`, `srun --mpi=pmix`, `sbatch`)

## PARCC documentation
- Main: https://parcc.upenn.edu/training/getting-started/
- Login: https://parcc.upenn.edu/training/getting-started/logging-in/
- Windows setup: https://parcc.upenn.edu/training/getting-started/logging-in/windows-setup/
- Tools: https://parcc.upenn.edu/training/getting-started/parcc-tools/

## Good citizenship rules
- Login nodes are for editing, syncing, and submitting — **not training**
- Use interactive allocations only for debugging; release when done
- Check `parcc_quota.py` before large transfers

## Betty AI Agent

This repo includes **Betty AI** — a conversational agent for LLM fine-tuning and inference on Betty.

### Quick start
Invoke the agent: `/agent betty-ai` or just ask about fine-tuning/serving LLMs.

### Project context
See `PROJECT.md` for research-specific info: dataset details, current experiments, team, known issues. **Keep this file updated** — it's the agent's primary context about YOUR work.

## Knowledge base — Karpathy LLM Wiki pattern

This project uses a persistent, agent-maintained wiki:
- **`raw/`** — Immutable source documents (agent reads but never writes here)
- **`wiki/`** — LLM-maintained markdown knowledge base (entities, concepts, models, experiments, sources)
- **`wiki/SCHEMA.md`** — Rules for how the wiki is organized (read this to understand the pattern)
- **`wiki/index.md`** — Catalog of all wiki pages
- **`wiki/log.md`** — Chronological log of ingests, queries, lint passes

### Key commands to the agent
- **"Ingest `raw/docs/foo.md`"** → agent summarizes and files into wiki
- **"What do we know about X?"** → agent searches the wiki first, then answers
- **"Lint the wiki"** → agent checks for orphans, contradictions, stale claims
- **"Start experiment 001"** → agent creates experiment page + Slurm script + submits job

See `wiki/SCHEMA.md` for the full pattern.

### Key files
- `.claude/agents/betty-ai.md` — Agent definition
- `betty-ai/models/model_registry.yaml` — Model VRAM/resource database
- `betty-ai/models/gpu_calculator.py` — Resource allocation calculator
- `betty-ai/configs/betty_cluster.yaml` — Cluster specs (machine-readable)
- `betty-ai/templates/` — Slurm, DeepSpeed, training script templates
- `BETTY_SYSTEM_GUIDE.md` — Full cluster documentation
- `BETTY_LLM_AND_WORKFLOWS_GUIDE.md` — LLM workflow guide

### For new team members
1. Copy `betty-ai/configs/team.yaml.example` to `betty-ai/configs/team.yaml`
2. Fill in your PennKey and project path
3. Run `claude` from this directory and talk to Betty AI
