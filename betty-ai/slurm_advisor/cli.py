"""JSON-emitting CLI invoked by the agent's slurm_* tools.

Verbs:
    check         — read sbatch from stdin (or --file), report violations
    recommend     — JSON intent on stdin (or flags), return a SolverResult
    diagnose      — `scontrol show job <id>` output on stdin, return a diagnosis
    availability  — JSON snapshot+intent on stdin, return ranked Slot list

The contract: every invocation prints a single JSON object on stdout. Errors
go to stderr and exit non-zero. The TS tools rely on this — don't print
banner text from this module.

Run: `python -m slurm_advisor.cli <verb> [args]`
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List

from . import SCHEMA_VERSION
from .availability import (
    BlackoutWindow,
    ClusterSnapshot,
    propose_slots,
)
from .policy import Policy
from .recommender import (
    check_sbatch,
    diagnose_pending,
    recommend,
)
from .solver import JobIntent


def _emit(obj: Dict[str, Any]) -> int:
    obj.setdefault("schema_version", SCHEMA_VERSION)
    json.dump(obj, sys.stdout, indent=2, sort_keys=True, default=str)
    sys.stdout.write("\n")
    return 0


def cmd_check(args: argparse.Namespace) -> int:
    if args.file:
        text = open(args.file, "r", encoding="utf-8").read()
    else:
        text = sys.stdin.read()
    if not text.strip():
        print("check: empty sbatch input", file=sys.stderr)
        return 2
    report = check_sbatch(text)
    return _emit(report.to_dict())


def cmd_recommend(args: argparse.Namespace) -> int:
    intent = JobIntent(
        gpus=args.gpus or 0,
        cpus=args.cpus or 0,
        mem_gb=args.mem_gb,
        hours=args.hours or 1.0,
        partition_pref=args.partition,
        qos_pref=args.qos,
        interactive=args.interactive,
        min_vram_per_gpu_gb=args.min_vram_gb,
    )
    if args.json_in:
        data = json.loads(sys.stdin.read())
        intent = JobIntent(
            gpus=int(data.get("gpus", 0)),
            cpus=int(data.get("cpus", 0)),
            mem_gb=data.get("mem_gb"),
            hours=float(data.get("hours", 1.0)),
            partition_pref=data.get("partition"),
            qos_pref=data.get("qos"),
            interactive=bool(data.get("interactive", False)),
            min_vram_per_gpu_gb=data.get("min_vram_gb"),
            notes=list(data.get("notes", [])),
        )
    rec = recommend(intent)
    return _emit(rec.to_dict())


def cmd_diagnose(args: argparse.Namespace) -> int:
    """Read scontrol output on stdin; optionally read sprio output from --sprio-file.

    The scontrol+sprio split lets the TS adapter run both commands on the
    cluster in parallel, then ship them down through one CLI call. The
    sprio file is optional: when absent, diagnose still works (just without
    priority decomposition).
    """
    text = sys.stdin.read()
    if not text.strip():
        print("diagnose: paste `scontrol show job <id>` output on stdin", file=sys.stderr)
        return 2
    sprio_text = ""
    if args.sprio_file:
        try:
            with open(args.sprio_file, "r", encoding="utf-8") as f:
                sprio_text = f.read()
        except OSError as e:
            print(f"diagnose: could not read sprio file {args.sprio_file}: {e}", file=sys.stderr)
            # Non-fatal: continue without priority factors.
    diag = diagnose_pending(args.job_id, text, sprio_text=sprio_text)
    return _emit(diag.to_dict())


def cmd_availability(args: argparse.Namespace) -> int:
    """Read a JSON payload on stdin like:

      {
        "gpus": 2,
        "hours": 8,
        "partition": "dgx-b200",
        "snapshot": {
          "gpus_idle_by_partition": {"dgx-b200": 12, "b200-mig45": 4},
          "gpus_total_by_partition": {"dgx-b200": 216, "b200-mig45": 32},
          "pending_jobs_by_partition": {"dgx-b200": 3},
          "blackouts": [
            {"start": "2026-04-30T05:00:00Z", "end": "2026-04-30T11:00:00Z",
             "partition": "dgx-b200", "reason": "weekly maintenance"}
          ]
        }
      }
    """
    payload = json.loads(sys.stdin.read() or "{}")
    snap_in = payload.get("snapshot", {}) or {}
    blackouts = []
    for b in snap_in.get("blackouts", []) or []:
        blackouts.append(BlackoutWindow(
            start=datetime.fromisoformat(b["start"].replace("Z", "+00:00")),
            end=datetime.fromisoformat(b["end"].replace("Z", "+00:00")),
            partition=b.get("partition"),
            reason=b.get("reason", ""),
        ))
    snap = ClusterSnapshot(
        gpus_idle_by_partition=dict(snap_in.get("gpus_idle_by_partition", {}) or {}),
        gpus_total_by_partition=dict(snap_in.get("gpus_total_by_partition", {}) or {}),
        pending_jobs_by_partition=dict(snap_in.get("pending_jobs_by_partition", {}) or {}),
        next_start_by_partition=dict(snap_in.get("next_start_by_partition", {}) or {}),
        sources=list(snap_in.get("sources", []) or []),
        blackout_windows=blackouts,
    )
    earliest = payload.get("earliest")
    latest = payload.get("latest")

    slots = propose_slots(
        gpus=int(payload.get("gpus", 1)),
        hours=float(payload.get("hours", 1.0)),
        partition=str(payload.get("partition", "dgx-b200")),
        snapshot=snap,
        earliest=datetime.fromisoformat(earliest.replace("Z", "+00:00")) if earliest else None,
        latest=datetime.fromisoformat(latest.replace("Z", "+00:00")) if latest else None,
        now=datetime.now(timezone.utc),
    )
    return _emit({
        "gpus": int(payload.get("gpus", 1)),
        "hours": float(payload.get("hours", 1.0)),
        "partition": payload.get("partition"),
        "slots": [s.to_dict() for s in slots],
        # Provenance + formula — surfaced so the agent can answer
        # "how are you reasoning about this?" without inventing weights.
        "sources": snap.sources,
        "score_formula": (
            "(1.5 if free>=gpus else 0) "
            "+ (1.0 - load_at_hour) "
            "- min(pending/50, 1.0) "
            "- (dt_hours / 168)"
        ),
        "load_curve_kind": "historical" if "historical_load" in snap.sources else "synthetic",
    })


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="slurm_advisor")
    sub = parser.add_subparsers(dest="verb", required=True)

    pc = sub.add_parser("check", help="lint an sbatch script")
    pc.add_argument("--file", help="path to sbatch (otherwise stdin)")
    pc.set_defaults(func=cmd_check)

    pr = sub.add_parser("recommend", help="recommend partition+shape")
    pr.add_argument("--gpus", type=int)
    pr.add_argument("--cpus", type=int)
    pr.add_argument("--mem-gb", type=int)
    pr.add_argument("--hours", type=float)
    pr.add_argument("--partition")
    pr.add_argument("--qos")
    pr.add_argument("--interactive", action="store_true")
    pr.add_argument(
        "--min-vram-gb", type=int,
        help="Exclude partitions whose gpu_vram_gb is below this (e.g. 80 to "
             "force off the 45 GB MIG slices). Pipe in from gpu_calculate.",
    )
    pr.add_argument("--json-in", action="store_true",
                    help="read intent JSON from stdin instead of using flags")
    pr.set_defaults(func=cmd_recommend)

    pd = sub.add_parser("diagnose", help="explain why a job is pending")
    pd.add_argument("job_id")
    pd.add_argument(
        "--sprio-file",
        help="Optional path to a file containing `sprio -hl -j <id>` output. "
             "When provided, the diagnose result includes per-factor priority "
             "decomposition (AGE/FAIRSHARE/JOBSIZE/...) plus actionable advice "
             "based on which factor is dragging the priority down.",
    )
    pd.set_defaults(func=cmd_diagnose)

    pa = sub.add_parser("availability", help="propose calendar slots (JSON in/out)")
    pa.set_defaults(func=cmd_availability)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
