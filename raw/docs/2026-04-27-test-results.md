# Betty SLURM Advisor — test matrix results

**Run date:** 2026-04-27
**Plan:** [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../../BETTY_SLURM_ADVISOR_TEST_PLAN.md)
**Test file:** [`betty-ai/slurm_advisor/tests/test_scenarios.py`](../../betty-ai/slurm_advisor/tests/test_scenarios.py)
**Run command:** `cd betty-ai && python3 -m pytest slurm_advisor/tests/ -v`

---

## Summary

| Suite | Cases | Pre-fix pass rate | Post-fix pass rate | After Round 2 fixes |
|---|---|---|---|---|
| Existing unit tests (`test_parser`, `test_recommender`, `test_availability`, `test_load_curve`) | 28 | 28/28 (100%) | 28/28 (100%) | 28/28 (100%) |
| **Scenario matrix** (`test_scenarios.py`) | 70 → **82** | 66/70 (94.3%) | 70/70 (100%) | **82/82 (100%)** |
| TS adapter tests | 7 → **18** | 7/7 (100%) | 7/7 (100%) | **18/18 (100%)** |
| **Total** | 105 → **128** | 101/105 (96.2%) | 105/105 (100%) | **128/128 (100%)** |

**Round 1** (initial scenario matrix): the first run surfaced **four real findings** the unit tests had not caught. Three were correctness gaps in the code (walltime rejection reasons, QOS GPU-cap, NVLink awareness); one was a wrong test premise. All four closed — details in §3.

**Round 2** (acting on documented gaps): four additional fixes shipped to address items the test matrix flagged as deferred — `sprio` integration, defensive `sshare` parser, reservation auto-feed, dev historical curve seeding. **23 new tests** (12 Python scenarios + 11 TS parser tests) added to lock in the contracts. Details in §4.

---

## 1. Per-dimension pass-rate scoreboard

After applying fixes (§3), every dimension is at 100%. The matrix below is the *complete* breakdown so reviewers can see what was actually exercised.

### 1.1 Recommend — hardware variations

| Case | GPUs | Hours | Result |
|---|---|---|---|
| `1gpu-no-vram-4h` | 1 | 4 | ✅ |
| `2gpu-no-vram-8h` | 2 | 8 | ✅ |
| `4gpu-no-vram-12h` | 4 | 12 | ✅ |
| `8gpu-no-vram-24h` | 8 | 24 | ✅ |
| `16gpu-no-vram-12h` | 16 | 12 | ✅ |

**Coverage:** 1, 2, 4, 8, 16 GPUs across single-node and multi-node packings. All landed on a GPU partition with a tight pack (no over-allocation, no under-allocation).

### 1.2 Recommend — VRAM safety matrix

| Case | `min_vram_gb` | Allowed partitions | Excluded | Result |
|---|---|---|---|---|
| `vram-40-fits-all` | 40 | dgx-b200, mig-45, mig-90 | (none) | ✅ |
| `vram-50-excludes-mig45` | 50 | dgx-b200, mig-90 | mig-45 | ✅ |
| `vram-100-only-full` | 100 | dgx-b200 | mig-45, mig-90 | ✅ |
| `vram-192-only-full` | 192 | dgx-b200 | mig-45, mig-90 | ✅ |
| `vram-256-infeasible` | 256 | (none) | all three | ✅ infeasible w/ reasons |
| `vram-disclosure-when-unset` | None | all GPU partitions | — | ✅ disclaimer rendered |

**Coverage:** the ladder from "fits everywhere" to "infeasible". The infeasible case correctly returns `feasible=False` with all three GPU partitions listed in `result.rejected`. The disclosure-when-unset case is the safety net for ML workloads where the agent forgot to compute VRAM.

### 1.3 Recommend — walltime handling

| Case | Hours | `interactive` | Expected `time_seconds` | Result |
|---|---|---|---|---|
| `interactive-30min-stays` | 0.5 | True | 1800 | ✅ |
| `interactive-2h-stays` | 2 | True | 7200 | ✅ |
| `interactive-4h-at-cap` | 4 | True | 14400 | ✅ |
| `interactive-10h-capped-to-4` | 10 | True | 14400 | ✅ (cap fired) |
| `batch-12h-untouched` | 12 | False | 43200 | ✅ |
| `batch-24h-untouched` | 24 | False | 86400 | ✅ |
| `batch-7day-untouched` | 168 | False | 604800 | ✅ |
| `walltime-over-partition-max` | 200 | False | — | ✅ infeasible w/ reasons (post-fix) |

**Coverage:** the interactive cap (4h) fires correctly even when the request is 10h; batch jobs are honored up to the partition's 7-day max. The 200h case (over the max) was pre-fix where Finding #1 was caught (see §3).

### 1.4 Recommend — CPU-only workloads

| Case | CPUs | Hours | Expected partition class | Result |
|---|---|---|---|---|
| `cpu-1core-1h` | 1 | 1 | genoa-* | ✅ |
| `cpu-8core-4h` | 8 | 4 | genoa-* | ✅ |
| `cpu-32core-12h` | 32 | 12 | genoa-* | ✅ |
| `cpu-64core-24h` | 64 | 24 | genoa-* | ✅ |
| `cpu-128core-48h` | 128 | 48 | genoa-* | ✅ |

**Coverage:** zero accidental routing of CPU-only jobs to GPU partitions across the ladder.

### 1.5 Persona suite (10 realistic researchers)

| Persona | Workload | Result |
|---|---|---|
| **Frank** — LoRA Llama-3-8B (1 GPU × 4h, 24 GB VRAM) | ✅ |
| **Maya** — full FT Llama-3-70B (4 GPUs × 24h, 192 GB VRAM) | ✅ post-fix |
| **Diego** — distributed 16-GPU training, NVLink required | ✅ post-fix |
| **Priya** — interactive debug (1 GPU × 0.5h) | ✅ |
| **Carlos** — CPU genomics (32 cores × 12h) | ✅ |
| **Aisha** — GROMACS MD (4 GPUs × 7d) | ✅ |
| **Tom** — vLLM serving (1 GPU × 24h) | ✅ |
| **Lin** — submit now (top slot near "now") | ✅ |
| **Pat** — Friday-onward planning (slots respect `earliest`) | ✅ |
| **Bob** — over-budget 41 GPUs (above gpu-max QOS cap) | ✅ post-fix |

**Coverage:** the realistic-user happy paths plus three edge cases (interactive cap, 7d max, over-cap). Maya, Diego, and Bob all surfaced fixes — see §3.

### 1.6 Cost monotonicity invariants

| Invariant | Result |
|---|---|
| More GPUs (same partition, same hours) → higher billing | ✅ |
| Longer walltime (same partition, same GPUs) → higher billing | ✅ |
| Full B200 > MIG-45 cost for identical 2-GPU × 8h | ✅ |

**Coverage:** the math underlying the recommend objective. If a regression broke the YAML billing weights, these would catch it.

### 1.7 Check — sbatch violation matrix

| Scenario | Status | Codes that must fire | Codes that must NOT fire | Result |
|---|---|---|---|---|
| `clean-1gpu-12h` | `ok` | (none) | CPU/MEM/TIME warnings | ✅ |
| `over-cpu-soft` (24 ≤ 28) | `ok` | (none) | CPU_PER_GPU_HIGH | ✅ |
| `over-cpu-hard` (128 > 28) | `block` | CPU_PER_GPU_OVER_NODE_LIMIT | — | ✅ |
| `over-mem-soft` (300 > 224 GB/GPU) | `revise` | MEM_PER_GPU_HIGH | — | ✅ |
| `over-time-backfill` (2 days) | `revise` | TIME_HURTS_BACKFILL | TIME_OVER_PARTITION_MAX | ✅ |
| `unknown-partition` | `block` | UNKNOWN_PARTITION | — | ✅ |
| `gpu-on-cpu-partition` | `block` | GPU_ON_CPU_PARTITION | — | ✅ |
| `qos-not-allowed` | `block` | QOS_NOT_ALLOWED | — | ✅ |
| `multi-violation` | `block` | CPU + MEM + TIME (all three) | — | ✅ |
| `suggested-fix-fixpoint` | (re-checked passes) | — | — | ✅ |

**Coverage:** every code in the violation registry, every status level, plus the fixpoint test confirming `suggested_sbatch` itself doesn't re-block. No false positives, no false negatives.

### 1.8 Availability — cluster state × time-of-day

| Cluster state | Hour (UTC) | Result |
|---|---|---|
| `idle` (200/216 free) | 12:00 | ✅ |
| `idle` | 00:00 | ✅ |
| `mixed` (64/216, 12 pending) | 12:00 | ✅ |
| `saturated` (0/216, 50 pending) | 12:00 | ✅ |
| `saturated` | 03:00 | ✅ |
| `with-blackout` (24h MAINT) | 12:00 | ✅ slots avoid blackout |
| `empty` (no live data) | 12:00 | ✅ degrades to synthetic-only |

**Plus:**

| Invariant | Result |
|---|---|
| Idle cluster top-slot scores higher than saturated | ✅ |
| Pending queue depth lowers score (penalty appears in reasons) | ✅ |
| Blackout windows excluded from results | ✅ |
| Slots ranked descending by score | ✅ |

**Coverage:** every cluster state we'd plausibly see, plus the score-direction invariants.

### 1.9 Availability — privacy and source-tagging

| Property | Result |
|---|---|
| No `JobID` strings in serialized payload | ✅ |
| Synthetic curve correctly labeled in `reasons` | ✅ |

**Coverage:** §5.4 of the main report (privacy posture for `squeue --start`) verified at the data layer, not just by code comment.

### 1.10 Diagnose — SLURM Reason code mapping

| Reason code | Test ID | Result |
|---|---|---|
| `Resources` (1h walltime) | `resources-short-wall` | ✅ |
| `Resources` (2-day walltime → backfill warn) | `resources-long-wall-triggers-backfill-warn` | ✅ |
| `Priority` | `priority` | ✅ |
| `QOSMaxJobsPerUserLimit` | `qos-max-jobs` | ✅ |
| `QOSGrpGRESMinutes` | `qos-grp-gres` | ✅ |
| `ReqNodeNotAvail` | `req-node-not-avail` | ✅ |
| `AssocGrpGRES` | `assoc-grp-gres` | ✅ |
| `Dependency` | `dependency` | ✅ |
| `BeginTime` | `begin-time` | ✅ |
| `WeirdNewReasonV99` (unknown) | `unknown-reason` | ✅ falls back gracefully |
| Long walltime + any reason | `long-walltime-always-warns` | ✅ |
| Field extraction (Partition, QOS, TimeLimit, TRES) | `field-extraction` | ✅ |

**Coverage:** every entry in `_REASON_GUIDE` plus an unknown-reason fallback test plus the cross-cutting walltime backfill heuristic.

---

## 2. Test inventory

| File | Tests | Purpose |
|---|---|---|
| [`test_parser.py`](../../betty-ai/slurm_advisor/tests/test_parser.py) | 6 | sbatch / time / mem unit parsing |
| [`test_recommender.py`](../../betty-ai/slurm_advisor/tests/test_recommender.py) | 12 | check/recommend/diagnose end-to-end (existing) |
| [`test_availability.py`](../../betty-ai/slurm_advisor/tests/test_availability.py) | 3 | core slot ranking |
| [`test_load_curve.py`](../../betty-ai/slurm_advisor/tests/test_load_curve.py) | 7 | real vs synthetic curve loading |
| [`test_scenarios.py`](../../betty-ai/slurm_advisor/tests/test_scenarios.py) | **70** | scenario matrix (this report) |
| [`slurm-availability.test.ts`](../../betty-ai-web/src/agent/tools/slurm-availability.test.ts) | 7 | sinfo + squeue parsers |
| **Total** | **105** | |

---

## 3. Findings from the first matrix run

The first run produced 4 failures across 70 tests (94.3% pass rate). Each is documented here with what the test caught, what we did about it, and the resulting code/test change.

### Finding 3.1 — Walltime infeasibility returned no rejection reasons

**Test:** `test_recommend_walltime_over_partition_max_clipped` (200h request)

**Pre-fix behavior:** `recommend(JobIntent(gpus=1, hours=200))` returned `feasible=False` with an empty `rejected` list. The user got no explanation of *why* the request was infeasible.

**Root cause:** the MiniZinc solver's "no feasible assignment" branch returned a bare infeasibility result without enumerating which constraint failed for which partition. MZN itself doesn't distinguish failure modes; the Python solver does.

**Fix:** when MZN finds no solution, fall back to `PythonSolver.solve(policy, intent)` and return that result with a note that MZN was tried first. The Python path produces partition-specific rejection reasons ("req 200:00:00 exceeds partition max 7-00:00:00", etc.).

**Code:** [`solver.py`](../../betty-ai/slurm_advisor/solver.py) — MZN-no-solution branch now invokes Python fallback.

### Finding 3.2 — QOS GPU-cap not enforced (Bob's 41-GPU request)

**Test:** `test_persona_bob_over_qos_cap` (41 GPUs requested; gpu-max QOS caps at 40)

**Pre-fix behavior:** the solver returned a 42-GPU configuration (6 nodes × 7 GPUs/node) on dgx-b200. Partition geometry alone was honored; the QOS layer was completely absent from the constraint model.

**Root cause:** the MiniZinc model carried per-partition `cpus_per_node`, `gpus_per_node`, `mem_gb_per_node`, `max_nodes`, and `max_walltime_s`, but no per-partition QOS GPU cap. The Python path was the same.

**Fix:**
1. Added `_max_qos_gpu_cap(policy, partition)` helper that returns the most permissive GPU cap among QOSes allowed on the partition (e.g., dgx-b200's allowed_qos=[normal:8, dgx:32, gpu-max:40] → 40).
2. Added `array[PART] of int: max_qos_gpus` to the MZN model and the constraint `nodes * gpus_per_node_out <= max_qos_gpus[pidx]` (gated on `max_qos_gpus > 0`).
3. Mirror change in `_shape_for` and the Python solver loop, with a specific rejection reason: `"req 41 GPUs exceeds QOS cap 40"`.

**Code:** [`solver.py`](../../betty-ai/slurm_advisor/solver.py) — new `_max_qos_gpu_cap` helper, updated MZN model, updated `_shape_for`.

### Finding 3.3 — No interconnect awareness for distributed training (Diego)

**Test:** `test_persona_diego_distributed_training` (16 GPUs × 48h)

**Pre-fix behavior:** advisor routed 16 GPUs to b200-mig45 (32 MIG slices/node, fits in 1 node, cheapest billing). This is *technically legal* under cluster geometry but *performance-catastrophic* for distributed training: MIG slices have no NVLink between siblings (the YAML correctly reports `nvlink: false` on MIG partitions), so tensor-parallel all-reduce would saturate PCIe instead of NVLink.

**Root cause:** the constraint model did not consider interconnect topology. The cluster YAML had `nvlink: true|false` per partition, but `Policy.load` wasn't reading the field.

**Fix:**
1. Added `nvlink: bool` to `PartitionSpec` in [`policy.py`](../../betty-ai/slurm_advisor/policy.py); `Policy.load` now reads `nvlink` from the YAML (default false).
2. Added `requires_nvlink: bool` to `JobIntent`. When True, `_candidate_partitions` excludes any partition with `nvlink: false` *before* the constraint solver runs, with rejection reason "nvlink=false; required by distributed training".
3. Diego's persona test now passes `requires_nvlink=True` and asserts the advisor routes to dgx-b200 with multi-node packing.

**Code:** [`policy.py`](../../betty-ai/slurm_advisor/policy.py) (`PartitionSpec` field + Policy.load), [`solver.py`](../../betty-ai/slurm_advisor/solver.py) (`JobIntent` field + `_candidate_partitions` filter).

### Finding 3.4 — Test premise was wrong (Maya at 80 GB)

**Test:** `test_persona_maya_full_finetune_70b` (originally `min_vram_gb=80`)

**Pre-fix behavior:** Maya requested 4 GPUs × 24h with `min_vram_gb=80`. The advisor correctly picked b200-mig90 (which has 90 GB VRAM, clearing the 80 GB floor). The test failed because it expected dgx-b200.

**Root cause:** the test premise. 70B fine-tuning *can* run on 90 GB MIG slices with offloading or sharding, so a strict 80 GB floor is permissive. The persona should pass `min_vram_gb=192` to model the "needs full unsharded weights" case.

**Resolution:** updated the test to use `min_vram_gb=192` with a comment explaining the nuance (90 GB sometimes works for 70B with offloading; 192 GB is the unsharded case). The advisor's behavior was correct; the test was wrong.

**Note on the underlying capability gap:** the advisor still doesn't know whether *this* researcher's 70B job is the offloading case or the unsharded case. The agent has to ask, or pipe in the model+method via `gpu_calculate` which does the math. This is documented in [`BETTY_SLURM_ADVISOR_REPORT.md`](../../BETTY_SLURM_ADVISOR_REPORT.md) §7.

---

## 4. Round 2 — fixes addressing documented gaps

After §3 closed the matrix's first-run findings, four additional fixes shipped the same day to address gaps the matrix had flagged as deferred. Each fix came with both code and tests so the contracts are locked in.

### 4.1 — `sprio` priority decomposition in `slurm_diagnose`

**Gap addressed.** "Your job is pending because higher-priority jobs are queued ahead" was the only explanation the diagnose card could give for `Reason=Priority`. Researchers couldn't tell which priority factor (AGE / FAIRSHARE / JOBSIZE / PARTITION / QOS / TRES) was the bottleneck, so they couldn't act on it.

**Fix.** `slurm_diagnose` now runs `sprio -hl -j <id>` in parallel with `scontrol show job <id>`. The Python diagnoser identifies the dominant bottleneck factor (smallest non-zero ppm value) and dispatches factor-specific advice from `_FACTOR_ADVICE` — e.g., a low FAIRSHARE factor surfaces "your account has been running heavy recently; check usage with `parcc_sreport.py --user <pennkey>`". The diagnose card renders the per-factor breakdown as a sortable table with bottleneck/helper highlighting.

**Tests added.** Six new tests in [`test_scenarios.py`](../../betty-ai/slurm_advisor/tests/test_scenarios.py) §K:
- `test_parse_sprio_extracts_factor_columns` — locks the column-by-name extraction
- `test_parse_sprio_handles_empty_input`, `test_parse_sprio_handles_missing_data_line` — defensive paths
- `test_diagnose_with_sprio_identifies_fairshare_bottleneck` — FAIRSHARE-specific advice surfaces
- `test_diagnose_with_sprio_identifies_jobsize_bottleneck` — JOBSIZE-specific advice surfaces
- `test_diagnose_without_sprio_falls_back_to_reason_only` — backwards compat

### 4.2 — Defensive `sshare` parser

**Gap addressed.** The earlier evidence report flagged `sshare` rows whose values matched columns from a different tool, suggesting either an MOTD wrapper or a SLURM version difference. Without a defensive parser the recommend card was rendering nonsense rows.

**Fix.** [`parseSshareDefensive`](../../betty-ai-web/src/agent/tools/slurm-recommend.ts) drops three classes of suspect rows: wrong column count (MOTD preamble), header-keyword in `User` column, and non-numeric `RawUsage` / `FairShare`. Drops are *counted* and surfaced — the recommend card shows "N suspicious rows dropped" with up to 3 verbatim samples.

**Tests added.** Six new tests in [`slurm-availability.test.ts`](../../betty-ai-web/src/agent/tools/slurm-availability.test.ts):
- `accepts well-formed sshare rows` — happy path
- `drops rows whose User column is a header word` — the actual symptom we observed
- `drops rows where numeric columns are not numeric`
- `drops MOTD-style preamble lines`
- `limits dropped_samples to 3 even when many rows are dropped`
- `preserves parent-account rows with empty FairShare` — false-positive prevention

### 4.3 — Reservation auto-feed into `slurm_availability`

**Gap addressed.** The Python ranker has always supported `BlackoutWindow` exclusions, but `fetchSnapshot` wasn't fetching reservations from SLURM, so slots overlapping maintenance windows were still recommended.

**Fix.** `fetchSnapshot` now runs `scontrol show res` in parallel with `sinfo` and `squeue --start`. [`parseScontrolReservations`](../../betty-ai-web/src/agent/tools/slurm-availability.ts) extracts MAINT/FLEX flags and partition scope, mapped into `BlackoutWindow` entries.

**Tests added.** Two scenarios in [`test_scenarios.py`](../../betty-ai/slurm_advisor/tests/test_scenarios.py) §M:
- `test_availability_excludes_partition_specific_blackout` — partition-scoped reservation doesn't block other partitions
- `test_availability_excludes_global_blackout` — `partition=None` reservation blocks everything

Plus five TS parser tests:
- `parses a maintenance window with partition scope`
- `handles global reservations without PartitionName`
- `separates multiple reservation stanzas`
- `skips reservations with null timestamps`
- `returns empty array on empty input`

### 4.4 — Dev historical load curve seeder

**Gap addressed.** Until the production sacct→features pipeline runs nightly, every dev environment shows `load_curve_kind: synthetic` and the loader code path that production will use is untested.

**Fix.** [`slurm_advisor/scripts/seed_dev_load_curves.py`](../../betty-ai/slurm_advisor/scripts/seed_dev_load_curves.py) generates `data/features/partitions/<p>.json` files with configurable hour-of-day shapes (`academic` | `flat` | `nighttime-heavy` | `weekend-quiet`). Every seeded file carries `_dev_seed_marker: true` so review tooling can detect accidental seeding on production.

**Tests added.** Three round-trip tests in [`test_scenarios.py`](../../betty-ai/slurm_advisor/tests/test_scenarios.py) §N:
- `test_seed_dev_curves_writes_partition_files` — file is loadable by `availability.load_real_load_curve`
- `test_seed_dev_curves_marker_present_for_audit` — `_dev_seed_marker` field present
- `test_propose_slots_uses_seeded_curve_after_seeding` — full E2E: seed → propose → `load_curve_kind=historical`

---

## 5. Coverage gaps still pending

This matrix exercises everything our deterministic test infrastructure can reach. The remaining gaps require live cluster state, multi-user infrastructure, or follow-up plumbing:

| Gap | Where it sits | Tracking |
|---|---|---|
| Live SLURM scheduler behavior (does the picked shape actually start when squeue says it will?) | E2E browser tests with real cluster | [evidence report](2026-04-27-slurm-advisor-evidence-report-ryb.md) |
| Multi-user agent process (each PennKey gets their own backend) | OOD Batch Connect deployment | [main report §8.1](../../BETTY_SLURM_ADVISOR_REPORT.md#81-open-ondemand-batch-connect-deployment-multi-user) |
| `sshare` raw stdout investigation (parser quirk) | Deferred until we can SSH live | [main report §7.3](../../BETTY_SLURM_ADVISOR_REPORT.md#73-sshare-output-investigation-pending) |
| `sprio` integration for richer pending diagnosis | Future work | [main report §8.2](../../BETTY_SLURM_ADVISOR_REPORT.md) |
| Real historical hour-of-day load curves | Pending nightly `scheduling/features.py` cron on production | [main report §8.5](../../BETTY_SLURM_ADVISOR_REPORT.md) |
| LLM tool selection consistency (does the model call the right tool?) | Manual E2E + system-prompt contract | [main report §4.5](../../BETTY_SLURM_ADVISOR_REPORT.md) |

---

## 5. How to reproduce

```bash
cd "/Users/jvadala/BettyAgent /parcc1/betty-ai"
python3 -m pytest slurm_advisor/tests/ -v
```

Expected output: **98 passed**. Run time: ~13 seconds (MiniZinc solves dominate).

For the scenario matrix only:

```bash
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v
```

Expected output: **70 passed**.

For specific dimensions (using pytest `-k` filter):

```bash
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k vram         # VRAM matrix only
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k persona      # Persona suite only
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k check_scenario  # Check matrix
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k availability    # Availability matrix
python3 -m pytest slurm_advisor/tests/test_scenarios.py -v -k diagnose        # Diagnose matrix
```

---

## 6. What this run tells us

**The good:** every dimension in the matrix is exercised, every quality criterion in the test plan §4 is verified, and the four findings the matrix produced have all been closed in code (3 cases) or as test corrections (1 case). The constraint solver, the policy validator, the slot ranker, and the reason-code mapper all do what they say they do across realistic researcher inputs.

**The honest part:** these are deterministic tests. They prove the *system as currently architected* behaves as documented. They cannot prove that the recommendations are *empirically optimal* for actual cluster behavior — that would require validating recommendation outcomes against post-submission run data, which we don't yet have. The next layer of validation will need a feedback loop: track recommended-vs-actual placement, recommended-vs-actual wait time, and adjust the model when they diverge. The infrastructure for that loop is in [`scheduling/features.py`](../../betty-ai/scheduling/features.py); wiring it into a continuous-validation pipeline is future work (main report §8.5).

**What changed in the code today (post-matrix):**
- `Policy.PartitionSpec` gained `nvlink: bool` field.
- `JobIntent` gained `requires_nvlink: bool` field.
- New `_max_qos_gpu_cap` helper enforces QOS GPU ceilings in both Python and MiniZinc paths.
- MiniZinc model gained `max_qos_gpus[pidx]` array + constraint.
- MZN-infeasible path now falls back to `PythonSolver` to populate per-partition rejection reasons.
- Persona tests for Maya, Diego, and Bob updated with corrected expectations + comments explaining the underlying capability nuances.
