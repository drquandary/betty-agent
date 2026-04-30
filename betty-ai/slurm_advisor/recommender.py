"""Top-level orchestration: check, recommend, diagnose."""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import Any, Dict, List, Optional

from .parser import (
    SbatchRequest,
    format_mem_mb,
    format_seconds,
    parse_sbatch,
)
from .policy import CheckIssue, Policy
from .solver import JobIntent, SolverResult, pick_solver


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


@dataclass
class CheckReport:
    status: str               # "ok" | "revise" | "block"
    issues: List[CheckIssue] = field(default_factory=list)
    parsed: Dict[str, Any] = field(default_factory=dict)
    suggested_sbatch: Optional[str] = None
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "status": self.status,
            "summary": self.summary,
            "issues": [asdict(i) for i in self.issues],
            "parsed": self.parsed,
            "suggested_sbatch": self.suggested_sbatch,
        }


def check_sbatch(text: str, policy: Optional[Policy] = None) -> CheckReport:
    """Top-level: parse, validate, and (if revisable) propose a fixed sbatch block."""
    policy = policy or Policy.load()
    req = parse_sbatch(text)
    issues = policy.violations(req)

    has_error = any(i.severity == "error" for i in issues)
    has_warn = any(i.severity == "warn" for i in issues)
    status = "block" if has_error else ("revise" if has_warn else "ok")

    parsed_view = {
        "partition": req.partition,
        "qos": req.qos,
        "nodes": req.nodes,
        "cpus_per_task": req.cpus_per_task,
        "ntasks": req.ntasks,
        "gpus": req.gpus,
        "gpu_type": req.gpu_type,
        "mem_mb": req.mem_mb,
        "mem_per_cpu_mb": req.mem_per_cpu_mb,
        "time_seconds": req.time_seconds,
        "directives": dict(req.directives),
        "body_lines": req.body_lines,
    }

    suggested = None
    if status != "ok":
        # Synthesize an intent from the parsed sbatch and re-solve.
        # When the request violated soft caps, drop the offending fields so
        # the solver fills in healthy defaults rather than echoing them back.
        violated_codes = {i.code for i in issues}
        cpus = req.cpus_per_task or 0
        if "CPU_PER_GPU_HIGH" in violated_codes or "CPU_PER_GPU_OVER_NODE_LIMIT" in violated_codes:
            cpus = 0
        mem_gb = (req.mem_mb // 1024) if req.mem_mb else None
        if "MEM_PER_GPU_HIGH" in violated_codes or "MEM_OVER_NODE" in violated_codes:
            mem_gb = None
        hours = (req.time_seconds / 3600) if req.time_seconds else 1.0
        if "TIME_HURTS_BACKFILL" in violated_codes:
            hours = float(policy.soft_max_walltime_h_for_backfill)
        if "TIME_OVER_PARTITION_MAX" in violated_codes:
            hours = float(policy.soft_max_walltime_h_for_backfill)
        intent = JobIntent(
            gpus=req.gpus or 0,
            cpus=cpus,
            mem_gb=mem_gb,
            hours=hours,
            partition_pref=req.partition if "UNKNOWN_PARTITION" not in violated_codes else None,
            qos_pref=req.qos,
        )
        result = pick_solver().solve(policy, intent)
        if result.feasible:
            suggested = result.as_sbatch()

    summary = _summarize(status, issues, req)
    return CheckReport(
        status=status,
        issues=issues,
        parsed=parsed_view,
        suggested_sbatch=suggested,
        summary=summary,
    )


def _summarize(status: str, issues: List[CheckIssue], req: SbatchRequest) -> str:
    if status == "ok":
        return "Looks fine — no issues found."
    n_err = sum(1 for i in issues if i.severity == "error")
    n_warn = sum(1 for i in issues if i.severity == "warn")
    bits = []
    if n_err:
        bits.append(f"{n_err} error{'s' if n_err != 1 else ''}")
    if n_warn:
        bits.append(f"{n_warn} warning{'s' if n_warn != 1 else ''}")
    return f"Found {' and '.join(bits)}. " + (
        "Block — fix errors before submitting." if status == "block"
        else "Revise — script will run but is suboptimal."
    )


# ---------------------------------------------------------------------------
# Recommend
# ---------------------------------------------------------------------------


@dataclass
class Recommendation:
    intent: Dict[str, Any]
    result: Dict[str, Any]
    sbatch_block: str
    notes: List[str] = field(default_factory=list)
    # Honest surface area of how VRAM was treated. The recommend card reads
    # this and renders a banner so the user sees "VRAM ≥ 80 GB enforced" or
    # "VRAM not constrained — solver picked partition without checking model
    # fit". Ryan's correctness concern: without this, a 70B fine-tune could
    # be silently routed to a 45 GB MIG slice that OOMs.
    vram_constraint: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


def recommend(intent: JobIntent, policy: Optional[Policy] = None) -> Recommendation:
    """Pick a partition + resource shape for an intent."""
    policy = policy or Policy.load()
    result = pick_solver().solve(policy, intent)
    notes: List[str] = list(intent.notes)
    if intent.interactive and intent.hours > 4:
        notes.append("Interactive jobs > 4h are discouraged; consider salloc with --time=04:00:00.")

    if intent.min_vram_per_gpu_gb:
        vram = {
            "enforced": True,
            "min_vram_per_gpu_gb": intent.min_vram_per_gpu_gb,
            "message": (
                f"VRAM ≥ {intent.min_vram_per_gpu_gb} GB enforced. "
                f"Partitions below this were excluded before solving."
            ),
        }
    else:
        vram = {
            "enforced": False,
            "min_vram_per_gpu_gb": None,
            "message": (
                "VRAM not constrained. The solver picked the cheapest legal "
                "partition without knowing your workload's VRAM requirement. "
                "If you're fine-tuning or running a model > the chosen "
                "partition's gpu_vram_gb, this recommendation may OOM. Pass "
                "min_vram_gb (or call gpu_calculate first) to enforce a floor."
            ),
        }

    return Recommendation(
        intent=asdict(intent),
        result=result.to_dict(),
        sbatch_block=result.as_sbatch(),
        notes=notes,
        vram_constraint=vram,
    )


# ---------------------------------------------------------------------------
# Diagnose pending
# ---------------------------------------------------------------------------


@dataclass
class PendingDiagnosis:
    job_id: str
    state: str
    reason: Optional[str]
    request: Dict[str, Any]
    likely_causes: List[str] = field(default_factory=list)
    suggested_actions: List[str] = field(default_factory=list)
    # Per-factor priority decomposition from `sprio -hl -j <id>`. Populated
    # when the TS adapter passes sprio output. Keys: AGE, FAIRSHARE, JOBSIZE,
    # PARTITION, QOS, TRES, plus optional SITE. Values are the integer factor
    # contributions Slurm assigns. The diagnose card shows which factor is
    # dominant when Reason=Priority — without this, "higher priority jobs
    # are ahead of you" is opaque; with it we can say "your fairshare factor
    # is the 5th-percentile drag — that's what's keeping you back".
    priority_factors: Dict[str, int] = field(default_factory=dict)
    # Identified bottleneck factor (the one with the highest contribution
    # MEANS the highest score, but in Slurm priority math, larger numbers
    # are better. The bottleneck is the SMALLEST factor relative to typical.
    # We surface both: the dominant_positive (largest factor — what's
    # helping) and dominant_negative (smallest factor — what's holding back).
    priority_dominant_positive: Optional[str] = None
    priority_dominant_negative: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


# `sprio -hl -j <jobid>` output looks like:
#   JOBID PARTITION   PRIORITY     SITE        AGE  FAIRSHARE    JOBSIZE  PARTITION        QOS        TRES
#   12345 dgx-b200    0.000123       0   0.000010   0.000004   0.000050   0.000050   0.000009     cpu=0
# Factor values are normalized to 0..1 (the columns we care about). Larger
# factor = more contribution to the job's priority (so larger = better for
# the user; smallest factor = the bottleneck).
_SPRIO_COLUMNS = ["AGE", "FAIRSHARE", "JOBSIZE", "PARTITION", "QOS", "TRES"]


def parse_sprio(text: str) -> Dict[str, int]:
    """Parse `sprio -hl -j <id>` output into per-factor integer contributions.

    Tolerant of Slurm version differences: looks up columns by header name
    rather than fixed position. Returns empty dict if the output looks
    malformed (no header line found, no data line).
    """
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return {}
    # Find header (first line containing both "AGE" and "FAIRSHARE")
    header_idx = None
    for i, ln in enumerate(lines):
        upper = ln.upper()
        if "AGE" in upper and "FAIRSHARE" in upper:
            header_idx = i
            break
    if header_idx is None:
        return {}
    header_cols = lines[header_idx].split()
    # Find data line (next non-blank after header, with same length-ish)
    data_idx = header_idx + 1
    if data_idx >= len(lines):
        return {}
    data_cols = lines[data_idx].split()
    out: Dict[str, int] = {}
    for col_name in _SPRIO_COLUMNS:
        # Some Slurm versions emit two "PARTITION" columns (one for the
        # partition name in column 2, one for the partition factor). Use the
        # SECOND occurrence — that's the factor.
        indices = [i for i, h in enumerate(header_cols) if h.upper() == col_name]
        if not indices:
            continue
        idx = indices[-1]  # last match
        if idx >= len(data_cols):
            continue
        raw = data_cols[idx]
        # Slurm prints factors as floats in [0, 1]; we normalize to integer
        # ppm (parts-per-million) so comparisons are stable and the JSON
        # payload doesn't have float-precision noise.
        try:
            f = float(raw)
            out[col_name] = int(round(f * 1_000_000))
        except ValueError:
            # TRES sometimes has the form "cpu=0,mem=0,gres/gpu=N" — skip.
            continue
    return out


# Reasons SLURM emits in `squeue`/`scontrol` for pending jobs, mapped to
# user-facing explanations and suggested fixes.
_REASON_GUIDE = {
    "Resources": (
        "The cluster doesn't currently have nodes free that match the request.",
        ["Reduce --time so the job becomes backfill-eligible.",
         "Reduce GPU count if possible.",
         "Try a less crowded partition (run `parcc_sfree.py`)."],
    ),
    "Priority": (
        "Higher-priority jobs are queued ahead.",
        ["Wait, or shorten --time to fit a backfill window."],
    ),
    "QOSMaxJobsPerUserLimit": (
        "You've hit a per-user job limit for this QOS.",
        ["Cancel a queued job, or wait for one to start."],
    ),
    "QOSGrpGRESMinutes": (
        "QOS GPU-minute budget is exhausted for the group.",
        ["Wait for the budget to reset (typically daily)."],
    ),
    "ReqNodeNotAvail": (
        "A specific node you asked for is down or drained.",
        ["Drop --nodelist / --exclude unless you really need it.",
         "Check sinfo for node state."],
    ),
    "AssocGrpGRES": (
        "Your account's GPU allocation is at the cap.",
        ["Reduce GPUs or wait for an existing job of yours to finish."],
    ),
    "JobHeldUser": ("Held by user.", ["scontrol release <jobid>"]),
    "JobHeldAdmin": ("Held by admin.", ["Contact PARCC ops."]),
    "BeginTime": ("Submitted with a future start time.", ["Wait, or scontrol update jobid=N StartTime=now."]),
    "Dependency": ("Waiting on another job to finish.", ["Check the dependency: `scontrol show job <jobid>`"]),
}


def diagnose_pending(
    job_id: str,
    scontrol_text: str,
    sprio_text: str = "",
    policy: Optional[Policy] = None,
) -> PendingDiagnosis:
    """Diagnose why a pending job hasn't started yet.

    `scontrol_text` is the raw output of `scontrol show job <id>`.
    `sprio_text` is the raw output of `sprio -hl -j <id>` (optional). When
    provided, we decompose the priority into per-factor contributions and
    surface the dominant bottleneck — turning "higher priority jobs are
    ahead" into "your fairshare factor is the dominant drag".
    """
    fields = _parse_scontrol(scontrol_text)
    state = fields.get("JobState", "UNKNOWN")
    reason = fields.get("Reason")
    request = {
        "partition": fields.get("Partition"),
        "qos": fields.get("QOS"),
        "time_limit": fields.get("TimeLimit"),
        "tres": fields.get("ReqTRES") or fields.get("TRES"),
        "node_list": fields.get("ReqNodeList") or fields.get("NodeList"),
        "submit_time": fields.get("SubmitTime"),
    }
    causes: List[str] = []
    suggestions: List[str] = []
    if reason and reason in _REASON_GUIDE:
        cause, recs = _REASON_GUIDE[reason]
        causes.append(cause)
        suggestions.extend(recs)
    elif reason:
        causes.append(f"SLURM reason code: {reason} (no canned advice).")

    # Heuristics layered on top of the reason code
    time_limit = fields.get("TimeLimit", "")
    from .parser import parse_time_to_seconds
    secs = parse_time_to_seconds(time_limit) or 0
    if secs > 24 * 3600:
        causes.append(f"Walltime is {time_limit} (>24h); backfill is unlikely.")
        suggestions.append("Try `--time=12:00:00` and resubmit if your job can fit.")

    # Priority decomposition (only meaningful when reason is Resources or Priority).
    factors = parse_sprio(sprio_text) if sprio_text else {}
    dominant_positive: Optional[str] = None
    dominant_negative: Optional[str] = None
    if factors:
        # Filter to factors with non-trivial contribution to avoid noise on
        # zero-valued factors like SITE.
        nonzero = {k: v for k, v in factors.items() if v > 0}
        if nonzero:
            dominant_positive = max(nonzero, key=nonzero.get)
            dominant_negative = min(nonzero, key=nonzero.get)
            # Add a cause specifically about the bottleneck — most actionable
            # when Reason=Priority since that's what users typically can
            # influence (e.g., shrinking a request raises JOBSIZE factor).
            if reason == "Priority":
                _add_priority_factor_advice(dominant_negative, nonzero, causes, suggestions)

    return PendingDiagnosis(
        job_id=job_id,
        state=state,
        reason=reason,
        request=request,
        likely_causes=causes,
        suggested_actions=suggestions,
        priority_factors=factors,
        priority_dominant_positive=dominant_positive,
        priority_dominant_negative=dominant_negative,
    )


# Per-factor remediation hints. Slurm's factor names map to actionable advice
# the user can take RIGHT NOW. AGE just means "wait"; FAIRSHARE means "your
# account has been heavy lately"; JOBSIZE rewards small jobs (so shrink to
# get backfilled); QOS/TRES depend on partition policy.
_FACTOR_ADVICE = {
    "AGE": (
        "Your AGE factor is small — your job hasn't been pending long enough "
        "to accrue priority yet.",
        ["Wait — AGE grows automatically while pending."],
    ),
    "FAIRSHARE": (
        "Your FAIRSHARE factor is the dominant drag — your account has been "
        "running heavy recently and is being de-prioritized to make room for others.",
        ["Wait for the rolling-window decay (typically days–weeks).",
         "Check usage with `parcc_sreport.py --user <pennkey>`.",
         "If urgent, ask PARCC about a temporary FairShare adjustment."],
    ),
    "JOBSIZE": (
        "Your JOBSIZE factor is small — Slurm rewards smaller jobs because "
        "they backfill more easily.",
        ["Reduce --nodes, --gres=gpu:N, or --time so your job fits in backfill windows."],
    ),
    "PARTITION": (
        "Your PARTITION factor is small — the partition's base priority is low, "
        "or this partition is heavily contested.",
        ["Try a less-contested partition (run `parcc_sfree.py`)."],
    ),
    "QOS": (
        "Your QOS factor is small — the QOS you selected has a lower priority weight.",
        ["Check QOS allow-list: `parcc_sqos.py`. If a higher-priority QOS is allowed for your account, switch to it via `--qos=<name>`."],
    ),
    "TRES": (
        "Your TRES factor is small — the resource mix you requested is being "
        "weighted down (e.g., GPU-heavy jobs may be deprioritized when GPUs are scarce).",
        ["Reduce GPU count if your workload tolerates it.",
         "Switch to a partition where your TRES mix scores higher."],
    ),
}


def _add_priority_factor_advice(
    factor: str,
    nonzero_factors: Dict[str, int],
    causes: List[str],
    suggestions: List[str],
) -> None:
    """Append the per-factor explanation when sprio reveals a bottleneck."""
    advice = _FACTOR_ADVICE.get(factor)
    if not advice:
        return
    cause, recs = advice
    # Add the per-factor numeric context to the cause for transparency.
    factor_value = nonzero_factors[factor]
    factor_pct = factor_value / 1_000_000
    causes.append(f"{cause} (sprio factor = {factor_pct:.6f})")
    suggestions.extend(recs)


def _parse_scontrol(text: str) -> Dict[str, str]:
    """Crude key=value parser for `scontrol show job` output.

    Format is space-separated `Key=Value` tokens, but Value can contain
    commas/colons. Good enough for the fields we care about.
    """
    out: Dict[str, str] = {}
    for tok in text.split():
        if "=" not in tok:
            continue
        k, v = tok.split("=", 1)
        out[k] = v
    # Reason can show up as "Reason=Resources" or buried in "Reason=" with
    # extra whitespace in some versions; the simple split above gets the common case.
    return out
