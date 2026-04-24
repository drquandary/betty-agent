"""Pure-function parsers for the four Slurm log types we ingest.

Each `parse_*` is:
  - Pure: takes `str` contents (or a Path), returns typed records + counters.
  - Tolerant: malformed lines are counted, not raised. The CLI prints counts.
  - Deterministic: same input → same output. No clock reads, no randomness.

Duration + timestamp helpers are re-exported for the features layer, which
sometimes needs to parse them from JSON round-trips.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

from .types import (
    NodeRecord,
    ParseCounters,
    Reservation,
    SacctJob,
    SinfoRow,
)


# ---------------------------------------------------------------------------
# Primitive helpers — exported, widely reused.
# ---------------------------------------------------------------------------

_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$")

_DURATION_DAYS = re.compile(r"^(\d+)-(\d{1,2}):(\d{2}):(\d{2})$")
_DURATION_HMS = re.compile(r"^(\d{1,3}):(\d{2}):(\d{2})$")
_DURATION_MS = re.compile(r"^(\d{1,3}):(\d{2})$")


def parse_slurm_timestamp(s: Optional[str]) -> Optional[datetime]:
    """Parse a Slurm timestamp. Slurm emits several sentinels for "missing":

      - "Unknown"
      - "None"
      - "N/A"
      - "" (empty)

    All of those → None. A valid ISO-like "2026-04-24T18:00:00" → a naive
    datetime assumed to be in the cluster's local timezone. We return a
    timezone-aware UTC datetime for unambiguous downstream math.

    Slurm's local TZ is the compute-cluster's admin setting; for Betty it
    is America/New_York. We convert at the ingest boundary so every
    timestamp downstream is UTC. The conversion is a simple hard-coded
    offset lookup because stdlib `zoneinfo` is Python 3.9+ (present) and
    we don't want to drag tzdata as a dep.
    """
    if s is None:
        return None
    s = s.strip()
    if s in {"", "Unknown", "None", "N/A", "(null)"}:
        return None
    if not _ISO.match(s):
        return None
    # Naive parse, treat as America/New_York, convert to UTC.
    naive = datetime.strptime(s, "%Y-%m-%dT%H:%M:%S")
    # America/New_York offset: EDT is UTC-4 (Mar..Nov), EST is UTC-5. We
    # approximate by using zoneinfo if available, otherwise EDT for
    # Mar-Oct-inclusive and EST otherwise. Dashboard-grade precision.
    try:
        from zoneinfo import ZoneInfo  # py3.9+ stdlib
        eastern = ZoneInfo("America/New_York")
        return naive.replace(tzinfo=eastern).astimezone(timezone.utc)
    except Exception:
        # Fallback: conservative EST offset (may be 1h off during DST).
        return naive.replace(tzinfo=timezone(offset=_fallback_et_offset(naive)))


def _fallback_et_offset(naive: datetime):
    # Crude DST heuristic: second Sunday of March to first Sunday of November.
    # Used only when zoneinfo import fails. Most systems have zoneinfo.
    from datetime import timedelta
    m = naive.month
    if 4 <= m <= 10:
        return timedelta(hours=-4)
    if m in (3, 11):
        # not perfectly accurate across the DST boundary; acceptable for dashboard math
        return timedelta(hours=-4 if m == 3 else -5)
    return timedelta(hours=-5)


def parse_slurm_duration(s: Optional[str]) -> Optional[float]:
    """Parse a Slurm duration string to seconds.

    Handles:
      "D-HH:MM:SS"   e.g. "7-00:00:00"  -> 604800.0
      "HH:MM:SS"     e.g. "01:30:00"    -> 5400.0
      "MM:SS"        e.g. "05:00"       -> 300.0
      "UNLIMITED"                       -> None (distinct from malformed)
      "Partition_Limit"                 -> None (same)
      "", None, "Unknown"               -> None

    Negative, NaN, or malformed strings return None.
    """
    if s is None:
        return None
    s = s.strip()
    if s in {"", "UNLIMITED", "Partition_Limit", "Unknown", "INVALID", "None"}:
        return None
    m = _DURATION_DAYS.match(s)
    if m:
        d, h, mi, se = map(int, m.groups())
        return float(d * 86400 + h * 3600 + mi * 60 + se)
    m = _DURATION_HMS.match(s)
    if m:
        h, mi, se = map(int, m.groups())
        return float(h * 3600 + mi * 60 + se)
    m = _DURATION_MS.match(s)
    if m:
        mi, se = map(int, m.groups())
        return float(mi * 60 + se)
    return None


def parse_tres(s: Optional[str]) -> Dict[str, str]:
    """Parse a TRES string like "billing=1920,cpu=96,gres/gpu=8,mem=1920000M,node=1".

    Empty / None / "(null)" → {}. Malformed pairs are silently dropped
    rather than raising, because Slurm occasionally emits values like
    "fs/disk" with no `=`. A well-formed output keeps all interesting keys
    (`cpu`, `gres/gpu`, `mem`, `node`, `billing`).
    """
    if s is None:
        return {}
    s = s.strip()
    if s in {"", "(null)", "None"}:
        return {}
    out: Dict[str, str] = {}
    for pair in s.split(","):
        if "=" not in pair:
            continue
        k, v = pair.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def tres_gpu_count(tres: Dict[str, str]) -> Optional[int]:
    """Extract GPU count from a parsed TRES dict.

    Slurm reports GPUs under `gres/gpu` for the aggregate or
    `gres/gpu:B200` for a typed count. We prefer the typed value if both
    are present, otherwise the aggregate.
    """
    # typed first
    for k, v in tres.items():
        if k.startswith("gres/gpu:"):
            try:
                return int(v)
            except ValueError:
                continue
    if "gres/gpu" in tres:
        try:
            return int(tres["gres/gpu"])
        except ValueError:
            return None
    return None


def tres_cpu_count(tres: Dict[str, str]) -> Optional[int]:
    if "cpu" in tres:
        try:
            return int(tres["cpu"])
        except ValueError:
            return None
    return None


def tres_node_count(tres: Dict[str, str]) -> Optional[int]:
    if "node" in tres:
        try:
            return int(tres["node"])
        except ValueError:
            return None
    return None


def tres_mem_mb(tres: Dict[str, str]) -> Optional[int]:
    """Parse `mem=1920000M` or `mem=64G` to megabytes."""
    if "mem" not in tres:
        return None
    raw = tres["mem"].strip()
    m = re.match(r"^(\d+)([KMGT]?)$", raw)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2) or "M"  # Slurm defaults to MB when unit omitted
    factor = {"K": 1 / 1024, "M": 1, "G": 1024, "T": 1024 * 1024}[unit]
    return int(n * factor)


# ---------------------------------------------------------------------------
# Parser 1: sacct --parsable2
# ---------------------------------------------------------------------------

def parse_sacct(text: str) -> Tuple[List[SacctJob], ParseCounters]:
    """Parse `sacct -X --parsable2 -o <fields>` output.

    Expects line 1 to be the header (Slurm prints headers by default when
    `-n` is absent). Fields are pipe-separated. Extra whitespace is
    stripped per field.
    """
    counters = ParseCounters()
    jobs: List[SacctJob] = []
    lines = text.splitlines()
    if not lines:
        return jobs, counters

    header = [h.strip() for h in lines[0].split("|")]
    idx = {h: i for i, h in enumerate(header)}

    def col(row: List[str], name: str) -> Optional[str]:
        i = idx.get(name)
        if i is None or i >= len(row):
            return None
        v = row[i].strip()
        return v if v else None

    for raw_line in lines[1:]:
        if not raw_line.strip():
            continue
        counters.rows_total += 1
        row = raw_line.split("|")
        job_id = col(row, "JobID") or ""
        if not job_id:
            counters.rows_dropped_malformed += 1
            continue
        # Even with -X, some exports include step IDs if the caller forgot -X.
        # Defensive: drop rows with dots.
        if "." in job_id:
            counters.rows_dropped_step += 1
            continue
        try:
            jobs.append(SacctJob(
                job_id=job_id,
                user=col(row, "User"),
                account=col(row, "Account"),
                partition=col(row, "Partition"),
                qos=col(row, "QOS"),
                submit_ts=parse_slurm_timestamp(col(row, "Submit")),
                eligible_ts=parse_slurm_timestamp(col(row, "Eligible")),
                start_ts=parse_slurm_timestamp(col(row, "Start")),
                end_ts=parse_slurm_timestamp(col(row, "End")),
                elapsed_sec=parse_slurm_duration(col(row, "Elapsed")),
                planned_sec=parse_slurm_duration(col(row, "Planned")),
                state=col(row, "State") or "",
                exit_code=col(row, "ExitCode"),
                req_tres=parse_tres(col(row, "ReqTRES")),
                alloc_tres=parse_tres(col(row, "AllocTRES")),
                req_mem=col(row, "ReqMem"),
                req_cpus=_maybe_int(col(row, "ReqCPUS")),
                req_nodes=_maybe_int(col(row, "ReqNodes")),
                node_list=col(row, "NodeList"),
                reason=col(row, "Reason"),
            ))
            counters.rows_ok += 1
        except Exception:
            counters.rows_dropped_malformed += 1
    return jobs, counters


# ---------------------------------------------------------------------------
# Parser 2: sinfo (default format)
# ---------------------------------------------------------------------------

def parse_sinfo(text: str) -> Tuple[List[SinfoRow], ParseCounters]:
    """Parse default `sinfo` output (6 columns: PARTITION AVAIL TIMELIMIT NODES STATE NODELIST).

    Whitespace-delimited, variable-width. First non-blank line with
    "PARTITION" is treated as the header and skipped.
    """
    counters = ParseCounters()
    rows: List[SinfoRow] = []
    saw_header = False
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        parts = stripped.split()
        if not saw_header and parts[0].upper() == "PARTITION":
            saw_header = True
            continue
        counters.rows_total += 1
        if len(parts) < 6:
            counters.rows_dropped_malformed += 1
            continue
        partition_raw, avail, timelimit, nodes_s, state, *rest = parts
        nodelist = " ".join(rest)  # nodelist can look like "dgx[001-003,005]" — one token usually
        try:
            nodes = int(nodes_s)
        except ValueError:
            counters.rows_dropped_malformed += 1
            continue
        is_default = partition_raw.endswith("*")
        partition = partition_raw.rstrip("*")
        rows.append(SinfoRow(
            partition=partition,
            partition_default=is_default,
            avail=avail,
            timelimit=timelimit,
            nodes=nodes,
            state=state,
            nodelist=nodelist,
        ))
        counters.rows_ok += 1
    return rows, counters


# ---------------------------------------------------------------------------
# Parser 3: scontrol show nodes -o
# ---------------------------------------------------------------------------

# `Gres=gpu:B200:8(S:0-1)` — value uses COLON as the count separator, NOT `=`.
# Allow an optional type segment (`:B200`) between the keyword and the count.
_GPU_COUNT_RE = re.compile(r"gpu(?::[^:()]+)?:(\d+)")


def parse_scontrol_nodes(text: str) -> Tuple[List[NodeRecord], ParseCounters]:
    """Parse `scontrol show nodes -o` (one node per line, `key=value` pairs)."""
    counters = ParseCounters()
    nodes: List[NodeRecord] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        counters.rows_total += 1
        kv = _parse_kv_line(stripped)
        if "NodeName" not in kv:
            counters.rows_dropped_malformed += 1
            continue
        gres = kv.get("Gres")
        gres_used = kv.get("GresUsed")
        nodes.append(NodeRecord(
            name=kv["NodeName"],
            state=kv.get("State", ""),
            partitions=(kv.get("Partitions", "").split(",") if kv.get("Partitions") else []),
            cpu_total=_maybe_int(kv.get("CPUTot")),
            cpu_alloc=_maybe_int(kv.get("CPUAlloc")),
            real_memory_mb=_maybe_int(kv.get("RealMemory")),
            free_memory_mb=_maybe_int(kv.get("FreeMem")),
            gres=gres if gres and gres != "(null)" else None,
            gres_used=gres_used if gres_used and gres_used != "(null)" else None,
            gpus_total=_extract_gpu_count(gres),
            gpus_alloc=_extract_gpu_count(gres_used),
            reason=kv.get("Reason") if kv.get("Reason") and kv.get("Reason") != "(null)" else None,
            raw=kv,
        ))
        counters.rows_ok += 1
    return nodes, counters


def _extract_gpu_count(gres: Optional[str]) -> Optional[int]:
    """From Slurm's `Gres=gpu:B200:8(S:0-1)` or `GresUsed=gpu:B200:3(IDX:0-2)`."""
    if not gres or gres == "(null)":
        return None
    m = _GPU_COUNT_RE.search(gres)
    if not m:
        return None
    return int(m.group(1))


# ---------------------------------------------------------------------------
# Parser 4: scontrol show reservation
# ---------------------------------------------------------------------------

def parse_scontrol_res(text: str) -> Tuple[List[Reservation], ParseCounters]:
    """Parse `scontrol show reservation` output.

    Stanzas are separated by blank lines. Each stanza can span multiple
    lines; all whitespace-delimited `key=value` pairs within a stanza
    belong to the same reservation.
    """
    counters = ParseCounters()
    reservations: List[Reservation] = []
    stanza: List[str] = []
    for line in text.splitlines() + [""]:
        if line.strip():
            stanza.append(line)
            continue
        if not stanza:
            continue
        counters.rows_total += 1
        kv = _parse_kv_line(" ".join(stanza))
        stanza = []
        if "ReservationName" not in kv:
            counters.rows_dropped_malformed += 1
            continue
        reservations.append(Reservation(
            name=kv["ReservationName"],
            start_ts=parse_slurm_timestamp(kv.get("StartTime")),
            end_ts=parse_slurm_timestamp(kv.get("EndTime")),
            duration=kv.get("Duration"),
            nodes=kv.get("Nodes") if kv.get("Nodes") and kv.get("Nodes") != "(null)" else None,
            node_count=_maybe_int(kv.get("NodeCnt")),
            partition=kv.get("PartitionName") if kv.get("PartitionName") and kv.get("PartitionName") != "(null)" else None,
            features=kv.get("Features") if kv.get("Features") and kv.get("Features") != "(null)" else None,
            flags=(kv.get("Flags", "").split(",") if kv.get("Flags") else []),
            users=(kv.get("Users", "").split(",") if kv.get("Users") and kv.get("Users") != "(null)" else []),
            accounts=(kv.get("Accounts", "").split(",") if kv.get("Accounts") and kv.get("Accounts") != "(null)" else []),
            state=kv.get("State"),
            raw=kv,
        ))
        counters.rows_ok += 1
    return reservations, counters


# ---------------------------------------------------------------------------
# Shared primitives
# ---------------------------------------------------------------------------

def _maybe_int(s: Optional[str]) -> Optional[int]:
    if s is None or s == "":
        return None
    try:
        return int(s)
    except ValueError:
        return None


_KV_TOKEN = re.compile(r"(\S+?)=((?:\([^)]*\)|\S)*)")


def _parse_kv_line(s: str) -> Dict[str, str]:
    """Split a whitespace-delimited line of `Key=Value` tokens.

    Values may contain parentheses (Slurm puts auxiliary info like
    `(S:0-1)` after Gres values). We match non-greedily up to the next
    whitespace but allow a balanced `(...)` group.
    """
    out: Dict[str, str] = {}
    for m in _KV_TOKEN.finditer(s):
        k, v = m.group(1), m.group(2)
        out[k] = v
    return out


# ---------------------------------------------------------------------------
# Convenience: dispatch by filename prefix.
# ---------------------------------------------------------------------------

def infer_log_type(path: Path) -> Optional[str]:
    """Map filename to parser key: 'sinfo' / 'sacct' / 'nodes' / 'res'.

    Filenames are produced by the collector script; we dispatch on prefix.
    """
    name = path.name
    if name.startswith("sinfo-"):
        return "sinfo"
    if name.startswith("sacct-"):
        return "sacct"
    if name.startswith("scontrol-show-nodes-"):
        return "nodes"
    if name.startswith("scontrol-show-res-"):
        return "res"
    return None
