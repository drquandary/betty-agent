# PARCC Knowledge Tree

Compiled on 2026-04-08 from the PARCC "Getting Started" guide and directly linked child pages so this workspace has a reusable local reference for future PARCC help.

Primary scope:
- Getting Started: <https://parcc.upenn.edu/training/getting-started/>
- Logging In / Windows Setup
- Looking Around
- Zero to MNIST
- Zero to MPI
- PARCC Tools

## 1. Core mental model

PARCC in this training path is centered on the Betty cluster. A new researcher typically needs to:

1. Be added to the correct project in ColdFront by their PI.
2. Wait up to an hour for account/project membership to propagate.
3. Authenticate to `login.betty.parcc.upenn.edu` with Penn credentials, Kerberos, and 2FA.
4. Learn the storage layout, module system, and Slurm basics.
5. Pick an initial workflow:
   - ML path: Zero to MNIST
   - HPC/MPI path: Zero to MPI

Important dependency:
- Researchers do not self-provision project access; the PI/project admin controls project membership.
- Non-Penn collaborators need a Guest PennKey request before project addition.

## 2. Access and prerequisites

### Faculty / PI
- Start at Faculty Info / ColdFront-related guidance.
- PI is responsible for adding researchers to the proper project(s).

### Researchers
- Need project membership in ColdFront before normal use.
- Access changes may take up to an hour to become active.

### External collaborators
- Need a Guest PennKey arranged through the PI and the relevant Local Support Provider.

## 3. Authentication and connection

### Primary login target
- Host: `login.betty.parcc.upenn.edu`

### Connection expectations
- Be on campus or on Penn VPN before connecting.
- Kerberos + PennKey + Duo 2FA are part of the login flow in the Windows docs.

### Windows-specific path
- Supported options include WSL2, MobaXterm, and SecureCRT.
- If not using WSL, install MIT Kerberos for Windows.
- WSL2 is recommended as a Linux-native environment and includes `kinit`.

### Windows setup details
- MobaXterm:
  - Enable GSSAPI Kerberos
  - Domain: `UPENN.EDU`
  - Remote host: `login.betty.parcc.upenn.edu`
  - Username: PennKey
- SecureCRT:
  - Protocol: `SSH2`
  - Hostname: `login.betty.parcc.upenn.edu`
  - Username: PennKey

## 4. First orientation after login

### Identity / location checks
- `whoami`
- `hostname`
- `pwd`
- `date`

Typical home path example from docs:
- `/vast/home/c/<PennKey>`

### Filesystem model
- Home: personal configs, code, light data.
- Projects: shared group research space.
- Example shared storage namespace: `/vast/projects/<your-project>`

### Data transfer
- Basic SCP pattern:
  - `scp <local-file> <PennKey>@login.betty.parcc.upenn.edu:/vast/projects/<your-project>`

## 5. Storage and quota management

### Built-in helper tools
- `parcc_quota.py`
  - Shows quota usage across storage pools such as home, project space, and Ceph-related storage.
  - Use before large transfers or job submissions.
- `parcc_du.py /vast/projects/<your-project>`
  - Directory-level usage report for finding large folders and cleanup targets.

### Storage practice
- Use project storage for shared or research data.
- Use home for code, configuration, and lighter personal working data.
- If space gets tight, inspect with `parcc_quota.py` and `parcc_du.py`.

## 6. Software environment model

Betty uses Lmod / environment modules.

### Discovery
- `module avail`
- `module spider anaconda3`

### Inspect and load
- `module show anaconda3`
- `module load anaconda3`

### Python environment guidance
- `conda env list`
- `conda create -n tutorial`

Best practice from docs:
- Keep project-specific packages in your own environments.
- Avoid `pip install --user` into the shared/system Python.

## 7. Slurm operational basics

### Quick cluster state
- `sinfo`
- `parcc_sfree.py`

Note:
- The docs also mention `parcc_free.py` in Looking Around, but the dedicated tools page documents `parcc_sfree.py`. Treat `parcc_sfree.py` as the current named utility unless the cluster shell shows an alias.

### Inspect your jobs
- `squeue -u $USER`
- `squeue | wc -l`

### Minimal GPU sanity test
- `srun -p dgx-b200 --gpus=1 -t 00:01:00 nvidia-smi`

### Good citizenship
- Login nodes are for editing, syncing, and submitting jobs, not training.
- Use small interactive allocations for debugging.
- Release interactive resources when done.

## 8. PARCC Slurm helper tools

### Resource availability
- `parcc_sfree.py`
  - Simplified snapshot of partitions, nodes, GPUs, and memory state.

### QOS inspection
- `parcc_sqos.py`
  - Shows which QOS options your account/project can use and their limits.
  - Useful for matching `sbatch` requests to allowed QOS ceilings.

### Usage reporting
- `parcc_sreport.py [--user YOUR_PennKey]`
  - Summarizes recent job usage and helps with allocation/billing awareness.

### Debugging
- `parcc_sdebug.py [--node NODENAME] [--job JOBID]`
  - Gives deeper job/node diagnostics for failures, preemption, or node health issues.

## 9. Recommended beginner pathways

### Path A: Zero to MNIST

Purpose:
- First end-to-end ML training workflow on Betty.

What it likely covers in the getting-started path:
- Log in
- Prepare environment
- Launch a simple training job
- Learn the Slurm/job-output loop

Use this when:
- The project is deep learning or GPU training oriented.
- You want a low-friction example before adapting to your own code.

### Path B: Zero to MPI

Purpose:
- First MPI workflow on Betty.

Observed concepts from the page:
- Build MPI examples with `mpicc`
- Run with `srun --mpi=pmix`
- Submit CPU and DGX variants with `sbatch`
- Watch job output with `tail -f slurm-<JobID>.out`
- On DGX nodes, set UCX/network environment variables to use the correct compute fabric interfaces

Representative commands from the docs:
- `mpicc -O2 -o hello_mpi_dgx hello_mpi.c`
- `srun --mpi=pmix ./hello_mpi_dgx`
- `sbatch mpi_genoa.sbatch`
- `sbatch mpi_dgx.sbatch`

Expected signal:
- Hello-world ranks print correctly.
- Ping-pong latency should be under 10 microseconds.

## 10. Practical troubleshooting map

### Command not found
- Check `module spider <tool>`
- Load the appropriate module

### Job will not start
- Verify account / partition / QOS
- Check `squeue`
- Check `scontrol show job <JOBID>`
- Use `parcc_sqos.py` for limits and `parcc_sfree.py` for available capacity

### Disk full or quota pressure
- Run `parcc_quota.py`
- Run `parcc_du.py <path>`
- Remove caches and temp files
- Move shared datasets into project storage

### Unexpected job failure
- Use `parcc_sdebug.py --job <JOBID>`
- If node-specific, inspect `parcc_sdebug.py --node <NODENAME>`

## 11. Concept graph (human-readable)

- PARCC
  - hosts -> Betty
  - uses -> ColdFront for project membership
  - teaches -> Getting Started
- Getting Started
  - requires -> PI/project membership
  - leads to -> Logging In
  - leads to -> Looking Around
  - branches to -> Zero to MNIST
  - branches to -> Zero to MPI
  - references -> PARCC Tools
- Logging In
  - targets -> `login.betty.parcc.upenn.edu`
  - depends on -> PennKey
  - depends on -> Kerberos
  - depends on -> Duo / 2FA
- Looking Around
  - explains -> Home storage
  - explains -> Project storage
  - explains -> Modules
  - explains -> Slurm basics
- Storage
  - inspected by -> `parcc_quota.py`
  - inspected by -> `parcc_du.py`
- Slurm
  - inspected by -> `sinfo`
  - inspected by -> `squeue`
  - assisted by -> `parcc_sfree.py`
  - constrained by -> QOS
  - diagnosed by -> `parcc_sdebug.py`
- QOS
  - inspected by -> `parcc_sqos.py`
- Usage reporting
  - generated by -> `parcc_sreport.py`
- Zero to MPI
  - uses -> `mpicc`
  - uses -> `srun --mpi=pmix`
  - uses -> `sbatch`
- Zero to MNIST
  - uses -> Slurm
  - uses -> ML training workflow

## 12. Working assumptions I should keep for future PARCC help

- Default cluster in this training material is Betty.
- User identity and project/account details matter for almost every Slurm answer.
- Correct account, partition, QOS, and storage path are frequent failure points.
- PARCC provides cluster-specific helper scripts beyond stock Slurm commands.
- For beginners, the fastest route is usually:
  - confirm project membership
  - confirm login
  - confirm storage path
  - inspect available partitions / QOS
  - test with a minimal interactive or hello-world job

## 13. Source URLs

- <https://parcc.upenn.edu/training/getting-started/>
- <https://parcc.upenn.edu/training/getting-started/logging-in/>
- <https://parcc.upenn.edu/training/getting-started/logging-in/windows-setup/>
- <https://parcc.upenn.edu/training/getting-started/looking-around/>
- <https://parcc.upenn.edu/training/getting-started/zero-to-mnist/>
- <https://parcc.upenn.edu/training/getting-started/zero-to-mpi/>
- <https://parcc.upenn.edu/training/getting-started/parcc-tools/>
