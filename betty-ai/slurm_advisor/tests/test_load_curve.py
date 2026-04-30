"""Test the real-vs-synthetic hour-of-day load curve loader."""
from __future__ import annotations

import json
import os

from slurm_advisor.availability import (
    ClusterSnapshot,
    load_real_load_curve,
    propose_slots,
)


def test_load_real_curve_missing_returns_none(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    assert load_real_load_curve("dgx-b200") is None


def test_load_real_curve_normalizes_to_peak(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    pdir = tmp_path / "partitions"
    pdir.mkdir()
    counts = [0] * 24
    counts[14] = 100  # peak
    counts[3] = 25    # quarter of peak
    (pdir / "dgx-b200.json").write_text(json.dumps({"submit_count_by_hour": counts}))
    curve = load_real_load_curve("dgx-b200")
    assert curve is not None
    assert curve[14] == 1.0
    assert curve[3] == 0.25
    assert curve[0] == 0.0


def test_load_real_curve_rejects_malformed(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    pdir = tmp_path / "partitions"
    pdir.mkdir()
    # Wrong length
    (pdir / "p1.json").write_text(json.dumps({"submit_count_by_hour": [0] * 23}))
    assert load_real_load_curve("p1") is None
    # All zeros (peak == 0)
    (pdir / "p2.json").write_text(json.dumps({"submit_count_by_hour": [0] * 24}))
    assert load_real_load_curve("p2") is None
    # Not a list
    (pdir / "p3.json").write_text(json.dumps({"submit_count_by_hour": "nope"}))
    assert load_real_load_curve("p3") is None


def test_propose_slots_tags_synthetic_when_no_real_curve(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(gpus=2, hours=2, partition="dgx-b200", snapshot=snap)
    assert slots
    # No real curve loaded -> reasons should label as synthetic
    assert any("synthetic load" in r for s in slots for r in s.reasons)
    assert "historical_load" not in snap.sources


def test_propose_slots_uses_real_curve_when_present(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    pdir = tmp_path / "partitions"
    pdir.mkdir()
    counts = [50] * 24
    (pdir / "dgx-b200.json").write_text(json.dumps({"submit_count_by_hour": counts}))
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
    )
    slots = propose_slots(gpus=2, hours=2, partition="dgx-b200", snapshot=snap)
    assert slots
    assert any("historical load" in r for s in slots for r in s.reasons)
    assert "historical_load" in snap.sources


def test_pending_queue_adds_penalty_to_score(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    snap_quiet = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 0},
    )
    snap_busy = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        pending_jobs_by_partition={"dgx-b200": 25},
    )
    quiet = propose_slots(gpus=2, hours=2, partition="dgx-b200", snapshot=snap_quiet)
    busy = propose_slots(gpus=2, hours=2, partition="dgx-b200", snapshot=snap_busy)
    assert quiet[0].score > busy[0].score
    assert any("penalty" in r for r in busy[0].reasons)


def test_next_start_surfaced_in_reasons(tmp_path, monkeypatch):
    monkeypatch.setenv("BETTY_FEATURES_DIR", str(tmp_path))
    snap = ClusterSnapshot(
        gpus_idle_by_partition={"dgx-b200": 16},
        gpus_total_by_partition={"dgx-b200": 216},
        next_start_by_partition={"dgx-b200": "2026-04-28T22:00:00"},
    )
    slots = propose_slots(gpus=2, hours=2, partition="dgx-b200", snapshot=snap)
    assert any("SLURM est. earliest start" in r for s in slots for r in s.reasons)
