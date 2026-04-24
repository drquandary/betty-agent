# Scheduling Helper — Plan v2 (Constrained-Agent + Python Analytics + Dashboard)

> **Supersedes** [2026-04-24-scheduling-helper-plan.md](2026-04-24-scheduling-helper-plan.md).
> v1 left the door open for the LLM to reason about statistics. This version
> closes it: **the LLM does not interpret data — Python does.** The LLM
> orchestrates, surfaces pre-computed facts, and stays out of the math.
> Dashboard is the primary UI for quantitative insights; the agent is a
> narrower read-only caller over the same pre-computed artifacts.

## What changed from v1

### Decisions locked in (from ryb)

| Question (v1) | Answer | Implication |
|---------------|--------|-------------|
| Slurm epilog webhook? | **No — don't touch.** | Polling only. `sacct` is the source of truth. |
| Outbound `--mail-type`? | **Unreliable.** | No job-end email; Slack DM or dashboard notification instead. |
| `slurm_exporter` on Betty? | **None today.** | No Prometheus metrics. Roll our own. |
| Reservations visible? | **Yes, read-only** via `scontrol show reservation`. | We can parse + display; we can't create. |
| Can agent request QOS bumps? | **No.** User emails PARCC. | Mode E (deadline-crunch) is **out of scope**. |
| `sacct` retention? | **Infinite.** | No history ceiling. We can backfill as far as we want. |
| iCal for maintenance? | **None.** `scontrol show reservation` is it. | Ingest that file; no extra feed. |

### Architectural mandate: constrain the agent

> **The LLM MUST NOT compute statistics.** It calls tools that return
> pre-computed features. It quotes those features. It does not average,
> median, percentile, multiply, divide, or reason about distributions.
> If a statistic isn't in the tool output, the answer is "not computed."

Rationale: LLM creativity is a liability for quantitative scheduling
recommendations. Researchers need numbers they can defend in a paper.
Python gives reproducible math; the LLM gives natural-language framing.

This forces every quantitative question through a Python pipeline, which in
turn forces us to enumerate the questions up-front — a healthy constraint.

## The boundary: LLM vs Python vs Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│ HUMAN                                                              │
│    questions: "when will my 8-GPU job start?"                      │
│    decisions: pick a submit time, approve a sbatch, read a chart   │
└─────────────────┬────────────────────────────────┬─────────────────┘
                  │ natural language                │ direct view
                  ▼                                 ▼
┌──────────────────────────────┐    ┌──────────────────────────────┐
│ AGENT (LLM)                  │    │ DASHBOARD (Next.js)          │
│ - parses intent              │    │ - reads features.json        │
│ - calls read-only tools      │    │ - renders charts             │
│ - quotes returned numbers    │    │ - no agent in the loop       │
│ - NEVER computes             │    │ - primary surface for stats  │
│ - NEVER estimates            │    │                              │
└─────────────────┬────────────┘    └──────────────────────────────┘
                  │ tool calls (read-only)              ▲
                  ▼                                      │
┌──────────────────────────────────────────────────────┬─┘
│ PYTHON ANALYTICS (offline, reproducible)            │
│   ingest.py        — parse Slurm log files          │
│   features.py      — distributions, percentiles     │
│   recommender.py   — rank (partition, begin) tuples │
│   -> writes stable-schema JSON + parquet            │
└──────────────────────────────────────────────────────┘
                  ▲
                  │ daily dumps
┌─────────────────┴──────────────────────────────────────┐
│ SLURM LOG FILES (scp'd from Betty, v1 manual)          │
│   sinfo-*.log                                          │
│   scontrol-show-res-*.log                              │
│   scontrol-show-nodes-*.log                            │
│   sacct-week-*.tsv                                     │
└────────────────────────────────────────────────────────┘
```

**One-way data flow.** The agent reads only pre-computed JSON. The dashboard
reads only pre-computed JSON. Python is the only thing that touches raw data.

## Ingest pipeline — v1 manual workflow

### The four commands to run on Betty (login node, your account)

Your proposed set, with one augmentation for `sacct` so we can actually
compute wait times — the default format drops the timestamps we need.

```bash
# 1. Live partition / node capacity snapshot
sinfo > sinfo-$(date +%Y%m%d%H%M).log

# 2. Current reservations (our only maintenance-window signal)
scontrol show reservation > scontrol-show-res-$(date +%Y%m%d%H%M).log

# 3. Node detail with one-line-per-node (-o) for easy parsing
scontrol show nodes -o > scontrol-show-nodes-$(date +%Y%m%d%H%M).log

# 4. Historical accounting — AUGMENTED from your draft
#    -X            : main job only, drop .batch / .extern steps (kills duplicates)
#    --parsable2   : pipe-separated, no trailing |, stable parser input
#    -o <fields>   : without this the default output omits Eligible/Start/End,
#                    so we can't compute queue_wait = Start - Eligible.
sacct -a -S "$(date -d '7 days ago' +%Y-%m-%d)" \
      -X --parsable2 \
      -o JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,\
Elapsed,Planned,State,ExitCode,ReqTRES,AllocTRES,ReqMem,ReqCPUS,ReqNodes,NodeList,Reason \
      > sacct-week-$(date +%Y%m%d%H%M).tsv
```

Why the `sacct` augmentation matters (if you're wondering):
- **`Submit`** — when the user typed `sbatch` (includes held-job time).
- **`Eligible`** — when Slurm actually started considering it for a slot.
- **`Start`** — when it ran.
- **`queue_wait = Start − Eligible`** (NOT `Start − Submit` — that would penalize users who held their own jobs).
- **`Planned`** — Slurm 24.11+ exposes this as a pre-computed duration; we verify our subtraction against it.

### Where files land on your Mac

```
parcc1/raw/slurm_logs/
├── inbox/                         # you scp into here
│   ├── sinfo-202604241800.log
│   ├── scontrol-show-res-202604241800.log
│   ├── scontrol-show-nodes-202604241800.log
│   └── sacct-week-202604241800.tsv
└── archive/                       # parsed files moved here
    └── 2026-04-24T18:00:00Z/
```

`ingest.py` watches `inbox/`, parses, writes parquet to
`betty-ai/data/processed/<timestamp>/`, then moves originals to `archive/`.

### v2 (later): automated pull

Phase 3.6 replaces the manual scp with a launchd daily job that runs the
four commands over the existing SSH ControlMaster and writes straight into
`inbox/`. Same parser, same features — just the collection shifts.

## Parsers (one per log type)

All parsers live in `betty-ai/scheduling/ingest.py`. Each returns a
pandas DataFrame with a **documented schema**. All pure — no network.

### Parser 1: `parse_sinfo(path) -> DataFrame`

Input: default `sinfo` output (partition/state rollup).
Output columns: `partition, avail, timelimit, nodes, state, nodelist`.
Notes: `state` uses the compact codes + modifiers (`mix-`, `idle~`) from
[[slurm-node-state-modifiers]] — preserve the raw string; decode in
features.py.

### Parser 2: `parse_scontrol_res(path) -> DataFrame`

Input: `scontrol show reservation` — stanza-per-reservation, blank-line-separated.
Fields to extract: `ReservationName, StartTime, EndTime, Duration, Nodes, NodeCnt, Features, PartitionName, Flags, Users, Accounts`.
Notes: parse ISO-ish timestamps into pandas `Timestamp` UTC-aware.

### Parser 3: `parse_scontrol_nodes(path) -> DataFrame`

Input: `scontrol show nodes -o` — one line per node, `key=value` pairs.
Fields: `NodeName, State, CPUs, AllocCPUs, RealMemory, FreeMem, Gres, GresUsed, Partitions, Reason, Weight, Boards, ThreadsPerCore, CoresPerSocket, Sockets`.
Derived: `gpus_total, gpus_alloc, gpus_free` from `Gres` / `GresUsed` strings.

### Parser 4: `parse_sacct(path) -> DataFrame`

Input: `--parsable2` TSV with the format string above.
Fields: passthrough plus derived:
- `submit_ts, eligible_ts, start_ts, end_ts` — pandas `Timestamp`
- `elapsed_sec, planned_sec` — from Slurm's duration strings
- `queue_wait_sec = start_ts − eligible_ts` (seconds)
- `gpu_count` — parsed from `AllocTRES` regex `gres/gpu=(\d+)`
- `cpu_count` — from `AllocTRES` `cpu=(\d+)` or fall back to `AllocCPUS`
- `mem_gb` — parsed from `ReqMem`
- `node_count` — from `AllocTRES` `node=(\d+)`
- `hour_of_week` — `eligible_ts.weekday * 24 + eligible_ts.hour` in `America/New_York`
- `state_bucket` — collapses `COMPLETED` vs `{FAILED,TIMEOUT,OUT_OF_MEMORY}` vs `{CANCELLED,REQUEUED}`

Drop rows: `eligible_ts` is `Unknown` or null; `queue_wait_sec < 0`
(clock drift); `state_bucket == 'PENDING'` (not yet started).

## Feature extraction algorithm

Lives in `betty-ai/scheduling/features.py`. Pure function:
`extract_features(sacct_df, nodes_df, res_df, sinfo_df) -> dict`.
Output conforms to the stable JSON schema below.

### Algorithm — partition wait-time distribution

```python
def wait_distribution(df: pd.DataFrame, partition: str) -> dict:
    sub = df[
        (df.partition == partition) &
        (df.state_bucket != 'PENDING') &
        (df.queue_wait_sec.notna()) &
        (df.queue_wait_sec >= 0)
    ]
    if len(sub) < 10:
        return {"n": len(sub), "status": "insufficient-data"}
    wait = sub.queue_wait_sec
    return {
        "n": int(len(sub)),
        "mean_sec":   float(wait.mean()),
        "std_sec":    float(wait.std()),
        "min_sec":    float(wait.min()),
        "p10_sec":    float(wait.quantile(0.10)),
        "p25_sec":    float(wait.quantile(0.25)),
        "p50_sec":    float(wait.quantile(0.50)),
        "p75_sec":    float(wait.quantile(0.75)),
        "p90_sec":    float(wait.quantile(0.90)),
        "p95_sec":    float(wait.quantile(0.95)),
        "p99_sec":    float(wait.quantile(0.99)),
        "max_sec":    float(wait.max()),
        "status":     "ok",
    }
```

**Same structure** for:
- `runtime_distribution` — `elapsed_sec`, filter `state_bucket == 'COMPLETED'`
  (failed/cancelled skew the tail).
- `gpu_count_distribution`, `cpu_count_distribution`, `mem_gb_distribution`,
  `node_count_distribution` — on `AllocTRES`-derived columns.

### Algorithm — busy-hour heatmap

```python
def hourly_load(df: pd.DataFrame, partition: str) -> dict:
    sub = df[df.partition == partition]
    counts = sub.groupby('hour_of_week').size()
    # 168-bucket dense vector: Mon_00 .. Sun_23
    return {f"{WEEKDAYS[h//24]}_{h%24:02d}": int(counts.get(h, 0))
            for h in range(168)}
```

### Algorithm — success-rate

```python
def success_rate(df: pd.DataFrame, partition: str) -> dict:
    sub = df[(df.partition == partition) &
             (df.state_bucket.isin(['COMPLETED','FAILED']))]
    if len(sub) < 10: return {"status": "insufficient-data"}
    return {
        "n": int(len(sub)),
        "completed": int((sub.state_bucket == 'COMPLETED').sum()),
        "failed":    int((sub.state_bucket == 'FAILED').sum()),
        "rate":      float((sub.state_bucket == 'COMPLETED').mean()),
    }
```

### Algorithm — per-user history

```python
def user_history(df: pd.DataFrame, user: str) -> dict:
    sub = df[df.user == user]
    return {
        "n_jobs": int(len(sub)),
        "partitions_used": sub.partition.value_counts().to_dict(),
        "typical_gpu_count": int(sub.gpu_count.mode().iloc[0]) if len(sub) else None,
        "typical_runtime_sec": float(sub.elapsed_sec.median()) if len(sub) else None,
        "success_rate": float((sub.state_bucket == 'COMPLETED').mean()) if len(sub) else None,
    }
```

**Deliberate omission**: no "predict next start time" function here. That
belongs in `recommender.py` where it can be tested against held-out data.
Features are just features.

## Stable JSON schema (what the agent + dashboard both read)

`betty-ai/data/features/<partition>/<YYYY-MM-DD>.json`:

```json
{
  "schema_version": 1,
  "partition": "dgx-b200",
  "computed_at": "2026-04-24T18:00:00Z",
  "input_window_days": 7,
  "input_n_jobs": 3421,
  "wait_sec":     { "n": 3421, "mean_sec": 1820, "p50_sec": 930, ... },
  "runtime_sec":  { ... },
  "gpu_count":    { "min": 1, "p50": 8, "p95": 8, "mode": 8 },
  "cpu_count":    { ... },
  "mem_gb":       { ... },
  "node_count":   { ... },
  "success_rate": { "n": 3100, "completed": 2800, "failed": 300, "rate": 0.903 },
  "hourly_load":  { "mon_00": 12, "mon_01": 8, ..., "sun_23": 45 },
  "state_breakdown": {
    "COMPLETED": 2800, "FAILED": 300, "TIMEOUT": 128, "CANCELLED": 193
  }
}
```

Also published:
- `betty-ai/data/features/current.json` — latest sinfo + reservations + free capacity
- `betty-ai/data/features/users/<user>.json` — per-user history
- `betty-ai/data/features/index.json` — catalog of what's been computed

`schema_version` bumps require both agent tools and dashboard to migrate.

## Dashboard pages

All pages read features JSON directly. No agent involvement.

### 1. `/dashboard` — Cluster overview

- Live free-vs-allocated GPU bars per partition (from latest `sinfo` log)
- Active reservations table (from `scontrol show reservation`)
- Down/drain node count with reasons
- Log ingest status: last successful parse, files in inbox, parse errors

### 2. `/dashboard/partitions/[name]` — Partition deep-dive

- Wait-time histogram with p50/p90/p95 markers
- Runtime histogram (completed jobs only)
- Job-size distributions (GPUs, CPUs, memory, nodes) as violin plots
- Success-rate ring chart
- Busy-hour heatmap (7×24 matrix)
- Top-10 users by GPU-hours (anonymized option for fairness discussions)

### 3. `/dashboard/my-jobs` — Your history

- Table of recent jobs with states
- Your median runtime per (partition, gpu_count)
- Your success rate
- "When you typically submit" heatmap

### 4. `/dashboard/recommend` — Submission-window recommender (form)

- Inputs: partition, GPU count, estimated runtime, deadline
- Output: ranked list of submit-now vs `--begin=...` windows with
  predicted wait (p50, p90) and rationale strings
- One click → copy-to-clipboard `sbatch --begin=... --time=... ...`

### 5. `/dashboard/ingest` — Pipeline health (admin-ish)

- Last parse timestamps per file type
- Parquet file sizes and row counts
- Stale-data warning if newest sacct > 48h old

## Agent tools (constrained)

Tool surface for the LLM. **Every tool returns JSON that was computed by
Python. No tool exposes a DataFrame, SQL handle, or raw log.**

| Tool | Returns | Notes |
|------|---------|-------|
| `list_partitions()` | `["dgx-b200", "b200-mig45", ...]` | names only |
| `get_partition_stats(partition)` | features JSON | pass-through |
| `get_my_job_history(user)` | user features JSON | pass-through |
| `get_reservations()` | `[{name, start, end, nodes, partition}, ...]` | parsed, not rendered |
| `get_current_capacity()` | `{partition: {gpus_free, gpus_total, nodes_up, nodes_down}}` | from latest sinfo |
| `recommend_submission_window(spec)` | `[{start_time, predicted_wait_p50, predicted_wait_p90, rationale}, ...]` | Python recommender; agent doesn't re-rank |

### System-prompt constraints (to be added to `.claude/agents/betty-ai.md`)

```
## Scheduling — hard rules

1. NEVER compute statistics. Call get_partition_stats or
   get_my_job_history and quote the returned values. Acceptable:
   "p50 wait on dgx-b200 is 930s per today's features." Unacceptable:
   "I estimate your wait will be about 15 minutes based on typical load."

2. NEVER invent a number. If the user asks for a statistic not in the
   tool output, say "not computed — the features only track X, Y, Z."

3. NEVER run a prediction without calling recommend_submission_window.
   Do not propose a --begin time from memory or general knowledge.

4. When displaying stats, cite the features file: "from
   partitions/dgx-b200/2026-04-24.json".

5. If the dashboard already shows what the user is asking, recommend
   they check the dashboard tab, not the chat.
```

## Modular build plan — revised

Each phase ends with: Python module + tests on fixture logs + one dashboard
surface using the output. Flag-off by default.

### Phase 3.0 — Ingest skeleton (2 days)

- `betty-ai/scheduling/ingest.py` — four parsers, one per log type.
- `betty-ai/scheduling/fixtures/` — a captured set of real logs from Betty
  (first thing you do after this plan is signed off: run the four commands
  once and commit the output anonymized as fixtures).
- pytest covers each parser against fixtures.
- CLI: `python -m betty_ai.scheduling.ingest <inbox_dir> <processed_dir>`
- **Acceptance**: running the CLI on fixtures produces parquet files that
  round-trip back to identical DataFrames.

### Phase 3.1 — Feature extractor (2 days)

- `betty-ai/scheduling/features.py` — the algorithms above.
- Golden-value tests: for a fixed fixture, assert specific p50/p95/etc.
- CLI: `python -m betty_ai.scheduling.features <processed_dir> <features_dir>`
- **Acceptance**: features JSON validates against a `schema.json`.

### Phase 3.2 — Dashboard MVP (3 days)

- `betty-ai-web/src/app/dashboard/page.tsx` — cluster overview
- `betty-ai-web/src/app/dashboard/partitions/[name]/page.tsx`
- Chart library decision: **Recharts** (React-native, no d3 deps, renders
  in Next.js server components cleanly).
- **Acceptance**: partition page renders wait-time histogram from a fixture
  features JSON; no agent involved.

### Phase 3.3 — Agent tools wired (1 day)

- `betty-ai-web/src/agent/tools/scheduling/*` — six tools from the table.
- All tools are thin: `read features JSON, return it`.
- System-prompt fragment added, flag-gated.
- vitest: each tool returns the JSON bytes that the fixture produces.
- **Acceptance**: agent can answer "what's the p50 wait on dgx-b200?" by
  citing the features JSON; refuses to compute anything not pre-computed.

### Phase 3.4 — My-jobs dashboard + user-history features (2 days)

- Extend `features.py` to emit per-user files.
- `/dashboard/my-jobs` page.
- **Acceptance**: your sacct history loads in <500ms.

### Phase 3.5 — Python recommender (3 days)

- `betty-ai/scheduling/recommender.py` — given
  `(partition, gpu_count, runtime_est)`, return top-5 submit-time windows
  with predicted wait from hourly_load × partition's wait distribution.
- Held-out test: train on days 1–6, test on day 7, MAE on predicted wait.
- Agent tool just wraps it.
- `/dashboard/recommend` page.
- **Acceptance**: recommender MAE < 30% on held-out, documented in the
  features schema.

### Phase 3.6 — Automated ingest (3 days, last)

- `betty-ai-web/scripts/install-traffic-collector.sh` — launchd agent runs
  the four commands daily via existing ControlMaster SSH; writes to inbox.
- `ingest.py` runs after the pull.
- Alerts in `/dashboard/ingest` when the pipeline breaks.
- **Acceptance**: a full day passes with zero manual intervention and
  features update.

## Acceptance gates (non-negotiable)

Before flipping any flag from `false` to `true` in `defaults.yaml`:

1. Python pipeline runs end-to-end on fixtures under 30s.
2. Every agent tool has a test asserting it returns the fixture JSON
   byte-for-byte (prevents the LLM from "helpfully" rewriting a number).
3. Dashboard page uses the feature JSON without any agent plumbing.
4. System-prompt hard rules are tested with at least 3 adversarial prompts
   ("estimate my wait", "give me a rough average", "you can probably guess")
   and the agent refuses or delegates to a tool.

## Out of scope (explicitly)

- **Mode E (deadline-crunch QOS bumps)** — ryb said no, user emails PARCC.
- **Epilog webhooks** — ryb said don't touch.
- **Prometheus / slurm_exporter** — not today.
- **Reservation creation** — users can't.
- **Cross-user notifications** — v1 is solo-user (mode F deferred).

## First concrete step (for Jeff)

Run the four commands on Betty once today, scp to
`parcc1/raw/slurm_logs/inbox/`, and tell me when it's there. I will:

1. Diff the real sinfo / sacct output against my assumed schema.
2. Commit the anonymized output as `betty-ai/scheduling/fixtures/2026-04-24/`.
3. Start Phase 3.0 (ingest parsers) with real data as the oracle.

That gets us to a working parser + a first dashboard page (partition wait
histogram) in <5 days.
