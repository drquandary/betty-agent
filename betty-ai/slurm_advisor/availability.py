"""Calendar availability — generate time slots for a desired GPU+wall request.

The agent uses this to render a calendar table in chat: "given that you want
2 GPUs for 8 hours, here are the next 5 candidate windows ranked by expected
queue wait."

Score formula (kept simple so the agent can explain it correctly):

    score = (1.5 if free >= req_gpus else 0)            # idle-now bonus
          + (1.0 - load_at_hour)                        # off-peak bonus
          - min(pending / 50, 1.0)                      # queue depth penalty
          - (dt_hours / 168)                            # prefer sooner

Higher = better. Each component appears in the slot's `reasons` list so the
chat card and the LLM can both narrate it accurately.

The `load_at_hour` curve is REAL when `betty-ai/data/features/partitions/<p>.json`
exists (produced offline by `scheduling/features.py` from sacct logs). When
absent, we fall back to a hand-coded synthetic curve and label it as such.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, asdict, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional


@dataclass
class ClusterSnapshot:
    """Current-state input to the availability ranker.

    Populated by the TS adapter (slurm-availability.ts:fetchSnapshot) from
    one or more of: `sinfo`, `squeue --start`, the offline features dir, or
    blackout configs. Each field is independently optional — missing data
    just means the score is computed without that signal. The `sources` list
    tells the agent and the user what was actually live so they don't have
    to guess.
    """

    gpus_idle_by_partition: Dict[str, int] = field(default_factory=dict)
    gpus_total_by_partition: Dict[str, int] = field(default_factory=dict)
    pending_jobs_by_partition: Dict[str, int] = field(default_factory=dict)
    # Earliest SLURM-estimated start per partition (ISO-8601). When
    # available, we'll surface "SLURM thinks something starts here at <t>"
    # as a slot reason.
    next_start_by_partition: Dict[str, str] = field(default_factory=dict)
    # Reservations / maintenance windows that would block a slot.
    blackout_windows: List["BlackoutWindow"] = field(default_factory=list)
    # Provenance of this snapshot's live signals (e.g. ["sinfo", "squeue --start"]).
    sources: List[str] = field(default_factory=list)


@dataclass
class BlackoutWindow:
    start: datetime
    end: datetime
    partition: Optional[str] = None  # None = applies to all
    reason: str = ""


@dataclass
class Slot:
    start: datetime
    end: datetime
    partition: str
    gpus: int
    score: float            # higher = better
    reasons: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        d = asdict(self)
        d["start"] = self.start.isoformat()
        d["end"] = self.end.isoformat()
        d["start_local"] = self.start.astimezone().strftime("%a %b %d, %I:%M %p")
        return d


# Synthetic hour-of-day load profile (0..23). Used ONLY when no real
# partition_features data is available. The real curve, when present, comes
# from `scheduling/features.py`'s `partition_features()` output written to
# betty-ai/data/features/partitions/<partition>.json under the
# `submit_count_by_hour` key (24-element histogram of submit timestamps).
# We normalize that to a 0..1 load proxy.
_DEFAULT_LOAD_BY_HOUR = [
    0.20, 0.15, 0.10, 0.10, 0.10, 0.15,  # 00–05 quietest
    0.25, 0.40, 0.60, 0.75, 0.85, 0.90,  # 06–11 builds up
    0.90, 0.90, 0.85, 0.80, 0.80, 0.75,  # 12–17 peak
    0.70, 0.60, 0.50, 0.40, 0.30, 0.25,  # 18–23 winds down
]


def _features_dir() -> str:
    """Return the absolute path to betty-ai/data/features (override-able)."""
    if "BETTY_FEATURES_DIR" in os.environ:
        return os.environ["BETTY_FEATURES_DIR"]
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "data", "features"))


def load_real_load_curve(partition: str) -> Optional[List[float]]:
    """Try to load a partition's empirical hour-of-day load curve.

    Looks for `<features_dir>/partitions/<partition>.json` produced offline
    by the scheduling pipeline. The pipeline writes a 24-element
    `submit_count_by_hour` histogram; we normalize so the peak hour = 1.0
    and use that as a "load proxy". Returns None if the file is missing or
    malformed — caller falls back to the synthetic curve.
    """
    path = os.path.join(_features_dir(), "partitions", f"{partition}.json")
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None
    raw = data.get("submit_count_by_hour")
    if not isinstance(raw, list) or len(raw) != 24:
        return None
    try:
        nums = [float(x) for x in raw]
    except (TypeError, ValueError):
        return None
    peak = max(nums) if nums else 0.0
    if peak <= 0:
        return None
    return [n / peak for n in nums]


def _slot_blocked(start: datetime, end: datetime, partition: str,
                  blackouts: List[BlackoutWindow]) -> Optional[str]:
    for b in blackouts:
        if b.partition and b.partition != partition:
            continue
        if start < b.end and end > b.start:
            return b.reason or "reserved window"
    return None


def propose_slots(
    *,
    gpus: int,
    hours: float,
    partition: str,
    snapshot: ClusterSnapshot,
    earliest: Optional[datetime] = None,
    latest: Optional[datetime] = None,
    candidate_offsets_hours: Optional[List[float]] = None,
    load_by_hour: Optional[List[float]] = None,
    now: Optional[datetime] = None,
) -> List[Slot]:
    """Propose ranked candidate windows for a `gpus` × `hours` request.

    `candidate_offsets_hours` defaults to a useful menu: now, 1h, 3h, 6h,
    "after 6 PM", 12h, 24h, 48h.
    """
    now = now or datetime.now(timezone.utc)
    earliest = earliest or now
    latest = latest or now + timedelta(days=7)
    if load_by_hour is None:
        real = load_real_load_curve(partition)
        if real is not None:
            load_by_hour = real
            # Mutate snapshot.sources so the slot reasons can label this curve
            # as "historical" instead of "synthetic" — agent reads this back.
            if "historical_load" not in snapshot.sources:
                snapshot.sources.append("historical_load")
        else:
            load_by_hour = _DEFAULT_LOAD_BY_HOUR

    if not candidate_offsets_hours:
        candidate_offsets_hours = [0, 1, 3, 6, 12, 24, 48]

    free = snapshot.gpus_idle_by_partition.get(partition, 0)
    total = snapshot.gpus_total_by_partition.get(partition, max(free, 1))
    free_ratio = min(1.0, free / total) if total > 0 else 0.0
    pending = snapshot.pending_jobs_by_partition.get(partition, 0)

    slots: List[Slot] = []
    seen: set = set()

    def add(start: datetime, label: str = "") -> None:
        if start < earliest or start > latest:
            return
        end = start + timedelta(hours=hours)
        if end > latest + timedelta(hours=hours):
            return
        block_reason = _slot_blocked(start, end, partition, snapshot.blackout_windows)
        if block_reason:
            return
        # Round to nearest 15min so the calendar reads nicely.
        rounded = start.replace(second=0, microsecond=0)
        rounded = rounded.replace(minute=(rounded.minute // 15) * 15)
        key = (rounded.isoformat(), partition)
        if key in seen:
            return
        seen.add(key)

        local_hour = start.astimezone().hour
        load = load_by_hour[local_hour] if 0 <= local_hour < 24 else 0.5
        dt_hours = (start - now).total_seconds() / 3600

        # Score formula (intentionally simple — explainable to the user):
        #   +1.5 if enough GPUs are idle right now
        #    +(1.0 - load_at_hour)   — favor off-peak slots
        #    -(pending / 50)          — penalize crowded queues, capped soft
        #    -(dt_hours / 168)        — slight pull toward "soonest viable"
        # Each component appears in `reasons` so the agent doesn't have to
        # reverse-engineer where the score came from.
        score = 0.0
        reasons: List[str] = []
        if free >= gpus:
            score += 1.5
            reasons.append(f"{free}/{total} GPUs idle right now in {partition}")
        else:
            reasons.append(
                f"{free}/{total} GPUs idle ({pending} pending) — short wait expected"
            )
        score += (1.0 - load)
        load_label = "historical" if "historical_load" in (snapshot.sources or []) else "synthetic"
        reasons.append(f"{load_label} load at {local_hour:02d}:00 = {load:.0%}")
        # Queue-depth penalty — soft, capped to avoid dominating the score.
        if pending > 0:
            qpenalty = min(pending / 50.0, 1.0)
            score -= qpenalty
            reasons.append(f"{pending} pending in queue (penalty {qpenalty:.2f})")
        # Modest penalty for far-future slots so we don't always recommend "next week".
        score -= dt_hours / 168
        if dt_hours > 12:
            reasons.append(f"~{dt_hours:.0f}h from now")
        # If SLURM's own backfill simulator predicted a start, surface it.
        next_start = snapshot.next_start_by_partition.get(partition)
        if next_start:
            reasons.append(f"SLURM est. earliest start in this partition: {next_start}")
        if label:
            reasons.append(label)

        slots.append(Slot(
            start=rounded, end=end, partition=partition, gpus=gpus,
            score=round(score, 3), reasons=reasons,
        ))

    for off in candidate_offsets_hours:
        add(now + timedelta(hours=off))

    # Always offer "tonight after 6 PM local" as a backfill-friendly window
    local_now = now.astimezone()
    six_pm = local_now.replace(hour=18, minute=0, second=0, microsecond=0)
    if six_pm <= local_now:
        six_pm = six_pm + timedelta(days=1)
    add(six_pm.astimezone(timezone.utc), label="off-peak window")

    slots.sort(key=lambda s: s.score, reverse=True)
    return slots[:8]
