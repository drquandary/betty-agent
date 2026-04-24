# betty-ai/scheduling — SLURM log ingest + feature extraction

Phase 3.0 + 3.1 of the scheduling helper (see
[`raw/docs/2026-04-24-scheduling-plan-v2-constrained-agent.md`](../../raw/docs/2026-04-24-scheduling-plan-v2-constrained-agent.md)).

**Design rule: the LLM does not compute statistics.** All quantitative
reasoning happens in this module. The dashboard and the agent both read
the same pre-computed JSON files from `betty-ai/data/features/`.

## Layout

```
scheduling/
├── __init__.py              # SCHEMA_VERSION
├── types.py                 # dataclasses (SacctJob, SinfoRow, NodeRecord, Reservation)
├── parsers.py               # pure functions: parse_sacct, parse_sinfo, parse_scontrol_{nodes,res}
├── features.py              # distribution maths, partition + user features, current snapshot
├── cli.py                   # `python -m betty_ai.scheduling.cli {ingest|features|all}`
├── fixtures/synthetic/      # 53-job sacct fixture + sinfo/nodes/reservation samples
├── tests/
│   ├── test_parsers.py      # parser contract tests
│   └── test_features.py     # features contract tests
├── Makefile                 # dev loop
└── README.md                # this file
```

## The pipeline

```
raw/slurm_logs/inbox/                   <- you scp logs here
  sinfo-YYYYMMDDHHMM.log
  scontrol-show-res-YYYYMMDDHHMM.log
  scontrol-show-nodes-YYYYMMDDHHMM.log
  sacct-week-YYYYMMDDHHMM.tsv
           │
           │  make ingest
           ▼
raw/slurm_logs/processed/               <- parsed, typed, JSON
  <stem>.json   (one per input, with counters + records)
           │
           │  make features
           ▼
betty-ai/data/features/                 <- stable-schema output
  partitions/<partition>__<date>.json
  users/<user>__<date>.json
  current.json                          (latest live cluster snapshot)
  index.json                            (catalog)
```

Original files are moved from `inbox/` to `raw/slurm_logs/archive/` after
successful parse. Re-running ingest on an empty inbox is a no-op.

## Collecting logs

Two paths, depending on whether you've done Duo today.

### Path A — automated (requires live SSH ControlMaster)

```bash
# once, in a Terminal, approve Duo:
ssh jvadala@login.betty.parcc.upenn.edu

# in any shell after:
./betty-ai-web/scripts/collect-slurm-logs.sh
```

The script pulls all four files into `raw/slurm_logs/inbox/` with a
matching timestamp suffix. It aborts with a clear hint if the
ControlMaster isn't live.

### Path B — manual (runs the commands yourself)

On Betty (`ssh jvadala@login.betty.parcc.upenn.edu`):

```bash
sinfo > sinfo-$(date +%Y%m%d%H%M).log
scontrol show reservation > scontrol-show-res-$(date +%Y%m%d%H%M).log
scontrol show nodes -o    > scontrol-show-nodes-$(date +%Y%m%d%H%M).log

# sacct needs the explicit format or the timestamps are missing.
sacct -a -S "$(date -d '7 days ago' +%Y-%m-%d)" -X --parsable2 \
  -o JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,\
Elapsed,Planned,State,ExitCode,ReqTRES,AllocTRES,ReqMem,ReqCPUS,ReqNodes,NodeList,Reason \
  > sacct-week-$(date +%Y%m%d%H%M).tsv
```

Then `scp` the four files into `parcc1/raw/slurm_logs/inbox/` on your Mac.

## Dev loop

```bash
cd parcc1/betty-ai/scheduling
make test        # ~1s; stdlib unittest
make smoke       # end-to-end on synthetic fixtures, isolated .smoke/ dir
make all         # real pipeline: inbox -> processed -> features
make clean       # drop processed/, features/, smoke/
```

No pip install. No pandas. `python3 --version` ≥ 3.9 is the only requirement.

## The stable-schema output

`betty-ai/data/features/partitions/dgx-b200__2026-04-24.json`:

```json
{
  "schema_version": 1,
  "partition": "dgx-b200",
  "computed_at": "2026-04-24T18:00:00+00:00",
  "window_start": "2026-04-18T13:00:00+00:00",
  "window_end":   "2026-04-24T19:00:00+00:00",
  "input_n_jobs_in_window": 20,
  "input_n_terminal": 19,
  "wait_sec": {
    "n": 19, "status": "ok",
    "mean": 1234.5, "stdev": 890.3,
    "min": 30, "p10": 60, "p25": 180, "p50": 600, "p75": 1800,
    "p90": 3600, "p95": 5400, "p99": 7200, "max": 7200
  },
  "runtime_sec": { ... },
  "gpu_count":   { ... },
  "cpu_count":   { ... },
  "mem_gb":      { ... },
  "node_count":  { ... },
  "success_rate": { "n": 19, "status": "ok",
                    "completed": 16, "failed": 2, "rate": 0.89 },
  "state_breakdown": { "COMPLETED": 16, "FAILED": 2, "CANCELLED": 1 },
  "hourly_load": { "mon_00": 0, ..., "sun_23": 2 },
  "top_gpu_hours": [
    { "user": "alice", "gpu_hours": 344.0 },
    { "user": "jvadala", "gpu_hours": 48.5 }
  ]
}
```

Every distribution carries a `status` field:
- `"ok"` — usable percentiles
- `"insufficient-data"` — n < 10; agent must report "not enough history"
- `"no-data"` — empty

The agent cites these values verbatim. It never computes them.

## Contract for callers (dashboard + agent)

1. **Schema is versioned.** Any output-shape change bumps `SCHEMA_VERSION`.
   Consumers must check `schema_version == 1` and reject anything higher.
2. **No NaN or Inf.** Percentiles are always finite float or the object is
   replaced with `{"n": ..., "status": "..."}`.
3. **Empty distributions never throw.** Empty input → `{"n": 0, "status": "no-data"}`.
4. **UTC timestamps.** Every ISO string is timezone-aware, UTC.
5. **Deterministic JSON.** `indent=2, sort_keys=True` — diffable in git.

## Adding a new feature (engineering discipline)

1. Add the computation in `features.py` with a pure function.
2. Add a golden test in `tests/test_features.py` (bound, not exact, to
   survive minor quantile-method drift).
3. Bump `SCHEMA_VERSION` in `__init__.py`.
4. Update the schema block in this README.
5. Update the dashboard component + agent tool that read the field.

## What this module is NOT

- Not a prediction engine — that's `recommender.py` (Phase 3.5).
- Not a scheduler — we never call `sbatch`.
- Not a Slurm client — we never call `sacct` directly; we consume files.
- Not aware of users' calendars — that's Phase 3.x integrations.

## Fixture regeneration

The synthetic fixture in `fixtures/synthetic/` was hand-written against
Slurm 24.11.7 output formats. When we get real logs from Betty, we will:

1. Capture output with the collector script.
2. Spot-check parsers against real data via `make all`.
3. Commit an anonymized snapshot as a real fixture alongside the synthetic one.
4. Add `test_parsers_real.py` with assertions against the real fixture.
