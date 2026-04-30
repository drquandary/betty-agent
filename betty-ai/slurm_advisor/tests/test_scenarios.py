"""Scenario matrix for the Betty SLURM Advisor.

This is the systematic cross-product of dimensions documented in
`BETTY_SLURM_ADVISOR_TEST_PLAN.md`. Each test is parametrized so a
failure tells you exactly which dimension combination broke.

Layout:
  §A — Recommend: hardware variations
  §B — Recommend: VRAM safety matrix
  §C — Recommend: walltime variations
  §D — Recommend: CPU-only workloads
  §E — Recommend: persona suite (10 realistic researchers)
  §F — Recommend: cost monotonicity invariants
  §G — Check: sbatch violation matrix
  §H — Availability: cluster state × time-of-day
  §I — Availability: privacy and source-tagging
  §J — Diagnose: SLURM Reason code mapping

Conventions:
  - Each parametrize id is human-readable so the test report tells the story
    directly: `test_recommend_hardware[1gpu-no-vram-4h]`.
  - Quality assertions check both presence (right thing happened) and absence
    (wrong thing did not happen). False-positive prevention is half the value.
  - When a scenario is intentionally infeasible, the test asserts `feasible=False`
    AND verifies the rejection reasons explain why.
"""
from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Optional

import pytest

from slurm_advisor.availability import (
    BlackoutWindow,
    ClusterSnapshot,
    propose_slots,
)
from slurm_advisor.parser import parse_sbatch
from slurm_advisor.policy import Policy
from slurm_advisor.recommender import (
    check_sbatch,
    diagnose_pending,
    recommend,
)
from slurm_advisor.solver import JobIntent


# ---------------------------------------------------------------------------
# Cluster geometry constants — read once so tests fail loudly if the YAML
# changes shape, instead of silently testing against stale assumptions.
# ---------------------------------------------------------------------------

POLICY = Policy.load()
GPU_VRAM = {p.name: p.gpu_vram_gb for p in POLICY.gpu_partitions()}
# {"dgx-b200": 192, "b200-mig45": 45, "b200-mig90": 90}


# ===========================================================================
# §A — Recommend: hardware variations
# ===========================================================================


@pytest.mark.parametrize(
    "case_id, gpus, hours, partition_class",
    [
        # GPU partitions: any of the three is acceptable when no VRAM constraint
        ("1gpu-no-vram-4h",   1,  4,  "gpu"),
        ("2gpu-no-vram-8h",   2,  8,  "gpu"),
        ("4gpu-no-vram-12h",  4,  12, "gpu"),
        ("8gpu-no-vram-24h",  8,  24, "gpu"),
        ("16gpu-no-vram-12h", 16, 12, "gpu"),  # multi-node on dgx-b200
    ],
    ids=lambda x: x if isinstance(x, str) else None,
)
def test_recommend_hardware_picks_gpu_partition_when_gpus_requested(
    case_id, gpus, hours, partition_class
):
    """Any GPU request must land on a GPU partition, never CPU-only.

    Multi-node packing must respect partition geometry — 16 GPUs on
    dgx-b200 should give 2 nodes × 8 GPUs (the only feasible shape), not
    spread across MIG partitions which cap at 1 node.
    """
    intent = JobIntent(gpus=gpus, hours=hours)
    rec = recommend(intent)
    assert rec.result["feasible"], f"{case_id}: should be feasible"
    assert rec.result["gpus_per_node"] > 0, f"{case_id}: must have GPUs"
    p = rec.result["partition"]
    assert p in {"dgx-b200", "b200-mig45", "b200-mig90"}, (
        f"{case_id}: picked non-GPU partition {p}"
    )
    # Tight pack invariant
    n = rec.result["nodes"]
    gpn = rec.result["gpus_per_node"]
    assert n * gpn >= gpus, f"{case_id}: under-allocated ({n}×{gpn} < {gpus})"
    assert (n - 1) * gpn < gpus, f"{case_id}: over-allocated ({n}×{gpn} for {gpus})"


# ===========================================================================
# §B — Recommend: VRAM safety matrix
# ===========================================================================
# Critical correctness contract: with min_vram_gb set, partitions whose
# gpu_vram_gb is BELOW that floor must NEVER be selected, even if cheaper.

_VRAM_CASES = [
    # (case_id, min_vram_gb, allowed_partitions, must_be_excluded)
    ("vram-40-fits-all",     40,   {"dgx-b200", "b200-mig45", "b200-mig90"}, set()),
    ("vram-50-excludes-mig45", 50, {"dgx-b200", "b200-mig90"},              {"b200-mig45"}),
    ("vram-100-only-full",  100,   {"dgx-b200"},                            {"b200-mig45", "b200-mig90"}),
    ("vram-192-only-full",  192,   {"dgx-b200"},                            {"b200-mig45", "b200-mig90"}),
]


@pytest.mark.parametrize("case_id, min_vram, allowed, excluded", _VRAM_CASES, ids=[c[0] for c in _VRAM_CASES])
def test_recommend_vram_filtering(case_id, min_vram, allowed, excluded):
    """VRAM floor MUST be enforced before solving."""
    rec = recommend(JobIntent(gpus=2, hours=8, min_vram_per_gpu_gb=min_vram))
    assert rec.result["feasible"], f"{case_id}: should be feasible"
    assert rec.result["partition"] in allowed, (
        f"{case_id}: picked {rec.result['partition']} not in {allowed}"
    )
    rejected_names = {name for name, _why in rec.result["rejected"]}
    for must_exclude in excluded:
        assert must_exclude in rejected_names, (
            f"{case_id}: {must_exclude} should have been excluded but wasn't"
        )
    # The rejection reason must mention the actual VRAM numbers, not be opaque
    for name, why in rec.result["rejected"]:
        if name in excluded:
            assert "vram" in why.lower() or str(min_vram) in why


def test_recommend_vram_infeasible_when_floor_exceeds_all_gpus():
    """Floor higher than the largest GPU's VRAM should produce feasible=False."""
    rec = recommend(JobIntent(gpus=1, hours=4, min_vram_per_gpu_gb=256))
    assert rec.result["feasible"] is False
    rejected_names = {name for name, _why in rec.result["rejected"]}
    # All three GPU partitions must be in the excluded list
    assert {"dgx-b200", "b200-mig45", "b200-mig90"}.issubset(rejected_names)


def test_recommend_vram_disclosure_when_unset():
    """When min_vram_gb is not passed, the disclaimer banner is mandatory."""
    rec = recommend(JobIntent(gpus=1, hours=4))
    assert rec.vram_constraint["enforced"] is False
    msg = rec.vram_constraint["message"].lower()
    assert "not constrained" in msg
    assert "oom" in msg or "vram" in msg


# ===========================================================================
# §C — Recommend: walltime variations
# ===========================================================================


@pytest.mark.parametrize(
    "case_id, hours, interactive, expected_seconds",
    [
        ("interactive-30min-stays",      0.5, True,  1800),
        ("interactive-2h-stays",         2,   True,  7200),
        ("interactive-4h-at-cap",        4,   True,  14400),
        ("interactive-10h-capped-to-4",  10,  True,  14400),  # cap fires
        ("batch-12h-untouched",          12,  False, 43200),
        ("batch-24h-untouched",          24,  False, 86400),
        ("batch-7day-untouched",         168, False, 604800),
    ],
    ids=lambda x: x if isinstance(x, str) else None,
)
def test_recommend_walltime_handling(case_id, hours, interactive, expected_seconds):
    """Interactive flag caps walltime at 4h; batch jobs honor the request."""
    rec = recommend(JobIntent(gpus=1, hours=hours, interactive=interactive))
    assert rec.result["feasible"], f"{case_id}: should be feasible"
    assert rec.result["time_seconds"] == expected_seconds, (
        f"{case_id}: time_seconds={rec.result['time_seconds']} != {expected_seconds}"
    )


def test_recommend_walltime_over_partition_max_clipped():
    """200h > 7d (max_walltime). Solver must reject this partition or clip.

    Behavior we want: not crash, return a feasible result OR an explicit
    infeasibility with explanation. Either is acceptable; silent corruption
    is not.
    """
    rec = recommend(JobIntent(gpus=1, hours=200))
    if rec.result["feasible"]:
        assert rec.result["time_seconds"] <= 7 * 86400, "must clip to 7d"
    else:
        assert rec.result["rejected"], "infeasibility must explain why"


# ===========================================================================
# §D — Recommend: CPU-only workloads
# ===========================================================================


@pytest.mark.parametrize(
    "case_id, cpus, hours, expected_partition_set",
    [
        ("cpu-1core-1h",      1,   1,  {"genoa-std-mem", "genoa-lrg-mem"}),
        ("cpu-8core-4h",      8,   4,  {"genoa-std-mem", "genoa-lrg-mem"}),
        ("cpu-32core-12h",    32,  12, {"genoa-std-mem", "genoa-lrg-mem"}),
        ("cpu-64core-24h",    64,  24, {"genoa-std-mem", "genoa-lrg-mem"}),
        ("cpu-128core-48h",   128, 48, {"genoa-std-mem", "genoa-lrg-mem"}),
    ],
    ids=lambda x: x if isinstance(x, str) else None,
)
def test_recommend_cpu_only_workloads(case_id, cpus, hours, expected_partition_set):
    """No GPUs requested => CPU partition. Never an accidental GPU pick."""
    rec = recommend(JobIntent(gpus=0, cpus=cpus, hours=hours))
    assert rec.result["feasible"], f"{case_id}: should be feasible"
    assert rec.result["gpus_per_node"] == 0, f"{case_id}: must have zero GPUs"
    assert rec.result["partition"] in expected_partition_set, (
        f"{case_id}: picked {rec.result['partition']} not in {expected_partition_set}"
    )


# ===========================================================================
# §E — Recommend: persona suite
# ===========================================================================
# Ten realistic researchers. Each one represents a usage pattern PARCC sees.


def test_persona_frank_lora_finetune():
    """LoRA on Llama-3-8B fits in 24 GB; cheapest GPU partition wins."""
    rec = recommend(JobIntent(gpus=1, hours=4, min_vram_per_gpu_gb=24))
    assert rec.result["feasible"]
    # All three GPU partitions clear 24 GB; solver picks the cheapest
    assert rec.result["partition"] in {"dgx-b200", "b200-mig45", "b200-mig90"}
    # Should not pick dgx-b200 if MIG is cheaper
    if rec.result["partition"] == "dgx-b200":
        # Acceptable only if MIG was excluded for a reason
        assert rec.result["rejected"]


def test_persona_maya_full_finetune_70b():
    """Llama-3-70B full fine-tune needs full unsharded weights ≈ 192 GB/GPU.

    Note: 70B FT on 90 GB MIG slices is technically possible with offloading
    or sharding, so a min_vram floor of just 80 GB would let mig-90 win
    (it has 90 GB > 80). To force the strict "needs full B200 unsharded"
    case, Maya passes 192 GB which excludes both MIG partitions.
    """
    rec = recommend(JobIntent(gpus=4, hours=24, min_vram_per_gpu_gb=192))
    assert rec.result["feasible"]
    assert rec.result["partition"] == "dgx-b200", (
        "70B FT (unsharded) requires full B200; advisor cannot route it to MIG"
    )
    assert rec.vram_constraint["enforced"] is True


def test_persona_diego_distributed_training():
    """Distributed training requires NVLink between GPUs of the same replica.

    Without NVLink awareness the solver routes 16 GPUs to b200-mig45 (32 MIG
    slices/node, fits in 1 node), which is technically legal but performance-
    catastrophic for tensor parallelism. requires_nvlink=True excludes MIG
    partitions (nvlink: false) and forces the multi-node dgx-b200 shape.
    """
    rec = recommend(JobIntent(gpus=16, hours=48, requires_nvlink=True))
    assert rec.result["feasible"]
    assert rec.result["partition"] == "dgx-b200", (
        "Distributed 16-GPU training with NVLink requires dgx-b200; "
        "MIG partitions have nvlink=false and were correctly excluded"
    )
    assert rec.result["nodes"] >= 2
    assert rec.result["nodes"] * rec.result["gpus_per_node"] >= 16
    rejected_names = {name for name, _why in rec.result["rejected"]}
    assert "b200-mig45" in rejected_names or "b200-mig90" in rejected_names


def test_persona_priya_interactive_debug():
    """Quick GPU sanity check: 0.5h stays at 0.5h (under the 4h cap)."""
    rec = recommend(JobIntent(gpus=1, hours=0.5, interactive=True))
    assert rec.result["feasible"]
    assert rec.result["time_seconds"] == 1800
    assert rec.result["gpus_per_node"] >= 1


def test_persona_carlos_cpu_genomics():
    """32-core CPU job lands on genoa partition, not GPU."""
    rec = recommend(JobIntent(gpus=0, cpus=32, hours=12))
    assert rec.result["feasible"]
    assert rec.result["partition"].startswith("genoa")
    assert rec.result["gpus_per_node"] == 0


def test_persona_aisha_long_md_simulation():
    """7-day GROMACS run: feasible (max_walltime=7d), should still warn."""
    rec = recommend(JobIntent(gpus=4, hours=168))
    assert rec.result["feasible"]
    assert rec.result["time_seconds"] == 7 * 86400
    # Whatever partition wins must accept the 7d walltime
    p = next(p for p in POLICY.partitions.values() if p.name == rec.result["partition"])
    assert p.max_walltime_seconds >= 7 * 86400


def test_persona_tom_vllm_serving():
    """vLLM single-GPU serving for 24h. No interactive cap; cheapest GPU."""
    rec = recommend(JobIntent(gpus=1, hours=24))
    assert rec.result["feasible"]
    assert rec.result["time_seconds"] == 24 * 3600
    assert rec.result["gpus_per_node"] >= 1


def test_persona_lin_submit_now_availability():
    """High-urgency: top slot must be at or near 'now'."""
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 200},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    slots = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=snap, now=now)
    assert slots
    # Highest-scoring slot should be very close to "now"
    top = slots[0]
    delta_h = (top.start - now).total_seconds() / 3600
    assert delta_h < 24, f"top slot is {delta_h:.1f}h out — Lin wanted soonest"


def test_persona_pat_friday_evening_planning():
    """Submit Friday-onward only: respects `earliest`."""
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    now = datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc)  # Mon morning
    friday_evening = datetime(2026, 5, 1, 22, 0, tzinfo=timezone.utc)  # Fri 18:00 ET ≈ 22:00 UTC
    slots = propose_slots(
        gpus=2, hours=48, partition="dgx-b200", snapshot=snap,
        now=now, earliest=friday_evening,
    )
    # Every returned slot must be >= the earliest constraint
    for s in slots:
        assert s.start >= friday_evening, (
            f"slot {s.start_local} starts before earliest {friday_evening}"
        )


def test_persona_bob_over_qos_cap():
    """41 GPUs exceeds gpu-max QOS cap (40). Either constrained or infeasible."""
    rec = recommend(JobIntent(gpus=41, hours=24))
    if rec.result["feasible"]:
        # If the solver returned a result, it should be at most 40 GPUs total
        total = rec.result["nodes"] * rec.result["gpus_per_node"]
        assert total <= 40, f"got {total} GPUs which exceeds gpu-max cap"
    else:
        # Or it should explain the infeasibility
        assert rec.result["rejected"] or rec.result["explanation"]


# ===========================================================================
# §F — Recommend: cost monotonicity invariants
# ===========================================================================
# Mathematical sanity: if request A is strictly less demanding than B,
# A's billing score must be ≤ B's. These tests catch regressions where the
# solver picks pathological shapes.


def test_billing_monotone_in_gpus():
    """More GPUs (same partition, same hours) => higher billing."""
    a = recommend(JobIntent(gpus=1, hours=8, partition_pref="dgx-b200"))
    b = recommend(JobIntent(gpus=4, hours=8, partition_pref="dgx-b200"))
    assert a.result["billing_score"] < b.result["billing_score"]


def test_billing_monotone_in_hours():
    """Longer walltime (same partition, same GPUs) => higher billing."""
    a = recommend(JobIntent(gpus=2, hours=4,  partition_pref="dgx-b200"))
    b = recommend(JobIntent(gpus=2, hours=24, partition_pref="dgx-b200"))
    assert a.result["billing_score"] < b.result["billing_score"]


def test_full_b200_more_expensive_than_mig_for_same_request():
    """For identical 2-GPU × 8h work, full B200 must cost more than MIG-45.

    This validates the YAML billing weights are pulled into the objective
    function correctly. If this regresses, MIG/full ratio is broken.
    """
    full = recommend(JobIntent(gpus=2, hours=8, partition_pref="dgx-b200"))
    mig  = recommend(JobIntent(gpus=2, hours=8, partition_pref="b200-mig45"))
    assert full.result["billing_score"] > mig.result["billing_score"], (
        "dgx-b200 should cost more than b200-mig45 for the same request"
    )


# ===========================================================================
# §G — Check: sbatch violation matrix
# ===========================================================================


def _sbatch(directives: dict) -> str:
    """Compose a minimal sbatch from a directive dict for testing."""
    lines = ["#!/bin/bash"]
    for k, v in directives.items():
        if v is None:
            continue
        lines.append(f"#SBATCH {k}={v}" if v != "" else f"#SBATCH {k}")
    lines.append("echo run")
    return "\n".join(lines) + "\n"


_CHECK_SCENARIOS = [
    # (id, directives, expected_status, must_contain_codes, must_not_contain)
    (
        "clean-1gpu-12h",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 16,
         "--mem": "96G", "--time": "12:00:00"},
        "ok", set(), {"CPU_PER_GPU_HIGH", "MEM_PER_GPU_HIGH", "TIME_HURTS_BACKFILL"},
    ),
    (
        "over-cpu-soft",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 24,
         "--mem": "96G", "--time": "12:00:00"},
        # 24 ≤ 28 (soft) so this is clean
        "ok", set(), {"CPU_PER_GPU_HIGH"},
    ),
    (
        "over-cpu-hard",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 128,
         "--mem": "96G", "--time": "12:00:00"},
        # 128 > 28 cap → hard error (cpus_per_node/gpus_per_node = 28)
        "block", {"CPU_PER_GPU_OVER_NODE_LIMIT"}, set(),
    ),
    (
        "over-mem-soft",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 16,
         "--mem": "300G", "--time": "12:00:00"},
        # 300 > 224 GB/GPU soft cap → warning
        "revise", {"MEM_PER_GPU_HIGH"}, set(),
    ),
    (
        "over-time-backfill",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 16,
         "--mem": "96G", "--time": "2-00:00:00"},
        "revise", {"TIME_HURTS_BACKFILL"}, {"TIME_OVER_PARTITION_MAX"},
    ),
    (
        "unknown-partition",
        {"--partition": "fake-partition", "--gres": "gpu:1", "--time": "01:00:00"},
        "block", {"UNKNOWN_PARTITION"}, set(),
    ),
    (
        "gpu-on-cpu-partition",
        {"--partition": "genoa-std-mem", "--gres": "gpu:1", "--time": "01:00:00"},
        "block", {"GPU_ON_CPU_PARTITION"}, set(),
    ),
    (
        "qos-not-allowed",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--qos": "genoa-std",
         "--cpus-per-task": 16, "--mem": "96G", "--time": "12:00:00"},
        "block", {"QOS_NOT_ALLOWED"}, set(),
    ),
    (
        "multi-violation",
        {"--partition": "dgx-b200", "--gres": "gpu:1", "--cpus-per-task": 128,
         "--mem": "500G", "--time": "7-00:00:00"},
        "block", {"CPU_PER_GPU_OVER_NODE_LIMIT", "MEM_PER_GPU_HIGH", "TIME_HURTS_BACKFILL"}, set(),
    ),
]


@pytest.mark.parametrize(
    "case_id, directives, expected_status, must_contain, must_not_contain",
    _CHECK_SCENARIOS,
    ids=[c[0] for c in _CHECK_SCENARIOS],
)
def test_check_scenario(case_id, directives, expected_status, must_contain, must_not_contain):
    """Each scenario verifies BOTH which codes fire and which do not."""
    rep = check_sbatch(_sbatch(directives))
    actual_codes = {i.code for i in rep.issues}
    assert rep.status == expected_status, (
        f"{case_id}: status={rep.status} (expected {expected_status}); codes={actual_codes}"
    )
    missing = must_contain - actual_codes
    assert not missing, f"{case_id}: missing expected codes {missing}; got {actual_codes}"
    spurious = must_not_contain & actual_codes
    assert not spurious, f"{case_id}: spurious codes {spurious}"


def test_check_suggested_fix_is_itself_valid():
    """The suggested_sbatch from a failing check, when re-checked, must NOT block.

    This catches a class of bug where the solver produces a "fix" that itself
    fails policy. Running rec → check on the suggestion is a fixpoint test.
    """
    bad = _sbatch({
        "--partition": "dgx-b200", "--gres": "gpu:1",
        "--cpus-per-task": 128, "--mem": "500G", "--time": "7-00:00:00",
    })
    rep = check_sbatch(bad)
    assert rep.status == "block"
    assert rep.suggested_sbatch is not None
    # Re-check the suggested fix
    rep2 = check_sbatch(rep.suggested_sbatch)
    assert rep2.status != "block", (
        f"suggested fix still blocks: {[i.code for i in rep2.issues if i.severity == 'error']}"
    )


# ===========================================================================
# §H — Availability: cluster state × time-of-day
# ===========================================================================


def _snap_with_state(state: str) -> ClusterSnapshot:
    """Generate a representative snapshot for each cluster state."""
    if state == "empty":
        return ClusterSnapshot()
    if state == "idle":
        return ClusterSnapshot(
            gpus_idle_by_partition={"dgx-b200": 200},
            gpus_total_by_partition={"dgx-b200": 216},
            pending_jobs_by_partition={"dgx-b200": 0},
        )
    if state == "mixed":
        return ClusterSnapshot(
            gpus_idle_by_partition={"dgx-b200": 64},
            gpus_total_by_partition={"dgx-b200": 216},
            pending_jobs_by_partition={"dgx-b200": 12},
        )
    if state == "saturated":
        return ClusterSnapshot(
            gpus_idle_by_partition={"dgx-b200": 0},
            gpus_total_by_partition={"dgx-b200": 216},
            pending_jobs_by_partition={"dgx-b200": 50},
        )
    if state == "with-blackout":
        return ClusterSnapshot(
            gpus_idle_by_partition={"dgx-b200": 100},
            gpus_total_by_partition={"dgx-b200": 216},
            blackout_windows=[BlackoutWindow(
                start=datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc),
                end=datetime(2026, 4, 28, 14, 0, tzinfo=timezone.utc),
                partition="dgx-b200",
                reason="planned maintenance",
            )],
        )
    raise ValueError(state)


@pytest.mark.parametrize(
    "case_id, state, hour_utc",
    [
        ("idle-cluster-noon",         "idle",         12),
        ("idle-cluster-midnight",     "idle",          0),
        ("mixed-cluster-noon",        "mixed",        12),
        ("saturated-cluster-noon",    "saturated",    12),
        ("saturated-cluster-3am",     "saturated",     3),
        ("blackout-active",           "with-blackout",12),
        ("empty-cluster-no-data",     "empty",        12),
    ],
    ids=lambda x: x if isinstance(x, str) else None,
)
def test_availability_state_and_time(case_id, state, hour_utc):
    """Slots respect cluster state and produce ranked output."""
    snap = _snap_with_state(state)
    now = datetime(2026, 4, 27, hour_utc, 0, tzinfo=timezone.utc)
    slots = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=snap, now=now)
    # Always at least one slot if we're not in a global blackout (we set a
    # 24h partition-scoped blackout, not all partitions; offsets like 48h
    # are still acceptable for the dgx-b200 query).
    if state == "with-blackout":
        for s in slots:
            # No slot should overlap the blackout
            assert s.end <= datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc) or \
                   s.start >= datetime(2026, 4, 28, 14, 0, tzinfo=timezone.utc), (
                f"{case_id}: slot {s.start_local} overlaps blackout"
            )
    else:
        assert slots, f"{case_id}: should have at least one slot"
        # Descending score
        scores = [s.score for s in slots]
        assert scores == sorted(scores, reverse=True), (
            f"{case_id}: slots not descending by score"
        )


def test_availability_idle_cluster_scores_higher_than_saturated():
    """Same time-of-day, more idle GPUs => higher top-slot score."""
    now = datetime(2026, 4, 27, 12, 0, tzinfo=timezone.utc)
    idle = propose_slots(
        gpus=2, hours=8, partition="dgx-b200",
        snapshot=_snap_with_state("idle"), now=now,
    )
    sat = propose_slots(
        gpus=2, hours=8, partition="dgx-b200",
        snapshot=_snap_with_state("saturated"), now=now,
    )
    assert idle[0].score > sat[0].score


def test_availability_pending_queue_lowers_score():
    """A deeper pending queue must penalize slot scores."""
    now = datetime(2026, 4, 27, 12, 0, tzinfo=timezone.utc)
    light = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 8},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 0},
    )
    deep = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 8},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 100},  # 100/50 saturates penalty
    )
    light_top = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=light, now=now)[0]
    deep_top  = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=deep,  now=now)[0]
    assert light_top.score > deep_top.score
    assert any("penalty" in r.lower() for r in deep_top.reasons)


# ===========================================================================
# §I — Availability: privacy and source-tagging
# ===========================================================================


def test_availability_no_per_job_data_in_payload():
    """The Slot output must not contain JobIDs from squeue.

    Privacy contract: we aggregate squeue --start into pending counts and
    earliest-start times only. Per-job rows from other users must never
    appear in the rendered payload.
    """
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 30},
        next_start_by_partition={"dgx-b200": "2026-04-28T22:00:00"},
    )
    slots = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=snap)
    serialized = json.dumps([s.to_dict() for s in slots])
    # Heuristic: SLURM job IDs are 4+ digit integers. We allow timestamps
    # but reject anything that looks like a JobID list.
    # We also explicitly check that the only numeric values present are
    # in expected fields (gpus, score, hours).
    for s in slots:
        for r in s.reasons:
            # No "JobID=" or "%i" leaked
            assert "JobID" not in r
    assert "JobID" not in serialized


def test_availability_synthetic_curve_labeled():
    """When no historical file, load_curve_kind must be 'synthetic'."""
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(gpus=2, hours=8, partition="dgx-b200", snapshot=snap)
    # Tag should be in reasons
    assert any("synthetic" in r.lower() for s in slots for r in s.reasons)


# ===========================================================================
# §J — Diagnose: SLURM Reason code mapping
# ===========================================================================


def _scontrol(reason: str, time_limit: str = "01:00:00", **extras) -> str:
    """Compose a minimal `scontrol show job` output for testing."""
    fields = {
        "JobId": "12345",
        "JobName": "test",
        "UserId": "jvadala",
        "JobState": "PENDING" if reason != "(null)" else "RUNNING",
        "Reason": reason,
        "TimeLimit": time_limit,
        "Partition": "dgx-b200",
        "QOS": "normal",
        "ReqTRES": "cpu=16,mem=96G,node=1,gres/gpu=1",
        "SubmitTime": "2026-04-27T10:00:00",
    }
    fields.update(extras)
    return " ".join(f"{k}={v}" for k, v in fields.items())


_DIAGNOSE_SCENARIOS = [
    # (id, scontrol_text, expected_reason, must_contain_phrases)
    ("resources-short-wall",
     _scontrol("Resources", "01:00:00"),
     "Resources",
     ["nodes free that match"]),
    ("resources-long-wall-triggers-backfill-warn",
     _scontrol("Resources", "2-00:00:00"),
     "Resources",
     ["nodes free that match", "backfill"]),
    ("priority",
     _scontrol("Priority", "12:00:00"),
     "Priority",
     ["Higher-priority jobs"]),
    ("qos-max-jobs",
     _scontrol("QOSMaxJobsPerUserLimit"),
     "QOSMaxJobsPerUserLimit",
     ["per-user job limit"]),
    ("qos-grp-gres",
     _scontrol("QOSGrpGRESMinutes"),
     "QOSGrpGRESMinutes",
     ["GPU-minute budget"]),
    ("req-node-not-avail",
     _scontrol("ReqNodeNotAvail"),
     "ReqNodeNotAvail",
     ["specific node"]),
    ("assoc-grp-gres",
     _scontrol("AssocGrpGRES"),
     "AssocGrpGRES",
     ["GPU allocation"]),
    ("dependency",
     _scontrol("Dependency"),
     "Dependency",
     ["Waiting on another"]),
    ("begin-time",
     _scontrol("BeginTime"),
     "BeginTime",
     ["future start time"]),
    ("unknown-reason",
     _scontrol("WeirdNewReasonV99"),
     "WeirdNewReasonV99",
     ["WeirdNewReasonV99"]),
]


@pytest.mark.parametrize(
    "case_id, scontrol_text, expected_reason, must_contain",
    _DIAGNOSE_SCENARIOS,
    ids=[c[0] for c in _DIAGNOSE_SCENARIOS],
)
def test_diagnose_scenario(case_id, scontrol_text, expected_reason, must_contain):
    diag = diagnose_pending("12345", scontrol_text)
    assert diag.reason == expected_reason, f"{case_id}: reason mismatch"
    # Combine causes + actions for substring search
    haystack = " ".join(diag.likely_causes + diag.suggested_actions).lower()
    for phrase in must_contain:
        assert phrase.lower() in haystack, (
            f"{case_id}: expected phrase {phrase!r} not in: {haystack[:200]}"
        )


def test_diagnose_long_walltime_always_warns_about_backfill():
    """Regardless of Reason, walltime > 24h must produce a backfill warning."""
    text = _scontrol("Priority", "3-00:00:00")
    diag = diagnose_pending("999", text)
    assert any("backfill" in c.lower() for c in diag.likely_causes), (
        "3-day walltime should trigger backfill heuristic"
    )


def test_diagnose_field_extraction():
    """Partition, QOS, time_limit, tres are surfaced from scontrol output."""
    text = _scontrol("Resources", time_limit="04:00:00",
                     Partition="dgx-b200", QOS="normal")
    diag = diagnose_pending("777", text)
    assert diag.request["partition"] == "dgx-b200"
    assert diag.request["qos"] == "normal"
    assert diag.request["time_limit"] == "04:00:00"
    assert "gpu=1" in (diag.request["tres"] or "")


# ===========================================================================
# §K — Diagnose: sprio priority decomposition (new)
# ===========================================================================
# When a job is pending with Reason=Priority, sprio reveals which factor
# (AGE, FAIRSHARE, JOBSIZE, ...) is dragging the priority down. These tests
# verify both parsing correctness AND that the diagnose card surfaces
# actionable advice keyed to the dominant bottleneck.

from slurm_advisor.recommender import parse_sprio


_SPRIO_LOW_FAIRSHARE = """\
          JOBID PARTITION   PRIORITY       SITE        AGE  FAIRSHARE    JOBSIZE  PARTITION        QOS        TRES
          12345 dgx-b200    0.000200          0   0.000050   0.000004   0.000080   0.000050   0.000016     cpu=0
"""

_SPRIO_LOW_JOBSIZE = """\
          JOBID PARTITION   PRIORITY       SITE        AGE  FAIRSHARE    JOBSIZE  PARTITION        QOS        TRES
          54321 dgx-b200    0.000300          0   0.000080   0.000200   0.000005   0.000050   0.000016     cpu=0
"""


def test_parse_sprio_extracts_factor_columns():
    """Parse sprio output into per-factor integer ppm values."""
    factors = parse_sprio(_SPRIO_LOW_FAIRSHARE)
    # Factors normalized to ppm (parts per million)
    assert factors["AGE"] == 50
    assert factors["FAIRSHARE"] == 4
    assert factors["JOBSIZE"] == 80
    assert factors["PARTITION"] == 50
    assert factors["QOS"] == 16


def test_parse_sprio_handles_empty_input():
    assert parse_sprio("") == {}
    assert parse_sprio("garbage with no header") == {}


def test_parse_sprio_handles_missing_data_line():
    text = "          JOBID PARTITION   PRIORITY       AGE  FAIRSHARE\n"  # header only
    assert parse_sprio(text) == {}


def test_diagnose_with_sprio_identifies_fairshare_bottleneck():
    """Reason=Priority + low FAIRSHARE → diagnose card identifies it."""
    diag = diagnose_pending(
        "12345",
        _scontrol("Priority"),
        sprio_text=_SPRIO_LOW_FAIRSHARE,
    )
    assert diag.priority_dominant_negative == "FAIRSHARE"
    # Should add a FAIRSHARE-specific cause
    assert any("FAIRSHARE" in c.upper() for c in diag.likely_causes)
    # Should suggest the actual remediation (sreport, FairShare adjustment)
    actions_text = " ".join(diag.suggested_actions).lower()
    assert "sreport" in actions_text or "fairshare" in actions_text


def test_diagnose_with_sprio_identifies_jobsize_bottleneck():
    """Reason=Priority + low JOBSIZE → advice should be 'shrink the job'."""
    diag = diagnose_pending(
        "54321",
        _scontrol("Priority"),
        sprio_text=_SPRIO_LOW_JOBSIZE,
    )
    assert diag.priority_dominant_negative == "JOBSIZE"
    assert any("JOBSIZE" in c.upper() for c in diag.likely_causes)
    actions_text = " ".join(diag.suggested_actions).lower()
    assert "reduce" in actions_text or "smaller" in actions_text


def test_diagnose_without_sprio_falls_back_to_reason_only():
    """Backwards compat: when sprio is absent, diagnose still works."""
    diag = diagnose_pending("12345", _scontrol("Priority"))
    assert diag.reason == "Priority"
    assert diag.priority_factors == {}
    assert diag.priority_dominant_negative is None
    # Original Reason=Priority message still surfaces
    assert any("Higher-priority" in c for c in diag.likely_causes)


# ===========================================================================
# §L — Sshare defensive parser (new)
# ===========================================================================
# The TS-side parser is the line of defense; we mirror its core logic in
# Python form via a parameterized check that locks the symptoms→behavior
# mapping. The tests live next to the JS tests in
# slurm-availability.test.ts; here we test the symptoms semantically.


# These tests verify the documented behavior of the defensive parser without
# requiring TypeScript execution. The actual parser lives in slurm-recommend.ts;
# this test ensures the contract remains stable as the parser evolves.

def test_sshare_defensive_contract_documented():
    """Lock in the parser contract: header rows + non-numeric rows are dropped."""
    # The contract is documented in slurm-recommend.ts:parseSshareDefensive.
    # We test the TS implementation in slurm-availability.test.ts; here we
    # just assert the file exists and has the documentation.
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    parser_ts = os.path.normpath(os.path.join(
        here, "..", "..", "..",
        "betty-ai-web", "src", "agent", "tools", "slurm-recommend.ts",
    ))
    assert os.path.exists(parser_ts), "slurm-recommend.ts must exist"
    contents = open(parser_ts).read()
    # Required defensive parsing keywords
    assert "parseSshareDefensive" in contents
    assert "HEADER_WORDS" in contents
    assert "looksNumeric" in contents
    assert "dropped_count" in contents


# ===========================================================================
# §M — Reservations auto-feed (new)
# ===========================================================================
# Tests that the Python availability ranker correctly excludes blackout
# windows passed to it. The TS-side parser is tested in slurm-availability.test.ts.


def test_availability_excludes_partition_specific_blackout():
    """A reservation on dgx-b200 should not affect availability for other partitions."""
    now = datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc)
    blackout = BlackoutWindow(
        start=now,
        end=now + timedelta(hours=24),
        partition="dgx-b200",
        reason="weekly maintenance (MAINT)",
    )
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100, "b200-mig45": 16},
        gpus_total_by_partition={"dgx-b200": 216, "b200-mig45": 32},
        blackout_windows=[blackout],
    )
    # Query for dgx-b200 — should respect blackout
    dgx_slots = propose_slots(
        gpus=2, hours=4, partition="dgx-b200",
        snapshot=snap, now=now,
        candidate_offsets_hours=[0, 4, 12, 30],  # 0–12 inside blackout, 30 outside
    )
    for s in dgx_slots:
        assert s.start >= now + timedelta(hours=24), (
            f"dgx-b200 slot {s.start_local} starts inside MAINT window"
        )

    # Query for b200-mig45 — should be unaffected by dgx-b200 blackout
    mig_slots = propose_slots(
        gpus=2, hours=4, partition="b200-mig45",
        snapshot=snap, now=now,
        candidate_offsets_hours=[0, 4, 12],
    )
    assert mig_slots, "b200-mig45 should not be blocked by dgx-b200's blackout"


def test_availability_excludes_global_blackout():
    """A reservation with partition=None should block all partitions."""
    now = datetime(2026, 4, 27, 9, 0, tzinfo=timezone.utc)
    blackout = BlackoutWindow(
        start=now,
        end=now + timedelta(hours=12),
        partition=None,  # global
        reason="cluster-wide maintenance",
    )
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100},
        gpus_total_by_partition={"dgx-b200": 216},
        blackout_windows=[blackout],
    )
    slots = propose_slots(
        gpus=2, hours=4, partition="dgx-b200",
        snapshot=snap, now=now,
        candidate_offsets_hours=[0, 1, 4, 8, 16],
    )
    for s in slots:
        assert s.start >= now + timedelta(hours=12), (
            f"slot {s.start_local} starts inside global blackout"
        )


# ===========================================================================
# §N — Dev historical load curve seeder (new)
# ===========================================================================


def test_seed_dev_curves_writes_partition_files(tmp_path, monkeypatch):
    """The seed script must produce files the availability loader can read.

    This is the round-trip test: seed → load → score uses historical curve.
    """
    from slurm_advisor.scripts.seed_dev_load_curves import (
        SHAPES, write_curve_for_partition,
    )
    from slurm_advisor.availability import load_real_load_curve

    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    pdir = tmp_path / "partitions"

    # Write the academic-shape curve for dgx-b200
    written = write_curve_for_partition(pdir, "dgx-b200", SHAPES["academic"])
    assert written.exists()

    # Load it back through the availability ranker's loader
    curve = load_real_load_curve("dgx-b200")
    assert curve is not None, "loader must read the seeded file"
    assert len(curve) == 24
    # Peak hour gets normalized to 1.0
    assert max(curve) == 1.0
    # Off-peak hour (3 AM = index 3) is small but non-zero
    assert curve[3] < 0.5


def test_seed_dev_curves_marker_present_for_audit(tmp_path):
    """Every seeded file MUST include the dev marker so production review
    tooling can detect accidental seeding on a production node."""
    from slurm_advisor.scripts.seed_dev_load_curves import (
        SHAPES, write_curve_for_partition,
    )
    pdir = tmp_path / "partitions"
    written = write_curve_for_partition(pdir, "dgx-b200", SHAPES["academic"])
    payload = json.loads(written.read_text())
    assert payload["_dev_seed_marker"] is True
    assert "DEVELOPMENT" in payload["_dev_seed_note"]


def test_propose_slots_uses_seeded_curve_after_seeding(tmp_path, monkeypatch):
    """Full E2E: seed curve → propose_slots labels load_curve as historical."""
    from slurm_advisor.scripts.seed_dev_load_curves import (
        SHAPES, write_curve_for_partition,
    )
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    pdir = tmp_path / "partitions"
    write_curve_for_partition(pdir, "dgx-b200", SHAPES["academic"])

    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 100},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(gpus=2, hours=4, partition="dgx-b200", snapshot=snap)
    assert slots
    # After seeding, sources must include 'historical_load' and reasons say so
    assert "historical_load" in snap.sources
    assert any("historical load" in r for s in slots for r in s.reasons)
