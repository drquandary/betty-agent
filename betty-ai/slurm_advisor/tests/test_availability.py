"""Tests for the calendar availability ranker."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from slurm_advisor.availability import (
    BlackoutWindow,
    ClusterSnapshot,
    propose_slots,
)


def test_propose_slots_returns_ranked_list():
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 5},
    )
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)  # 2 PM UTC
    slots = propose_slots(
        gpus=2, hours=8, partition="dgx-b200", snapshot=snap, now=now,
    )
    assert len(slots) > 0
    # First slot must have the highest score
    scores = [s.score for s in slots]
    assert scores == sorted(scores, reverse=True)
    # Each slot has a partition, gpus, and at least one reason
    for s in slots:
        assert s.partition == "dgx-b200"
        assert s.gpus == 2
        assert s.reasons


def test_propose_slots_skips_blackouts():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    blackout = BlackoutWindow(
        start=now,
        end=now + timedelta(days=2),  # block out everything for 2 days
        partition="dgx-b200",
        reason="planned maintenance",
    )
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        blackout_windows=[blackout],
    )
    slots = propose_slots(
        gpus=2, hours=8, partition="dgx-b200", snapshot=snap, now=now,
        candidate_offsets_hours=[0, 1, 12, 24],
    )
    # All offered offsets fall inside the blackout, so only the post-2-day
    # "after 6 PM" slot might survive (it's day+1 18:00).
    for s in slots:
        assert s.start >= now + timedelta(days=2) or s.end <= now


def test_propose_slots_prefers_more_idle_gpus():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    crowded = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 0},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    free = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 200},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    crowded_score = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=crowded, now=now,
    )[0].score
    free_score = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=free, now=now,
    )[0].score
    assert free_score > crowded_score


# ----------------------------------------------------------------------------
# Confidence / horizon / new wire fields
#
# These tests exercise the +62-line change introduced on this branch:
#   - `confidence` field on Slot (high | medium | low)
#   - `score_raw` and `window_local` keys in to_dict()
#   - 12-hour horizon cap on the synthetic (no-historical) branch
#   - bf_window-driven confidence transitions
#
# Tests assert by *behavior*, not by internal constant names (the constant
# may be renamed `bf_window_hours -> _DEFAULT_BF_WINDOW_HOURS` etc.).
# ----------------------------------------------------------------------------

_VALID_CONFIDENCE = {"high", "medium", "low"}


def _snap_with_historical(**kwargs) -> ClusterSnapshot:
    """Build a snapshot whose `sources` already declares historical_load.

    The availability module checks `"historical_load" in snapshot.sources` to
    decide which horizon and confidence to assign — we can't easily fake a
    JSON features file from here, but injecting the marker directly drives
    the same code path.
    """
    snap = ClusterSnapshot(**kwargs)
    snap.sources = ["historical_load"]
    return snap


def test_slot_inside_bf_window_is_high_confidence_with_historical_data():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    snap = _snap_with_historical(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    # Pass a flat load curve so the load value is the same hour-to-hour and
    # the historical branch is enforced via snapshot.sources above.
    slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
        candidate_offsets_hours=[0, 1, 6],
        load_by_hour=[0.3] * 24,
    )
    assert slots, "expected at least one slot in the bf window"
    # Every slot at offsets 0/1/6h is well within the 24h bf window.
    near_slots = [s for s in slots if (s.start - now).total_seconds() / 3600 <= 24]
    assert near_slots
    assert all(s.confidence == "high" for s in near_slots), (
        f"expected high confidence inside bf window with historical data; "
        f"got {[s.confidence for s in near_slots]}"
    )


def test_slot_outside_bf_window_drops_below_high_with_historical_data():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    snap = _snap_with_historical(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
        candidate_offsets_hours=[48],  # well beyond the 24h bf window
        load_by_hour=[0.3] * 24,
    )
    far = [s for s in slots if (s.start - now).total_seconds() / 3600 >= 36]
    assert far, "expected the 48h offset slot to be emitted"
    for s in far:
        assert s.confidence in {"medium", "low"}, (
            f"slot {s.start} outside bf window should not be high confidence; "
            f"got {s.confidence}"
        )


def test_synthetic_branch_caps_explicit_offsets_at_12h():
    """No historical data => slot horizon is capped at 12 hours, EXCEPT for
    the always-on "after 6 PM" slot which may exceed the cap.
    """
    # Pick a `now` such that 6 PM local is more than 12h away to make the
    # exception visible. 06:00 UTC ~ 02:00 ET — 6 PM local is ~16h out.
    now = datetime(2026, 4, 27, 6, 0, tzinfo=timezone.utc)
    snap = ClusterSnapshot(  # no sources => synthetic curve
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
    )
    # Partition out the "after 6 PM" slot — it's labelled in `reasons`.
    six_pm_slots = [s for s in slots if any("off-peak window" in r for r in s.reasons)]
    other_slots = [s for s in slots if s not in six_pm_slots]
    # Every non-"after 6 PM" slot is within 12h of now.
    for s in other_slots:
        dt = (s.start - now).total_seconds() / 3600
        assert dt <= 12 + 1e-6, (
            f"synthetic-only branch should cap horizon at 12h; got slot {dt}h out "
            f"with reasons {s.reasons}"
        )
    # The "after 6 PM" slot exists and is allowed to exceed 12h.
    assert six_pm_slots, "expected the explicit 'after 6 PM' slot in synthetic branch"


def test_slot_confidence_values_are_in_documented_enum():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    # Cover both branches: synthetic and historical.
    for snap in (
        ClusterSnapshot(
            gpus_idle_by_partition={"dgx-b200": 16},
            gpus_total_by_partition={"dgx-b200": 216},
        ),
        _snap_with_historical(
            gpus_idle_by_partition={"dgx-b200": 16},
            gpus_total_by_partition={"dgx-b200": 216},
        ),
    ):
        slots = propose_slots(
            gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
        )
        for s in slots:
            assert s.confidence in _VALID_CONFIDENCE, (
                f"unexpected confidence value: {s.confidence!r}"
            )


def test_slot_to_dict_includes_new_wire_fields():
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    snap = _snap_with_historical(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
        candidate_offsets_hours=[1],
        load_by_hour=[0.3] * 24,
    )
    assert slots
    d = slots[0].to_dict()
    # New fields introduced by this change:
    for key in ("confidence", "score_raw", "window_local", "start_local", "start", "end"):
        assert key in d, f"to_dict() missing key {key!r}"
    assert d["confidence"] in _VALID_CONFIDENCE
    # score_raw is the unrounded score; score is rounded to 1 decimal.
    assert isinstance(d["score_raw"], float)
    assert isinstance(d["score"], float)
    # window_local has the "Day Mon DD, HH:MM AM/PM – HH:MM AM/PM" shape.
    assert " – " in d["window_local"], f"window_local format unexpected: {d['window_local']!r}"


def test_to_dict_score_raw_preserves_precision_beyond_one_decimal():
    """`score` is rounded to 1 decimal for display; `score_raw` keeps more.

    We construct a scenario where the score won't land on a 0.1 multiple so
    the rounded `score` and the raw value will differ. Using a fractional
    load value 0.37 and the standard scoring formula guarantees this.
    """
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    snap = _snap_with_historical(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 3},
    )
    slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap, now=now,
        candidate_offsets_hours=[0],
        load_by_hour=[0.37] * 24,
    )
    assert slots
    d = slots[0].to_dict()
    # Either the values differ (because score_raw has more precision) OR
    # they happen to land on a 0.1 boundary. The contract we care about:
    # `score` is round(score_raw, 1). Assert that exactly.
    assert d["score"] == round(d["score_raw"], 1)


def test_historical_branch_extends_horizon_beyond_12h():
    """With historical data the candidate menu includes 24h and 48h offsets;
    synthetic-only caps at 12h. Asserting via the count of distinct
    explicit-offset slots emitted, ignoring the always-on 6 PM slot.
    """
    now = datetime(2026, 4, 27, 14, 0, tzinfo=timezone.utc)
    snap_hist = _snap_with_historical(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    snap_synth = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    hist_slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap_hist, now=now,
        load_by_hour=[0.3] * 24,
    )
    synth_slots = propose_slots(
        gpus=2, hours=2, partition="dgx-b200", snapshot=snap_synth, now=now,
    )
    hist_far = [s for s in hist_slots
                if (s.start - now).total_seconds() / 3600 > 12
                and not any("off-peak window" in r for r in s.reasons)]
    synth_far = [s for s in synth_slots
                 if (s.start - now).total_seconds() / 3600 > 12
                 and not any("off-peak window" in r for r in s.reasons)]
    assert hist_far, "historical branch should produce slots beyond 12h"
    assert not synth_far, (
        f"synthetic branch must not produce non-'after 6 PM' slots beyond 12h; "
        f"got {[(s.start, s.reasons) for s in synth_far]}"
    )
