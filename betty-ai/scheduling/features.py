"""Feature extraction — turn parsed records into the stable JSON schema.

This is the ONLY place statistics are computed. The agent reads the JSON
produced here; it does not re-compute.

Schema is versioned via `SCHEMA_VERSION`. Any change to the output shape
must bump the version and update the dashboard + agent tool consumers.
"""
from __future__ import annotations

import json
import statistics
from collections import Counter, defaultdict
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional

from . import SCHEMA_VERSION
from .types import NodeRecord, Reservation, SacctJob, SinfoRow

# Minimum sample size before we report percentiles at all. Below this we
# emit {"n": N, "status": "insufficient-data"} so the agent can tell the
# user honestly that we don't have enough history.
MIN_SAMPLE = 10

WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


# ---------------------------------------------------------------------------
# Distribution primitives
# ---------------------------------------------------------------------------

def _distribution(values: List[float]) -> Dict[str, Any]:
    """Summary stats for a non-empty numeric list.

    Emits `status: "insufficient-data"` when n < MIN_SAMPLE so agents and
    dashboards know the numbers aren't reliable. Uses `statistics.quantiles`
    (Python 3.8+ stdlib) with method='exclusive' for consistency.

    Percentiles reported: p10, p25, p50, p75, p90, p95, p99.
    """
    n = len(values)
    if n == 0:
        return {"n": 0, "status": "no-data"}
    if n < MIN_SAMPLE:
        return {"n": n, "status": "insufficient-data"}
    # quantiles(n=100) gives 99 cut points -> q[i-1] approximates pi
    q = statistics.quantiles(values, n=100, method="exclusive")
    return {
        "n": n,
        "status": "ok",
        "mean": round(statistics.fmean(values), 3),
        "stdev": round(statistics.pstdev(values), 3) if n > 1 else 0.0,
        "min": round(min(values), 3),
        "p10": round(q[9], 3),
        "p25": round(q[24], 3),
        "p50": round(q[49], 3),
        "p75": round(q[74], 3),
        "p90": round(q[89], 3),
        "p95": round(q[94], 3),
        "p99": round(q[98], 3),
        "max": round(max(values), 3),
    }


# ---------------------------------------------------------------------------
# Per-partition feature extraction
# ---------------------------------------------------------------------------

def partition_features(
    jobs: List[SacctJob],
    partition: str,
    window_start: Optional[datetime],
    window_end: datetime,
) -> Dict[str, Any]:
    """Compute the features JSON for a single partition.

    The caller is responsible for restricting `jobs` to the time window and
    computing `window_start` / `window_end` from the input sacct data.
    """
    partition_jobs = [j for j in jobs if j.partition == partition]
    terminal = [j for j in partition_jobs if j.state_bucket() in {"COMPLETED", "FAILED", "CANCELLED"}]

    # --- wait distribution (all terminal jobs) ---
    waits = [w for j in terminal if (w := j.queue_wait_sec()) is not None]
    wait_dist = _distribution(waits)

    # --- runtime distribution (successful jobs only) ---
    completed = [j for j in terminal if j.state_bucket() == "COMPLETED"]
    runtimes = [j.elapsed_sec for j in completed if j.elapsed_sec is not None]
    runtime_dist = _distribution(runtimes)

    # --- job size distributions (allocated resources on terminal jobs) ---
    def _alloc_dist(key_extractor) -> Dict[str, Any]:
        values = [v for j in terminal if (v := key_extractor(j)) is not None]
        return _distribution(values)

    from .parsers import tres_cpu_count, tres_gpu_count, tres_mem_mb, tres_node_count

    cpu_dist = _alloc_dist(lambda j: tres_cpu_count(j.alloc_tres))
    gpu_dist = _alloc_dist(lambda j: tres_gpu_count(j.alloc_tres))
    mem_dist = _alloc_dist(lambda j: (mb := tres_mem_mb(j.alloc_tres)) and mb / 1024.0)
    node_dist = _alloc_dist(lambda j: tres_node_count(j.alloc_tres))

    # --- success rate (COMPLETED / (COMPLETED + FAILED)) ---
    succeeded = sum(1 for j in terminal if j.state_bucket() == "COMPLETED")
    failed = sum(1 for j in terminal if j.state_bucket() == "FAILED")
    if succeeded + failed >= MIN_SAMPLE:
        success_rate = {
            "n": succeeded + failed,
            "status": "ok",
            "completed": succeeded,
            "failed": failed,
            "rate": round(succeeded / (succeeded + failed), 4),
        }
    else:
        success_rate = {"n": succeeded + failed, "status": "insufficient-data"}

    # --- state breakdown (counts across all terminal buckets) ---
    state_breakdown: Counter = Counter()
    for j in terminal:
        state_breakdown[j.state_bucket()] += 1

    # --- hourly load (arrivals per hour-of-week, in America/New_York) ---
    hourly = _hourly_load(partition_jobs)

    # --- top GPU consumers ---
    gpu_hours = defaultdict(float)
    for j in completed:
        g = tres_gpu_count(j.alloc_tres)
        e = j.elapsed_sec
        if g and e:
            gpu_hours[j.user or "unknown"] += (g * e) / 3600.0
    top_users = [
        {"user": u, "gpu_hours": round(h, 2)}
        for u, h in sorted(gpu_hours.items(), key=lambda kv: -kv[1])[:10]
    ]

    return {
        "schema_version": SCHEMA_VERSION,
        "partition": partition,
        "computed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "window_start": window_start.isoformat() if window_start else None,
        "window_end": window_end.isoformat(),
        "input_n_jobs_in_window": len(partition_jobs),
        "input_n_terminal": len(terminal),
        "wait_sec": wait_dist,
        "runtime_sec": runtime_dist,
        "cpu_count": cpu_dist,
        "gpu_count": gpu_dist,
        "mem_gb": mem_dist,
        "node_count": node_dist,
        "success_rate": success_rate,
        "state_breakdown": dict(state_breakdown),
        "hourly_load": hourly,
        "top_gpu_hours": top_users,
    }


def _hourly_load(jobs: Iterable[SacctJob]) -> Dict[str, int]:
    """168-bucket arrival-rate heatmap (Mon_00 .. Sun_23) in America/New_York.

    Arrival = Eligible timestamp (falls back to Submit if Eligible missing).
    Timestamps are stored UTC; we convert back to ET for the bucket key.
    """
    try:
        from zoneinfo import ZoneInfo
        eastern = ZoneInfo("America/New_York")
    except Exception:
        eastern = timezone.utc  # fallback; bucketing drift acceptable

    counts: Counter = Counter()
    for j in jobs:
        ts = j.eligible_ts or j.submit_ts
        if ts is None:
            continue
        local = ts.astimezone(eastern)
        key = f"{WEEKDAYS[local.weekday()]}_{local.hour:02d}"
        counts[key] += 1
    # Dense output so the dashboard doesn't need to fill zeros.
    out = {}
    for d in WEEKDAYS:
        for h in range(24):
            out[f"{d}_{h:02d}"] = int(counts.get(f"{d}_{h:02d}", 0))
    return out


# ---------------------------------------------------------------------------
# Per-user feature extraction
# ---------------------------------------------------------------------------

def user_features(
    jobs: List[SacctJob],
    user: str,
    window_start: Optional[datetime],
    window_end: datetime,
) -> Dict[str, Any]:
    """Compute per-user history features."""
    from .parsers import tres_gpu_count

    user_jobs = [j for j in jobs if j.user == user]
    terminal = [j for j in user_jobs if j.state_bucket() in {"COMPLETED", "FAILED", "CANCELLED"}]
    completed = [j for j in terminal if j.state_bucket() == "COMPLETED"]

    partition_counts = Counter(j.partition for j in user_jobs if j.partition)

    runtimes = [j.elapsed_sec for j in completed if j.elapsed_sec is not None]
    waits = [w for j in terminal if (w := j.queue_wait_sec()) is not None]
    gpu_sizes = [g for j in terminal if (g := tres_gpu_count(j.alloc_tres)) is not None]

    succeeded = sum(1 for j in terminal if j.state_bucket() == "COMPLETED")
    failed = sum(1 for j in terminal if j.state_bucket() == "FAILED")

    return {
        "schema_version": SCHEMA_VERSION,
        "user": user,
        "computed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "window_start": window_start.isoformat() if window_start else None,
        "window_end": window_end.isoformat(),
        "n_jobs": len(user_jobs),
        "n_terminal": len(terminal),
        "partitions_used": dict(partition_counts),
        "runtime_sec": _distribution(runtimes),
        "wait_sec": _distribution(waits),
        "gpu_count": _distribution(gpu_sizes),
        "success_rate": (
            {
                "n": succeeded + failed,
                "status": "ok",
                "rate": round(succeeded / (succeeded + failed), 4),
            }
            if succeeded + failed >= MIN_SAMPLE
            else {"n": succeeded + failed, "status": "insufficient-data"}
        ),
    }


# ---------------------------------------------------------------------------
# Cluster-level "current" snapshot
# ---------------------------------------------------------------------------

def current_snapshot(
    sinfo_rows: List[SinfoRow],
    nodes: List[NodeRecord],
    reservations: List[Reservation],
) -> Dict[str, Any]:
    """Summary of the cluster's current live state — what the dashboard tiles show."""
    per_partition: Dict[str, Dict[str, int]] = defaultdict(lambda: {
        "nodes_total": 0, "nodes_up": 0, "nodes_down": 0, "nodes_drain": 0,
        "gpus_total": 0, "gpus_alloc": 0,
    })
    for r in sinfo_rows:
        p = per_partition[r.partition]
        p["nodes_total"] += r.nodes
        state = r.state.lower()
        if "down" in state or "fail" in state:
            p["nodes_down"] += r.nodes
        elif "drain" in state:
            p["nodes_drain"] += r.nodes
        elif "up" in r.avail.lower():
            p["nodes_up"] += r.nodes

    for n in nodes:
        for part in n.partitions:
            if n.gpus_total is not None:
                per_partition[part]["gpus_total"] += n.gpus_total
            if n.gpus_alloc is not None:
                per_partition[part]["gpus_alloc"] += n.gpus_alloc

    for v in per_partition.values():
        v["gpus_free"] = max(0, v["gpus_total"] - v["gpus_alloc"])

    return {
        "schema_version": SCHEMA_VERSION,
        "computed_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "partitions": {k: dict(v) for k, v in per_partition.items()},
        "reservations": [
            {
                "name": r.name,
                "start": r.start_ts.isoformat() if r.start_ts else None,
                "end": r.end_ts.isoformat() if r.end_ts else None,
                "partition": r.partition,
                "nodes": r.nodes,
                "node_count": r.node_count,
                "flags": r.flags,
                "state": r.state,
            }
            for r in reservations
        ],
    }


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def write_features(out_dir: Path, partition: str, payload: Dict[str, Any]) -> Path:
    """Write features JSON with deterministic formatting."""
    out_dir.mkdir(parents=True, exist_ok=True)
    date_tag = payload.get("window_end", datetime.now(timezone.utc).isoformat())[:10]
    path = out_dir / f"{partition}__{date_tag}.json"
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return path
