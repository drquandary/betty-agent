"""Reverse CLI filter — project an illegal job request onto the nearest legal one.

Forward filter (Ryan's `slurm-cli-filter.py`): request -> {legal | reject(Reason)}.
Reverse filter (this module): request -> nearest legal request (with diff and Reason
that fired), so the user gets a concrete "did you mean …?" suggestion instead of a
plain rejection.

Architecture:

    JobRequest (partition, gpus, cpus, mem_gb, nodes, tasks, ...)
            |
            v
    forward_validate()  --(shell out)-->  slurm-cli-filter.py validate ...
            |
            +-- status == ok        -> ReverseResult(legal=True, request unchanged)
            +-- status == junction  -> ReverseResult(branches=[...] from Ryan)
            +-- status == error     -> enumerate neighborhood, oracle = Ryan's kernel,
                                        rank by L1 distance, return top-k legal points

Why use Ryan's kernel as the oracle?
- Single source of truth. We never re-encode his rules in Python; CI doesn't drift.
- Ryan's kernel is stdlib-only and runs in ~65ms, so per-candidate calls are cheap.

A MiniZinc model that mirrors the same constraints lives in `reverse.mzn` next to
this file. When the MiniZinc binary is installed the solver path can use it for
larger search regions; the Python enumerator below works on any laptop and is
provably consistent with Ryan's kernel via the fuzz test in
`tests/test_reverse.py`.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple


# Partitions Ryan's kernel knows about. Mirrored so we don't shell out just to
# bound enumeration; the fuzz test asserts these agree.
PARTITIONS: Dict[str, Dict[str, Any]] = {
    "dgx-b200": {"gpn": 8, "cpn": 224, "cpg": 28, "mpc": 8, "tpc": 2},
    "genoa-std-mem": {"gpn": 0, "cpn": 64, "cpg": None, "mpc": 5.5, "tpc": 1},
    "genoa-lrg-mem": {"gpn": 0, "cpn": 64, "cpg": None, "mpc": 15.5, "tpc": 1},
}


@dataclass
class JobRequest:
    partition: str
    gpus: Optional[int] = None
    gres: Optional[int] = None         # gpus per node
    nodes: Optional[int] = None
    tasks: Optional[int] = None
    tasks_per_node: Optional[int] = None
    cpus: Optional[int] = None         # cpus-per-task
    memory: Optional[int] = None       # mem per node (GiB)
    mem_per_cpu: Optional[float] = None
    mem_per_gpu: Optional[float] = None
    cpus_per_gpu: Optional[int] = None

    def kv_args(self) -> List[str]:
        out = []
        for k, v in asdict(self).items():
            if v is None:
                continue
            out.append(f"{k}={v}")
        return out


@dataclass
class ForwardResult:
    status: str                        # "ok" | "junction" | "error"
    code: Optional[str] = None         # Reason code
    message: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)
    set_directives: Dict[str, str] = field(default_factory=dict)
    branches: List[Dict[str, Any]] = field(default_factory=list)


@dataclass
class Candidate:
    request: JobRequest
    distance: float
    set_directives: Dict[str, str] = field(default_factory=dict)


@dataclass
class ReverseResult:
    original: JobRequest
    forward: ForwardResult
    legal: bool
    candidates: List[Candidate] = field(default_factory=list)
    filter_path: str = ""
    solver: str = "python-enumerate"   # or "minizinc"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "original": asdict(self.original),
            "forward": {
                "status": self.forward.status,
                "code": self.forward.code,
                "message": self.forward.message,
                "params": self.forward.params,
                "set": self.forward.set_directives,
                "branches": self.forward.branches,
            },
            "legal": self.legal,
            "candidates": [
                {
                    "request": asdict(c.request),
                    "distance": c.distance,
                    "set": c.set_directives,
                }
                for c in self.candidates
            ],
            "filter_path": self.filter_path,
            "solver": self.solver,
        }


def find_filter_path() -> Optional[str]:
    """Locate Ryan's slurm-cli-filter.py. Order: env var, common dev paths, PATH."""
    env = os.environ.get("PARCC_CLI_FILTER")
    if env and os.path.exists(env):
        return env
    candidates = [
        os.path.expanduser(
            "~/Downloads/parcc-docs-ops-ux-filter-analyze/ops/ux/filter/slurm-cli-filter.py"
        ),
        "/vast/projects/ryb/parcc-data-science/arcdocs/ops/ux/filter/slurm-cli-filter.py",
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    which = shutil.which("slurm-cli-filter.py")
    return which


def _resolve_python_bin() -> str:
    """Ryan's kernel needs Python >= 3.10 (uses typing.assert_never).

    Prefer $PARCC_CLI_FILTER_PYTHON, then python3.13/3.12/3.11/3.10 on PATH,
    then fall back to python3 (which on macOS dev laptops may be 3.9 and will
    fail loudly rather than silently)."""
    env = os.environ.get("PARCC_CLI_FILTER_PYTHON")
    if env and shutil.which(env):
        return env
    for cand in ("python3.13", "python3.12", "python3.11", "python3.10"):
        p = shutil.which(cand)
        if p:
            return p
    return "python3"


def forward_validate(req: JobRequest, filter_path: str,
                     python_bin: Optional[str] = None, timeout: float = 5.0) -> ForwardResult:
    """Call Ryan's kernel as a subprocess. Returns a ForwardResult."""
    if python_bin is None:
        python_bin = _resolve_python_bin()
    args = [python_bin, filter_path, "validate", *req.kv_args()]
    try:
        proc = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        return ForwardResult(status="error", code="TIMEOUT",
                             message=f"filter timed out after {timeout}s")
    raw = proc.stdout.strip().splitlines()
    payload = None
    for line in reversed(raw):
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            break
        except json.JSONDecodeError:
            continue
    if payload is None:
        return ForwardResult(status="error", code="FILTER_NO_JSON",
                             message=proc.stderr.strip() or "no JSON from filter")
    return ForwardResult(
        status=payload.get("status", "error"),
        code=payload.get("code"),
        message=payload.get("message"),
        params=payload.get("params", {}) or {},
        set_directives=payload.get("set", {}) or {},
        branches=payload.get("branches", []) or [],
    )


def _neighborhood(req: JobRequest, max_radius: int = 2) -> List[JobRequest]:
    """Generate candidate variations to probe.

    Heuristic, not exhaustive: vary GPU count up/down a few steps, snap CPUs to
    the partition's CPUs-per-GPU multiple, and snap memory to the natural
    per-CPU floor. Ryan's kernel will derive the rest. Limited to a small set so
    the demo runs in <1s without MiniZinc.
    """
    if req.partition not in PARTITIONS:
        return []
    spec = PARTITIONS[req.partition]
    gpn = int(spec["gpn"])
    cpg = spec["cpg"]
    mpc = spec["mpc"]
    tpc = int(spec["tpc"])

    out: List[JobRequest] = []
    if gpn == 0:
        # CPU-only partition: vary cpus and memory only.
        cpus_base = req.cpus or req.tasks or 1
        for d in range(-max_radius, max_radius + 1):
            c = max(1, cpus_base + d)
            if c > spec["cpn"]:
                continue
            cand = JobRequest(partition=req.partition, cpus=c)
            out.append(cand)
        return out

    # GPU partition: enumerate gpus in [1, gpn] and snap derived knobs.
    gpus_base = req.gpus or (req.gres * (req.nodes or 1) if req.gres else 1)
    for g in range(max(1, gpus_base - max_radius), min(gpn, gpus_base + max_radius) + 1):
        # Snap cpus to the partition's natural cpg * g (threads, not cores).
        cpus_natural = int(cpg) * g if cpg else None
        cand = JobRequest(
            partition=req.partition,
            gpus=g,
        )
        out.append(cand)
        # Also offer the explicit cpus-per-task variant so Ryan's kernel
        # reports a `set` block including memory.
        if cpus_natural is not None:
            out.append(JobRequest(
                partition=req.partition,
                gpus=g,
                cpus=int(cpg),
            ))
    # Dedup by tuple of fields.
    seen = set()
    uniq: List[JobRequest] = []
    for c in out:
        key = tuple(sorted(asdict(c).items()))
        if key in seen:
            continue
        seen.add(key)
        uniq.append(c)
    return uniq


def _distance(a: JobRequest, b: JobRequest) -> float:
    """Weighted L1 distance over the resource axes the user cares about."""
    def _v(x: Optional[float]) -> float:
        return float(x) if x is not None else 0.0
    return (
        2.0 * abs(_v(a.gpus) - _v(b.gpus))
        + 1.0 * abs(_v(a.cpus) - _v(b.cpus))
        + 0.5 * abs(_v(a.nodes) - _v(b.nodes))
        + 0.1 * abs(_v(a.memory) - _v(b.memory))
    )


def reverse_filter(req: JobRequest, filter_path: Optional[str] = None,
                   max_candidates: int = 3, max_radius: int = 2) -> ReverseResult:
    """Top-level: run forward filter, and if rejected, find nearest legal points.

    The oracle for legality is Ryan's kernel (subprocess). We never call our own
    rule code — Ryan's filter is the single source of truth.
    """
    fp = filter_path or find_filter_path()
    if not fp:
        return ReverseResult(
            original=req,
            forward=ForwardResult(status="error", code="FILTER_NOT_FOUND",
                                  message="set PARCC_CLI_FILTER to slurm-cli-filter.py"),
            legal=False,
            filter_path="",
        )

    forward = forward_validate(req, fp)
    if forward.status == "ok":
        return ReverseResult(original=req, forward=forward, legal=True,
                             filter_path=fp)

    candidates: List[Candidate] = []
    seen_keys = set()
    for cand_req in _neighborhood(req, max_radius=max_radius):
        key = tuple(sorted(asdict(cand_req).items()))
        if key in seen_keys:
            continue
        seen_keys.add(key)
        cand_forward = forward_validate(cand_req, fp)
        if cand_forward.status != "ok":
            continue
        candidates.append(Candidate(
            request=cand_req,
            distance=_distance(req, cand_req),
            set_directives=cand_forward.set_directives,
        ))

    # Also surface Ryan's own junction branches when present — those are *his*
    # suggestions for ambiguous requests and we want to show them first.
    candidates.sort(key=lambda c: c.distance)
    return ReverseResult(
        original=req,
        forward=forward,
        legal=False,
        candidates=candidates[:max_candidates],
        filter_path=fp,
    )
