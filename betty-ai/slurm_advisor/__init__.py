"""Betty SLURM advisor — sbatch checker, recommender, pending-job diagnostics.

Layered like `scheduling/`: pure Python in here, no LLM math. The agent calls
into `cli.py` and consumes structured JSON.

Modules:
- `parser`     — read `#SBATCH` directives out of an sbatch script
- `policy`     — load cluster constraints from `configs/betty_cluster.yaml`
- `solver`     — MiniZinc model for picking partition/cpus/mem/time;
                 falls back to a deterministic Python search if MiniZinc isn't
                 installed (so dev laptops can run unit tests)
- `recommender`— top-level entry: `check`, `recommend`, `diagnose_pending`
- `availability` — produce calendar slots for a desired GPU+wall request
- `cli`        — JSON-emitting CLI invoked by the agent's slurm_* tools
"""

SCHEMA_VERSION = 1
