"""Reverse CLI filter — agreement with Ryan's slurm-cli-filter.py.

These tests are skipped if Ryan's kernel isn't on disk (PARCC_CLI_FILTER unset
and no copy in the dev paths). They are NOT skipped in CI on Betty.

What we test:
1. forward_validate parses Ryan's JSON correctly for ok/error/junction cases.
2. reverse_filter returns legal=True for a known-good request.
3. reverse_filter returns at least one legal candidate for a known-bad request,
   and that candidate passes Ryan's kernel when re-validated.
4. Fuzz pass: for N random requests, every returned candidate is legal per
   Ryan's kernel (oracle agreement).
"""
from __future__ import annotations

import os
import random
from pathlib import Path

import pytest

from slurm_advisor.reverse import (
    JobRequest,
    find_filter_path,
    forward_validate,
    reverse_filter,
)


def _filter_path() -> str | None:
    return find_filter_path()


pytestmark = pytest.mark.skipif(
    _filter_path() is None,
    reason="Ryan's slurm-cli-filter.py not found; set PARCC_CLI_FILTER to enable",
)


def test_forward_validate_known_legal():
    """8 GPUs packed on one dgx-b200 node is canonical-legal."""
    fp = _filter_path()
    req = JobRequest(partition="dgx-b200", nodes=2, gres=8, gpus=16)
    res = forward_validate(req, fp)
    assert res.status == "ok", f"expected ok, got {res.status}: {res.message}"


def test_forward_validate_known_bad_indivisible():
    """5 GPUs on 3 nodes hits GPUS_NODES_INDIVISIBLE."""
    fp = _filter_path()
    req = JobRequest(partition="dgx-b200", nodes=3, gpus=5)
    res = forward_validate(req, fp)
    assert res.status != "ok"
    # Ryan reports GPUS_NODES_INDIVISIBLE for this; accept any rejection code
    # so the test isn't brittle to error-code renames.
    assert res.code is not None


def test_reverse_filter_legal_passes_through():
    """A legal request should round-trip with legal=True and no candidates needed."""
    req = JobRequest(partition="dgx-b200", gpus=8, gres=8, nodes=1)
    result = reverse_filter(req)
    assert result.legal is True
    assert result.forward.status == "ok"


def test_reverse_filter_produces_legal_candidate():
    """An illegal request should produce >=1 candidate that Ryan accepts."""
    fp = _filter_path()
    # nodes=3 with gpus=5 hits GPUS_NODES_INDIVISIBLE (5 doesn't divide 3).
    req = JobRequest(partition="dgx-b200", nodes=3, gpus=5)
    result = reverse_filter(req, filter_path=fp)
    assert result.legal is False
    assert len(result.candidates) >= 1, (
        f"expected >=1 legal candidate, got 0. forward={result.forward.code}"
    )
    # Oracle agreement: every candidate must pass Ryan's kernel.
    for c in result.candidates:
        recheck = forward_validate(c.request, fp)
        assert recheck.status == "ok", (
            f"candidate {c.request} rejected on re-validation: "
            f"{recheck.code} {recheck.message}"
        )


def test_fuzz_oracle_agreement():
    """Randomized requests — every candidate the reverse filter returns must
    be legal per Ryan's kernel. This is the contract that lets the agent
    surface candidates without re-encoding rules.
    """
    fp = _filter_path()
    rng = random.Random(20260512)
    n_checked = 0
    for _ in range(8):
        partition = rng.choice(["dgx-b200", "genoa-std-mem"])
        kwargs = {"partition": partition}
        if partition == "dgx-b200":
            kwargs["gpus"] = rng.randint(1, 9)
            if rng.random() < 0.5:
                kwargs["nodes"] = rng.randint(1, 3)
        else:
            kwargs["cpus"] = rng.randint(1, 70)
        result = reverse_filter(JobRequest(**kwargs), filter_path=fp,
                                max_candidates=3, max_radius=2)
        for c in result.candidates:
            recheck = forward_validate(c.request, fp)
            assert recheck.status == "ok", (
                f"oracle disagreement for {c.request}: {recheck.code}"
            )
            n_checked += 1
    # Sanity: across 8 random requests with radius 2 we should usually find
    # at least one legal candidate. If none — most likely we set the search
    # radius too tight, surface that rather than silently passing.
    assert n_checked > 0, "no candidates produced across fuzz run"
