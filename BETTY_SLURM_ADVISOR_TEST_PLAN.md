# Betty SLURM Advisor — Test Plan

**Companion to:** [`BETTY_SLURM_ADVISOR_REPORT.md`](BETTY_SLURM_ADVISOR_REPORT.md)
**Test artifacts:** [`betty-ai/slurm_advisor/tests/`](betty-ai/slurm_advisor/tests/)
**Results:** [`raw/docs/2026-04-27-test-results.md`](raw/docs/2026-04-27-test-results.md)

---

## 1. Goals

This plan derives directly from the six **design objectives** stated in [`BETTY_SLURM_ADVISOR_REPORT.md` §1.4](BETTY_SLURM_ADVISOR_REPORT.md#14-design-objectives-with-acceptance-criteria). Each test in the matrix below maps to at least one acceptance criterion in that section; if a test fails, an objective is unmet and the design is wrong.

The acceptance criteria that this test plan does *not* yet cover live at the boundary between the advisor and real Betty operations — wait-time prediction accuracy, fairshare half-life calibration, backfill-window assumptions — and depend on answers to the [§1.5 open policy questions](BETTY_SLURM_ADVISOR_REPORT.md#15-open-policy-questions-affecting-design). Until those answers exist, the test plan validates *the design as described*; not *the design as appropriate for production Betty operations*. That distinction is load-bearing for Ryan's review.

The advisor's value depends on it being *correct in ordinary cases* and *honest in unusual ones*. This test plan exercises the system across the dimensions a real PARCC researcher will hit, and produces a scoreboard so we can see — at a glance — which dimensions the system handles well and which still need work.

Three complementary test layers:

| Layer | Count | Purpose |
|---|---|---|
| **Unit** ([`test_parser.py`](betty-ai/slurm_advisor/tests/test_parser.py), [`test_recommender.py`](betty-ai/slurm_advisor/tests/test_recommender.py), [`test_availability.py`](betty-ai/slurm_advisor/tests/test_availability.py), [`test_load_curve.py`](betty-ai/slurm_advisor/tests/test_load_curve.py)) | 28 | Per-function correctness (parser, policy, MiniZinc model, ranker) |
| **Scenario matrix** ([`test_scenarios.py`](betty-ai/slurm_advisor/tests/test_scenarios.py)) | 80+ parametrized cases | Multi-dimensional cross-product across realistic researcher inputs |
| **TS adapter** ([`slurm-availability.test.ts`](betty-ai-web/src/agent/tools/slurm-availability.test.ts)) | 7 | sinfo / squeue parsers, regex correctness for typed GRES |

Out of scope for this plan (tracked separately):
- **Live SLURM behavior** — non-deterministic, depends on cluster state. Verified via point-in-time E2E browser tests in [`raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md`](raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md).
- **LLM phrasing of card narration** — the contract is "paste the fenced block verbatim." Phrasing variation is acceptable; tested by the model's adherence to the contract, verified manually.
- **Multi-user authentication** — pending OOD deployment.

---

## 2. Dimensions to vary

The scenario matrix is a controlled cross-product across these axes. Not every combination is meaningful; we test the meaningful ones plus edge cases.

| Dimension | Values |
|---|---|
| **GPU count** | 0 (CPU-only), 1, 2, 4, 8, 16, 32 (multi-node), 41 (over QOS cap) |
| **VRAM per GPU** (when GPUs > 0) | None (no constraint), 40 GB (fits MIG-45), 50 GB (excludes MIG-45), 100 GB (excludes both MIGs), 192 GB (only full B200), 256 GB (infeasible) |
| **CPU count** (when GPUs = 0) | 1, 8, 32, 64, 128, 200 |
| **Memory** (optional override) | None, 32 GB, 200 GB, 1024 GB (large-mem partition only), 4096 GB (exceeds node) |
| **Walltime hours** | 0.25, 1, 4, 12, 24, 48, 168 (full week), 200 (over partition max) |
| **Partition preference** | None, `dgx-b200`, `b200-mig45`, `b200-mig90`, `genoa-std-mem`, `genoa-lrg-mem`, `fake-partition` |
| **QOS preference** | None, `normal`, `dgx`, `gpu-max`, `genoa-std`, `fake-qos` |
| **Interactive flag** | `True`, `False` |
| **Time-of-day** (availability) | 02:00 (off-peak quiet), 11:00 (peak), 18:00 (off-peak shoulder), 23:00 (winding down) |
| **Cluster state** (availability) | empty, idle (≥80% free), mixed, saturated (0 idle), with-blackout |
| **Pending depth** (availability) | 0, 5, 50, 200 |
| **Future offset** (availability) | now, 1h, 12h, 24h, 7d |
| **Sbatch shape** (check) | clean, missing-shebang, over-cpu-soft, over-cpu-hard, over-mem, over-time-soft, over-time-hard, unknown-partition, gpu-on-cpu-partition, qos-not-allowed, multi-violation |
| **SLURM Reason code** (diagnose) | Resources, Priority, QOSMaxJobsPerUserLimit, AssocGrpGRES, ReqNodeNotAvail, BeginTime, Dependency, JobHeldUser, novel-unknown |

---

## 3. Researcher persona suite

Ten realistic researcher scenarios, each modeling a distinct usage pattern PARCC sees. These are the "happy path" tests — if the advisor doesn't handle these correctly, it isn't useful.

| Persona | Workload | Intent | Expected outcome |
|---|---|---|---|
| **Frank — LoRA fine-tune** | Llama-3-8B with LoRA, fits in 24 GB | `gpus=1, hours=4` | Cheapest GPU partition that fits; should land on `b200-mig45` |
| **Maya — full fine-tune** | Llama-3-70B full FT, needs 80+ GB/GPU | `gpus=4, hours=24, min_vram_gb=80` | `dgx-b200` only; both MIG partitions excluded |
| **Diego — distributed train** | Multi-node 16 GPU pre-training | `gpus=16, hours=48` | `dgx-b200`, 2 nodes × 8 GPUs |
| **Priya — interactive debug** | Quick GPU sanity check | `gpus=1, hours=0.5, interactive=True` | Walltime stays at 0.5h; cheapest GPU partition |
| **Carlos — CPU genomics** | Multi-threaded analysis | `cpus=32, hours=12` | `genoa-std-mem` |
| **Aisha — GROMACS MD** | Long simulation | `gpus=4, hours=168` (7 days) | At soft cap edge; emits backfill warning but feasible |
| **Tom — vLLM serving** | Inference endpoint | `gpus=1, hours=24` | Cheapest GPU partition; recommend should not warn (24h is at edge) |
| **Lin — submit now** | Time-sensitive, needs soonest start | `gpus=2, hours=8` + availability call | Top slot = "now" or near-now offset |
| **Pat — Friday for weekend** | Pre-scheduled batch | `gpus=2, hours=48` + availability call with `earliest=Friday 18:00` | Slots constrained to Friday-onward |
| **Bob — over budget** | Request exceeds QOS cap | `gpus=41, hours=24` | Either constrained to 40 GPUs (gpu-max) or infeasible with explanation |

Each persona test verifies (where applicable):

1. **Feasibility** — does the recommend return `feasible: true`?
2. **Partition correctness** — did it pick a partition where the workload actually fits (VRAM, CPU/GPU ratio, node count)?
3. **Sbatch validity** — does the generated sbatch pass `slurm_check`?
4. **Cost direction** — does the billing score rank correctly relative to alternatives?
5. **Honesty signals** — when something is missing (VRAM not constrained, synthetic curve, SSH down), is it labeled?

---

## 4. Quality criteria per tool

What "correct" means for each output, beyond just code not crashing.

### 4.1 `slurm_recommend`

- ✅ **Feasibility**: `feasible: true` when at least one partition can satisfy the request.
- ✅ **VRAM safety**: when `min_vram_gb` is set, no partition with `gpu_vram_gb < min_vram_gb` appears in the result.
- ✅ **VRAM disclosure**: when `min_vram_gb` is unset, the `vram_constraint.enforced` field is `false` and the disclaimer message contains "not constrained".
- ✅ **Geometry**: `nodes * gpus_per_node ≥ requested_gpus`; the pack is tight (no over-allocation).
- ✅ **Soft caps respected**: `cpus_per_task ≤ 28` per GPU on dgx-b200 unless explicitly overridden.
- ✅ **Walltime sane**: never exceeds `max_walltime_seconds[partition]`; capped at 4h when `interactive`.
- ✅ **Self-consistent**: the generated sbatch block, fed back into `slurm_check`, returns `status: ok` (or `revise` for soft warnings only — never `block`).
- ✅ **Cost monotonicity**: if request A is a strict subset of request B (fewer GPUs OR fewer hours OR smaller partition), then A's billing score ≤ B's.

### 4.2 `slurm_check`

- ✅ **All expected violations caught** (no false negatives). Each scenario explicitly lists the codes that must appear.
- ✅ **No false positives** on clean scripts — `status: ok` and zero error-severity issues.
- ✅ **Suggested fix is itself valid** — the `suggested_sbatch` block, when parsed and re-checked, returns `status: ok` or `revise` (warnings only).
- ✅ **Severity correctness** — hard violations are `error`, lore-based caps are `warn`.

### 4.3 `slurm_availability`

- ✅ **Slots ranked descending by score**.
- ✅ **Synthetic curve labeled red** in the `load_curve_kind` field whenever no historical file is present.
- ✅ **Pending penalty applied** — when `pending_jobs_by_partition[p] > 0`, the score includes `-min(pending/50, 1.0)` and the `reasons` list mentions it.
- ✅ **Empty sources handled** — when SSH fails, `sources: []` and the card UI's Pre-validation banner fires.
- ✅ **Blackout windows excluded** — slots overlapping a `BlackoutWindow` are not returned.
- ✅ **Future-bounded** — slots beyond `latest` are not returned.
- ✅ **Privacy** — no per-job IDs anywhere in the output payload.

### 4.4 `slurm_diagnose`

- ✅ **Reason mapping** — each well-known SLURM Reason code produces a non-empty `likely_causes` and `suggested_actions` list.
- ✅ **Walltime backfill heuristic** — any pending job with `TimeLimit > 24h` triggers a backfill-related cause regardless of the SLURM Reason.
- ✅ **Unknown reason** — produces a fallback "no canned advice" entry rather than crashing or fabricating.
- ✅ **Field extraction** — `request.partition`, `request.qos`, `request.time_limit`, `request.tres` are populated when present in the scontrol output.

---

## 5. How to run

### Full suite (deterministic, no SSH required)

```bash
cd betty-ai
python3 -m pytest slurm_advisor/tests/ -v
```

Expected: **all green, zero failures**. If any scenario regresses, the responsible PR must explain the trade-off in the commit message and update this plan's "known divergences" section.

### Per-dimension breakdown

Each scenario is tagged with a `dimension` marker so you can filter:

```bash
# Run only the VRAM matrix
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k vram

# Run only the persona suite
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k persona

# Run the slurm_check scenario matrix
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k check_scenario
```

### Scoreboard generation

```bash
python3 -m pytest slurm_advisor/tests/test_scenarios.py --tb=no -q | \
  python3 -m slurm_advisor.scripts.scoreboard > raw/docs/2026-04-27-test-results.md
```

This produces a markdown table showing pass/fail per dimension, captured into the dated results doc for review.

---

## 6. What we DON'T test (and why)

A short list, kept honest:

- **Live SLURM scheduler decisions.** Whether a job actually starts at the predicted time depends on the cluster's instantaneous state, which is non-reproducible. Tested via point-in-time E2E only.
- **MiniZinc solver internals.** We trust gecode/cbc to be correct; we test that *our model* produces sensible results when the solver runs.
- **The OpenSSH transport.** `runRemote` is treated as a black box; tested with mocks in TS adapter tests, exercised live in browser tests.
- **LLM tool selection.** Whether the model decides to call `slurm_recommend` vs. `slurm_check` for a given user message is a system-prompt behavior, verified via the anti-hallucination contract tests in §6.2 of the main report.
- **Auth flow.** No automated test currently fails or recovers from kinit expiry; the system degrades gracefully, verified via the "expired Kerberos" E2E case.
- **Adversarial inputs.** A user typing `; rm -rf /` into the chat is handled at the command-whitelist layer, tested in [`whitelist.test.ts`](betty-ai-web/src/agent/cluster/whitelist.test.ts), not here.

---

## 7. Maintenance

When the system grows, this plan grows with it:

- **New tool** → add a Quality Criteria subsection in §4 + a scenario matrix block in §3 + tests in `test_scenarios.py`.
- **New partition in `betty_cluster.yaml`** → review the persona suite in §3 to see if any persona's expected partition should change; add new persona if the partition serves a distinct workload class.
- **New SLURM Reason code in `_REASON_GUIDE`** → add a row to the diagnose dimension in §2 and a corresponding test.
- **Policy change (e.g., new soft cap)** → update §4 and add a test that verifies the cap is enforced AND a test that verifies it can be intentionally overridden.

If a scenario starts failing, the appropriate response is one of:
1. **Fix the bug** in the code.
2. **Update the expected behavior** in the test, with a commit message explaining why the behavior change is intentional.
3. **Mark the test as `pytest.xfail`** with a reason and a tracking ticket.

Silent test deletions are not acceptable.
