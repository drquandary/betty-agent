"""Command-line entry points. One module = one verb.

Usage:
    python -m scheduling.cli ingest <inbox_dir> <processed_dir>
    python -m scheduling.cli features <processed_dir> <features_dir>
    python -m scheduling.cli all <inbox_dir> <processed_dir> <features_dir>

The `ingest` verb reads a directory of captured Slurm log files, routes each
through the appropriate parser, and writes JSON summaries per input file to
`<processed_dir>/<stem>.json`. Source files are MOVED (not copied) to
`<inbox_dir>/../archive/<stem>/` on success.

The `features` verb reads the most recent parsed sacct file, computes per-
partition + per-user feature JSON, and writes to `<features_dir>/<partition>/`.
"""
from __future__ import annotations

import json
import shutil
import sys
from dataclasses import asdict, is_dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from . import SCHEMA_VERSION
from .features import (
    current_snapshot,
    partition_features,
    user_features,
    write_features,
)
from .parsers import (
    infer_log_type,
    parse_sacct,
    parse_scontrol_nodes,
    parse_scontrol_res,
    parse_sinfo,
)
from .types import NodeRecord, Reservation, SacctJob, SinfoRow


# ---------------------------------------------------------------------------
# ingest
# ---------------------------------------------------------------------------

def cmd_ingest(inbox: Path, processed: Path) -> int:
    """Parse every log file in `inbox` into JSON under `processed`.

    Returns exit code 0 if every file parsed; 1 if any dropped rows exceeded
    zero (visible data loss; caller may want to investigate).
    """
    inbox = inbox.resolve()
    processed = processed.resolve()
    processed.mkdir(parents=True, exist_ok=True)
    archive = inbox.parent / "archive"
    archive.mkdir(parents=True, exist_ok=True)

    any_drops = False
    files = sorted(p for p in inbox.iterdir() if p.is_file() and not p.name.startswith("."))
    if not files:
        print(f"[ingest] inbox empty: {inbox}")
        return 0

    for path in files:
        kind = infer_log_type(path)
        if kind is None:
            print(f"[ingest] skip (unknown prefix): {path.name}")
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        if kind == "sacct":
            records, counters = parse_sacct(text)
            payload = {
                "schema_version": SCHEMA_VERSION,
                "kind": "sacct",
                "source_file": path.name,
                "counters": counters.as_dict(),
                "records": [_record_to_dict(r) for r in records],
            }
        elif kind == "sinfo":
            records, counters = parse_sinfo(text)
            payload = {
                "schema_version": SCHEMA_VERSION,
                "kind": "sinfo",
                "source_file": path.name,
                "counters": counters.as_dict(),
                "records": [_record_to_dict(r) for r in records],
            }
        elif kind == "nodes":
            records, counters = parse_scontrol_nodes(text)
            payload = {
                "schema_version": SCHEMA_VERSION,
                "kind": "nodes",
                "source_file": path.name,
                "counters": counters.as_dict(),
                "records": [_record_to_dict(r) for r in records],
            }
        elif kind == "res":
            records, counters = parse_scontrol_res(text)
            payload = {
                "schema_version": SCHEMA_VERSION,
                "kind": "reservations",
                "source_file": path.name,
                "counters": counters.as_dict(),
                "records": [_record_to_dict(r) for r in records],
            }
        else:
            continue

        out_path = processed / f"{path.stem}.json"
        out_path.write_text(json.dumps(payload, indent=2, default=str) + "\n", encoding="utf-8")

        dropped = sum(
            v for k, v in counters.as_dict().items()
            if k.startswith("rows_dropped")
        )
        status = "OK" if dropped == 0 else f"DROPPED={dropped}"
        print(f"[ingest] {path.name} -> {out_path.name}  ok={counters.rows_ok} {status}")
        if dropped:
            any_drops = True

        # Move original to archive so inbox stays drainable.
        (archive / path.name).write_bytes(path.read_bytes())
        path.unlink()

    return 1 if any_drops else 0


# ---------------------------------------------------------------------------
# features
# ---------------------------------------------------------------------------

def cmd_features(processed: Path, features_dir: Path) -> int:
    """Compute features from the latest ingested sacct + sinfo + nodes + res."""
    processed = processed.resolve()
    features_dir = features_dir.resolve()
    features_dir.mkdir(parents=True, exist_ok=True)

    sacct_jobs, window_start, window_end = _load_latest_sacct(processed)
    if not sacct_jobs:
        print(f"[features] no sacct data in {processed}; nothing to compute")
        return 0
    sinfo_rows = _load_latest(processed, "sinfo", _sinfo_from_dict)
    nodes = _load_latest(processed, "nodes", _node_from_dict)
    reservations = _load_latest(processed, "reservations", _res_from_dict)

    partitions = sorted({j.partition for j in sacct_jobs if j.partition})
    print(f"[features] computing for {len(partitions)} partitions across {len(sacct_jobs)} jobs")

    (features_dir / "partitions").mkdir(exist_ok=True)
    for p in partitions:
        payload = partition_features(sacct_jobs, p, window_start, window_end)
        write_features(features_dir / "partitions", p, payload)

    users = sorted({j.user for j in sacct_jobs if j.user})
    (features_dir / "users").mkdir(exist_ok=True)
    for u in users:
        payload = user_features(sacct_jobs, u, window_start, window_end)
        write_features(features_dir / "users", u, payload)

    # Cluster current snapshot
    current = current_snapshot(sinfo_rows, nodes, reservations)
    (features_dir / "current.json").write_text(
        json.dumps(current, indent=2, sort_keys=True) + "\n", encoding="utf-8",
    )

    # Index — catalog of available feature files
    index = {
        "schema_version": SCHEMA_VERSION,
        "partitions": partitions,
        "users": users,
        "window_start": window_start.isoformat() if window_start else None,
        "window_end": window_end.isoformat(),
    }
    (features_dir / "index.json").write_text(
        json.dumps(index, indent=2, sort_keys=True) + "\n", encoding="utf-8",
    )
    print(f"[features] wrote partitions/, users/, current.json, index.json -> {features_dir}")
    return 0


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------

def _record_to_dict(r: Any) -> Dict[str, Any]:
    """dataclass -> dict, with datetimes stringified to ISO UTC."""
    if not is_dataclass(r):
        return {}
    d = asdict(r)
    for k, v in list(d.items()):
        if isinstance(v, datetime):
            d[k] = v.isoformat()
    return d


def _load_latest_sacct(processed: Path):
    candidates = sorted(processed.glob("sacct-*.json"))
    if not candidates:
        return [], None, None
    latest = candidates[-1]
    data = json.loads(latest.read_text(encoding="utf-8"))
    jobs = [_sacct_from_dict(r) for r in data.get("records", [])]
    times = [j.eligible_ts or j.submit_ts for j in jobs]
    times = [t for t in times if t is not None]
    return jobs, (min(times) if times else None), (max(times) if times else datetime.utcnow())


def _load_latest(processed: Path, kind: str, ctor) -> List[Any]:
    # File prefix conventions:
    #   sinfo-*.json
    #   scontrol-show-nodes-*.json
    #   scontrol-show-res-*.json
    patterns = {
        "sinfo": "sinfo-*.json",
        "nodes": "scontrol-show-nodes-*.json",
        "reservations": "scontrol-show-res-*.json",
    }
    pat = patterns[kind]
    candidates = sorted(processed.glob(pat))
    if not candidates:
        return []
    latest = candidates[-1]
    data = json.loads(latest.read_text(encoding="utf-8"))
    return [ctor(r) for r in data.get("records", [])]


def _sacct_from_dict(d: Dict[str, Any]) -> SacctJob:
    from .parsers import parse_slurm_timestamp
    return SacctJob(
        job_id=d["job_id"],
        user=d.get("user"),
        account=d.get("account"),
        partition=d.get("partition"),
        qos=d.get("qos"),
        submit_ts=_maybe_dt(d.get("submit_ts")),
        eligible_ts=_maybe_dt(d.get("eligible_ts")),
        start_ts=_maybe_dt(d.get("start_ts")),
        end_ts=_maybe_dt(d.get("end_ts")),
        elapsed_sec=d.get("elapsed_sec"),
        planned_sec=d.get("planned_sec"),
        state=d.get("state") or "",
        exit_code=d.get("exit_code"),
        req_tres=d.get("req_tres") or {},
        alloc_tres=d.get("alloc_tres") or {},
        req_mem=d.get("req_mem"),
        req_cpus=d.get("req_cpus"),
        req_nodes=d.get("req_nodes"),
        node_list=d.get("node_list"),
        reason=d.get("reason"),
    )


def _sinfo_from_dict(d: Dict[str, Any]) -> SinfoRow:
    return SinfoRow(
        partition=d["partition"], partition_default=d["partition_default"],
        avail=d["avail"], timelimit=d["timelimit"], nodes=d["nodes"],
        state=d["state"], nodelist=d.get("nodelist", ""),
    )


def _node_from_dict(d: Dict[str, Any]) -> NodeRecord:
    return NodeRecord(
        name=d["name"], state=d.get("state", ""), partitions=d.get("partitions", []),
        cpu_total=d.get("cpu_total"), cpu_alloc=d.get("cpu_alloc"),
        real_memory_mb=d.get("real_memory_mb"), free_memory_mb=d.get("free_memory_mb"),
        gres=d.get("gres"), gres_used=d.get("gres_used"),
        gpus_total=d.get("gpus_total"), gpus_alloc=d.get("gpus_alloc"),
        reason=d.get("reason"), raw=d.get("raw", {}),
    )


def _res_from_dict(d: Dict[str, Any]) -> Reservation:
    return Reservation(
        name=d["name"], start_ts=_maybe_dt(d.get("start_ts")),
        end_ts=_maybe_dt(d.get("end_ts")), duration=d.get("duration"),
        nodes=d.get("nodes"), node_count=d.get("node_count"),
        partition=d.get("partition"), features=d.get("features"),
        flags=d.get("flags", []), users=d.get("users", []),
        accounts=d.get("accounts", []), state=d.get("state"), raw=d.get("raw", {}),
    )


def _maybe_dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Main dispatcher
# ---------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if not argv or argv[0] in {"-h", "--help", "help"}:
        print(__doc__, file=sys.stderr)
        return 0
    verb = argv[0]
    rest = argv[1:]
    if verb == "ingest":
        if len(rest) != 2:
            print("usage: ingest <inbox_dir> <processed_dir>", file=sys.stderr)
            return 2
        return cmd_ingest(Path(rest[0]), Path(rest[1]))
    if verb == "features":
        if len(rest) != 2:
            print("usage: features <processed_dir> <features_dir>", file=sys.stderr)
            return 2
        return cmd_features(Path(rest[0]), Path(rest[1]))
    if verb == "all":
        if len(rest) != 3:
            print("usage: all <inbox_dir> <processed_dir> <features_dir>", file=sys.stderr)
            return 2
        rc = cmd_ingest(Path(rest[0]), Path(rest[1]))
        if rc == 0:
            rc = cmd_features(Path(rest[1]), Path(rest[2]))
        return rc
    print(f"unknown verb: {verb}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
