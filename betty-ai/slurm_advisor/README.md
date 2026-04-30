# `slurm_advisor` — Python brain for the Betty SLURM Advisor

This package is one half of the Betty SLURM Advisor; the other half is the
TypeScript agent tools at [`betty-ai-web/src/agent/tools/slurm-*.ts`](../../betty-ai-web/src/agent/tools/).

## What this is

A constraint-based, MiniZinc-backed recommendation engine for SLURM jobs on
the Betty cluster. Researchers describe their workload in plain language;
the advisor produces a runnable `#SBATCH` block that respects every
applicable cluster policy.

The Python side does all the math (constraint solving, policy validation,
slot ranking, priority decomposition). The LLM agent never does arithmetic
— it picks tools and phrases responses.

## Layout

```
slurm_advisor/
├── parser.py         # sbatch parser (#SBATCH directives, time/mem units)
├── policy.py         # cluster constraints from betty_cluster.yaml
├── solver.py         # MiniZinc model + Python fallback for slurm_recommend
├── recommender.py    # check / recommend / diagnose orchestrators
├── availability.py   # time-slot ranker for slurm_availability
├── cli.py            # JSON-emitting CLI invoked by the TS tools
├── scripts/
│   └── seed_dev_load_curves.py    # dev-mode historical curve generator
└── tests/
    ├── test_parser.py
    ├── test_recommender.py
    ├── test_availability.py
    ├── test_load_curve.py
    └── test_scenarios.py          # 82-case scenario matrix
```

## Where to read more

| Doc | What it covers |
|---|---|
| [`BETTY_SLURM_ADVISOR_REPORT.md`](../../BETTY_SLURM_ADVISOR_REPORT.md) | Full architecture, design objectives + acceptance criteria, open policy questions, safety contracts, future work |
| [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../../BETTY_SLURM_ADVISOR_TEST_PLAN.md) | Test strategy, dimensions, persona suite, quality criteria |
| [`wiki/concepts/slurm-state-dimensionality.md`](../../wiki/concepts/slurm-state-dimensionality.md) | TRES model + Betty's live coverage matrix |
| [`raw/docs/2026-04-27-test-results.md`](../../raw/docs/2026-04-27-test-results.md) | Most recent scenario matrix run with per-dimension scoreboard |

## Run the tests

```bash
cd betty-ai
python3 -m pytest slurm_advisor/tests/ -v
```

Expected: 110 tests passing. Total project test count (Python + TS) is 128.

## Key dependencies

- **Python ≥ 3.9** with `pyyaml` and `pytest`.
- **MiniZinc 2.9.6+** with at least one of: `gecode`, `cbc`. The Python
  package falls back to a deterministic enumerate-and-rank when MiniZinc
  isn't available; same answers for our 5-partition setup.
- See the main report's §3.3 for solver registration notes.
