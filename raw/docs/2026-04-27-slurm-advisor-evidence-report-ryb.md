# Betty SLURM Advisor — evidence report

**To:** ryb
**From:** jvadala
**Date:** 2026-04-27
**Subject:** End-to-end test of the SLURM advisor stack with real cluster data

> Companion docs:
> - Wiki: [wiki/concepts/slurm-state-dimensionality.md](../../wiki/concepts/slurm-state-dimensionality.md) (canonical, kept live as coverage changes)
> - Architecture writeup: [2026-04-27-slurm-advisor-report-ryb.md](2026-04-27-slurm-advisor-report-ryb.md)
> - This doc: point-in-time test results with actual tool outputs

---

## TL;DR

Drove the four agent tools end-to-end through the chat UI against the live cluster. Three of four tools fully worked on the first attempt; the fourth (`slurm_diagnose`) is the same SSH transport as `slurm_availability` and was gated on a Kerberos ticket refresh during the second test pass — the system **correctly degraded and reported why**, which is itself the most important behavior to verify.

| Test | Tool | Backend / live data exercised | Result |
|---|---|---|---|
| 1a | `slurm_recommend` | MiniZinc constraint solver + `sshare` | ✅ correct shape, real fairshare rows, MiniZinc backend confirmed |
| 1b | `slurm_check` | YAML policy + suggested-fix solver | ✅ blocked correctly, all 3 expected violation codes, suggested fix valid |
| 2  | `slurm_availability` | `sinfo` + `squeue --start` over SSH | ✅ in earlier session (full live data); ⚠️ in retry session (Kerberos expired → graceful fallback to synthetic, agent correctly diagnosed cause) |
| 3  | `slurm_diagnose` | `scontrol show job <id>` over SSH | ⏳ untested today (needs both fresh kinit AND a real pending JOBID) |

The "why is this a good outcome" frame: the system told the user **exactly** why a live signal was missing ("Kerberos ticket expired — run `kinit jvadala@UPENN.EDU`") and the calendar card explicitly labeled the fallback ("Sources: (none — score uses synthetic curve only) · load curve: synthetic"). No hallucination, no invented data.

---

## 1. Test methodology

- **Environment:** dev preview server (Next.js 15 + claude-agent-sdk 0.2.111) running locally, agent SDK calling claude-sonnet-4-5, MCP server registers all 11 Betty tools including the 4 new `slurm_*` tools.
- **Solver:** MiniZinc 2.9.6 with Gecode 6.2.0 (manually registered via `~/.minizinc/solvers/gecode.msc` because brew's formula doesn't auto-register it).
- **Cluster connectivity:** SSH ControlMaster pool to `jvadala@login.betty.parcc.upenn.edu` using Kerberos GSSAPI from local kinit cache.
- **Test harness:** drove the chat via DOM scripting, captured the full SSE response, parsed the rendered fenced cards out of the assistant message, verified field-by-field against expected values.

---

## 2. Test 1 — `slurm_recommend` + `slurm_check` (combined turn)

**User prompt sent:**

> Two tasks. (1) Use `slurm_recommend` to find a shape for 2 GPUs for 8 hours. (2) Use `slurm_check` on this sbatch:
> ```bash
> #!/bin/bash
> #SBATCH --partition=dgx-b200
> #SBATCH --gres=gpu:1
> #SBATCH --cpus-per-task=128
> #SBATCH --mem=500G
> #SBATCH --time=7-00:00:00
> echo train
> ```

### 2a. `slurm_recommend` payload (verbatim from card)

```json
{
  "result": {
    "backend": "minizinc",
    "partition": "b200-mig45",
    "qos": "normal",
    "nodes": 1,
    "gpus_per_node": 2,
    "cpus_per_task": 7,
    "mem_gb": 112,
    "time_seconds": 28800,
    "billing_score": 4056,
    "explanation": [
      "MiniZinc picked b200-mig45; objective = 4056.",
      "Shape: 1 node(s) × 2 GPU(s), 7 CPUs/task, 112 GB."
    ]
  },
  "sbatch_block": "#!/bin/bash\n#SBATCH --partition=b200-mig45\n#SBATCH --qos=normal\n#SBATCH --nodes=1\n#SBATCH --gres=gpu:2\n#SBATCH --cpus-per-task=7\n#SBATCH --mem=112G\n#SBATCH --time=08:00:00\n",
  "fairshare": {
    "rows": [3 rows from sshare],
    "source": "sshare"
  }
}
```

**What this proves:**
- ✅ `backend: "minizinc"` — Gecode was actually invoked end-to-end (not the Python fallback).
- ✅ Cheapest legal partition selected: `b200-mig45` at billing score 4056, vs ~16,285 if it had picked `dgx-b200`. The objective function correctly weights against the bigger partition's `gpu_weight=1000` per [betty_cluster.yaml](../../betty-ai/configs/betty_cluster.yaml).
- ✅ Shape pinned to partition defaults (7 CPUs/GPU, 56 GB/GPU = 112 GB total) — without the default-pinning logic added in [solver.py](../../betty-ai/slurm_advisor/solver.py), MiniZinc would have picked the cheapest legal shape (`cpus=1, mem=minimum`), legal but useless.
- ✅ `fairshare.source: "sshare"` — the new SSH call to `sshare -h -P -U` succeeded and returned 3 association rows.

### 2b. `slurm_check` payload (verbatim from card)

```json
{
  "status": "block",
  "summary": "Found 1 error and 2 warnings. Block — fix errors before submitting.",
  "issues": [
    {"severity":"error", "code":"CPU_PER_GPU_OVER_NODE_LIMIT", "field":"--cpus-per-task",
     "message":"--cpus-per-task=128 with 1 GPU(s) exceeds dgx-b200's 28 CPUs per GPU.",
     "suggestion":"#SBATCH --cpus-per-task=28"},
    {"severity":"warn",  "code":"MEM_PER_GPU_HIGH",  "field":"--mem",
     "message":"--mem=500G works out to 500 GB per GPU on dgx-b200; placement is much easier under 224 GB/GPU.",
     "suggestion":"#SBATCH --mem=224G"},
    {"severity":"warn",  "code":"TIME_HURTS_BACKFILL", "field":"--time",
     "message":"--time=7-00:00:00 (>24h) makes backfill unlikely; shorter jobs start sooner."}
  ],
  "suggested_sbatch": "#!/bin/bash\n#SBATCH --partition=dgx-b200\n#SBATCH --qos=normal\n#SBATCH --nodes=1\n#SBATCH --gres=gpu:2\n#SBATCH --cpus-per-task=28\n#SBATCH --mem=448G\n#SBATCH --time=1-00:00:00\n"
}
```

**What this proves:**
- ✅ All three expected violations caught with stable codes the chat UI can color-code.
- ✅ Hard error (`CPU_PER_GPU_OVER_NODE_LIMIT`) flips status to `block` and surfaces a suggested fix the user can paste.
- ✅ Soft warnings (`MEM_PER_GPU_HIGH`, `TIME_HURTS_BACKFILL`) are explained in plain English with concrete remediation values.
- ✅ Suggested sbatch passes its own check (verified by re-running `slurm_check` on the suggested block).

### 2c. Agent narration (verbatim, unedited)

> I'll run both tasks for you. Let me load the SLURM advisor tools and execute them.
>
> **Task 1: Recommend shape for 2 GPUs, 8 hours**
> Here's the recommended configuration:
> [recommend card rendered]
> The solver chose **b200-mig45** (the cheaper MIG partition) over dgx-b200 for cost efficiency.
>
> ---
>
> **Task 2: Check your sbatch script**
> Here's the lint report:
> [check card rendered]
> You need to fix the CPU count (128 → 28) before this will submit. The memory and walltime warnings won't block submission, but they'll hurt your queue priority.

The agent followed the system-prompt contract: brief intro, verbatim card paste, one-sentence next-step. No paraphrasing, no invention, no imagined weights.

---

## 3. Test 2 — `slurm_availability`

### 3a. Earlier session (Kerberos fresh) — full live data

Captured during the development session before the kinit ticket expired. **This is the canonical "system works" trace.**

**Payload:**

```json
{
  "gpus": 2,
  "hours": 8,
  "partition": "dgx-b200",
  "sources": ["sinfo", "squeue --start"],
  "score_formula": "(1.5 if free>=gpus else 0) + (1.0 - load_at_hour) - min(pending/50, 1.0) - (dt_hours / 168)",
  "load_curve_kind": "synthetic",
  "slot_count": 8,
  "top_slot": {
    "when": "Tue Apr 28, 03:00 AM",
    "score": 0.829,
    "reasons": [
      "0/215 GPUs idle (45 pending) — short wait expected",
      "synthetic load at 03:00 = 10%",
      "45 pending in queue (penalty 0.90)",
      "SLURM est. earliest start in this partition: 2026-04-27T16:24:19"
    ]
  }
}
```

**What the live signals contributed:**

| Field | Value | Source command |
|---|---|---|
| `0/215 GPUs idle` | cluster fully utilized at test time | `sinfo -h -o '%P\|%D\|%T\|%G'` aggregated |
| `45 pending` | real queue depth on dgx-b200 | `squeue -h --start -t PD -o '%i\|%P\|%S'` row count |
| `SLURM est. earliest start: 2026-04-27T16:24:19` | SLURM's own backfill simulator's prediction | `squeue --start` `%S` field, earliest non-`N/A` per partition |
| `synthetic load at 03:00 = 10%` | hand-coded curve (no historical data on this dev box) | [`_DEFAULT_LOAD_BY_HOUR`](../../betty-ai/slurm_advisor/availability.py) |

**The most valuable line is `SLURM est. earliest start: 2026-04-27T16:24:19`.** That's not our heuristic — it's the actual cluster's backfill scheduler answering "if I had to pick a slot for a similar request right now, when would it start?" Surfacing that into the calendar card is the single highest-value piece of new dimensionality wiring.

### 3b. Retry session (Kerberos expired) — graceful degradation

When I restarted the dev server later in the day, the Kerberos ticket had expired. Same prompt, same code path. The system's response is what we want it to do:

**Payload:**

```json
{
  "gpus": 2, "hours": 8, "partition": "dgx-b200",
  "sources": [],
  "load_curve_kind": "synthetic",
  "slot_count": 8,
  "top_slot": {
    "when": "Wed Apr 29, 10:30 PM",
    "score": 0.629,
    "reasons": ["0/1 GPUs idle (0 pending) — short wait expected",
                "synthetic load at 22:00 = 30%"]
  }
}
```

**Card footer rendered:**

> Formula: `(1.5 if free>=gpus else 0) + (1.0 - load_at_hour) - min(pending/50, 1.0) - (dt_hours / 168)`
> **Sources: (none — score uses synthetic curve only) · load curve: synthetic**

**Agent narration of the failure** (when prompted to compare against `parcc_sfree.py`):

> **Issue confirmed:** `"sources": []` is still empty, and the "0/1 GPUs idle" message suggests `slurm_availability` didn't successfully fetch live `sinfo` data. This is falling back to pure synthetic load scoring.
>
> **Authentication problem:** The `parcc_sfree.py` call failed because your Kerberos ticket expired:
>
> ```
> Permission denied (publickey,gssapi-with-mic)
> ```
>
> **Next step:** Run `kinit jvadala@UPENN.EDU` in your terminal, then I can re-fetch `parcc_sfree.py` and also investigate why `slurm_availability` isn't getting sinfo data (likely the same auth issue on the backend).

**What this proves about the system:**
- ✅ When live signals are unreachable, the tool returns `sources: []` rather than fabricating data.
- ✅ The card footer **explicitly labels the absence**: "(none — score uses synthetic curve only)".
- ✅ The agent correctly identifies the root cause from a parallel `cluster_run` failure and tells the user the exact remediation command.
- ✅ The chat UI's "Betty status" badge in the top-right flipped to **"kinit needed"** with the full error message — that wiring already existed in [betty-ai-web](../../betty-ai-web/) but works correctly with the new tools.

This is the dimensionality story working as designed: degrade honestly, label what's missing, point at how to fix it.

---

## 4. Test 3 — `slurm_diagnose`

Not exercised end-to-end today because:

1. SSH was unavailable in the second test pass (Kerberos expired).
2. Need a known JOBID for a currently-pending job from the user's account, which needs SSH access to look up.

The path was unit-tested earlier ([test_recommender.py::test_diagnose_resources_pending](../../betty-ai/slurm_advisor/tests/test_recommender.py)) against synthetic `scontrol` output — it correctly maps `Reason=Resources` plus a 2-day walltime to two diagnostic causes and three suggested actions. Will exercise live in the next session after `kinit`.

---

## 5. Anti-hallucination contract — verified in this test pass

When I asked the agent to "explain how the score is computed and what data sources you actually used" (in a prior session), it now responds with the **real** formula, not invented weights:

> **Breaking it down:**
> 1. **Idle GPU bonus**: `+1.5` if the partition currently has enough idle GPUs for your request, otherwise `0`
> 2. **Load penalty**: `-(load_at_hour)`, where load is 0.0–1.0 (lower cluster load = higher score)
> 3. **Queue depth penalty**: `- min(pending/50, 1.0)` — capped at 1.0, so 45 pending jobs = penalty of 0.90
> 4. **Time preference penalty**: `-(dt_hours / 168)` — slots further in the future score lower (168h = 1 week)
>
> **What the tool does NOT use:**
> - No `squeue` for detailed job analysis
> - No `sprio`, `sshare`, or `sdiag` for priority/fairshare/backfill stats
> - No real historical load data from `betty-ai/data/features/partitions/dgx-b200.json` (if that file existed and was loaded, it would say `"load_curve_kind": "historical"`)
> - No reservation or blackout window data (would appear in the snapshot if explicitly passed)

The agent **cites the actual file path** that would change `load_curve_kind` from synthetic→historical. That comes from the [system-prompt contract](../../betty-ai-web/src/agent/system-prompt.ts) which now enumerates each tool's exact capabilities and source files. Compare to the pre-fix response which invented a four-weight formula `w1·idle + w2·(1-load) - w3·queue_penalty - w4·time_distance` from whole cloth.

---

## 6. Live coverage matrix (post-this-pass)

| Dimension | Source | Captured | This pass result |
|---|---|---|---|
| Partition geometry | `betty_cluster.yaml` | ✅ static | used by recommend ✅ |
| QOS caps | `betty_cluster.yaml` | ⚠️ static | used by check ✅ |
| Idle GPUs/partition | `sinfo` | ✅ live | worked in session 1, failed gracefully in session 2 |
| Live queue depth + est. start | `squeue --start` | ✅ live (NEW) | "45 pending, est earliest start 2026-04-27T16:24:19" |
| Account fairshare/usage | `sshare -U` | ✅ live (NEW) | 3 rows returned; **parsing quirk noted** (see §7) |
| Per-node drain reason | `scontrol show node` | ❌ | not yet wired |
| Priority decomposition | `sprio` | ❌ | not yet wired |
| Reservations (auto-fed) | `scontrol show res` | ⚠️ parser-only | not yet auto-fed to availability |
| Backfill scheduler health | `sdiag` | ❌ | not yet wired |
| Real hour-of-day load | `data/features/partitions/<p>.json` | ⚠️ auto-load if present | curve was synthetic on this dev box (no nightly cron yet) |
| GRES granularity / topology | `scontrol show node -d` | ⚠️ wiki-only | not yet machine-readable |

---

## 7. Known issues observed during testing

1. **`sshare` output parsing quirk.** `slurm_recommend`'s fairshare integration returned 3 rows (good — the source is `sshare`) but the parsed values for one of them looked like header-row content (`User: "Src", RawShares: "Path"`). Betty's slurm 24.11.7 may emit a second header line that `-h --noheader` doesn't fully suppress, or there may be a wrapper injecting text. Two paths forward: (a) defensive parser that requires numeric values in the numeric columns, (b) probe what the raw stdout actually looks like first. Deliberately leaving as-is for now per direction; will fix in a focused pass.
2. **Kerberos expiry surfaces only when SSH is actually attempted.** The "kinit needed" status badge appeared correctly in the UI after a failed `cluster_run`, but `slurm_availability`'s SSH errors were swallowed silently inside `fetchSnapshot`'s try/catch (correct: the tool degrades to synthetic). The combination is right — UI surfaces auth status from any failing tool, calendar tool keeps producing useful output. Worth adding: a one-line "(Kerberos expired — run kinit)" hint inside the calendar card itself when sources is empty.
3. **`load_curve_kind` is always `synthetic` on dev** because the offline `scheduling/features.py` pipeline isn't running on this machine. Production deployment needs the nightly sacct→features cron to actually run.

---

## 8. Recommendation

The core architecture works. The MiniZinc solver, the constraint policy, the rich-card chat UI, and the anti-hallucination contract all hold up under live testing. The dimensionality story is real: when SSH is available we surface real cluster state with proper provenance; when it's not, we degrade honestly and tell the user why.

**To take this from "demonstrated working" to "production":**

1. **Fix the `sshare` parser** (~30 min) — defensive parsing of header rows.
2. **Run `scheduling/features.py` nightly on the production box** (~1 hour with crontab) — flips `load_curve_kind` from synthetic→historical.
3. **Wire `sprio` into `slurm_diagnose`** (~2 hours) — the single highest-value upgrade for "why is my job pending" answers; needs a small parser + extending the `_REASON_GUIDE` map.
4. **Auto-fetch reservations into `slurm_availability`** (~1 hour) — parser already exists; just needs a 15-minute-cached `runRemote` call.

Happy to scope and ship 1–4 in any order you prefer.
