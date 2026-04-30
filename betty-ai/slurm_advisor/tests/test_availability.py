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
