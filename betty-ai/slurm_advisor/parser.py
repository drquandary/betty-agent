"""Parse a SLURM sbatch script into a structured request.

We deliberately read only `#SBATCH` directives — the actual program body is the
user's business. Each directive becomes one entry in `SbatchRequest.directives`
keyed by the long flag (e.g. `--gres`, `--cpus-per-task`).
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Unit conversion
# ---------------------------------------------------------------------------

_MEM_RE = re.compile(r"^(?P<n>\d+(?:\.\d+)?)(?P<u>[KMGT]?B?)?$", re.IGNORECASE)


def parse_time_to_seconds(spec: str) -> Optional[int]:
    """Parse a SLURM `--time` value.

    SLURM accepts: `MM`, `MM:SS`, `HH:MM:SS`, `D-HH`, `D-HH:MM`, `D-HH:MM:SS`.
    With one colon and no day prefix, it's `MM:SS` (NOT `HH:MM`).
    """
    if not spec:
        return None
    s = spec.strip()
    if not s:
        return None

    days = 0
    if "-" in s:
        d_str, _, rest = s.partition("-")
        if not d_str.isdigit():
            return None
        days = int(d_str)
        s = rest
        # `D-HH[:MM[:SS]]`
        parts = s.split(":") if s else ["0"]
        if len(parts) > 3:
            return None
        for p in parts:
            if not p.isdigit():
                return None
        h = int(parts[0]) if parts else 0
        m = int(parts[1]) if len(parts) > 1 else 0
        sec = int(parts[2]) if len(parts) > 2 else 0
        return days * 86400 + h * 3600 + m * 60 + sec

    parts = s.split(":")
    if len(parts) > 3:
        return None
    for p in parts:
        if not p.isdigit():
            return None
    if len(parts) == 1:
        # Just minutes
        return int(parts[0]) * 60
    if len(parts) == 2:
        # MM:SS
        return int(parts[0]) * 60 + int(parts[1])
    # HH:MM:SS
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])


def parse_mem_to_mb(spec: str) -> Optional[int]:
    """Parse a SLURM mem spec like `500G`, `128000M`, `2T` → MiB."""
    if not spec:
        return None
    m = _MEM_RE.match(spec.strip())
    if not m:
        return None
    n = float(m.group("n"))
    unit = (m.group("u") or "M").upper().rstrip("B") or "M"
    factor = {"K": 1 / 1024, "M": 1, "G": 1024, "T": 1024 * 1024}.get(unit)
    if factor is None:
        return None
    return int(round(n * factor))


def parse_gres_gpus(spec: str) -> Optional[int]:
    """Parse `--gres=gpu:N`, `--gres=gpu:a100:N`, or `--gres=N`."""
    if not spec:
        return None
    parts = spec.strip().split(":")
    # gpu:N | gpu:type:N | N
    if len(parts) == 1 and parts[0].isdigit():
        return int(parts[0])
    if parts[0].lower() != "gpu":
        return None
    last = parts[-1]
    if last.isdigit():
        return int(last)
    return None


def parse_gpu_type(spec: str) -> Optional[str]:
    """If `--gres=gpu:<type>:N`, return `<type>`."""
    if not spec:
        return None
    parts = spec.strip().split(":")
    if len(parts) == 3 and parts[0].lower() == "gpu":
        return parts[1].lower()
    return None


# ---------------------------------------------------------------------------
# Sbatch request model
# ---------------------------------------------------------------------------

# Map short SLURM flags to canonical long ones. Only the set we care about for
# advice — unknown flags pass through verbatim.
_FLAG_ALIASES = {
    "-p": "--partition",
    "-N": "--nodes",
    "-n": "--ntasks",
    "-c": "--cpus-per-task",
    "-t": "--time",
    "-J": "--job-name",
    "-o": "--output",
    "-e": "--error",
    "-A": "--account",
    "-q": "--qos",
}


@dataclass
class SbatchRequest:
    """Structured view of an sbatch script's #SBATCH directives."""

    directives: Dict[str, str] = field(default_factory=dict)
    raw_lines: List[str] = field(default_factory=list)
    body_lines: int = 0
    parse_errors: List[str] = field(default_factory=list)

    # Convenience accessors (None if not present / unparseable)
    @property
    def partition(self) -> Optional[str]:
        return self.directives.get("--partition")

    @property
    def qos(self) -> Optional[str]:
        return self.directives.get("--qos")

    @property
    def nodes(self) -> Optional[int]:
        v = self.directives.get("--nodes")
        return int(v) if v and v.isdigit() else None

    @property
    def cpus_per_task(self) -> Optional[int]:
        v = self.directives.get("--cpus-per-task")
        return int(v) if v and v.isdigit() else None

    @property
    def ntasks(self) -> Optional[int]:
        v = self.directives.get("--ntasks")
        return int(v) if v and v.isdigit() else None

    @property
    def time_seconds(self) -> Optional[int]:
        return parse_time_to_seconds(self.directives.get("--time", ""))

    @property
    def mem_mb(self) -> Optional[int]:
        return parse_mem_to_mb(self.directives.get("--mem", ""))

    @property
    def mem_per_cpu_mb(self) -> Optional[int]:
        return parse_mem_to_mb(self.directives.get("--mem-per-cpu", ""))

    @property
    def gpus(self) -> Optional[int]:
        return parse_gres_gpus(self.directives.get("--gres", ""))

    @property
    def gpu_type(self) -> Optional[str]:
        return parse_gpu_type(self.directives.get("--gres", ""))


def _normalize_flag(token: str) -> Tuple[str, Optional[str]]:
    """Turn `--foo=bar` or `--foo bar` (caller splits) into (`--foo`, `bar`).

    Resolves short aliases to their long form.
    """
    if "=" in token:
        flag, val = token.split("=", 1)
    else:
        flag, val = token, None
    flag = _FLAG_ALIASES.get(flag, flag)
    return flag, val


def parse_sbatch(text: str) -> SbatchRequest:
    """Parse a `.sbatch` script text and return an SbatchRequest.

    Rules:
    - Only lines that start with `#SBATCH` (after optional leading whitespace,
      but the shebang must be the first line) are interpreted.
    - The first non-comment, non-`#SBATCH` line ends the directive block;
      anything after counts toward `body_lines`.
    - A `#SBATCH` line after the directive block is recorded as a warning
      (Slurm ignores those).
    """
    req = SbatchRequest()
    in_directive_block = True
    saw_shebang = False

    for raw in text.splitlines():
        req.raw_lines.append(raw)
        line = raw.strip()
        if not line:
            continue
        if line.startswith("#!"):
            saw_shebang = True
            continue
        if line.startswith("#SBATCH"):
            if not in_directive_block:
                req.parse_errors.append(
                    f"#SBATCH after first command line is ignored by SLURM: {raw!r}"
                )
                continue
            rest = line[len("#SBATCH") :].strip()
            if not rest:
                continue
            tokens = rest.split(None, 1)
            flag_token = tokens[0]
            inline_val: Optional[str] = tokens[1].strip() if len(tokens) > 1 else None
            flag, eq_val = _normalize_flag(flag_token)
            value = eq_val if eq_val is not None else inline_val
            if value is None:
                # Boolean flag (e.g. --exclusive); record as empty string.
                req.directives[flag] = ""
            else:
                req.directives[flag] = value
            continue
        if line.startswith("#"):
            continue
        in_directive_block = False
        req.body_lines += 1

    if not saw_shebang and req.raw_lines:
        # Not fatal, but worth flagging — Slurm doesn't strictly require it,
        # but most well-formed scripts have one.
        req.parse_errors.append("Missing shebang on line 1 (e.g. `#!/bin/bash`).")
    return req


# ---------------------------------------------------------------------------
# Pretty printer for advice output
# ---------------------------------------------------------------------------

def format_seconds(s: int) -> str:
    """Render seconds as SLURM `--time` form (`D-HH:MM:SS` or `HH:MM:SS`)."""
    if s < 0:
        s = 0
    days, rem = divmod(s, 86400)
    hours, rem = divmod(rem, 3600)
    minutes, seconds = divmod(rem, 60)
    if days:
        return f"{days}-{hours:02d}:{minutes:02d}:{seconds:02d}"
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}"


def format_mem_mb(mb: int) -> str:
    """Render MiB as a SLURM `--mem` value, preferring G when round."""
    if mb % 1024 == 0:
        return f"{mb // 1024}G"
    return f"{mb}M"
