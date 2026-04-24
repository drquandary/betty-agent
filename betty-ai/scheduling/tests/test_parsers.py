"""Parser contract tests against synthetic fixtures.

Each parser has two kinds of tests:
  1. Shape — the record count and field types match expectations.
  2. Semantics — specific values are extracted correctly from known inputs.

Runnable with stdlib alone:
    python -m unittest discover -v -s betty-ai/scheduling/tests
"""
from __future__ import annotations

import unittest
from datetime import datetime, timezone
from pathlib import Path

from scheduling.parsers import (
    parse_sacct,
    parse_scontrol_nodes,
    parse_scontrol_res,
    parse_sinfo,
    parse_slurm_duration,
    parse_slurm_timestamp,
    parse_tres,
    tres_cpu_count,
    tres_gpu_count,
    tres_mem_mb,
    tres_node_count,
)

FIXTURE_DIR = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic"


# ---------------------------------------------------------------------------
# Primitive helpers
# ---------------------------------------------------------------------------

class TestPrimitives(unittest.TestCase):
    def test_duration_days(self):
        self.assertEqual(parse_slurm_duration("7-00:00:00"), 604800.0)
        self.assertEqual(parse_slurm_duration("1-12:30:45"), 86400 + 12 * 3600 + 30 * 60 + 45)

    def test_duration_hms(self):
        self.assertEqual(parse_slurm_duration("01:30:00"), 5400.0)
        self.assertEqual(parse_slurm_duration("00:00:30"), 30.0)

    def test_duration_ms(self):
        self.assertEqual(parse_slurm_duration("05:00"), 300.0)

    def test_duration_sentinels(self):
        for s in (None, "", "UNLIMITED", "Partition_Limit", "Unknown", "INVALID"):
            self.assertIsNone(parse_slurm_duration(s), f"expected None for {s!r}")

    def test_duration_malformed(self):
        self.assertIsNone(parse_slurm_duration("nonsense"))
        self.assertIsNone(parse_slurm_duration("99:99:99:99"))

    def test_timestamp_valid(self):
        ts = parse_slurm_timestamp("2026-04-18T09:00:00")
        self.assertIsNotNone(ts)
        # Converted to UTC — April (EDT, UTC-4) so 09:00 ET == 13:00 UTC
        self.assertEqual(ts.astimezone(timezone.utc).hour, 13)

    def test_timestamp_sentinels(self):
        for s in (None, "", "Unknown", "None", "N/A", "(null)"):
            self.assertIsNone(parse_slurm_timestamp(s), f"expected None for {s!r}")

    def test_timestamp_malformed(self):
        self.assertIsNone(parse_slurm_timestamp("not-a-date"))

    def test_tres_normal(self):
        t = parse_tres("billing=1920,cpu=96,gres/gpu=8,mem=1920000M,node=1")
        self.assertEqual(t["cpu"], "96")
        self.assertEqual(t["gres/gpu"], "8")
        self.assertEqual(t["mem"], "1920000M")

    def test_tres_typed_gpu(self):
        t = parse_tres("cpu=28,gres/gpu=1,gres/gpu:B200=1,mem=257500M")
        # Typed takes precedence
        self.assertEqual(tres_gpu_count(t), 1)

    def test_tres_empty(self):
        self.assertEqual(parse_tres(""), {})
        self.assertEqual(parse_tres(None), {})
        self.assertEqual(parse_tres("(null)"), {})

    def test_tres_cpu_node(self):
        t = parse_tres("cpu=96,node=2")
        self.assertEqual(tres_cpu_count(t), 96)
        self.assertEqual(tres_node_count(t), 2)

    def test_tres_mem_units(self):
        self.assertEqual(tres_mem_mb(parse_tres("mem=2048")), 2048)
        self.assertEqual(tres_mem_mb(parse_tres("mem=2048M")), 2048)
        self.assertEqual(tres_mem_mb(parse_tres("mem=2G")), 2048)


# ---------------------------------------------------------------------------
# sinfo
# ---------------------------------------------------------------------------

class TestSinfoParser(unittest.TestCase):
    def setUp(self):
        self.text = (FIXTURE_DIR / "sinfo-202604241800.log").read_text()

    def test_row_count(self):
        rows, counters = parse_sinfo(self.text)
        # 11 data rows in the fixture
        self.assertEqual(len(rows), 11)
        self.assertEqual(counters.rows_ok, 11)
        self.assertEqual(counters.rows_dropped_malformed, 0)

    def test_default_partition_flag(self):
        rows, _ = parse_sinfo(self.text)
        dgx = [r for r in rows if r.partition == "dgx-b200"]
        self.assertTrue(all(r.partition_default for r in dgx),
                        "dgx-b200 rows should all be flagged as default (trailing *)")
        mig = [r for r in rows if r.partition == "b200-mig45"]
        self.assertTrue(all(not r.partition_default for r in mig))

    def test_nodes_parsed(self):
        rows, _ = parse_sinfo(self.text)
        by_state = {(r.partition, r.state): r.nodes for r in rows}
        self.assertEqual(by_state[("dgx-b200", "down*")], 3)
        self.assertEqual(by_state[("dgx-b200", "mix")], 22)


# ---------------------------------------------------------------------------
# scontrol show reservation
# ---------------------------------------------------------------------------

class TestReservationParser(unittest.TestCase):
    def setUp(self):
        self.text = (FIXTURE_DIR / "scontrol-show-res-202604241800.log").read_text()

    def test_reservation_count(self):
        res, counters = parse_scontrol_res(self.text)
        self.assertEqual(len(res), 2)
        self.assertEqual(counters.rows_ok, 2)

    def test_first_reservation_fields(self):
        res, _ = parse_scontrol_res(self.text)
        maint = res[0]
        self.assertEqual(maint.name, "maint_20260501")
        self.assertEqual(maint.node_count, 27)
        self.assertEqual(maint.partition, "dgx-b200")
        self.assertIn("MAINT", maint.flags)
        self.assertIn("IGNORE_JOBS", maint.flags)
        self.assertEqual(maint.state, "INACTIVE")

    def test_users_list(self):
        res, _ = parse_scontrol_res(self.text)
        maint = res[0]
        self.assertEqual(sorted(maint.users), ["root", "slurm"])


# ---------------------------------------------------------------------------
# scontrol show nodes -o
# ---------------------------------------------------------------------------

class TestNodesParser(unittest.TestCase):
    def setUp(self):
        self.text = (FIXTURE_DIR / "scontrol-show-nodes-202604241800.log").read_text()

    def test_node_count(self):
        nodes, counters = parse_scontrol_nodes(self.text)
        self.assertEqual(len(nodes), 4)
        self.assertEqual(counters.rows_ok, 4)

    def test_gpu_extraction(self):
        nodes, _ = parse_scontrol_nodes(self.text)
        by_name = {n.name: n for n in nodes}
        dgx001 = by_name["dgx001"]
        self.assertEqual(dgx001.gpus_total, 8)
        self.assertEqual(dgx001.gpus_alloc, 4)
        self.assertEqual(dgx001.gpus_free(), 4)
        # genoa has no GPUs
        genoa = by_name["genoa001"]
        self.assertIsNone(genoa.gpus_total)

    def test_partitions_multiple(self):
        nodes, _ = parse_scontrol_nodes(self.text)
        by_name = {n.name: n for n in nodes}
        self.assertEqual(by_name["dgx001"].partitions, ["dgx-b200"])
        self.assertEqual(by_name["genoa001"].partitions, ["genoa-std-mem"])

    def test_down_node_reason(self):
        nodes, _ = parse_scontrol_nodes(self.text)
        by_name = {n.name: n for n in nodes}
        self.assertEqual(by_name["dgx015"].state, "DOWN")
        self.assertEqual(by_name["dgx015"].reason, "NHC_failure")


# ---------------------------------------------------------------------------
# sacct --parsable2
# ---------------------------------------------------------------------------

class TestSacctParser(unittest.TestCase):
    def setUp(self):
        self.text = (FIXTURE_DIR / "sacct-week-202604241800.tsv").read_text()

    def test_row_count(self):
        jobs, counters = parse_sacct(self.text)
        # 53 data rows in the fixture
        self.assertEqual(len(jobs), 53)
        self.assertEqual(counters.rows_dropped_step, 0)
        self.assertEqual(counters.rows_dropped_malformed, 0)

    def test_pending_jobs_parsed_with_null_times(self):
        jobs, _ = parse_sacct(self.text)
        pending = [j for j in jobs if j.state.startswith("PENDING")]
        self.assertGreaterEqual(len(pending), 1)
        self.assertIsNone(pending[0].start_ts)
        self.assertIsNone(pending[0].end_ts)

    def test_state_bucket(self):
        jobs, _ = parse_sacct(self.text)
        buckets = {}
        for j in jobs:
            buckets.setdefault(j.state_bucket(), 0)
            buckets[j.state_bucket()] += 1
        self.assertGreater(buckets.get("COMPLETED", 0), 0)
        self.assertGreater(buckets.get("FAILED", 0), 0)
        self.assertGreater(buckets.get("CANCELLED", 0), 0)
        self.assertGreater(buckets.get("PENDING", 0), 0)

    def test_queue_wait_positive(self):
        jobs, _ = parse_sacct(self.text)
        # First job in fixture has eligible=09:00:00, start=09:00:30 → 30s
        by_id = {j.job_id: j for j in jobs}
        self.assertEqual(by_id["5400001"].queue_wait_sec(), 30.0)

    def test_queue_wait_none_when_pending(self):
        jobs, _ = parse_sacct(self.text)
        by_id = {j.job_id: j for j in jobs}
        # Job 5400020 is PENDING with Unknown start
        self.assertIsNone(by_id["5400020"].queue_wait_sec())

    def test_tres_parsed(self):
        jobs, _ = parse_sacct(self.text)
        by_id = {j.job_id: j for j in jobs}
        j = by_id["5400002"]  # 8-GPU job
        self.assertEqual(tres_gpu_count(j.alloc_tres), 8)
        self.assertEqual(tres_cpu_count(j.alloc_tres), 224)
        self.assertEqual(tres_node_count(j.alloc_tres), 1)

    def test_cancelled_with_reason(self):
        jobs, _ = parse_sacct(self.text)
        by_id = {j.job_id: j for j in jobs}
        j = by_id["5400008"]
        # state is "CANCELLED by 12345" — bucket should still collapse to CANCELLED
        self.assertEqual(j.state_bucket(), "CANCELLED")


if __name__ == "__main__":
    unittest.main()
