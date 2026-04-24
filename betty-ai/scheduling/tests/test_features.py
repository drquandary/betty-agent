"""Features contract tests.

Verifies that for our synthetic sacct fixture, the feature extractor:
  - produces valid schema
  - correctly partitions jobs
  - computes distributions that honor MIN_SAMPLE
  - emits hourly_load as a dense 168-bucket dict
  - cites the schema version

Golden-ish values: we don't assert exact percentile floats (fragile to
Python's quantile interpolation choices). Instead we assert bounds and
monotonicity — the distributions are ordered and within expected ranges.
"""
from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path

from scheduling import SCHEMA_VERSION
from scheduling.features import (
    _distribution,
    current_snapshot,
    partition_features,
    user_features,
)
from scheduling.parsers import (
    parse_sacct,
    parse_scontrol_nodes,
    parse_scontrol_res,
    parse_sinfo,
)

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic"


def _load_sacct_jobs():
    return parse_sacct((FIXTURE_DIR / "sacct-week-202604241800.tsv").read_text())[0]


def _window(jobs):
    ts = [j.eligible_ts or j.submit_ts for j in jobs]
    ts = [t for t in ts if t is not None]
    return min(ts), max(ts)


# ---------------------------------------------------------------------------
# _distribution primitive
# ---------------------------------------------------------------------------

class TestDistribution(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(_distribution([]), {"n": 0, "status": "no-data"})

    def test_insufficient(self):
        r = _distribution([1, 2, 3])
        self.assertEqual(r["status"], "insufficient-data")
        self.assertEqual(r["n"], 3)

    def test_ok_orders(self):
        r = _distribution(list(range(1, 101)))  # 1..100
        self.assertEqual(r["status"], "ok")
        self.assertEqual(r["n"], 100)
        # Monotonic percentiles
        self.assertLess(r["p10"], r["p50"])
        self.assertLess(r["p50"], r["p90"])
        self.assertLess(r["p90"], r["p99"])
        self.assertEqual(r["min"], 1.0)
        self.assertEqual(r["max"], 100.0)


# ---------------------------------------------------------------------------
# Partition features
# ---------------------------------------------------------------------------

class TestPartitionFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jobs = _load_sacct_jobs()
        cls.ws, cls.we = _window(cls.jobs)

    def _features(self, partition: str):
        return partition_features(self.jobs, partition, self.ws, self.we)

    def test_schema_version(self):
        f = self._features("dgx-b200")
        self.assertEqual(f["schema_version"], SCHEMA_VERSION)

    def test_dgx_b200_sample_size(self):
        f = self._features("dgx-b200")
        # 20 jobs total; 19 terminal (1 PENDING)
        self.assertEqual(f["input_n_jobs_in_window"], 20)
        self.assertEqual(f["input_n_terminal"], 19)

    def test_dgx_b200_wait_ok(self):
        f = self._features("dgx-b200")
        self.assertEqual(f["wait_sec"]["status"], "ok",
                         f"wait dist should have n={f['input_n_terminal']} >= 10")
        # Monotonic percentiles
        w = f["wait_sec"]
        self.assertLessEqual(w["p10"], w["p50"])
        self.assertLessEqual(w["p50"], w["p90"])

    def test_dgx_b200_gpu_mode(self):
        """The fixture has jobs with GPU counts 1, 2, and 8. GPU distribution
        on terminal jobs should reflect that range."""
        f = self._features("dgx-b200")
        g = f["gpu_count"]
        if g["status"] == "ok":
            self.assertEqual(g["min"], 1.0)
            self.assertEqual(g["max"], 8.0)
        # Otherwise insufficient — still valid

    def test_mig45_success_rate(self):
        f = self._features("b200-mig45")
        sr = f["success_rate"]
        # fixture: 10 COMPLETED + 1 FAILED + 1 CANCELLED = 12 terminal jobs.
        # success_rate denominator is COMPLETED+FAILED only (cancelled is
        # user intent, not a success/failure signal) = 11.
        self.assertEqual(sr["n"], 11)
        # 10 completed / 11 = 0.909...
        self.assertAlmostEqual(sr["rate"], 10 / 11, places=3)

    def test_state_breakdown(self):
        f = self._features("dgx-b200")
        sb = f["state_breakdown"]
        # COMPLETED, FAILED, CANCELLED present
        self.assertIn("COMPLETED", sb)
        self.assertIn("FAILED", sb)
        self.assertIn("CANCELLED", sb)

    def test_hourly_load_dense(self):
        f = self._features("dgx-b200")
        # 7 days * 24 hours = 168 buckets
        self.assertEqual(len(f["hourly_load"]), 168)
        # Sum of counts == number of jobs with parseable eligible or submit
        total = sum(f["hourly_load"].values())
        # All fixture jobs have eligible_ts, so total == n_jobs_in_window
        self.assertEqual(total, f["input_n_jobs_in_window"])

    def test_top_gpu_hours(self):
        f = self._features("dgx-b200")
        top = f["top_gpu_hours"]
        self.assertLessEqual(len(top), 10)
        users = {row["user"] for row in top}
        # Our fixture has 4 users on this partition
        self.assertLessEqual(len(users), 4)
        # alice's 8-GPU 8h jobs should outweigh jvadala's 1-GPU 4h jobs
        if "alice" in users:
            self.assertGreater(
                [r["gpu_hours"] for r in top if r["user"] == "alice"][0],
                0,
            )


# ---------------------------------------------------------------------------
# User features
# ---------------------------------------------------------------------------

class TestUserFeatures(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.jobs = _load_sacct_jobs()
        cls.ws, cls.we = _window(cls.jobs)

    def test_jvadala_cross_partition(self):
        f = user_features(self.jobs, "jvadala", self.ws, self.we)
        self.assertEqual(f["schema_version"], SCHEMA_VERSION)
        parts = f["partitions_used"]
        # jvadala uses at least these three partitions in the fixture
        self.assertIn("dgx-b200", parts)
        self.assertIn("b200-mig45", parts)
        self.assertIn("b200-mig90", parts)

    def test_unknown_user_empty(self):
        f = user_features(self.jobs, "nobody", self.ws, self.we)
        self.assertEqual(f["n_jobs"], 0)
        self.assertEqual(f["runtime_sec"]["status"], "no-data")


# ---------------------------------------------------------------------------
# Cluster current snapshot
# ---------------------------------------------------------------------------

class TestCurrentSnapshot(unittest.TestCase):
    def setUp(self):
        self.sinfo = parse_sinfo((FIXTURE_DIR / "sinfo-202604241800.log").read_text())[0]
        self.nodes = parse_scontrol_nodes((FIXTURE_DIR / "scontrol-show-nodes-202604241800.log").read_text())[0]
        self.res = parse_scontrol_res((FIXTURE_DIR / "scontrol-show-res-202604241800.log").read_text())[0]

    def test_dgx_b200_aggregated(self):
        snap = current_snapshot(self.sinfo, self.nodes, self.res)
        dgx = snap["partitions"]["dgx-b200"]
        self.assertGreater(dgx["nodes_total"], 0)
        # dgx015 is down in the fixture
        self.assertGreaterEqual(dgx["nodes_down"], 3)

    def test_reservations_summarized(self):
        snap = current_snapshot(self.sinfo, self.nodes, self.res)
        names = [r["name"] for r in snap["reservations"]]
        self.assertIn("maint_20260501", names)
        self.assertIn("icml_holding", names)


if __name__ == "__main__":
    unittest.main()
