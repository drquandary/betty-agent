"""Integration tests for check/recommend/diagnose against the real cluster YAML."""
from __future__ import annotations

from slurm_advisor.policy import Policy
from slurm_advisor.recommender import (
    check_sbatch,
    diagnose_pending,
    recommend,
)
from slurm_advisor.solver import JobIntent, PythonSolver


# ---- check ----------------------------------------------------------------

PROBLEM_SBATCH = """\
#!/bin/bash
#SBATCH --partition=dgx-b200
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=128
#SBATCH --mem=500G
#SBATCH --time=7-00:00:00
echo train
"""


def test_check_flags_known_problems():
    rep = check_sbatch(PROBLEM_SBATCH)
    codes = [i.code for i in rep.issues]
    # 128 CPUs for 1 GPU exceeds the 28-CPU/GPU node geometry on dgx-b200
    # (so it's a hard error, not just a soft warn)
    assert "CPU_PER_GPU_OVER_NODE_LIMIT" in codes
    # 500 GB / 1 GPU = 500 GB/GPU, way over soft cap
    assert "MEM_PER_GPU_HIGH" in codes
    # 7 days hurts backfill
    assert "TIME_HURTS_BACKFILL" in codes
    # Hard error → block status; suggested fix should drop CPUs
    assert rep.status == "block"
    assert rep.suggested_sbatch is not None
    assert "--cpus-per-task=" in rep.suggested_sbatch


def test_check_clean_sbatch_passes():
    sbatch = """\
#!/bin/bash
#SBATCH --partition=dgx-b200
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=16
#SBATCH --mem=96G
#SBATCH --time=12:00:00
echo train
"""
    rep = check_sbatch(sbatch)
    assert rep.status == "ok"
    assert all(i.severity != "error" for i in rep.issues)


def test_check_blocks_unknown_partition():
    sbatch = """\
#!/bin/bash
#SBATCH --partition=fake-partition
#SBATCH --gres=gpu:1
"""
    rep = check_sbatch(sbatch)
    assert rep.status == "block"
    assert any(i.code == "UNKNOWN_PARTITION" for i in rep.issues)


def test_check_blocks_gpu_on_cpu_partition():
    sbatch = """\
#!/bin/bash
#SBATCH --partition=genoa-std-mem
#SBATCH --gres=gpu:1
#SBATCH --time=01:00:00
"""
    rep = check_sbatch(sbatch)
    assert rep.status == "block"
    assert any(i.code == "GPU_ON_CPU_PARTITION" for i in rep.issues)


# ---- recommend ------------------------------------------------------------


def test_recommend_picks_gpu_partition_for_gpus():
    intent = JobIntent(gpus=2, hours=8)
    rec = recommend(intent)
    assert rec.result["feasible"] is True
    assert rec.result["partition"] in {"dgx-b200", "b200-mig45", "b200-mig90"}
    assert rec.result["gpus_per_node"] >= 1
    assert rec.result["nodes"] >= 1
    assert "#SBATCH --partition=" in rec.sbatch_block


def test_recommend_picks_cpu_partition_for_cpu_only():
    intent = JobIntent(gpus=0, cpus=8, hours=2)
    rec = recommend(intent)
    assert rec.result["partition"] in {"genoa-std-mem", "genoa-lrg-mem"}


def test_recommend_caps_interactive_walltime():
    intent = JobIntent(gpus=1, hours=10, interactive=True)
    rec = recommend(intent)
    assert rec.result["time_seconds"] <= 4 * 3600


def test_python_solver_packs_gpus_efficiently():
    """8 GPUs on dgx-b200 (8/node) should fit on one node."""
    policy = Policy.load()
    solver = PythonSolver()
    result = solver.solve(policy, JobIntent(gpus=8, hours=1, partition_pref="dgx-b200"))
    assert result.feasible
    assert result.nodes == 1
    assert result.gpus_per_node == 8


def test_recommend_excludes_partitions_below_vram_floor():
    """100 GB VRAM requirement must skip 45/90 GB MIG partitions and route to dgx-b200.

    This is Ryan's correctness concern: without VRAM filtering, MiniZinc
    happily picks b200-mig45 (45 GB) for any 2-GPU request, which OOMs a
    70B fine-tune. With min_vram_per_gpu_gb=100, only dgx-b200 (192 GB)
    qualifies — both b200-mig45 (45 GB) and b200-mig90 (90 GB) are below.
    """
    intent = JobIntent(gpus=2, hours=8, min_vram_per_gpu_gb=100)
    rec = recommend(intent)
    assert rec.result["feasible"]
    assert rec.result["partition"] == "dgx-b200"
    # Both MIG partitions should appear in rejected with VRAM reasons
    rejected_names = {name for name, _why in rec.result["rejected"]}
    assert "b200-mig45" in rejected_names
    assert "b200-mig90" in rejected_names
    # And the VRAM constraint is reflected at the top level
    assert rec.vram_constraint["enforced"] is True
    assert rec.vram_constraint["min_vram_per_gpu_gb"] == 100


def test_recommend_no_vram_floor_shows_disclaimer():
    """Without min_vram_gb, the recommend must surface a 'VRAM not constrained'
    disclaimer so users don't trust the partition choice for ML workloads."""
    rec = recommend(JobIntent(gpus=2, hours=8))
    assert rec.vram_constraint["enforced"] is False
    assert "not constrained" in rec.vram_constraint["message"].lower()
    # Without VRAM, the cheapest legal partition (b200-mig45) wins
    assert rec.result["partition"] == "b200-mig45"


def test_recommend_infeasible_when_vram_exceeds_all_gpus():
    """If min_vram > the largest available GPU, recommend is infeasible and
    the rejection list explains why."""
    rec = recommend(JobIntent(gpus=2, hours=8, min_vram_per_gpu_gb=999))
    assert rec.result["feasible"] is False
    assert all("999" in why for _name, why in rec.result["rejected"])


# ---- diagnose -------------------------------------------------------------


def test_diagnose_resources_pending():
    text = (
        "JobId=12345 JobName=train UserId=jvadala "
        "JobState=PENDING Reason=Resources Dependency=(null) "
        "TimeLimit=2-00:00:00 Partition=dgx-b200 QOS=normal "
        "ReqTRES=cpu=16,mem=96G,node=1,gres/gpu=1 "
        "SubmitTime=2026-04-27T10:00:00"
    )
    diag = diagnose_pending("12345", text)
    assert diag.state == "PENDING"
    assert diag.reason == "Resources"
    assert any("nodes free" in c.lower() or "free that match" in c for c in diag.likely_causes)
    # 2-day walltime should also trigger the backfill heuristic
    assert any("backfill" in c.lower() for c in diag.likely_causes)
