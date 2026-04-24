"""betty_ai.scheduling — SLURM log ingest + feature extraction.

Runs on Python 3.9+ with standard library only. Used by the scheduling
helper to turn raw Slurm log files into the stable-schema JSON that the
dashboard and the agent read.

See `betty-ai/scheduling/README.md` for the pipeline.
"""

from __future__ import annotations

__version__ = "0.1.0"
SCHEMA_VERSION = 1
