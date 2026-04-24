"""Typed records produced by the parsers.

Each parser in `parsers.py` returns a list of one of these dataclasses.
They are pure data — no methods that hit the filesystem or network —
so feature extraction is trivially testable.

Nullable fields use `Optional[...]`. Slurm often reports "Unknown",
"None", or the sentinel epoch for missing timestamps; the parser
normalizes those to `None` rather than propagating Slurm's mixed
sentinels downstream.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional


# --- sacct ----------------------------------------------------------------

@dataclass(frozen=True)
class SacctJob:
    """One row from `sacct -X --parsable2 -o ...`.

    `-X` means main job only (no `.batch` / `.extern` steps), so JobID is
    never a composite like `12345.batch`.
    """
    job_id: str
    user: Optional[str]
    account: Optional[str]
    partition: Optional[str]
    qos: Optional[str]
    submit_ts: Optional[datetime]
    eligible_ts: Optional[datetime]
    start_ts: Optional[datetime]
    end_ts: Optional[datetime]
    elapsed_sec: Optional[float]
    planned_sec: Optional[float]        # Slurm 24.11+, None on older versions
    state: str                          # raw string; state_bucket() collapses
    exit_code: Optional[str]
    req_tres: Dict[str, str]            # parsed from e.g. "cpu=96,gres/gpu=8,mem=1920000M,node=1"
    alloc_tres: Dict[str, str]
    req_mem: Optional[str]              # raw, e.g. "1920000M" or "64Gc"
    req_cpus: Optional[int]
    req_nodes: Optional[int]
    node_list: Optional[str]
    reason: Optional[str]

    def queue_wait_sec(self) -> Optional[float]:
        """True queue wait — time from Eligible to Start.

        Using Submit would penalize users who held their own jobs (`--hold`),
        so we use Eligible. Returns None if either timestamp is missing or
        if the difference is negative (clock drift).
        """
        if self.eligible_ts is None or self.start_ts is None:
            return None
        w = (self.start_ts - self.eligible_ts).total_seconds()
        return w if w >= 0 else None

    def state_bucket(self) -> str:
        """Collapse the 15+ raw Slurm states into three buckets.

        COMPLETED: ran and exited 0
        FAILED:    exhausted time, died with non-zero, or OOM
        CANCELLED: user- or admin-initiated cancel, or requeued
        PENDING:   still in queue (should be filtered before features)
        OTHER:     anything we haven't seen
        """
        s = self.state.split()[0] if self.state else ""  # strip "CANCELLED by 12345"
        if s == "COMPLETED":
            return "COMPLETED"
        if s in {"FAILED", "TIMEOUT", "OUT_OF_MEMORY", "NODE_FAIL", "BOOT_FAIL"}:
            return "FAILED"
        if s in {"CANCELLED", "REQUEUED", "PREEMPTED"}:
            return "CANCELLED"
        if s in {"PENDING", "RUNNING", "CONFIGURING", "COMPLETING", "RESIZING"}:
            return "PENDING"
        return "OTHER"


# --- sinfo ----------------------------------------------------------------

@dataclass(frozen=True)
class SinfoRow:
    """One row from default `sinfo` output (PARTITION/AVAIL/TIMELIMIT/NODES/STATE/NODELIST).

    `partition_default` is True if Slurm marked it with a trailing `*` (the
    cluster's default partition).
    """
    partition: str
    partition_default: bool
    avail: str                          # "up" | "down" | "drain" | "inactive"
    timelimit: str                      # raw Slurm duration, e.g. "7-00:00:00" or "UNLIMITED"
    nodes: int
    state: str                          # raw, may carry modifier like "mix-", "idle~"
    nodelist: str


# --- scontrol show nodes -o ----------------------------------------------

@dataclass(frozen=True)
class NodeRecord:
    """One line from `scontrol show nodes -o` (one node per line).

    Keeps the raw `key=value` map in `raw` so callers can access fields
    we didn't break out explicitly. Commonly-queried fields are hoisted.
    """
    name: str
    state: str                          # e.g. "MIXED+PLANNED"
    partitions: List[str]               # split from "Partitions=a,b,c"
    cpu_total: Optional[int]
    cpu_alloc: Optional[int]
    real_memory_mb: Optional[int]
    free_memory_mb: Optional[int]
    gres: Optional[str]                 # raw, e.g. "gpu:B200:8(S:0-1)"
    gres_used: Optional[str]
    gpus_total: Optional[int]
    gpus_alloc: Optional[int]
    reason: Optional[str]
    raw: Dict[str, str] = field(default_factory=dict)

    def gpus_free(self) -> Optional[int]:
        if self.gpus_total is None or self.gpus_alloc is None:
            return None
        return max(0, self.gpus_total - self.gpus_alloc)


# --- scontrol show reservation -------------------------------------------

@dataclass(frozen=True)
class Reservation:
    """One stanza from `scontrol show reservation`."""
    name: str
    start_ts: Optional[datetime]
    end_ts: Optional[datetime]
    duration: Optional[str]             # raw, e.g. "10:00:00"
    nodes: Optional[str]                # e.g. "dgx[001-027]"
    node_count: Optional[int]
    partition: Optional[str]
    features: Optional[str]
    flags: List[str]
    users: List[str]
    accounts: List[str]
    state: Optional[str]
    raw: Dict[str, str] = field(default_factory=dict)


# --- parser counters (observability) -------------------------------------

@dataclass
class ParseCounters:
    """Row-level counters emitted by each parser.

    Silent drops are a bug. Every dropped row increments a counter, and the
    CLI prints them at the end so data loss is visible.
    """
    rows_total: int = 0
    rows_ok: int = 0
    rows_dropped_malformed: int = 0
    rows_dropped_unknown_timestamp: int = 0
    rows_dropped_negative_wait: int = 0
    rows_dropped_step: int = 0          # sacct-specific: .batch / .extern despite -X

    def as_dict(self) -> Dict[str, int]:
        return {k: v for k, v in self.__dict__.items() if isinstance(v, int)}
