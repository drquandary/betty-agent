"""Render a plan.md from a reverse-filter result.

Used by the /plan-job slash command (and the agent) to produce a human-readable
record of: original request, what the forward filter said, the chosen nearest-
legal candidate, the diff, and a runnable #SBATCH block — closing with a
"validated by slurm-cli-filter.py ✓" footer.

Keep this pure-rendering: no I/O, no subprocess calls. The reverse result is
already validated by Ryan's kernel; this module just formats it.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, Optional

from .reverse import ReverseResult, JobRequest, Candidate


# Minimal Reason -> plain English. We only need the rejections most likely to
# show up in the demo; unknown codes fall back to the message Ryan emitted.
REASON_BLURBS: Dict[str, str] = {
    "GPUS_NODES_INDIVISIBLE":
        "your GPU count doesn't divide evenly across the nodes you asked for",
    "GPUS_NODE_RANGE_BAD_SCATTER":
        "the node range doesn't match a scatter pattern over your GPU count",
    "CPUS_PER_GPU_MISMATCH":
        "the CPUs-per-GPU ratio doesn't match this partition's natural ratio",
    "MEM_PER_GPU_MISMATCH":
        "the memory-per-GPU doesn't match this partition's natural amount",
    "MEMORY_IMPLICIT":
        "memory is derived from CPUs on Betty — pass cores, not --mem directly",
    "HIGH_MEM_CPU_PER_GPU":
        "the implied memory-per-core exceeds the partition's natural ratio",
    "NO_GPUS_SPEC":
        "the partition has GPUs but you didn't specify how many",
    "NO_GPUS_PARTITION":
        "this partition has no GPUs",
    "GPUS_PER_NODE_LIMIT":
        "you asked for more GPUs per node than the partition has",
    "TASKS_GPUS_INDIVISIBLE":
        "tasks don't divide evenly over GPUs",
    "TASKS_NODES_INDIVISIBLE":
        "tasks don't divide evenly over nodes",
}


def _sbatch_block(set_dict: Dict[str, str], partition: str,
                  time: Optional[str] = None) -> str:
    """Render a `#SBATCH` block from Ryan's `set` dict (keys are slurm names)."""
    lines = ["#!/bin/bash", f"#SBATCH --partition={partition}"]
    for k, v in sorted(set_dict.items()):
        lines.append(f"#SBATCH --{k}={v}")
    if time:
        lines.append(f"#SBATCH --time={time}")
    lines.append("")
    lines.append("# validated by slurm-cli-filter.py ✓")
    return "\n".join(lines)


def _diff_lines(original: JobRequest, chosen: JobRequest) -> str:
    o = asdict(original)
    c = asdict(chosen)
    rows = []
    for k in sorted(set(o) | set(c)):
        ov, cv = o.get(k), c.get(k)
        if ov == cv:
            continue
        rows.append(f"  - **{k}**: `{ov}` → `{cv}`")
    return "\n".join(rows) or "  (no field-level changes; rest derived by filter)"


def render_plan_md(result: ReverseResult, hours: Optional[float] = None,
                   chosen_index: int = 0) -> str:
    """Render the plan.md content. `hours` adds a --time directive."""
    out: list[str] = []
    out.append("# Betty job plan")
    out.append("")
    out.append("## Original request")
    out.append("```json")
    out.append(_pretty(asdict(result.original)))
    out.append("```")
    out.append("")

    if result.legal:
        out.append("## Forward filter")
        out.append("Status: **ok** — request already passes Ryan's filter.")
        out.append("")
        out.append("## Submission")
        out.append("```bash")
        time_str = _hours_to_walltime(hours) if hours else None
        out.append(_sbatch_block(result.forward.set_directives,
                                 result.original.partition, time_str))
        out.append("```")
        return "\n".join(out)

    # Illegal path.
    code = result.forward.code or "UNKNOWN"
    blurb = REASON_BLURBS.get(code, result.forward.message or "rejected")
    out.append("## Forward filter")
    out.append(f"Status: **{result.forward.status}** — `{code}`")
    out.append("")
    out.append(f"> {blurb.strip()}")
    out.append("")

    if not result.candidates:
        out.append("## Reverse filter")
        out.append("No nearest-legal candidate found within the search radius.")
        out.append("Try relaxing one of the explicitly-set fields and re-running.")
        return "\n".join(out)

    chosen = result.candidates[min(chosen_index, len(result.candidates) - 1)]
    out.append("## Reverse filter — nearest legal request")
    out.append(f"Distance from original (weighted L1): **{chosen.distance:.2f}**")
    out.append("")
    out.append("### Diff")
    out.append(_diff_lines(result.original, chosen.request))
    out.append("")
    out.append("### Submission")
    out.append("```bash")
    time_str = _hours_to_walltime(hours) if hours else None
    out.append(_sbatch_block(chosen.set_directives, chosen.request.partition, time_str))
    out.append("```")

    if len(result.candidates) > 1:
        out.append("")
        out.append("### Alternates")
        for i, alt in enumerate(result.candidates[1:], start=1):
            out.append(f"- **#{i+1}** (distance {alt.distance:.2f}): "
                       + _short_summary(alt.request))

    out.append("")
    out.append("---")
    out.append(f"_Oracle: `{result.filter_path}` · solver: `{result.solver}`_")
    return "\n".join(out)


def _pretty(d: Dict[str, Any]) -> str:
    import json
    return json.dumps({k: v for k, v in d.items() if v is not None},
                      indent=2, sort_keys=True)


def _hours_to_walltime(hours: float) -> str:
    h = int(hours)
    m = int(round((hours - h) * 60))
    return f"{h:02d}:{m:02d}:00"


def _short_summary(req: JobRequest) -> str:
    bits = []
    if req.gpus is not None:
        bits.append(f"gpus={req.gpus}")
    if req.cpus is not None:
        bits.append(f"cpus={req.cpus}")
    if req.nodes is not None:
        bits.append(f"nodes={req.nodes}")
    if req.memory is not None:
        bits.append(f"mem={req.memory}G")
    return f"`{req.partition}` " + " ".join(bits)
