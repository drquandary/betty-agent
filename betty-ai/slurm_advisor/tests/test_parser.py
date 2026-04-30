"""Unit tests for the sbatch parser."""
from __future__ import annotations

from slurm_advisor.parser import (
    parse_gpu_type,
    parse_gres_gpus,
    parse_mem_to_mb,
    parse_sbatch,
    parse_time_to_seconds,
)


def test_time_parsing_variants():
    assert parse_time_to_seconds("60") == 60 * 60         # bare minutes
    assert parse_time_to_seconds("60:30") == 60 * 60 + 30  # MM:SS
    assert parse_time_to_seconds("01:30:00") == 5400      # HH:MM:SS
    assert parse_time_to_seconds("7-00:00:00") == 7 * 86400
    assert parse_time_to_seconds("3-12") == 3 * 86400 + 12 * 3600
    assert parse_time_to_seconds("12:00:00") == 12 * 3600
    assert parse_time_to_seconds("garbage") is None


def test_mem_parsing_variants():
    assert parse_mem_to_mb("500G") == 500 * 1024
    assert parse_mem_to_mb("128000M") == 128000
    assert parse_mem_to_mb("2T") == 2 * 1024 * 1024
    assert parse_mem_to_mb("4096") == 4096   # default M
    assert parse_mem_to_mb("xxx") is None


def test_gres_parsing():
    assert parse_gres_gpus("gpu:2") == 2
    assert parse_gres_gpus("gpu:a100:4") == 4
    assert parse_gres_gpus("gpu:b200:8") == 8
    assert parse_gpu_type("gpu:a100:4") == "a100"
    assert parse_gpu_type("gpu:8") is None


def test_full_sbatch_parse():
    sbatch = """\
#!/bin/bash
#SBATCH --partition=dgx-b200
#SBATCH --gres=gpu:2
#SBATCH --cpus-per-task=128
#SBATCH --mem=500G
#SBATCH --time=7-00:00:00
#SBATCH -J test
echo "running"
echo "done"
"""
    req = parse_sbatch(sbatch)
    assert req.partition == "dgx-b200"
    assert req.gpus == 2
    assert req.cpus_per_task == 128
    assert req.mem_mb == 500 * 1024
    assert req.time_seconds == 7 * 86400
    assert req.directives["--job-name"] == "test"  # -J alias resolved
    assert req.body_lines == 2
    assert req.parse_errors == []  # has shebang


def test_sbatch_after_command_is_flagged():
    sbatch = """\
#!/bin/bash
#SBATCH --partition=dgx-b200
echo "go"
#SBATCH --gres=gpu:1
"""
    req = parse_sbatch(sbatch)
    assert any("after first command" in e for e in req.parse_errors)
    assert "--gres" not in req.directives


def test_missing_shebang_warned():
    req = parse_sbatch("#SBATCH --partition=dgx-b200\necho hi\n")
    assert any("shebang" in e for e in req.parse_errors)
