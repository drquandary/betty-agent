"""Constraint solver — pick a partition + resource shape that fits.

Architecture:

    JobIntent (gpus, hours, mem_gb_per_gpu_hint, partition_pref)
            │
            ▼
    pick_solver()  →  MiniZincSolver (preferred) or PythonSolver (fallback)
            │
            ▼
    SolverResult { partition, nodes, gpus_per_node, cpus, mem_gb,
                   time_seconds, billing_score, explanation }

Why two backends? MiniZinc is the right tool for the job (declarative
constraints, can grow into multi-objective optimization, easy for ops to read),
but it requires an external `minizinc` binary on disk plus the Python bindings.
On a dev laptop without MiniZinc, we still want `betty slurm recommend` to work
— so the Python fallback enumerates the small partition list and picks the
cheapest feasible shape. Both produce identical schemas.

Hand-tuned objective: minimize `billing_score = nodes * (cpus * cpu_weight +
gpus_per_node * gpu_weight) * hours`. Same weights as `betty_cluster.yaml`.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict, field
from typing import List, Optional, Tuple

from .policy import PartitionSpec, Policy


# ---------------------------------------------------------------------------
# Inputs / outputs
# ---------------------------------------------------------------------------


@dataclass
class JobIntent:
    """What the user wants. All fields optional except `hours` and one of gpus/cpus."""

    gpus: int = 0
    cpus: int = 0
    mem_gb: Optional[int] = None
    hours: float = 1.0
    partition_pref: Optional[str] = None
    qos_pref: Optional[str] = None
    interactive: bool = False
    # Minimum VRAM per GPU the workload needs (GB). When set, partitions whose
    # `gpu_vram_gb` is below this are excluded from candidates BEFORE the
    # constraint solver runs. This is what stops MiniZinc from cheerfully
    # picking b200-mig45 (45 GB) for a 70B fine-tune that needs 80+ GB/GPU.
    # Typical source: `gpu_calculator.py` computes `vram_needed_gb` from
    # model size + method (lora/qlora/full); the agent passes that here.
    min_vram_per_gpu_gb: Optional[int] = None
    # NVLink between GPUs required (distributed training, tensor parallelism).
    # When True, partitions whose `nvlink: false` are excluded BEFORE solving.
    # MIG slices on Betty have nvlink: false because MIG virtualization breaks
    # the NVLink fabric, so distributed training cannot use them.
    requires_nvlink: bool = False
    notes: List[str] = field(default_factory=list)


@dataclass
class SolverResult:
    feasible: bool
    partition: Optional[str]
    qos: Optional[str]
    nodes: int
    gpus_per_node: int
    cpus_per_task: int
    mem_gb: int
    time_seconds: int
    billing_score: float
    backend: str  # "minizinc" | "python"
    explanation: List[str] = field(default_factory=list)
    rejected: List[Tuple[str, str]] = field(default_factory=list)  # (partition, why)

    def as_sbatch(self) -> str:
        """Render the result as a runnable `#SBATCH` block."""
        from .parser import format_mem_mb, format_seconds
        lines = ["#!/bin/bash"]
        if self.partition:
            lines.append(f"#SBATCH --partition={self.partition}")
        if self.qos:
            lines.append(f"#SBATCH --qos={self.qos}")
        lines.append(f"#SBATCH --nodes={self.nodes}")
        if self.gpus_per_node > 0:
            lines.append(f"#SBATCH --gres=gpu:{self.gpus_per_node}")
        lines.append(f"#SBATCH --cpus-per-task={self.cpus_per_task}")
        lines.append(f"#SBATCH --mem={format_mem_mb(self.mem_gb * 1024)}")
        lines.append(f"#SBATCH --time={format_seconds(self.time_seconds)}")
        return "\n".join(lines) + "\n"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["sbatch_block"] = self.as_sbatch()
        return d


# ---------------------------------------------------------------------------
# Common helpers
# ---------------------------------------------------------------------------


def _candidate_partitions(
    policy: Policy, intent: JobIntent
) -> Tuple[List[PartitionSpec], List[Tuple[str, str]]]:
    """Return (eligible_partitions, rejected_with_reason).

    Pre-filters before the constraint solver runs:
      - partition_pref pin
      - GPU vs CPU partition class based on `gpus` request
      - VRAM floor (`min_vram_per_gpu_gb`) — excludes partitions with too-small GPUs
      - NVLink requirement (`requires_nvlink`) — excludes MIG slices that lack NVLink

    Each rejection records a human-readable reason, surfaced in the recommend
    card so users see *why* a cheaper partition was disqualified. Without
    this, the optimizer's choice of "the cheapest legal partition" would be
    a black box.
    """
    rejected: List[Tuple[str, str]] = []
    if intent.partition_pref:
        p = policy.find_partition(intent.partition_pref)
        return ([p] if p else []), rejected
    pool = policy.gpu_partitions() if intent.gpus > 0 else policy.cpu_partitions()
    eligible: List[PartitionSpec] = []
    for p in pool:
        # VRAM floor
        if intent.min_vram_per_gpu_gb and intent.gpus > 0:
            if p.gpu_vram_gb is not None and p.gpu_vram_gb < intent.min_vram_per_gpu_gb:
                rejected.append((
                    p.name,
                    f"gpu_vram_gb={p.gpu_vram_gb} < required {intent.min_vram_per_gpu_gb}",
                ))
                continue
        # NVLink requirement
        if intent.requires_nvlink and intent.gpus > 0 and not p.nvlink:
            rejected.append((p.name, "nvlink=false; required by distributed training"))
            continue
        eligible.append(p)
    return eligible, rejected


def _max_qos_gpu_cap(policy: Policy, partition: PartitionSpec) -> int:
    """Most permissive GPU cap among QOSes allowed on this partition.

    Returns 0 if no allowed QOS specifies a GPU cap (in which case we use a
    sentinel meaning "no QOS-imposed limit"). Used to prevent the solver
    from returning configurations that exceed the largest QOS the user
    could plausibly request — e.g. 41 GPUs is over `gpu-max`'s 40-cap.
    """
    cap = 0
    for q in partition.allowed_qos:
        spec = policy.qos.get(q)
        if spec and spec.max_gpus and spec.max_gpus > cap:
            cap = spec.max_gpus
    return cap


def _pick_qos(policy: Policy, partition: PartitionSpec, intent: JobIntent) -> Optional[str]:
    if intent.qos_pref and intent.qos_pref in partition.allowed_qos:
        return intent.qos_pref
    # Prefer "normal" if listed, else the first allowed.
    if "normal" in partition.allowed_qos:
        return "normal"
    return partition.allowed_qos[0] if partition.allowed_qos else None


def _shape_for(
    policy: Policy, partition: PartitionSpec, intent: JobIntent
) -> Optional[Tuple[int, int, int, int]]:
    """Return `(nodes, gpus_per_node, cpus_per_task, mem_gb)` for a partition.

    None if the intent can't fit on this partition at all.
    """
    if intent.gpus > 0:
        if not partition.is_gpu:
            return None
        # Reject up front if the request exceeds the partition's most
        # permissive QOS GPU cap. Without this, the model would happily
        # return e.g. 42 GPUs on dgx-b200 when gpu-max caps the user at 40.
        qos_cap = _max_qos_gpu_cap(policy, partition)
        if qos_cap and intent.gpus > qos_cap:
            return None
        # Pack GPUs onto as few nodes as possible.
        gpn = min(intent.gpus, partition.gpus_per_node)
        nodes = (intent.gpus + gpn - 1) // gpn
        if nodes > partition.max_nodes_per_job:
            return None
        # CPUs per task: cap to the lower of node-geometry and soft policy.
        # The solver returns *recommended* shapes — even if the caller asked
        # for 128 CPUs/1 GPU, we recommend 28 (or less).
        per_gpu_cap = min(
            partition.cpus_per_node // partition.gpus_per_node,
            policy.soft_max_cpu_per_gpu,
        )
        default_cpus = min(per_gpu_cap, partition.default_cpus_per_gpu or per_gpu_cap)
        cpus_per_task = min(intent.cpus, per_gpu_cap) if intent.cpus else default_cpus
        # Memory: cap to soft per-GPU policy and to per-node hardware.
        soft_mem_cap = policy.soft_max_mem_per_gpu_gb * gpn
        node_cap = partition.memory_gb_per_node or soft_mem_cap
        if intent.mem_gb:
            mem_gb = min(intent.mem_gb, soft_mem_cap, node_cap)
        else:
            per_gpu = partition.default_mem_per_gpu_gb or policy.soft_max_mem_per_gpu_gb
            mem_gb = min(per_gpu * gpn, node_cap)
        return nodes, gpn, cpus_per_task, mem_gb

    # CPU-only path
    if partition.is_gpu:
        return None
    cpus = intent.cpus or 1
    cpus_per_node = partition.cpus_per_node
    nodes = (cpus + cpus_per_node - 1) // cpus_per_node
    if nodes > partition.max_nodes_per_job:
        return None
    cpus_per_task = min(cpus, cpus_per_node)
    mem_gb = intent.mem_gb or (
        (partition.default_mem_per_cpu_mb or 5120) * cpus_per_task // 1024
    )
    if partition.memory_gb_per_node:
        mem_gb = min(mem_gb, partition.memory_gb_per_node)
    return nodes, 0, cpus_per_task, mem_gb


def _score(partition: PartitionSpec, nodes: int, gpus_per_node: int,
           cpus_per_task: int, mem_gb: int, hours: float) -> float:
    """Lower is cheaper. Mirrors Slurm TRES billing weights."""
    cpu_part = cpus_per_task * partition.billing_weight_cpu
    gpu_part = gpus_per_node * partition.billing_weight_gpu
    return float(nodes * (cpu_part + gpu_part) * hours)


# ---------------------------------------------------------------------------
# Pure-Python solver (always available)
# ---------------------------------------------------------------------------


class PythonSolver:
    backend = "python"

    def solve(self, policy: Policy, intent: JobIntent) -> SolverResult:
        candidates, vram_rejected = _candidate_partitions(policy, intent)
        if not candidates:
            return SolverResult(
                feasible=False, partition=None, qos=None, nodes=0,
                gpus_per_node=0, cpus_per_task=0, mem_gb=0, time_seconds=0,
                billing_score=0.0, backend=self.backend,
                explanation=[
                    "No partition matches the request "
                    f"(gpus={intent.gpus}, partition_pref={intent.partition_pref}, "
                    f"min_vram_per_gpu_gb={intent.min_vram_per_gpu_gb})."
                ],
                rejected=vram_rejected,
            )

        best: Optional[Tuple[float, PartitionSpec, Tuple[int, int, int, int]]] = None
        # Start the rejection list with VRAM exclusions so the user sees them
        # alongside any geometry/walltime rejections that follow.
        rejected: List[Tuple[str, str]] = list(vram_rejected)

        for p in candidates:
            shape = _shape_for(policy, p, intent)
            if shape is None:
                # Distinguish the failure modes so the user gets a specific
                # explanation, not just "doesn't fit".
                qos_cap = _max_qos_gpu_cap(policy, p)
                if intent.gpus > 0 and qos_cap and intent.gpus > qos_cap:
                    rejected.append((p.name, f"req {intent.gpus} GPUs exceeds QOS cap {qos_cap}"))
                elif intent.gpus > 0 and p.is_gpu:
                    needed_nodes = (intent.gpus + p.gpus_per_node - 1) // p.gpus_per_node
                    if needed_nodes > p.max_nodes_per_job:
                        rejected.append((p.name, f"req {intent.gpus} GPUs needs {needed_nodes} nodes > max {p.max_nodes_per_job}"))
                    else:
                        rejected.append((p.name, "request does not fit partition geometry"))
                else:
                    rejected.append((p.name, "request does not fit partition geometry"))
                continue
            nodes, gpn, cpus, mem_gb = shape
            # Walltime bound
            seconds = int(intent.hours * 3600)
            if intent.interactive and seconds > 4 * 3600:
                seconds = 4 * 3600  # interactive guideline
            if seconds > p.max_walltime_seconds:
                from .parser import format_seconds
                rejected.append((
                    p.name,
                    f"req {format_seconds(seconds)} exceeds partition max {format_seconds(p.max_walltime_seconds)}",
                ))
                continue
            score = _score(p, nodes, gpn, cpus, mem_gb, intent.hours)
            if best is None or score < best[0]:
                best = (score, p, (nodes, gpn, cpus, mem_gb))

        if best is None:
            return SolverResult(
                feasible=False, partition=None, qos=None, nodes=0,
                gpus_per_node=0, cpus_per_task=0, mem_gb=0, time_seconds=0,
                billing_score=0.0, backend=self.backend,
                explanation=["No candidate partition could satisfy the request."],
                rejected=rejected,
            )

        score, p, (nodes, gpn, cpus, mem_gb) = best
        seconds = int(intent.hours * 3600)
        if intent.interactive and seconds > 4 * 3600:
            seconds = 4 * 3600
        qos = _pick_qos(policy, p, intent)
        explanation = [
            f"Picked {p.name} as the cheapest partition that fits.",
            f"Packed {intent.gpus} GPU(s) onto {nodes} node(s) of {gpn} GPU(s) each.",
            f"CPUs/task = {cpus} (cap {policy.soft_max_cpu_per_gpu}/GPU).",
            f"Memory = {mem_gb} GB ({mem_gb // max(gpn, 1) if gpn else mem_gb} GB/GPU).",
            f"Walltime = {seconds // 3600}h. Billing score (lower is cheaper) = {score:.0f}.",
        ]
        return SolverResult(
            feasible=True, partition=p.name, qos=qos, nodes=nodes,
            gpus_per_node=gpn, cpus_per_task=cpus, mem_gb=mem_gb,
            time_seconds=seconds, billing_score=score, backend=self.backend,
            explanation=explanation, rejected=rejected,
        )


# ---------------------------------------------------------------------------
# MiniZinc solver
# ---------------------------------------------------------------------------


_MZN_MODEL = """\
% Betty SLURM advisor — pick a partition shape.
% Inputs are arrays of partition specs; outputs are indices and counts.

int: P;                                  % number of partitions
set of int: PART = 1..P;
array[PART] of string: name;
array[PART] of int:    cpus_per_node;
array[PART] of int:    gpus_per_node;
array[PART] of int:    mem_gb_per_node;
array[PART] of int:    max_nodes;
array[PART] of int:    max_walltime_s;
array[PART] of float:  cpu_weight;
array[PART] of float:  gpu_weight;
array[PART] of int:    is_gpu;           % 1 / 0

int: req_gpus;
int: req_cpus;
int: req_mem_gb;
int: req_seconds;
int: soft_cpu_per_gpu;
int: soft_mem_per_gpu;
% Per-partition recommended CPUs / mem per GPU (typically used when the
% caller didn't pin cpus/mem). 0 = "no useful default; fall back to soft".
array[PART] of int: default_cpus_per_gpu;
array[PART] of int: default_mem_per_gpu_gb;
% Per-partition most-permissive QOS GPU cap. 0 = no cap from any allowed
% QOS (rare; treated as effectively unlimited). Without this, the model
% would happily exceed the cluster's QOS-imposed GPU ceilings.
array[PART] of int: max_qos_gpus;

var PART: pidx;
var 1..1000: nodes;
var 0..256: gpus_per_node_out;
var 1..256: cpus_per_task;
var 1..16384: mem_gb;

% Partition selection enables/disables GPU packing
constraint
  if req_gpus > 0 then is_gpu[pidx] = 1
  else is_gpu[pidx] = 0
  endif;

% Geometry: gpus per node ≤ partition's gpus_per_node, packs req_gpus
constraint
  if req_gpus > 0 then
    gpus_per_node_out >= 1 /\\
    gpus_per_node_out <= gpus_per_node[pidx] /\\
    nodes * gpus_per_node_out >= req_gpus /\\
    (nodes - 1) * gpus_per_node_out < req_gpus
  else
    gpus_per_node_out = 0 /\\ nodes >= 1
  endif;

constraint nodes <= max_nodes[pidx];
constraint cpus_per_task <= cpus_per_node[pidx];
% QOS GPU cap: total GPUs allocated must not exceed the most permissive
% QOS cap on the chosen partition. (max_qos_gpus = 0 means no cap.)
constraint
  if max_qos_gpus[pidx] > 0 /\\ req_gpus > 0 then
    nodes * gpus_per_node_out <= max_qos_gpus[pidx]
  else true endif;
% Pin CPUs to the partition's recommended default when the caller didn't
% specify; otherwise honor the request but cap to the per-GPU policy. The
% objective minimizes billing, so without this the solver would pick
% cpus=1 (cheapest but useless).
constraint
  if req_cpus > 0 then
    cpus_per_task = min(req_cpus, soft_cpu_per_gpu)
  else
    if req_gpus > 0 then
      cpus_per_task = min(min(default_cpus_per_gpu[pidx],
                              cpus_per_node[pidx] div gpus_per_node[pidx]),
                          soft_cpu_per_gpu)
    else
      cpus_per_task >= 1
    endif
  endif;
constraint mem_gb <= mem_gb_per_node[pidx];
constraint
  if req_mem_gb > 0 then
    mem_gb = req_mem_gb
  else
    if req_gpus > 0 then
      mem_gb = min(default_mem_per_gpu_gb[pidx] * gpus_per_node_out,
                   mem_gb_per_node[pidx])
    else
      mem_gb >= 1
    endif
  endif;
constraint req_seconds <= max_walltime_s[pidx];

% Objective: minimize billing.
var float: billing =
  int2float(nodes) *
  (int2float(cpus_per_task) * cpu_weight[pidx] +
   int2float(gpus_per_node_out) * gpu_weight[pidx]) *
  (int2float(req_seconds) / 3600.0);

solve minimize billing;

output [
  "{",
  "\\"pidx\\":", show(pidx), ",",
  "\\"nodes\\":", show(nodes), ",",
  "\\"gpus_per_node\\":", show(gpus_per_node_out), ",",
  "\\"cpus_per_task\\":", show(cpus_per_task), ",",
  "\\"mem_gb\\":", show(mem_gb), ",",
  "\\"billing\\":", show(billing),
  "}"
];
"""


class MiniZincSolver:
    backend = "minizinc"

    # Solver preference order. `gecode` is best for our model (CP solver,
    # native fit for the constraint shape) but ships separately from the
    # base MiniZinc binary. The brew formula bundles only MIP solvers and
    # only `cbc` (COIN-OR) actually has its plugin shipped — `highs`/`scip`
    # are listed but their .dylib is missing on macOS brew. So: gecode →
    # cbc → anything cbc-shaped, then we give up.
    SOLVER_PREFS = ("gecode", "cbc", "coin-bc", "osicbc")

    def __init__(self) -> None:
        # Both the Python package AND a usable MiniZinc solver must be
        # present. Probe via `Solver.lookup` (which talks to the binary)
        # and remember which one we found — the solve() call uses the
        # same name so we don't have to re-probe.
        import warnings
        self._solver_name: Optional[str] = None
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            try:
                import minizinc
                for name in self.SOLVER_PREFS:
                    try:
                        minizinc.Solver.lookup(name)
                        self._solver_name = name
                        break
                    except Exception:
                        continue
            except Exception:
                pass
        self._available = self._solver_name is not None

    def is_available(self) -> bool:
        return self._available

    def solve(self, policy: Policy, intent: JobIntent) -> SolverResult:
        if not self._available:
            # Should never happen: pick_solver guards this. Be defensive anyway.
            return PythonSolver().solve(policy, intent)
        import minizinc  # local import — only when needed

        candidates, vram_rejected = _candidate_partitions(policy, intent)
        if not candidates:
            return SolverResult(
                feasible=False, partition=None, qos=None, nodes=0,
                gpus_per_node=0, cpus_per_task=0, mem_gb=0, time_seconds=0,
                billing_score=0.0, backend=self.backend,
                explanation=[
                    "No partition matches the request "
                    f"(min_vram_per_gpu_gb={intent.min_vram_per_gpu_gb})."
                ],
                rejected=vram_rejected,
            )
        # Use whichever solver we found at import (gecode preferred, highs
        # is the brew default).
        solver = minizinc.Solver.lookup(self._solver_name or "default")

        model = minizinc.Model()
        model.add_string(_MZN_MODEL)
        instance = minizinc.Instance(solver, model)

        instance["P"] = len(candidates)
        instance["name"] = [p.name for p in candidates]
        instance["cpus_per_node"] = [p.cpus_per_node for p in candidates]
        instance["gpus_per_node"] = [p.gpus_per_node for p in candidates]
        # Some MIG partitions don't list memory_gb_per_node in the YAML —
        # they share hardware with the parent DGX (~2 TB). Default to 2048
        # GB so the constraint doesn't reject otherwise-cheap partitions.
        instance["mem_gb_per_node"] = [p.memory_gb_per_node or 2048 for p in candidates]
        instance["max_nodes"] = [p.max_nodes_per_job for p in candidates]
        instance["max_walltime_s"] = [p.max_walltime_seconds for p in candidates]
        instance["cpu_weight"] = [p.billing_weight_cpu for p in candidates]
        instance["gpu_weight"] = [p.billing_weight_gpu for p in candidates]
        instance["is_gpu"] = [1 if p.is_gpu else 0 for p in candidates]
        instance["req_gpus"] = max(intent.gpus, 0)
        instance["req_cpus"] = max(intent.cpus, 1 if intent.gpus == 0 else 0)
        instance["req_mem_gb"] = intent.mem_gb or 0
        instance["req_seconds"] = int(intent.hours * 3600)
        instance["soft_cpu_per_gpu"] = policy.soft_max_cpu_per_gpu
        instance["soft_mem_per_gpu"] = policy.soft_max_mem_per_gpu_gb
        instance["default_cpus_per_gpu"] = [
            p.default_cpus_per_gpu or policy.soft_max_cpu_per_gpu for p in candidates
        ]
        instance["default_mem_per_gpu_gb"] = [
            p.default_mem_per_gpu_gb or policy.soft_max_mem_per_gpu_gb for p in candidates
        ]
        instance["max_qos_gpus"] = [_max_qos_gpu_cap(policy, p) for p in candidates]

        try:
            result = instance.solve()
        except Exception as e:
            # Fall back to Python solver if MiniZinc errors out (most common
            # cause: solver binary missing). Better to give an answer than blow up.
            r = PythonSolver().solve(policy, intent)
            r.explanation.insert(0, f"MiniZinc errored ({e!r}); used Python fallback.")
            return r

        if result is None or result.solution is None:
            # MZN doesn't tell us which constraint failed for which partition.
            # Fall back to the Python solver so the user gets a per-partition
            # rejection list ("walltime exceeds max", "QOS cap exceeded").
            # Honest infeasibility with reasons is more useful than silent
            # "no feasible assignment".
            py_result = PythonSolver().solve(policy, intent)
            py_result.explanation.insert(
                0, "MiniZinc reported no feasible assignment; "
                   "Python fallback enumerated reasons below."
            )
            py_result.backend = self.backend  # report MZN as source-of-truth
            # Merge in the VRAM rejections so they're not lost
            existing_names = {n for n, _ in py_result.rejected}
            for n, why in vram_rejected:
                if n not in existing_names:
                    py_result.rejected.append((n, why))
            return py_result

        sol = result.solution
        # MiniZinc indices are 1-based; our list is 0-based.
        pidx = int(getattr(sol, "pidx")) - 1
        partition = candidates[pidx]
        nodes = int(getattr(sol, "nodes"))
        # The MZN model names the output `gpus_per_node_out` to avoid
        # colliding with the input array `gpus_per_node`.
        gpn = int(getattr(sol, "gpus_per_node_out"))
        cpus = int(getattr(sol, "cpus_per_task"))
        mem_gb = int(getattr(sol, "mem_gb"))
        # MZN exposes the optimized expression as `objective`, not via
        # named-binding lookup. Same value, just a different attribute.
        billing = float(getattr(sol, "objective", 0.0))

        seconds = int(intent.hours * 3600)
        if intent.interactive and seconds > 4 * 3600:
            seconds = 4 * 3600
        qos = _pick_qos(policy, partition, intent)
        explanation = [
            f"MiniZinc picked {partition.name}; objective = {billing:.0f}.",
            f"Shape: {nodes} node(s) × {gpn} GPU(s), {cpus} CPUs/task, {mem_gb} GB.",
        ]
        return SolverResult(
            feasible=True, partition=partition.name, qos=qos, nodes=nodes,
            gpus_per_node=gpn, cpus_per_task=cpus, mem_gb=mem_gb,
            time_seconds=seconds, billing_score=billing, backend=self.backend,
            explanation=explanation, rejected=vram_rejected,
        )


def pick_solver(prefer_minizinc: bool = True):
    """Return a solver instance — MiniZinc if importable, else Python."""
    if prefer_minizinc:
        mz = MiniZincSolver()
        if mz.is_available():
            return mz
    return PythonSolver()
