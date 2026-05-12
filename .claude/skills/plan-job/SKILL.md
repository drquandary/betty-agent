---
name: plan-job
description: Plan a Slurm job submission for Betty — capture intent, recommend a job shape, validate against Ryan's slurm-cli-filter, and if rejected propose the nearest legal request using the reverse CLI filter. Emits a runnable #SBATCH block and a plan.md. Triggers — user says "plan a job", "/plan-job", "help me submit", "what should I sbatch", "is this sbatch legal", "fix my sbatch", "reverse cli filter".
---

# /plan-job — Reverse CLI filter demo for Betty Agent

This skill takes a researcher's job intent and produces a filter-clean `#SBATCH`
block. It abides by Ryan's `slurm-cli-filter.py` as the single source of truth
for legality, and uses the reverse filter to project illegal requests onto the
nearest legal request — "did you mean …?" instead of plain rejection.

## When to invoke

User says any of: "plan a job", "submit a job", "what should I ask for",
"is this legal", "fix my sbatch", "/plan-job", "reverse cli filter",
"plan-job" — or hands over an sbatch script and asks if it'll pass.

## Pipeline

1. **Capture intent** (skip questions whose answer is already in the user's message):
   - partition (default `dgx-b200` if user mentions GPUs, `genoa-std-mem` otherwise)
   - gpus (total)
   - nodes (default 1)
   - hours / walltime
   - memory feel (rough — Ryan's filter derives it from gpus)
   - any extra knobs they already typed (`--gres`, `--ntasks`, `--cpus-per-task`)
2. **Forward filter + render** — call the all-in-one `plan` verb:
   ```bash
   cd betty-ai && python3 -m slurm_advisor.cli plan \
       --partition <p> --gpus <g> --hours <h> \
       [--nodes N --cpus C --memory M ...] [--out plan.md]
   ```
   The `plan` verb runs the forward filter first; if `status: ok`, renders a
   ready-to-submit plan. If illegal, it renders the reverse-filter diff with
   the nearest-legal candidate's `#SBATCH` block. Use `--out plan.md` to save.
   For the raw JSON instead of markdown, use the `reverse` verb.
3. **Reverse pass** — if `status: error` or `status: junction`, the same call
   already returns ranked nearest-legal candidates plus Ryan's own junction
   branches when present.
4. **Re-validate** — the candidates come pre-validated by Ryan's kernel
   (oracle = his code). Show the diff between original and chosen candidate,
   plus the Reason code that fired so the user learns the rule.
5. **Emit** — write a runnable `#SBATCH` block based on the chosen candidate's
   `set` block. Optionally save a `plan.md` summarising:
   - original request
   - Reason code (with plain-English explanation if available)
   - chosen candidate + diff
   - final sbatch
   - footer: "validated by `slurm-cli-filter.py` ✓"

## Required env

Point at Ryan's filter once per shell:

```bash
export PARCC_CLI_FILTER=~/Downloads/parcc-docs-ops-ux-filter-analyze/ops/ux/filter/slurm-cli-filter.py
```

On Betty itself, point it at the deployed copy.

## Output contract

The CLI returns a single JSON object. Parse and present as:

- **Legal** path: paste the runnable `#SBATCH` block, note the partition shape.
- **Illegal** path: show
  1. the Reason code + message from Ryan's filter,
  2. the top candidate's `(partition, gpus, cpus, memory, nodes)` plus the diff,
  3. the `#SBATCH` block from the candidate's `set` directives,
  4. up to two alternates if `max_candidates > 1`.

## Anti-hallucination

- Never invent constraint rules. The legality oracle is **always** Ryan's
  `slurm-cli-filter.py`, called as a subprocess by `slurm_advisor.cli reverse`.
- The MiniZinc model at `betty-ai/slurm_advisor/reverse.mzn` mirrors the same
  constraints declaratively (labeled by Reason code). Use it for documentation
  or larger search regions, but the *truth* is always Ryan's kernel.
- The fuzz test in `betty-ai/slurm_advisor/tests/test_reverse.py` asserts the
  two stay in agreement.

## Example session

```
User: plan a job — 5 GPUs on dgx-b200, 4 hours
Agent: $ python3 -m slurm_advisor.cli reverse --partition dgx-b200 --gpus 5
{ "forward": { "status": "error", "code": "GPUS_NODES_INDIVISIBLE", ... },
  "candidates": [ { "request": {"partition":"dgx-b200","gpus":4}, "distance": 2 },
                  { "request": {"partition":"dgx-b200","gpus":8}, "distance": 6 } ] }

→ 5 GPUs on dgx-b200 doesn't divide cleanly across nodes (Reason:
  GPUS_NODES_INDIVISIBLE). Nearest legal request: 4 GPUs.

#SBATCH --partition=dgx-b200
#SBATCH --gpus=4
#SBATCH --cpus-per-task=28
#SBATCH --mem=224G
#SBATCH --time=04:00:00
# validated by slurm-cli-filter.py ✓
```

## Related files

- Logic: `betty-ai/slurm_advisor/reverse.py`
- MiniZinc constraint model: `betty-ai/slurm_advisor/reverse.mzn`
- CLI verb: `betty-ai/slurm_advisor/cli.py` (`reverse` subcommand)
- Forward filter (Ryan's): `$PARCC_CLI_FILTER` →
  `parcc-docs-ops-ux-filter-analyze/ops/ux/filter/slurm-cli-filter.py`
- Fuzz test: `betty-ai/slurm_advisor/tests/test_reverse.py`
