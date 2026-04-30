# Betty SLURM Advisor — status report for Ryan

**To:** ryb
**From:** jvadala
**Date:** 2026-04-27
**Subject:** SLURM dimensionality, what Betty agent currently sees, and what to wire next

> Companion wiki page (kept in sync as state changes): [wiki/concepts/slurm-state-dimensionality.md](../../wiki/concepts/slurm-state-dimensionality.md). This report is the point-in-time narrative; the wiki page is the live coverage matrix.

---

## TL;DR

I built four agent tools that let Betty reason about SLURM jobs end-to-end:

1. **`slurm_check`** — lints a user-pasted sbatch against per-partition constraints from [betty_cluster.yaml](../../betty-ai/configs/betty_cluster.yaml) plus PARCC scheduling lore (≤28 CPU/GPU, ≤224 GB/GPU, ≤24h for backfill). Reports errors/warnings and proposes a corrected sbatch.
2. **`slurm_recommend`** — given a high-level intent ("2 GPUs for 8 hours"), runs a **MiniZinc constraint model** to pick the cheapest legal partition shape. Falls back to a deterministic Python search when MiniZinc isn't installed.
3. **`slurm_availability`** — combines live `sinfo` + live `squeue --start` with an hour-of-day load profile to rank candidate time-slots and render a calendar in chat. Surfaces SLURM's own backfill-simulator estimates per partition.
4. **`slurm_diagnose`** — runs `scontrol show job <id>` and translates the SLURM Reason code into a plain-English explanation with concrete actions.

The right framing for what we capture vs. what we miss is **TRES** — Trackable Resources, SLURM's native dimensional model. Section 2 lays this out with Betty's coverage matrix.

The thing I most want to flag: when the agent first answered "how does the score work?", it **invented** weights and capabilities the tool didn't have. That was the root issue your initial concern pointed at. I've since (a) wired more real signals (`squeue --start`, `sshare`), (b) surfaced the actual formula in the tool output, and (c) added an explicit anti-hallucination contract in the system prompt with file-level pointers. Verified end-to-end — the agent now cites real source files when asked.

---

## 1. TRES — the dimensional model

SLURM models everything as **TRES** (Trackable Resources). Every node, partition, and job is a vector across:

- **cpu** — physical/hyperthreaded cores
- **mem** — bytes
- **gres/gpu:&lt;type&gt;** — typed GPUs (`b200`, `b200_mig45_g`, `b200_mig90_g`, …)
- **node** — whole-node count (relevant for billing)
- **billing** — synthetic per-partition TRES = the PC-minute charge against the account
- **license/&lt;name&gt;** — software licenses (none on Betty)
- **energy** — Watt-hours (not enabled)

A pending job is a request vector across these dimensions. A running job consumes a vector. A node advertises a vector of capacity and a vector currently allocated. The scheduler's job: pack request vectors into capacity vectors, subject to per-account / per-QOS / per-partition ceilings.

**The full live state at any moment** is roughly:

```
S = (node_state[N≈30], job_state[M=hundreds], assoc_state[A=accounts],
     reservation_set, qos_caps, partition_caps, time)
```

Practically: thousands of values changing per minute on a busy day. The fundamental question for an agent is *which slice of S do I capture, and how honestly do I report what I missed?*

---

## 2. Betty's coverage matrix

| Dimension | Source | Cadence | Captured? |
|---|---|---|---|
| Partition geometry (CPUs/node, GPUs/node, mem, GRES types) | `scontrol show partition`, sinfo | once/day | ✅ static in [betty_cluster.yaml](../../betty-ai/configs/betty_cluster.yaml) |
| QOS caps (max GPUs, max wall, GrpTRESMins) | `sacctmgr show qos -p` | once/day | ⚠️ static in YAML, **not refreshed live** |
| Per-partition idle GPUs (live) | `sinfo -h -o '%P\|%D\|%T\|%G'` | per call | ✅ |
| Per-node state (idle/mix/alloc/drain/down + drain reason) | `sinfo`, `scontrol show node -d` | every 1–5 min | ⚠️ parser exists, not wired into advisor |
| **Live queue** (PD jobs ahead of you, est. start) | `squeue -h --start -t PD -o '%i\|%P\|%S'` | per call | ✅ as of today |
| Priority decomposition (age, fairshare, jobsize, partition, QOS, TRES factors) | `sprio -hl -j <id>` | per diagnose | ❌ |
| **Account fairshare + live usage** | `sshare -h -P -U` | per recommend | ✅ as of today, surfaced in card |
| Reservations (MAINT/FLEX) | `scontrol show res` | every 15 min | ⚠️ parser exists, not auto-fed to availability |
| Backfill scheduler health (cycle time, depth tried, mean depth) | `sdiag` | every 5 min | ❌ |
| Historical sacct (rolling 30-day per-partition load) | `sacct -P -o ...` nightly | nightly batch | ⚠️ pipeline exists in [scheduling/features.py](../../betty-ai/scheduling/features.py); auto-loaded if file present, else synthetic curve labeled as such |
| GRES granularity (which GPU type on which node, NVLink groups, switch topology) | `scontrol show node -d`, `topology.conf` | once/day | ⚠️ partial via [wiki/concepts/gpu-topology-betty.md](../../wiki/concepts/gpu-topology-betty.md) |
| Energy/power | `sinfo -O EnergyJoules` | n/a | n/a — not enabled on Betty |

**Honest summary:** of the ~12 dimensions a sophisticated scheduler advisor should see, we now have 5 captured live or live-ish, 4 captured statically or via a ready-but-unwired parser, and 3 not captured at all. The 3 we don't capture are also the most impactful ones for "why is my job pending" answers.

---

## 3. The two solvers, in detail

### `slurm_recommend` — MiniZinc constraint model

**Source:** [betty-ai/slurm_advisor/solver.py](../../betty-ai/slurm_advisor/solver.py) (`_MZN_MODEL`)

**Decision variables:**
- `pidx` — which partition (1..P)
- `nodes` — node count
- `gpus_per_node_out` — GPUs per node (subject to partition geometry)
- `cpus_per_task` — CPUs per task
- `mem_gb` — memory per node

**Hard constraints:**
- `nodes * gpus_per_node ≥ req_gpus` and `(nodes-1) * gpus_per_node < req_gpus` (tight pack)
- `nodes ≤ max_nodes_per_job[pidx]`
- `cpus_per_task ≤ cpus_per_node[pidx] / gpus_per_node[pidx]` (geometric)
- `cpus_per_task ≤ soft_cpu_per_gpu` (PARCC policy: 28)
- `mem_gb ≤ mem_gb_per_node[pidx]`
- `req_seconds ≤ max_walltime_s[pidx]`

**When the user didn't pin CPUs/mem** the model fixes them to the partition's recommended defaults from the YAML — without this, the cheapest-billing solution is `cpus=1, mem=minimum`, which is legal but useless.

**Objective (minimize):**

```
billing = nodes * (cpus_per_task * cpu_weight[pidx] +
                   gpus_per_node_out * gpu_weight[pidx]) *
          (req_seconds / 3600)
```

**Open issue:** memory has no weight in the objective. That's intentional in our current YAML (no `billing_weight_mem`), but if PARCC ever wants to charge for memory, it's a one-line change.

**Solver fallback:** When MiniZinc isn't installed (or only ships MIP solvers, as the brew formula does — gecode needs to be installed and registered separately via `~/.minizinc/solvers/gecode.msc`), the same logic runs as a pure-Python enumerate-and-rank in `solver.py:PythonSolver`. Both produce identical answers for our 5-partition setup; the card tells the user which backend ran.

### `slurm_availability` — score formula

**Source:** [betty-ai/slurm_advisor/availability.py](../../betty-ai/slurm_advisor/availability.py)

**Inputs (live):**
- `sinfo -h -o '%P|%D|%T|%G'` — idle/total GPUs per partition
- `squeue -h --start -t PD -o '%i|%P|%S'` — pending depth + earliest est. start (SLURM's own backfill simulator output, when available)
- Hour-of-day load curve — real (from `data/features/partitions/<p>.json` produced by `scheduling/features.py`) when present, synthetic hand-coded curve otherwise. The card labels which.

**Score formula** (verbatim, surfaced in the card so the agent can't invent it):

```
score = (1.5 if free >= req_gpus else 0)   # idle-now bonus
      + (1.0 - load_at_hour)               # off-peak bonus
      - min(pending / 50, 1.0)             # queue depth penalty
      - (dt_hours / 168)                   # prefer sooner
```

Each component appears in the slot's `reasons` list, e.g.:

> 0/215 GPUs idle (45 pending) — short wait expected
> synthetic load at 04:00 = 10%
> 45 pending in queue (penalty 0.90)
> SLURM est. earliest start in this partition: 2026-04-27T16:24:19

That last line is SLURM's own backfill prediction surfaced verbatim — that's the highest-value piece of new live data we added today.

---

## 4. Anti-hallucination contract

The trigger for this whole pass: when a user asked "how are you reasoning about this?", the agent invented a formula `score = w1·idle + w2·(1-load) - w3·queue_penalty - w4·time_distance` with weights it had no source for. It also claimed to use squeue (didn't, then), claimed historical load (was synthetic), and said it couldn't see the MiniZinc model (it's literally embedded as a string in `solver.py`).

**Three fixes:**
1. The tool result now includes `score_formula`, `sources`, and `load_curve_kind` fields. The card renders them at the bottom (color-coded green=historical, amber=synthetic).
2. The system prompt at [betty-ai-web/src/agent/system-prompt.ts](../../betty-ai-web/src/agent/system-prompt.ts) now contains a hard "CRITICAL — never invent how the tools work" section enumerating exactly what each `slurm_*` tool sees, where its source file lives, and what to cite when asked.
3. Verified live: when prompted "explain how the score is computed and what data sources you actually used," the agent now correctly states `+1.5 idle bonus`, `-min(pending/50, 1.0)`, names `sources: ["sinfo", "squeue --start"]`, and notes "No real historical load data from `betty-ai/data/features/partitions/dgx-b200.json` — if that file existed, it would say `load_curve_kind: 'historical'`". That's the actual file path it would need to look at.

If you add a new live signal, the contract requires updating both the source-code tool AND that prompt section AND the wiki page in the same commit. There's a one-line note about this at the bottom of the wiki page.

---

## 5. Highest-value next investments

Ranked by impact-per-hour:

1. **`sprio` per pending job into `slurm_diagnose`.** Today `Reason=Resources` is opaque ("the cluster is busy"). With sprio we can say which factor (age, fairshare, jobsize, QOS, TRES) is dominating the priority and what the user can change. This is the single biggest leverage point for "why is MY job pending" answers.

2. **Reservations auto-fed into `slurm_availability`.** The parser exists in [scheduling/parsers.py](../../betty-ai/scheduling/parsers.py:parse_scontrol_res); it just needs a 15-minute cache + an extra `runRemote('scontrol show res')` call in the TS adapter. Right now the calendar treats blackouts as `[]` unless explicitly passed.

3. **Nightly sacct → features pipeline as a cron.** The whole offline pipeline already exists (`python -m scheduling.cli all`). Run it nightly and the load curve becomes real for every partition. The advisor already auto-loads it when present and labels honestly when not.

4. **`sdiag` snapshot in the calendar card.** Tells the user (and the agent) whether backfill is keeping up — if mean cycle time is high or depth-tried is low, recommendations to "shorten time for backfill" are worth more.

5. **Per-node state into `slurm_diagnose`.** A node draining for "DiskSpace" or "NHC" is meaningful context that's currently hidden.

I think 1, 3 are the only ones worth your direct attention; 2, 4, 5 I can scope and ship without further input.

---

## 6. Open questions

- **Should we charge for memory in the billing objective?** Currently 0; cheap to add if PARCC ever wants it.
- **Is the soft cap of 28 CPU/GPU on dgx-b200 still right?** That's `cpus_per_node / gpus_per_node = 224 / 8`, but I see jobs successfully run with higher ratios. Do we have a real per-workload number, or should I leave 28 as a lint warning rather than the recommended default?
- **Do you want `slurm_diagnose` to also offer to email PARCC when it sees `QOSGrpGRESMinutes` exhausted?** That's the v2 plan's "Mode E (deadline-crunch)" we marked out of scope, but it's a one-line nudge if you want to revisit.
- **Backfill horizon for `--start` estimates** — do you know what `bf_window` is configured at on Betty? If it's narrow (default is 1 day), `squeue --start` will return `N/A` for anything beyond that, and the agent's "est. earliest start" gets quieter the further out you ask.

Happy to walk through any of this in person — the wiki page will stay up to date as the dimensions covered grow.
