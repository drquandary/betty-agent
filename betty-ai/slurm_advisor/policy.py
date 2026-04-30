"""Cluster policy — derive constraint inputs from `configs/betty_cluster.yaml`.

This module is the bridge between the YAML source-of-truth and the constraint
solver / report generator. It exposes:

- `Policy.load()`             — read the YAML and return a Policy
- `Policy.partitions`         — dict of name -> PartitionSpec
- `Policy.qos`                — dict of name -> QosSpec
- `Policy.allowed_qos_for(p)` — list of QOS names allowed on a partition
- `Policy.violations(req)`    — list of CheckIssue from an SbatchRequest

We also bake in three "soft" rules that aren't in the YAML but are well-known
PARCC scheduling lore (see https://ood.betty.parcc.upenn.edu/.../filter.html):

  1. **CPU / GPU ≤ 28 on dgx-b200 (default)** — beyond that you're starving
     other GPUs on the node.
  2. **Mem / GPU ≤ 224 GB on dgx-b200** — same reason.
  3. **Long walltimes hurt backfill** — anything > 24h on a GPU partition gets
     a soft warning.

Hard limits (cluster YAML) become `severity=error`; soft rules become
`severity=warn`.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import yaml

from .parser import (
    SbatchRequest,
    format_mem_mb,
    format_seconds,
    parse_time_to_seconds,
)


_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_CONFIG = os.path.join(_THIS_DIR, "..", "configs", "betty_cluster.yaml")


# ---------------------------------------------------------------------------
# Spec models (mirrors the YAML; only fields we actually use)
# ---------------------------------------------------------------------------


@dataclass
class PartitionSpec:
    name: str
    cpus_per_node: int
    gpus_per_node: int
    memory_gb_per_node: Optional[int]
    max_nodes_per_job: int
    max_walltime_seconds: int
    default_walltime_seconds: Optional[int]
    default_cpus_per_gpu: Optional[int]
    default_mem_per_gpu_gb: Optional[int]
    default_mem_per_cpu_mb: Optional[int]
    max_mem_per_cpu_mb: Optional[int]
    allowed_qos: List[str]
    gpu_type: Optional[str]
    gpu_vram_gb: Optional[int]
    billing_weight_cpu: float
    billing_weight_gpu: float
    # NVLink between GPUs on the same node. Distributed training that needs
    # tensor parallelism (e.g. all-reduce across GPUs of a single replica)
    # requires this. MIG slices on Betty have nvlink: false because MIG
    # virtualization breaks the NVLink fabric between siblings.
    nvlink: bool = False
    is_default: bool = False

    @property
    def is_gpu(self) -> bool:
        return self.gpus_per_node > 0


@dataclass
class QosSpec:
    name: str
    max_gpus: Optional[int] = None
    max_cpus: Optional[int] = None


@dataclass
class CheckIssue:
    """One violation or recommendation produced by `Policy.violations`."""

    severity: str  # "error" | "warn" | "info"
    code: str      # short stable identifier, e.g. "MEM_PER_GPU_HIGH"
    message: str   # human-readable explanation
    suggestion: Optional[str] = None  # `#SBATCH ...` string or shell snippet
    field: Optional[str] = None       # which directive triggered it


# ---------------------------------------------------------------------------
# Policy
# ---------------------------------------------------------------------------


@dataclass
class Policy:
    partitions: Dict[str, PartitionSpec] = field(default_factory=dict)
    qos: Dict[str, QosSpec] = field(default_factory=dict)

    # Soft thresholds (overridable in tests)
    soft_max_cpu_per_gpu: int = 28
    soft_max_mem_per_gpu_gb: int = 224
    soft_max_walltime_h_for_backfill: int = 24

    @classmethod
    def load(cls, path: Optional[str] = None) -> "Policy":
        path = path or _DEFAULT_CONFIG
        with open(path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        pol = cls()
        for name, p in (data.get("partitions") or {}).items():
            walltime = parse_time_to_seconds(p.get("max_walltime", "")) or 7 * 86400
            default_walltime = parse_time_to_seconds(p.get("default_walltime", "")) or None
            mem_gb = p.get("memory_gb_per_node") or (
                int(p["memory_mb_per_node"] / 1024) if p.get("memory_mb_per_node") else None
            )
            pol.partitions[name] = PartitionSpec(
                name=name,
                cpus_per_node=int(p.get("cpus_per_node", 0)),
                gpus_per_node=int(p.get("gpus_per_node", 0)),
                memory_gb_per_node=mem_gb,
                max_nodes_per_job=int(p.get("max_nodes_per_job", 1)),
                max_walltime_seconds=walltime,
                default_walltime_seconds=default_walltime,
                default_cpus_per_gpu=p.get("default_cpus_per_gpu"),
                default_mem_per_gpu_gb=p.get("default_mem_per_gpu_gb"),
                default_mem_per_cpu_mb=p.get("default_mem_per_cpu_mb"),
                max_mem_per_cpu_mb=p.get("max_mem_per_cpu_mb"),
                allowed_qos=list(p.get("allowed_qos", []) or []),
                gpu_type=p.get("gpu_type"),
                gpu_vram_gb=p.get("gpu_vram_gb"),
                billing_weight_cpu=float(p.get("billing_weight_cpu", 1)),
                billing_weight_gpu=float(p.get("billing_weight_gpu", 0)),
                nvlink=bool(p.get("nvlink", False)),
                is_default=bool(p.get("is_default", False)),
            )
        for name, q in (data.get("qos") or {}).items():
            pol.qos[name] = QosSpec(
                name=name,
                max_gpus=q.get("max_gpus"),
                max_cpus=q.get("max_cpus"),
            )
        return pol

    # --- queries -----------------------------------------------------------

    def gpu_partitions(self) -> List[PartitionSpec]:
        return [p for p in self.partitions.values() if p.is_gpu]

    def cpu_partitions(self) -> List[PartitionSpec]:
        return [p for p in self.partitions.values() if not p.is_gpu]

    def find_partition(self, name: Optional[str]) -> Optional[PartitionSpec]:
        if not name:
            return None
        return self.partitions.get(name)

    # --- the big one: validate an SbatchRequest ---------------------------

    def violations(self, req: SbatchRequest) -> List[CheckIssue]:
        issues: List[CheckIssue] = []

        # -- partition check --
        partition = self.find_partition(req.partition)
        if req.partition and partition is None:
            issues.append(CheckIssue(
                severity="error",
                code="UNKNOWN_PARTITION",
                field="--partition",
                message=f"Partition '{req.partition}' is not defined on Betty.",
                suggestion=f"#SBATCH --partition={self._default_partition_name()}",
            ))
            return issues  # downstream checks need a known partition

        if partition is None:
            # No partition specified — Slurm will use the default. Hint at it.
            issues.append(CheckIssue(
                severity="info",
                code="PARTITION_UNSET",
                field="--partition",
                message=(
                    "No --partition set; Slurm will use the cluster default "
                    f"({self._default_partition_name()})."
                ),
            ))

        # -- gpu / partition consistency --
        if req.gpus and partition and not partition.is_gpu:
            issues.append(CheckIssue(
                severity="error",
                code="GPU_ON_CPU_PARTITION",
                field="--partition",
                message=(
                    f"--gres=gpu:{req.gpus} requested on CPU-only partition "
                    f"'{partition.name}'."
                ),
                suggestion="#SBATCH --partition=dgx-b200",
            ))

        if req.gpu_type and partition and partition.gpu_type:
            # Compare loosely: 'a100' vs 'NVIDIA A100' both work
            wanted = req.gpu_type.lower()
            avail = partition.gpu_type.lower()
            if wanted not in avail:
                issues.append(CheckIssue(
                    severity="warn",
                    code="GPU_TYPE_MISMATCH",
                    field="--gres",
                    message=(
                        f"Requested GPU type '{req.gpu_type}', but partition "
                        f"'{partition.name}' provides '{partition.gpu_type}'."
                    ),
                ))

        # -- per-GPU CPU/RAM caps (hard from YAML, soft from PARCC lore) --
        if partition and partition.is_gpu and req.gpus:
            # Hard cap from node geometry
            max_cpus_per_gpu_hard = partition.cpus_per_node // partition.gpus_per_node
            if req.cpus_per_task and req.cpus_per_task > max_cpus_per_gpu_hard:
                issues.append(CheckIssue(
                    severity="error",
                    code="CPU_PER_GPU_OVER_NODE_LIMIT",
                    field="--cpus-per-task",
                    message=(
                        f"--cpus-per-task={req.cpus_per_task} with {req.gpus} GPU(s) "
                        f"exceeds {partition.name}'s {max_cpus_per_gpu_hard} CPUs per GPU."
                    ),
                    suggestion=f"#SBATCH --cpus-per-task={max_cpus_per_gpu_hard}",
                ))
            elif req.cpus_per_task and req.cpus_per_task > self.soft_max_cpu_per_gpu:
                issues.append(CheckIssue(
                    severity="warn",
                    code="CPU_PER_GPU_HIGH",
                    field="--cpus-per-task",
                    message=(
                        f"--cpus-per-task={req.cpus_per_task} is high for {req.gpus} GPU(s); "
                        f"unless your dataloader is CPU-bound, "
                        f"{self.soft_max_cpu_per_gpu} or fewer leaves room for other GPUs on the node."
                    ),
                    suggestion=f"#SBATCH --cpus-per-task={self.soft_max_cpu_per_gpu}",
                ))

            mem_mb = req.mem_mb
            if mem_mb is not None:
                mem_gb_per_gpu = mem_mb / 1024 / max(req.gpus, 1)
                if partition.memory_gb_per_node and mem_mb / 1024 > partition.memory_gb_per_node:
                    issues.append(CheckIssue(
                        severity="error",
                        code="MEM_OVER_NODE",
                        field="--mem",
                        message=(
                            f"--mem={format_mem_mb(mem_mb)} exceeds the per-node "
                            f"{partition.memory_gb_per_node} GB on {partition.name}."
                        ),
                        suggestion=f"#SBATCH --mem={partition.memory_gb_per_node}G",
                    ))
                elif mem_gb_per_gpu > self.soft_max_mem_per_gpu_gb:
                    suggested_gb = self.soft_max_mem_per_gpu_gb * req.gpus
                    issues.append(CheckIssue(
                        severity="warn",
                        code="MEM_PER_GPU_HIGH",
                        field="--mem",
                        message=(
                            f"--mem={format_mem_mb(mem_mb)} works out to "
                            f"{mem_gb_per_gpu:.0f} GB per GPU on {partition.name}; "
                            f"placement is much easier under {self.soft_max_mem_per_gpu_gb} GB/GPU."
                        ),
                        suggestion=f"#SBATCH --mem={suggested_gb}G",
                    ))

        # -- walltime checks --
        if req.time_seconds is not None and partition is not None:
            if req.time_seconds > partition.max_walltime_seconds:
                issues.append(CheckIssue(
                    severity="error",
                    code="TIME_OVER_PARTITION_MAX",
                    field="--time",
                    message=(
                        f"--time={req.directives.get('--time')} exceeds the partition "
                        f"max ({format_seconds(partition.max_walltime_seconds)})."
                    ),
                    suggestion=f"#SBATCH --time={format_seconds(partition.max_walltime_seconds)}",
                ))
            elif partition.is_gpu and req.time_seconds > self.soft_max_walltime_h_for_backfill * 3600:
                issues.append(CheckIssue(
                    severity="warn",
                    code="TIME_HURTS_BACKFILL",
                    field="--time",
                    message=(
                        f"--time={req.directives.get('--time')} (>{self.soft_max_walltime_h_for_backfill}h) "
                        "makes backfill unlikely; shorter jobs start sooner."
                    ),
                    suggestion=f"#SBATCH --time={format_seconds(self.soft_max_walltime_h_for_backfill * 3600)}",
                ))

        # -- node count cap --
        if req.nodes is not None and partition is not None:
            if req.nodes > partition.max_nodes_per_job:
                issues.append(CheckIssue(
                    severity="error",
                    code="NODES_OVER_MAX",
                    field="--nodes",
                    message=(
                        f"--nodes={req.nodes} exceeds {partition.name}'s max "
                        f"{partition.max_nodes_per_job}."
                    ),
                    suggestion=f"#SBATCH --nodes={partition.max_nodes_per_job}",
                ))

        # -- QOS check --
        if req.qos and partition is not None and req.qos not in partition.allowed_qos:
            issues.append(CheckIssue(
                severity="error",
                code="QOS_NOT_ALLOWED",
                field="--qos",
                message=(
                    f"QOS '{req.qos}' is not allowed on {partition.name}. "
                    f"Allowed: {', '.join(partition.allowed_qos) or '(none)'}."
                ),
                suggestion=(
                    f"#SBATCH --qos={partition.allowed_qos[0]}"
                    if partition.allowed_qos else None
                ),
            ))

        # -- QOS GPU cap --
        if req.qos and req.gpus and req.qos in self.qos:
            max_gpus = self.qos[req.qos].max_gpus
            if max_gpus is not None and req.gpus > max_gpus:
                issues.append(CheckIssue(
                    severity="error",
                    code="GPU_OVER_QOS",
                    field="--gres",
                    message=(
                        f"QOS '{req.qos}' caps GPUs at {max_gpus}; you requested {req.gpus}."
                    ),
                ))

        # -- parser-level errors (missing shebang etc.) --
        for err in req.parse_errors:
            issues.append(CheckIssue(severity="info", code="PARSE_NOTE", message=err))

        return issues

    def _default_partition_name(self) -> str:
        for name, p in self.partitions.items():
            if p.is_default:
                return name
        return next(iter(self.partitions), "")
