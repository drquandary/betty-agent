# Scheduling Helper Agent — Design Plan (2026-04-24)

> Design doc for a Betty AI capability that schedules SLURM jobs around the
> **human's** schedule, not just the cluster's. Draft — awaiting decisions
> from Jeff before implementation.

## The reframing

"Schedule a job" is overloaded. A researcher asking for scheduling help is
actually asking one of six different questions. The agent needs to detect
which, because the answer shape is totally different for each.

| Mode | User utterance shape | What the agent does |
|------|----------------------|---------------------|
| **A — Deadline-backward** | "Have results before my 10am meeting Thursday" | Work backward: estimate runtime + queue wait, submit early enough with slack |
| **B — Begin-block** | "Don't start until I'm free to babysit" | Pin `--begin=<time>` to a free block in the user's calendar |
| **C — Hold-for-supervision** | "Start only when I'm online" | Submit `--hold`; release via `scontrol release` when presence flips |
| **D — Low-load window** | "Run 50 seeds whenever the cluster is cheap" | Pick a historically low-traffic window; submit with `--begin=` or a job array |
| **E — Deadline-crunch** | "ICML in 10 days, run 50 seeds, finish 24h early" | Combination: array, QOS bump, chunking to fit backfill windows |
| **F — Cross-user coordination** | "Don't run while Alice's benchmark is on" | Defer / resubmit based on teammate state |

Most real requests are **A + D combined** — "get done by Friday, but don't
burn PC-mins during rush hour." Keep the modes composable.

## What the agent needs to know

### SLURM data sources (live state)

- `squeue -t PD,R -h -o "%i|%P|%T|%M|%L|%C|%b|%Q|%r|%S"` — everyone's queue. Per-row: jobid, partition, state, elapsed, time-left, CPUs, GRES, priority, reason, start-est.
- `squeue --start -j <ID>` — **SLURM's own backfill-predicted start time.** The killer feature. Built-in, no ML needed.
- `sinfo -N -O "NodeList,Partition,StateCompact,CPUsState,Gres,GresUsed,FreeMem"` — per-node free capacity.
- `scontrol show partition` — MaxTime, DefaultTime, PreemptMode.
- `scontrol show job <ID>` — EligibleTime, StartTime, EndTime for a specific job.
- `scontrol show reservation` — maintenance windows.
- `sprio -o "%.15i %.8u %.10Y %.10N %.10F %.10P %.10Q %.20T"` — priority breakdown (Age, Fairshare, JobSize, Partition, QOS).
- `sdiag` — scheduler-wide stats: backfill cycle time, queue depth, thread counts. Lightweight, good for health.

### SLURM data sources (history)

**The foundation is `sacct`, not polling `squeue`.** Post-completion it gives
us `Submit`, `Eligible`, `Start`, `End` timestamps — we can compute true
queue wait and true runtime without polling:

```
sacct -a -S yesterday -E today -X --parsable2 -o \
  JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,\
  Elapsed,CPUTime,State,ExitCode,ReqTRES,AllocTRES,ReqMem,\
  NodeList,Reason
```

A nightly cron dumps yesterday's jobs to `/vast/projects/<team>/betty-ai/traffic/YYYY-MM-DD.tsv`.
Two weeks of history is enough to warm the queue-wait model; 90 days gives
stable hour-of-week patterns.

Also valuable:
- `sreport cluster utilizationbyAccount -t hour` — per-account PC-min.
- `sreport cluster AccountUtilizationByUser` — per-user billing.

### Logs

- **User's own job output** — stdout/stderr in the submit dir. Agent reads
  these for post-mortem when a job fails or when it tunes time estimates.
- `/var/log/slurm/slurmctld.log`, `/var/log/slurm/slurmd.log` — admin-only
  on Betty (PARCC). We ask Jaime/ryb for:
  - BackfillCycleTime / BackfillDepth metrics (from `sdiag`)
  - Preemption events
  - Node-failure reason codes
- **Epilog hook** — if PARCC will install one, a Slurm job epilog that POSTs
  to our webhook gives us "job ended" notifications without polling. Ask ryb.

### Traffic + prediction

The question "when will my job actually start?" has three layers:

1. **`squeue --start`** — cheap, uses SLURM's own predictor. Always try first.
2. **Historical hour-of-week priors** — for a `(partition, gpu_count)`, what
   was the p50/p95 queue wait during this hour of this weekday over the past
   30 days? Use this when (1) returns "NotAvailable" or looks unstable.
3. **Contention signals** — `sdiag` backfill cycle time, total pending jobs,
   recent submissions by top-10 users. These modulate the historical prior.

### User-side sources

- **Google Calendar** (connector already mounted: `mcp__4382fddf-*`) —
  `list_events` + `suggest_time` give free/busy. Query on demand; don't cache.
- **Slack presence** (`mcp__97085f41-*` — `slack_read_user_profile`) — live
  online/DND/away status.
- **`team.yaml`** — timezone, working hours, do-not-disturb, deadlines,
  lab affiliation. Schema addition:

```yaml
user:
  name: Jeff Vadala
  pennkey: jvadala
  timezone: America/New_York
  working_hours: "09:00-18:00"      # default
  do_not_disturb: "22:00-07:00"     # no auto-released jobs overnight
  on_call_days: ["mon","tue","wed","thu","fri"]
  deadlines:
    - name: "ICML 2026"
      at: "2026-05-18T23:59:00-04:00"
      importance: high
```

- **`wiki/experiments/`** — per-run history already populated by the agent.
  We read these to learn the user's typical runtimes per model/dataset.

## Architecture — modular, five planes

**Design rule: every module has a typed interface, runs standalone, and is
feature-flag-gated.** No module requires another module's runtime to exist.
A mock implementation should satisfy every contract.

```
 ┌──────────────────────────────────────────────────────────────────┐
 │ 5. AGENT PLANE                                                   │
 │    - tool definitions (wraps 2–4)                                │
 │    - system-prompt fragment                                      │
 │    - swappable per provider (Claude Code / LiteLLM)              │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │
 ┌───────────────────────────────┴──────────────────────────────────┐
 │ 4. INTEGRATION PLANE — one module per external service           │
 │    calendar/    slack/    notify/    wiki-writer/                │
 │    each behind an interface; each optional; each feature-flagged │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │
 ┌───────────────────────────────┴──────────────────────────────────┐
 │ 3. SCHEDULING PLANE — pure functions, no I/O                     │
 │    modes/a-deadline/   modes/b-begin-block/   modes/d-low-load/  │
 │    planner/            budget-check/           conflict-check/   │
 │    input  = predictions + user state   output = sbatch flag set  │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │
 ┌───────────────────────────────┴──────────────────────────────────┐
 │ 2. PREDICTION PLANE — read-only queries over plane 1             │
 │    predict-start/   historical/   traffic-snapshot/   priors/    │
 │    each returns a typed `Prediction` with `confidence`           │
 └───────────────────────────────┬──────────────────────────────────┘
                                 │
 ┌───────────────────────────────┴──────────────────────────────────┐
 │ 1. DATA PLANE — nothing above depends on a specific source       │
 │    collectors/sacct-daily    collectors/squeue-live              │
 │    storage/tsv               storage/sqlite   storage/memory     │
 │    swappable: a fixture directory satisfies the contract         │
 └──────────────────────────────────────────────────────────────────┘
```

### Module boundaries (what each does, what it doesn't)

**Plane 1 — Data**
- One `Collector` interface: `run(): Promise<void>` writes to a `Storage`.
- One `Storage` interface: `read(query: Query): Promise<Row[]>`.
- Initial implementations: `SacctDailyCollector` + `TsvStorage`. A
  `FixtureStorage` (reads fixed TSVs from `test/fixtures/`) is how we test
  everything above without a cluster.
- Does NOT: know about scheduling, predictions, agents.

**Plane 2 — Prediction**
- One `Predictor` interface per signal. e.g.
  `predictStart(spec): Promise<Prediction>`, `historicalRuntime(user, model, partition): Promise<Distribution>`.
- Each implementation declares its data dependencies by name — the composer
  decides which storage to hand it.
- Does NOT: know about modes, users, calendars.

**Plane 3 — Scheduling**
- One module per mode. Each module exports a pure function:
  `plan(intent: SchedulingIntent, predictions: Predictions, state: UserState): Plan`.
- `Plan = { sbatch_flags: Record<string,string>, rationale: string[], budget_pc_min: number, risks: Risk[] }`.
- The planner picks which mode(s) to run based on intent; composable so
  Mode A + D can both produce constraints and we merge.
- Does NOT: execute anything, call external services.

**Plane 4 — Integration**
- One folder per service with a single entry point. Calendar, Slack,
  Notify, WikiWriter are peers.
- Every integration ships a `NullIntegration` that returns sentinel "not
  available" values. Agent must handle missing integrations gracefully.
- Does NOT: import from other integrations.

**Plane 5 — Agent**
- Tool definitions are thin adapters that wrap Planes 2–4.
- System-prompt fragment is versioned and loaded conditionally — if Mode B
  isn't enabled, the prompt doesn't mention calendar.
- Does NOT: contain scheduling logic. (That's Plane 3.)

### Feature flags

`betty-ai/configs/defaults.yaml` grows:

```yaml
scheduling:
  enabled: false
  modes:
    deadline_backward: false    # Mode A
    begin_block: false          # Mode B
    hold_supervised: false      # Mode C
    low_load: false             # Mode D
    deadline_crunch: false      # Mode E
    teammate_aware: false       # Mode F
  integrations:
    calendar: false
    slack_presence: false
    notify_on_completion: false
  data:
    collector: "sacct-daily"     # or "fixture" for dev
    storage: "tsv"               # or "sqlite", "memory"
    history_days: 30
    min_history_for_predictions: 14
```

Every module reads its flag at load time. The agent's system prompt is
assembled from fragments whose presence depends on enabled modules —
if `begin_block: false`, the prompt never mentions calendars, so the
model won't hallucinate that it can query them.

### Dependency direction is strictly one way

Plane N can import from Planes 1..N−1 only. Lint rule in CI; catches drift
before it ossifies.

### Not a separate sub-agent — a capability of the main agent

Rationale:
- Scheduling conversations spill into submission details anyway
- Shared context (wiki, models, partition specs) stays continuous
- One agent to prompt-tune, one tool budget to maintain

A separate agent definition only makes sense if the scheduling logic needs a
different model (cheaper/faster) or a different permission boundary. Neither
is true today.

### Tools to add (Phase 2.6)

1. **`slurm_queue_state`** — `squeue` snapshot, parsed into TypeScript types.
   Read-only, Tier 0 auto-approve.
2. **`slurm_predict_start`** — given `(partition, gpus, nodes, time)`, return
   `{slurm_estimate, historical_p50, historical_p95, confidence}`. Tier 0.
3. **`slurm_historical`** — wraps `sacct` for a user over a window; returns
   runtime + success + queue-wait distributions. Tier 0.
4. **`slurm_traffic_snapshot`** — reads our rolling TSV; returns per-hour-of-week
   patterns. Tier 0.
5. **`slurm_submit_scheduled`** — extends `cluster_submit` with `--begin`,
   `--hold`, `--dependency=afterok:...`, `--mail-type=END,FAIL`. Tier 2
   (always prompt) because it commits PC-mins.
6. **`calendar_find_free_block`** — wraps the calendar connector. Returns
   free intervals ≥ N hours in the next D days. Tier 1 (prompt once).
7. **`slack_status_check`** — wraps the slack connector for presence. Tier 0.
8. **`notify_on_completion`** — register a post-completion alert. Tier 1.

### Background collector

A tiny **launchd agent on Jeff's Mac** that runs every day at 06:15 local:

```
ssh login.betty.parcc.upenn.edu \
  "sacct -a -S '$(date -v-1d +%Y-%m-%d)' -E '$(date +%Y-%m-%d)' -X --parsable2 \
     -o JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,\
     Elapsed,State,ExitCode,ReqTRES,AllocTRES,NodeList,Reason" \
  > /vast/projects/<team>/betty-ai/traffic/$(date -v-1d +%Y-%m-%d).tsv
```

Why on the Mac, not Betty: we already have the ControlMaster socket; no new
cron on the cluster to coordinate with PARCC. Downside: only runs when
Mac is awake. Mitigation: the `install-kinit-renewal.sh` script already
handles the auth side; add a sibling `install-traffic-collector.sh`.

14 days of seed data → trust predictions. First call of any prediction tool
before that: "I'm still collecting history, only SLURM's own estimate is
available."

### Knowledge to file in the wiki (after decisions)

- `wiki/concepts/scheduling-modes.md` — the six modes A–F as a canonical
  reference the agent cites when picking a plan.
- `wiki/concepts/slurm-data-sources-for-scheduling.md` — the SLURM command
  cheat-sheet above, with stable URLs for sacct/squeue/sinfo.
- `wiki/concepts/queue-wait-patterns-betty.md` — empirical hour-of-week
  patterns; re-generated by the analysis script weekly.
- `wiki/concepts/known-bad-time-windows.md` — maintenance reservations,
  submission deadlines, monthly billing closes.
- `wiki/entities/researcher-jvadala.md` (and one per team member) — schedule
  profile, typical run patterns, deadline calendar.

## User flows (worked examples)

### Flow 1 — Mode A: deadline-backward

> **User:** "I need my Qwen LoRA done by 9am tomorrow."
>
> **Agent:**
> 1. `slurm_historical(user='jvadala', model='qwen2.5-vl-7b-instruct', partition='b200-mig90')` → p50 runtime 3h10m, p95 4h30m.
> 2. `slurm_predict_start(partition='b200-mig90', gpus=1)` → SLURM says 22 min wait; historical p95 is 45 min.
> 3. Work backward with p95s: latest-submit = 09:00 - 4h30m - 45m - 30m slack = 03:15.
> 4. "Submit now (finishes ~06:15) or `--begin=03:00:00` (finishes ~07:45)?"
> 5. On approval → `slurm_submit_scheduled(sbatch, begin=now|03:00)`.

### Flow 2 — Mode B: begin-block

> **User:** "I want to be around while this runs. Find me a 5-hour block."
>
> **Agent:**
> 1. `calendar_find_free_block(hours=5, next_days=5, within_working_hours=true)`
>    → Tomorrow 10:00–16:00 is open; next slot is Thursday.
> 2. "Submit with `--begin=2026-04-25T10:00`? (cluster currently has capacity; SLURM predicts 15 min wait at that time.)"

### Flow 3 — Mode D: low-load window

> **User:** "Run 50 seeds whenever the cluster is cheap."
>
> **Agent:**
> 1. `slurm_traffic_snapshot(partition='b200-mig45', window='30d')` → tue/wed 02:00–06:00 local is consistently <30% utilized.
> 2. "Submit as a 50-job array with `--begin=02:00`, `--time=4:00:00` per job, on b200-mig45? Budget: ~2500 PC-min (7% of remaining allocation)."

## Risks and mitigations

| Risk | Mitigation |
|------|------------|
| `squeue --start` is unstable when higher-priority jobs arrive | Always add a safety margin (p95, not p50); re-check 30 min before deadline. |
| Traffic history goes stale after hardware changes | Mark pre-change history as `superseded`; warm up 2 weeks. Auto-detect via node-count change in `sinfo`. |
| User's declared working hours lie | Cross-check with Slack presence + calendar activity; surface discrepancy. |
| Calendar data is sensitive | Query on demand only; never cache free/busy; OAuth consent per-session. |
| Preemption after QOS bump | Always warn before Mode E; offer `--requeue` on by default. |
| Timezone confusion | Store UTC, display local using `team.yaml:timezone`. |
| Epilog hook not available | Fall back to `--mail-type=END,FAIL` or polling. |

## Open questions for Jaime/ryb

1. Can we install a Slurm epilog script that POSTs to a webhook, or must we poll?
2. Is outbound mail from compute nodes enabled (`--mail-type`) or filtered?
3. Is there a Prometheus `slurm_exporter` we can scrape, or is `sdiag` the only handle?
4. Are reservations (`scontrol show reservation`) user-visible, or admin-only?
5. Can the agent request QOS bumps on the user's behalf (Mode E), or must the user email PARCC each time?
6. Is there a public iCal for maintenance windows we can subscribe to?
7. `sacct` retention — how far back does Betty's accounting DB keep job history?

## Phased build — each phase ships a module, not a feature bundle

Every phase ends with: typed interface merged + real impl + `Null*` impl +
vitest coverage + flag off by default. A module can ship without any phase
that follows it being started.

**Phase 2.6a — Data plane scaffolding (1 day):**
- `src/scheduling/data/types.ts` — `Collector`, `Storage`, `JobRow`, `Query`.
- `src/scheduling/data/storage-tsv.ts` — TSV reader/writer + `FixtureStorage`.
- `src/scheduling/data/collector-sacct-daily.ts` — shells out to SSH.
- Tests use `FixtureStorage` — no cluster needed.
- Flag: `scheduling.data.collector`.

**Phase 2.6b — `slurm_predict_start` module (2 days):**
- `src/scheduling/prediction/predict-start.ts` — wraps `squeue --start`.
- Standalone tool even if nothing else exists. The whole agent gets marginal
  value from just this one.
- Flag-gated individually.

**Phase 2.7a — `historical` + `traffic-snapshot` predictors (3–4 days):**
- Consumers of the TSV storage.
- Weekly analysis script → `wiki/concepts/queue-wait-patterns-betty.md`.
- Each a separate file, separate flag.

**Phase 2.7b — Mode A (deadline-backward) scheduler module (2 days):**
- `src/scheduling/modes/a-deadline.ts` — pure function, no I/O.
- Composes predictors from 2.6b + 2.7a.
- Test matrix: 10 scenario fixtures (tight deadline, loose deadline, infeasible).

**Phase 2.8a — Calendar integration (2 days):**
- `src/scheduling/integrations/calendar/` — `find_free_block` + `NullCalendar`.
- Wraps the MCP connector.
- Works without any mode enabled — can call standalone.

**Phase 2.8b — Mode B (begin-block) scheduler module (2 days):**
- Pure function; depends only on calendar integration's TYPE, not its impl.
- With `NullCalendar`, Mode B returns "no free blocks known — calendar
  integration disabled", gracefully.

**Phase 2.8c — Mode D (low-load) scheduler module (2 days):**
- Depends on traffic-snapshot predictor only.
- Orthogonal to Mode A/B; can ship independently.

**Phase 2.9a — Notify integration + epilog webhook (3 days, depends on ryb):**
- Standalone module, usable without any scheduling mode.

**Phase 2.9b — Modes C, E, F (optional extras):**
- Each its own module, each its own phase-slot. Ship when the underlying
  integrations are real.

### Shipping cadence

Since each module is flag-off by default, we can push to master any time
without affecting users. The first user-visible change is when we set
`scheduling.modes.deadline_backward: true` in `defaults.yaml` — probably
end of Phase 2.7b.

## Decisions needed from Jeff before we start

1. **Collector location** — launchd on your Mac (fast to ship) or a cron on Betty (survives laptop sleep)? I'd pick launchd first, revisit if we miss collections.
2. **Scope of v1** — ship Mode A only first (the simplest, most-valuable one), or go straight to A+B+D? I'd pick A only.
3. **Calendar consent** — OAuth the Google Calendar MCP on your account now, or defer until Phase 2.8? Defer is safer.
4. **QOS bumps (Mode E)** — are you allowed to request them yourself, or do you email PARCC? (Affects whether Mode E is worth building.)
5. **Who else is in the lab?** — determines whether Mode F matters in v1. If it's you solo, skip it.
6. **Data home** — `/vast/projects/<your-project>/betty-ai/traffic/` — what's the project name?
