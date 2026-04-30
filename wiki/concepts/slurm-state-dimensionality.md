---
type: concept
tags: [betty, slurm, tres, scheduling, dimensionality, betty-agent, observability]
created: 2026-04-27
updated: 2026-04-27
status: current
related: [betty-billing-model, slurm-select-type-parameters, slurm-gres-conf, slurm-node-state-modifiers]
---

# SLURM state dimensionality (and what Betty agent sees of it)

## One-line summary
SLURM models everything as **TRES** (Trackable Resources). The scheduler's live state at any moment is a vector across {nodes × resources × jobs × accounts × reservations × time}. Betty agent currently captures a small slice of that — this page is the honest map of what's wired up vs. what isn't.

## Why this matters
When a user asks the agent "why is my job pending?" or "when can I run this?", the quality of the answer depends on which of these dimensions Betty can actually see. If a dimension isn't captured, the agent has to guess — and on Sonnet/Opus, guessing tends to look confident, which is worse than admitting ignorance. The contract in [system-prompt.ts](../../betty-ai-web/src/agent/system-prompt.ts) explicitly tells the model what each `slurm_*` tool sees and forbids inventing more.

## The TRES model
Every SLURM-managed resource lives along one of these axes:

- **cpu** — physical/hyperthreaded cores
- **mem** — bytes
- **gres/gpu:<type>** — typed GPUs (b200, b200_mig45_g, b200_mig90_g, …)
- **node** — whole-node count (relevant for billing)
- **billing** — per-partition synthetic TRES; what Slurm charges against the account
- **license/<name>** — software licenses (none on Betty currently)
- **energy** — Watt-hours (not enabled on Betty)

A pending job is a request vector across these. A running job consumes a vector. A node advertises a vector of capacity and a vector of currently-allocated. The scheduler's job: pack request vectors into capacity vectors, subject to per-account / per-QOS / per-partition ceilings.

## State dimensions and Betty's coverage

| Dimension | Source command(s) | Cadence | Why it matters | Captured? |
|---|---|---|---|---|
| Partition geometry (CPUs/node, GPUs/node, memory, GRES types) | `scontrol show partition`, `sinfo` | once/day (static) | constants for the constraint solver in [solver.py](../../betty-ai/slurm_advisor/solver.py) | ✅ in [betty_cluster.yaml](../../betty-ai/configs/betty_cluster.yaml) |
| QOS caps (max GPUs, max CPUs, max wall, GrpTRESMins) | `sacctmgr show qos -p` | once/day | hard caps for [policy.py](../../betty-ai/slurm_advisor/policy.py) | ⚠️ **static in YAML, not refreshed live** |
| Per-partition idle GPUs (live) | `sinfo -h -o '%P\|%D\|%T\|%G'` | per call | "is the cluster open right now?" | ✅ via [slurm-availability.ts](../../betty-ai-web/src/agent/tools/slurm-availability.ts) |
| Per-node state (idle/mix/alloc/drain/down + drain reason) | `sinfo`, `scontrol show node -d` | every 1–5 min | which specific nodes are flaky; multi-node placement | ⚠️ parser exists in [scheduling/parsers.py](../../betty-ai/scheduling/parsers.py), **not wired into the advisor** |
| Live queue (PD jobs ahead of you, request vectors, priorities) | `squeue -h --start -t PD -o '%i\|%P\|%S'` | per call | "you're #4 in line, est start 6 PM" | ✅ as of 2026-04-27 — feeds `next_start_by_partition` and `pending_jobs_by_partition` |
| Priority decomposition (age, fairshare, jobsize, partition, qos, tres factors) | `sprio -hl -j <id>` | per diagnose call | answers "why is **my** job ranked where it is" beyond `Reason=Resources` | ❌ |
| Account fairshare + live usage vs cap | `sshare -h -P -U -o "Account,User,RawShares,RawUsage,EffectvUsage,FairShare"` | per recommend call | "your account has X budget left this period; this job costs Y" | ✅ as of 2026-04-27 — surfaced in recommend card |
| Reservations / maintenance windows | `scontrol show res` | every 15 min | real blackouts in the calendar (currently the calendar treats blackouts as `[]` unless explicitly passed) | ⚠️ parser exists, **not auto-fed to availability** |
| Backfill scheduler health (last cycle time, depth tried, mean depth) | `sdiag` | every 5 min | tells you whether backfill is keeping up; informs "shorten time" advice | ❌ |
| Historical sacct rolling window (run/wait distributions, hour-of-day load by partition) | `sacct -P -o ...` over 30d | nightly batch | empirical hour-of-day load curve (today the agent uses a synthetic one when this isn't computed) | ⚠️ pipeline in [scheduling/features.py](../../betty-ai/scheduling/features.py) writes to `betty-ai/data/features/partitions/<p>.json`; [availability.py:load_real_load_curve](../../betty-ai/slurm_advisor/availability.py) reads it when present |
| GRES granularity (which GPU type on which node, NVLink groups, MIG slice topology, switch topology) | `scontrol show node -d`, `topology.conf`, `scontrol show topology` | once/day | distributed training placement, A100 vs B200 routing | ⚠️ partial via [gpu-topology-betty.md](gpu-topology-betty.md) |
| Energy / power state | `sinfo -O EnergyJoules`, `scontrol show node` | none | not enabled on Betty | n/a |

## What the agent's tools see right now

### `slurm_recommend`
- **Inputs (live):** none. Reads `betty_cluster.yaml` + (now) `sshare -h -P -U` for the calling user's fairshare.
- **Decision vars (MiniZinc):** `pidx, nodes, gpus_per_node_out, cpus_per_task, mem_gb`
- **Hard constraints:** GPU packing, partition node max, soft CPU/GPU cap, memory caps, walltime caps
- **Objective:** `nodes * (cpus * cpu_weight + gpus_per_node * gpu_weight) * (seconds / 3600)` — **memory has no weight** (open issue)
- **Source of truth:** [solver.py:_MZN_MODEL](../../betty-ai/slurm_advisor/solver.py)

### `slurm_check`
- **Inputs (live):** none.
- Parses `#SBATCH` directives, runs [policy.py:Policy.violations](../../betty-ai/slurm_advisor/policy.py).
- Soft caps: ≤28 CPU/GPU, ≤224 GB/GPU, ≤24h on GPU partitions for backfill.

### `slurm_availability`
- **Inputs (live):** `sinfo` (idle GPUs per partition) + `squeue -h --start -t PD -o '%i|%P|%S'` (queue depth + earliest est start). Provenance returned in `sources`.
- **Score formula** (verbatim, surfaced in the card):
  ```
  score = (1.5 if free >= req_gpus else 0)
        + (1.0 - load_at_hour)
        - min(pending / 50, 1.0)
        - (dt_hours / 168)
  ```
- **Load curve:** real (from `data/features/partitions/<p>.json`) when present, synthetic otherwise. The card labels which.

### `slurm_diagnose`
- **Inputs (live):** `scontrol show job <id>`.
- Maps the SLURM Reason code via [recommender.py:_REASON_GUIDE](../../betty-ai/slurm_advisor/recommender.py).

## Highest-value next gaps to close

1. **`sprio` per pending job** — currently `Reason=Resources` is opaque ("the cluster is busy"). With sprio we can say which factor (age, fairshare, jobsize) is dragging the job down and what the user can change.
2. **Per-node live state into advisor** — drains and drained-with-reason are visible in `scontrol show node` but not used. A node draining for "DiskSpace" is a hint we could surface in `slurm_diagnose`.
3. **Reservations auto-fed into availability** — the parser exists in `scheduling/parsers.py`; just needs to be called from the TS adapter on each `slurm_availability` call (cache for 15 min).
4. **Nightly sacct → features pipeline as a cron** — turns the synthetic load curve into a real one for every partition. Pipeline already exists; just needs to run.

## Anti-hallucination contract

The system prompt in [system-prompt.ts](../../betty-ai-web/src/agent/system-prompt.ts) explicitly enumerates what each `slurm_*` tool can and cannot see, with file pointers. When a user asks "how does this work" or "what does the tool see", the model is required to cite this list, not invent details. If you add a new live signal, update both the source-code tool AND that prompt section AND this wiki page in the same commit.
