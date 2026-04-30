# Betty SLURM Advisor

**A Constraint-Based Job-Shape Recommendation System for the Penn Advanced Research Computing Center**

| | |
|---|---|
| **Authors** | Penn Advanced Research Computing Center (PARCC) |
| **Cluster** | Betty (`login.betty.parcc.upenn.edu`) |
| **Status** | Working prototype, single-user; 128 tests passing across Python + TS suites; multi-user deployment planned via Open OnDemand |
| **Repository** | [`parcc1/betty-ai-web`](betty-ai-web/), [`parcc1/betty-ai/slurm_advisor`](betty-ai/slurm_advisor/) |
| **Companion docs** | [SLURM dimensionality wiki page](wiki/concepts/slurm-state-dimensionality.md) · [Evidence report](raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md) |

---

## Abstract

The Betty SLURM Advisor is a conversational tool-augmented LLM agent that helps researchers shape and validate SLURM job submissions before they reach the scheduler. It exposes four tools (`slurm_check`, `slurm_recommend`, `slurm_availability`, `slurm_diagnose`) backed by a MiniZinc constraint model, a per-partition policy enforced from a YAML source-of-truth, and live SLURM commands (`sinfo`, `squeue --start`, `sshare`, `scontrol`). The system is explicitly **not** a scheduler — it produces sbatch shapes and time-slot recommendations the user can review, then submits or copies into existing PARCC tooling. This report documents the architecture, implementation, correctness contracts, validation, current limitations, and the planned multi-user deployment as an Open OnDemand Batch Connect application.

---

## Table of contents

1. [Introduction](#1-introduction)
   1. [Motivation](#11-motivation)
   2. [Scope](#12-scope)
   3. [Contributions](#13-contributions)
   4. [**Design objectives (with acceptance criteria)**](#14-design-objectives-with-acceptance-criteria) ← read this if you have 5 minutes
   5. [**Open policy questions affecting design**](#15-open-policy-questions-affecting-design) ← items needing PARCC ops input
2. [Background: SLURM dimensionality](#2-background-slurm-dimensionality)
3. [System architecture](#3-system-architecture)
4. [Tool specifications](#4-tool-specifications)
5. [Safety and correctness contracts](#5-safety-and-correctness-contracts)
6. [Validation](#6-validation)
7. [Limitations](#7-limitations)
8. [Future work](#8-future-work)
9. [References and source map](#9-references-and-source-map)

---

## 1. Introduction

### 1.1 Motivation

The Betty cluster supports a heterogeneous research community whose SLURM expertise varies widely. PARCC's existing helper scripts (`parcc_sfree.py`, `parcc_sqos.py`, `parcc_sdebug.py`) surface live cluster state but require the researcher to know which command to run, in what order, and how to interpret the output. The most common questions PARCC support handles — "why is my job pending?", "what partition should I use?", "is this sbatch script reasonable?" — have answers that are mechanically derivable from the cluster's published state and policy, but the derivation is not a researcher's specialty.

The Betty SLURM Advisor encapsulates that derivation behind a chat interface, with three load-bearing properties:

1. **Math is done in Python, not by the language model.** The LLM chooses tools and phrases responses; constraint solving and policy enforcement are deterministic.
2. **Live cluster state is fetched at the moment of use, not pre-cached.** Stale state produces wrong advice; we prefer no advice to wrong advice.
3. **Every recommendation cites its sources.** A researcher (or a reviewer) can ask "where did this number come from?" and get a file path or command name, not a paraphrase.

### 1.2 Scope

The advisor is a **pre-submission** tool. It does not interact with SLURM's scheduler, modify accounting, or change cluster state. The collaboration is sequential: advisor produces a candidate shape → user reviews → user submits (manually or via the chat's existing `cluster_submit` tool) → SLURM schedules. This boundary keeps the advisor's failure modes bounded: a wrong recommendation costs a researcher one revised submission, never an incorrectly running job or a corrupted accounting record.

### 1.3 Contributions

This report describes:

- A constraint-model formulation of partition selection that respects PARCC's billing policy and per-partition geometric limits, with a graceful pure-Python fallback when MiniZinc is unavailable.
- A scoring formula for time-slot recommendation that combines live `sinfo` and `squeue --start` data with an empirical hour-of-day load profile, all surfaced verbatim in the chat output.
- An anti-hallucination contract enforced via the system prompt and tool result format that prevents the LLM from inventing tool capabilities or formulas.
- Four explicit safety contracts (VRAM, synthetic-curve labeling, backfill-estimate caveats, queue-data privacy) backed by code, tests, and visible UI signals.
- A planned deployment path through Open OnDemand that resolves the multi-user authentication question without inventing new credential infrastructure.

### 1.4 Design objectives (with acceptance criteria)


**Objective 1 — Reduce time from "I have a research question" to "I have a correct sbatch I'm willing to submit."**

Goal 1 — Be fast. A researcher should be able to describe what they want to run in plain language and get a ready-to-submit job script in under 3 minutes — without needing to know any SLURM flags or cluster jargon. The system has to translate "I want to fine-tune Llama" into the correct technical job configuration automatically.

- *Acceptance criterion:* For a sample of 20 PARCC-typical workloads (mix of LoRA fine-tuning, multi-node distributed training, CPU genomics, interactive debug, vLLM serving, GROMACS), median time from first chat message to a submittable sbatch ≤ 3 minutes when the user provides a model + workload type. Measured via instrumented chat sessions during a planned UAT.
- *Implication for design:* the advisor must be able to derive sbatch shape from natural-language intent without requiring the user to know SLURM flags. Drives the existence of `slurm_recommend` and the system-prompt rule that the agent calls `gpu_calculate` before `slurm_recommend` whenever a model is mentioned.

**Objective 2 — Recommendations must be *legal under cluster policy* before they are *cheap*.**

Goal 2 — Never suggest something illegal. Every job script the advisor produces must pass the cluster's policy rules — correct GPU counts, time limits, memory, etc. Policy compliance is a hard requirement, not a preference. The system only picks the cheapest/fastest option among valid ones, never bends the rules to get there.



- *Acceptance criterion:* For any recommendation the advisor produces, re-running `slurm_check` against the generated sbatch returns `status: ok` or `status: revise` (warnings only); never `status: block`. Verified by [`test_check_suggested_fix_is_itself_valid`](betty-ai/slurm_advisor/tests/test_scenarios.py).
- *Implication for design:* policy enforcement (per-partition geometry, QOS GPU caps, walltime maxima, VRAM safety, NVLink awareness) is encoded as *hard constraints* in the MiniZinc model and *pre-filters* in `_candidate_partitions` — never as soft preferences in the objective. The objective only ranks among legal options.

**Objective 3 — Every number the advisor displays is auditable to a source file or live command.**

Goal 3 — Every number must be traceable. If you ask "where did that number come from?", the advisor must point you to an exact file, function, or command — not just say "based on typical usage." No made-up figures.


- *Acceptance criterion:* When prompted "where did this number come from?", the agent answers with a file path, function name, or `runRemote` command. Verified during E2E browser tests (see §6.2): the agent now cites `betty-ai/data/features/partitions/dgx-b200.json`, `_DEFAULT_LOAD_BY_HOUR`, and `solver.py:_MZN_MODEL` by exact path rather than paraphrasing.
- *Implication for design:* the anti-hallucination contract (§4.5), the verbatim-paste fence convention, and the `sources`/`score_formula`/`vram_constraint.message` provenance fields all exist to make this objective testable.

**Objective 4 — When live data is unavailable, the advisor produces *labelled-uncertain* output rather than fabricated output.**

Goal 4 — Honest when it doesn't know. If the system can't reach the cluster (bad connection, expired credentials, missing data), it says so clearly with a visible warning badge — it never fills in the gaps with guesses or fabricated data.

- *Acceptance criterion:* When SSH fails, expired Kerberos blocks SLURM commands, or no historical features file exists, the corresponding tool returns *empty `sources`* (not synthesized data) and the rendering UI surfaces a red "pre-validation" or "kinit needed" badge. Verified by [`test_propose_slots_tags_synthetic_when_no_real_curve`](betty-ai/slurm_advisor/tests/test_load_curve.py) and the §6.2 expired-kinit E2E test.
- *Implication for design:* drives the §5.2 synthetic-curve labeling contract, the §5.5 graceful-degradation contract, and the choice to put `sources` and `load_curve_kind` in the payload schema rather than only in code comments.

**Objective 5 — Privacy: the advisor must not retain or surface other researchers' job-level data when aggregating cluster-wide signals.**

Goal 5 — No peeking at other people's jobs. When the advisor looks at overall cluster load, it only sees aggregate statistics (e.g., "80% of GPUs are busy") — never the details of any individual researcher's jobs.

- *Acceptance criterion:* The `parseSqueueStart` return type contains zero per-job fields; `grep -r squeue-aggregated-no-per-job-data parcc1/` returns the contract assertion in source. Tested by [`test_availability_no_per_job_data_in_payload`](betty-ai/slurm_advisor/tests/test_scenarios.py).
- *Implication for design:* drives the §5.4 privacy contract and the typed `privacy_posture` field on the snapshot.

**Objective 6 — Multi-user deployment must not require new credential infrastructure.**

Goal 6 — Deploy with what Penn already has. The system must work with PARCC's existing login infrastructure (Penn SSO + Kerberos) — no new password systems, no new credential services, nothing that requires IT to set up new infrastructure.

- *Acceptance criterion:* The deployment plan can be implemented with PARCC's existing OOD installation, Penn SSO, and Kerberos. No new keytab-management, no new credential-delegation service, no new identity store.
- *Implication for design:* drives the §8.1 OOD Batch Connect plan over alternatives that would require shared service accounts or per-user credential proxying.

**Non-goals (explicit).** The advisor is *not* trying to:
- Replace SLURM's scheduler or modify scheduling decisions.
- Predict the absolute future state of the cluster ("your job will start at exactly 2:34 PM"). It surfaces SLURM's *own* backfill simulator output (`squeue --start`) with explicit upper-bound caveats (§5.3).
- Optimize fairness or cluster utilization (those are SLURM's jobs).
- Be empirically validated against post-submission outcomes — yet. That feedback loop is future work (§8.5).

### 1.5 Open policy questions affecting design

Each question below has a *current assumption* the advisor's behavior depends on and a *design implication* if the answer turns out to differ. These are flagged for PARCC ops review before the advisor goes to a wider user base.

**Q1 — How does Betty decide which job runs next?**

`PriorityWeight*` values in `slurm.conf` set how much weight Betty gives to each priority factor (how long a job has waited, how much its account has used recently, how big the job is, the partition, the QOS, the resource mix). We don't know the actual values, so we don't know which lever a researcher could pull to start sooner. What weights does Betty assign to each priority component (Age, Fairshare, JobSize, Partition, QOS, TRES)?

- *Current assumption:* defaults-ish — Fairshare is significant (otherwise PARCC's billing model has no leverage), Age is non-trivial (otherwise long-pending jobs never advance), JobSize matters (otherwise backfill heuristics are wrong).
- *Design implication if wrong:* the per-factor advice in `_FACTOR_ADVICE` (§4.4) targets the dominant bottleneck identified by sprio. If Fairshare dominates by an order of magnitude, almost every "Reason=Priority" diagnosis collapses to "your account is heavy" regardless of which factor the user could actually move; we'd want to weight the advice by the *gap* a remediation could close, not just the smallest factor.

**Q2 — When the cluster says "you've been running heavy lately," how long does that penalty last?**

Fairshare gives heavy-using accounts a temporary priority penalty that decays over time. We need to know the half-life — hours, days, or weeks — because that's the difference between "wait it out" being viable and being a non-answer. What's the AccountingStorageEnforce setting? What's `PriorityDecayHalfLife`?

- *Current assumption:* a multi-day to multi-week half-life that means "wait" is a real but non-instant remediation.
- *Design implication if wrong:* if the half-life is days, "wait for the rolling-window decay (typically days–weeks)" advice in `_FACTOR_ADVICE['FAIRSHARE']` is roughly right. If it's weeks, we should soften "typically days" → "typically weeks." If it's an hour (e.g., decay disabled), the advice is misleading and should instead point at "submit smaller jobs to lower your usage rate."

**Q3 — How far ahead can SLURM tell you when your job will start?**

SLURM's backfill scheduler simulates future starts but only looks ahead a configurable window. If Betty's lookahead is 1 day, the calendar's "Wednesday afternoon" estimates beyond that are guesses. If it's 7 days, the predictions are real. We need to match our footnote text to reality. What are `bf_window`, `bf_resolution`, `bf_max_job_test`, `bf_continue`?

- *Current assumption:* `bf_window` ≈ 1 day (Slurm default), `bf_resolution` ≈ 60s. The §5.3 footnote on the calendar card hardcodes "typically 1 day."
- *Design implication if wrong:* if `bf_window` is set to 7 days at PARCC, `squeue --start` returns useful estimates for week-out planning and the §3.1 calendar can confidently show 7-day slots. If it's 4 hours, almost every slot beyond "today" is N/A and the calendar's far-future slots are noise. The footnote text should match the actual configured value.

**Q4 — Which limit actually stops a researcher's job — QOS or account?**

Cluster has multiple limit layers: what your QOS allows, what your account allows, what your group allows. We currently enforce QOS GPU caps in the constraint solver. If account-level limits matter more for some PIs (e.g., Wharton with separate budgets), our recommendations could pass QOS validation but get rejected at submission. Are GPU caps enforced at the QOS layer, the association layer, or both? Does PARCC use `MaxTRESPerJob` or `GrpTRESMins`?

- *Current assumption:* QOS-layer caps are the binding constraint for individual job size (we enforce these in §5.6 via `_max_qos_gpu_cap`). Association-level `GrpTRESMins` is the binding constraint for monthly budgets (mapped to `Reason=AssocGrpGRES` in `_REASON_GUIDE`).
- *Design implication if wrong:* if association limits override QOS for some accounts (e.g., Wharton has separate caps), the constraint solver could return shapes that pass QOS but fail at submission. Wiring `sacctmgr show assoc -p` into pre-filtering (§7.4 future work) becomes higher priority.

**Q5 — How long does a typical job actually wait before starting?**

If a researcher submits a 1-GPU 4-hour job at 2 PM on a Tuesday, do they wait 5 minutes or 5 hours? We don't know — we have no empirical baseline. Without it, we can't tell users "your similar job last week waited 45 minutes" and our calendar can only score relative likelihood. *This is the question Ryan's review surfaced most directly.* What is the median, p50, p90 wait time per partition, per QOS, per workload size?

- *Current assumption:* unknown. The advisor does not predict absolute wait times — it surfaces SLURM's `squeue --start` estimate when SLURM has computed one, otherwise it produces a synthetic relative score.
- *Design implication if wrong:* if wait times are short (median minutes), the calendar card's emphasis on "soonest viable slot" is well-targeted. If wait times are bimodal — short for small jobs, very long for large ones — the synthetic curve's smooth hour-of-day shape is misleading and we should compute per-(GPU-count, partition) wait distributions from sacct rather than per-hour load. Until [`scheduling/features.py`](betty-ai/scheduling/features.py) has run nightly for ≥30 days on a production node and we can validate the curve against actual outcomes, this objective is unverified.

**Q6 — How often does PARCC reserve the cluster for maintenance, and how much notice do users get?**

Maintenance windows are a fact of cluster life. If they're frequent and short-notice, the calendar should highlight upcoming windows so researchers can defer. If they're rare and well-announced, the agent just needs to avoid them quietly. We don't know the frequency. Who can request reservations? Are MAINT windows pre-announced to users? How often, with what lead time?

- *Current assumption:* PARCC ops creates MAINT reservations for planned downtime; researchers usually find out via email + the reservation appearing in `scontrol show res`. The advisor reads them live (§5.9) but does not predict them.
- *Design implication if wrong:* if reservations are frequent and short-notice, users will value "the next 4-hour MAINT window starts in 18 minutes; defer your submission." If they're rare, this advice is noise. The calendar card currently surfaces blackouts when they exist; whether to *highlight* upcoming reservations (vs. quietly avoid them) is a UX call we'd make based on frequency.

**Q7 — Will PARCC change how it bills for compute in the foreseeable future?**

The recommend card shows a billing score that ranks options from cheapest to most expensive under the cluster's current cost model. If billing weights change, or memory becomes billed, or off-peak discounts get introduced, the math behind that score has to follow. Is PARCC planning to change billing weights (`TRESBillingWeights`), introduce memory billing, change the PC-unit definition, or add per-partition surcharges?

- *Current assumption:* the YAML's billing weights are stable for the planning horizon of this advisor. Memory has zero weight (§3.3).
- *Design implication if wrong:* the MiniZinc objective is a single line; changing it is trivial. But if the cost model becomes time-varying (e.g., off-peak discount), the advisor needs to know the schedule, and the calendar's "best slot" recommendation becomes a cost-vs-time trade-off rather than a queue-prediction trade-off.

**Q8 — When jobs fail, what's the typical cause?**

Researcher jobs fail for a mix of reasons: ran out of memory, hit the walltime, file system issues, bugs in their own code. We've prioritized VRAM and walltime safety because we *guessed* those are the most common. If actual failure causes are different, we're optimizing the wrong safety nets. What % of jobs fail, and what % of those failures are due to OOM, walltime exceeded, file I/O, code errors?

- *Current assumption:* unknown. The advisor's safety contracts (VRAM in §5.1, walltime in §3.3) target the failure modes we *think* are most common.
- *Design implication if wrong:* if OOM is rare and walltime-exceeded is common, the VRAM banner is over-weighted relative to a "your similar past jobs ran 6h on average; your 1h request will likely time out" hint we don't yet produce. Adding a `slurm_predict_runtime` tool driven by sacct history becomes a higher priority.

**Q9 — Should the advisor talk differently to a first-year grad student than to a power user?**

Right now the advisor uses one voice for everyone — concise, technical, source-citing. If PARCC has a clearly novice population (e.g., CIS course students using Betty for the first time), they probably want more hand-holding by default. We don't currently distinguish. Are advanced researchers different users than novice ones? Does the advisor's tone need to adapt?

- *Current assumption:* one tone for all users — concise, source-citing, willing to explain. The chat naturally adapts via follow-up.
- *Design implication if wrong:* if PARCC has a clear novice tier (e.g., undergraduates in CIS courses), they may need more explanation by default. We could add a `verbosity` user preference; we haven't yet.

**Q10 — When does this become a real product researchers can use?**

Right now the advisor runs as a single developer's local instance. The plan to deploy as an Open OnDemand Batch Connect app (§8.1) is the path to multi-user, but we need a date — that gates everything that depends on multi-user identity (per-account budget, audit logs, usage attribution). When can we deploy the Batch Connect app?

- *Current assumption:* unspecified — gates on Ryan's input.
- *Design implication:* every section of the advisor that depends on multi-user (e.g., "your account has X budget left") is gated on this answer. Single-user development continues; production deployment doesn't.

**How these questions affect the test plan.** The acceptance criteria in §1.4 are testable today only against a single PennKey on a dev box. To validate against real Betty operations we need answers to Q1, Q3, Q5, and Q8 at minimum. The empirical-validation feedback loop (§8.5) is where these get answered.

---

## 2. Background: SLURM dimensionality

SLURM models every resource as a **TRES** (Trackable Resource): `cpu`, `mem`, `gres/gpu:<type>`, `node`, `billing`, `license/<name>`, `energy`. A pending job is a request vector across these dimensions; a node advertises a capacity vector and an in-use vector; the scheduler packs requests into capacity subject to per-account, per-QOS, and per-partition ceilings.

The full live state at any moment is approximately:

```
S = (node_state[N≈30], job_state[M=hundreds], assoc_state[A=accounts],
     reservation_set, qos_caps, partition_caps, time)
```

On a busy cluster this is thousands of values changing per minute. The fundamental design question for an advisor is *which slice of S to capture, and how to be honest about what was missed*. The advisor's coverage matrix is documented in detail at [`wiki/concepts/slurm-state-dimensionality.md`](wiki/concepts/slurm-state-dimensionality.md); a summary appears in §4.

---

## 3. System architecture

### 3.1 Data flow

A single chat turn proceeds as follows:

```
                    ┌─────────────────────────────────────────────┐
                    │         User in chat (browser)              │
                    │   "I need 2 GPUs for 8 hours, partition?"   │
                    └─────────────────────┬───────────────────────┘
                                          ▼
                    ┌─────────────────────────────────────────────┐
                    │  Next.js route /api/chat (server-side)      │
                    │  • spawns claude-agent-sdk session          │
                    │  • registers MCP server "betty-ai-tools"    │
                    │    with 11 tools (4 of them slurm_*)        │
                    │  • streams tokens back as SSE               │
                    └─────────────────────┬───────────────────────┘
                                          ▼
                ┌──────────────── Claude Sonnet 4.5 ──────────────┐
                │  Reads system prompt + user msg                 │
                │  Decides: call slurm_recommend with             │
                │           {gpus:2, hours:8, min_vram_gb:80}     │
                └─────────────────────┬───────────────────────────┘
                                      ▼
                ┌─────────────── slurm_recommend (TS tool) ───────┐
                │                                                 │
                │   ┌──────────── parallel ────────────┐          │
                │   ▼                                  ▼          │
                │  spawn python                    runRemote      │
                │  -m slurm_advisor.cli            'sshare ...'   │
                │  recommend --gpus 2              over SSH       │
                │  --hours 8                       (Kerberos      │
                │  --min-vram-gb 80                 GSSAPI)       │
                │   │                                  │          │
                │   ▼                                  ▼          │
                │  Python: load YAML,             Betty login     │
                │  filter by VRAM,                node returns    │
                │  build MiniZinc model,          fairshare rows  │
                │  call gecode/highs binary,                      │
                │  parse Solution                                 │
                │   │                                  │          │
                │   └──────────────┬───────────────────┘          │
                │                  ▼                              │
                │   Merge into JSON payload, wrap in              │
                │   ```betty-slurm-recommend\n{...}\n```          │
                │   plus instruction: "paste verbatim".           │
                └─────────────────────┬───────────────────────────┘
                                      ▼
                ┌──────────────────── Sonnet ─────────────────────┐
                │  Receives tool result, writes a one-sentence    │
                │  intro, pastes the fenced block verbatim,       │
                │  ends with one-sentence next-step.              │
                └─────────────────────┬───────────────────────────┘
                                      ▼
                ┌──────────── ChatMessage.tsx ────────────────────┐
                │  ReactMarkdown sees ```betty-slurm-recommend    │
                │  fence, dispatches to <SlurmRecommendCard/>.    │
                │  The card renders status pill, shape table,     │
                │  VRAM banner, sbatch block, and the fairshare   │
                │  panel with a raw-stdout disclosure for audit.  │
                └─────────────────────────────────────────────────┘
```

Two architectural commitments are visible in this diagram:

- **The LLM never performs arithmetic.** It selects tools and phrases prose; deterministic Python computes the constraint solution and policy violations. This is enforced by both the system prompt and the JSON schema returned to the model.
- **All cluster contact happens inside `runRemote`.** This is a single function ([`betty-ai-web/src/agent/cluster/ssh.ts`](betty-ai-web/src/agent/cluster/ssh.ts)) that shells out to OpenSSH with `ControlMaster -M -S <socket>` for connection pooling. It uses Kerberos GSSAPI from the user's local kinit cache rather than managed keypairs. This single point of integration matters for the multi-user deployment plan in §8.

### 3.2 The role of MiniZinc

MiniZinc and SLURM solve different problems and are not redundant.

| | SLURM | MiniZinc (in this advisor) |
|---|---|---|
| **What it decides** | When to start an *already-submitted* job | What an *un-submitted* request should look like |
| **What it sees** | All running and pending jobs, all node states, all reservations, all priorities | One user's intent + a static partition spec from YAML |
| **What it optimizes** | Throughput, fairness, backfill, tunable per partition | One job's billing score under the per-partition weights published in `betty_cluster.yaml` |
| **Outputs** | A node assignment for an existing job | A `#SBATCH` block the user can review or submit |
| **Where it runs** | Daemon on Betty's controller | Subprocess on the host running the agent |
| **Refresh rate** | Continuous, `bf_resolution` ticks | Once per chat turn |

The advisor never replaces, advises, or talks to SLURM's scheduler. It picks the *shape* of a request that, once submitted, SLURM will then schedule.

### 3.3 The MiniZinc constraint model

The complete model lives at [`betty-ai/slurm_advisor/solver.py:_MZN_MODEL`](betty-ai/slurm_advisor/solver.py). Its essential structure:

**Decision variables**

- `pidx` — partition index (1..P)
- `nodes` — node count
- `gpus_per_node_out` — GPUs per node assigned to the job
- `cpus_per_task` — CPUs per task
- `mem_gb` — memory per node (GB)

**Hard constraints (cluster geometry, from YAML)**

```
nodes * gpus_per_node_out >= req_gpus
(nodes - 1) * gpus_per_node_out < req_gpus     % tight pack
nodes <= max_nodes_per_job[pidx]
cpus_per_task <= cpus_per_node[pidx] / gpus_per_node[pidx]
mem_gb <= mem_gb_per_node[pidx]
req_seconds <= max_walltime_s[pidx]
nodes * gpus_per_node_out <= max_qos_gpus[pidx]   % QOS GPU cap (see §5.6)
```

**Pre-solve filters (applied in `_candidate_partitions`):**

- VRAM floor: partitions with `gpu_vram_gb < min_vram_per_gpu_gb` excluded.
- NVLink requirement: when `requires_nvlink=True`, partitions with `nvlink: false` excluded (e.g. MIG slices).

**Soft constraints (PARCC scheduling lore, override-able)**

```
cpus_per_task <= soft_cpu_per_gpu          % default 28 on dgx-b200
mem_gb_per_gpu <= soft_mem_per_gpu_gb      % default 224
walltime_h <= soft_max_walltime_h_for_backfill   % default 24
```

When the caller does not pin CPUs or memory, the model fixes them to the partition's recommended defaults. Without this step, the cheapest billing solution is `cpus=1, mem=minimum`, which is legal but useless for actual workloads.

**Objective**

```
minimize: nodes * (cpus_per_task * cpu_weight[pidx] +
                   gpus_per_node_out * gpu_weight[pidx]) *
          (req_seconds / 3600.0)
```

The weights come directly from `betty_cluster.yaml` and reflect the cluster's billing policy. Memory is currently zero-weighted in the objective; this is intentional under PARCC's current billing model and is one line to change if that policy changes.

**Solver selection**

The Python wrapper probes for available solvers in order: `gecode` (CP, preferred for our constraint shape) → `cbc` (MIP, fallback that handles our linear objective) → none, in which case the recommender falls back to a deterministic Python enumerate-and-rank that produces identical answers for our five-partition setup. The card output reports the active backend (`backend: "minizinc"` or `"python"`) so the user can audit which path was taken.

---

## 4. Tool specifications

The advisor exposes four MCP-registered tools. Each is gated by a permission tier (0 = auto-approve silently, 1 = prompt once per session, 2 = always prompt) consistent with the existing Betty agent permission model.

| Tool | Permission tier | Local sources | Live SSH sources |
|---|---|---|---|
| `slurm_check` | 0 | `betty_cluster.yaml` | none |
| `slurm_recommend` | 0 | `betty_cluster.yaml`, MiniZinc binary | `sshare -h -P -U` |
| `slurm_availability` | 1 | `data/features/partitions/<p>.json` if present | `sinfo`, `squeue -h --start -t PD` |
| `slurm_diagnose` | 1 | `_REASON_GUIDE` table | `scontrol show job <id>` |

`slurm_check` and `slurm_recommend` work fully offline; their output is reproducible on any machine with the same YAML. `slurm_availability` and `slurm_diagnose` require SSH and degrade honestly when SSH is unavailable.

### 4.1 `slurm_check`

Parses `#SBATCH` directives ([`parser.py`](betty-ai/slurm_advisor/parser.py)) and runs them against the policy validator ([`policy.py`](betty-ai/slurm_advisor/policy.py)). Returns a structured report containing a status (`ok` / `revise` / `block`), per-violation codes with severity and field, and — when fixable — a suggested corrected sbatch block produced by re-running the recommender with the violating values stripped.

Soft caps applied:
- ≤28 CPUs per GPU on dgx-b200
- ≤224 GB memory per GPU on dgx-b200
- ≤24h walltime on GPU partitions for backfill

Hard caps come from the per-partition node geometry in `betty_cluster.yaml` (e.g., `cpus_per_node / gpus_per_node`).

### 4.2 `slurm_recommend`

Takes a high-level intent — `{gpus, cpus, mem_gb, hours, partition_pref, qos_pref, interactive, min_vram_gb}` — and returns a partition-shape recommendation through the MiniZinc model in §3.3. In parallel with the constraint solve, it fetches the user's fairshare standing via `sshare`. The card renders both alongside an explicit VRAM safety banner (see §5.1).

### 4.3 `slurm_availability`

Fetches two live signals over SSH:
- `sinfo -h -o '%P|%D|%T|%G'` → idle and total GPUs per partition
- `squeue -h --start -t PD -o '%i|%P|%S'` → pending count and earliest SLURM-estimated start per partition

Generates candidate slot timestamps from a default offset list (`[0, 1, 3, 6, 12, 24, 48]` hours plus an "after 6 PM local" off-peak slot), then scores each:

```
score = (1.5 if free_gpus >= req_gpus else 0)
      + (1.0 - load_at_hour)
      - min(pending_jobs / 50, 1.0)
      - (dt_hours / 168)
```

Each component appears verbatim in the slot's `reasons` list, and the formula itself is included in the payload (`score_formula` field) so the rendering UI and the LLM both have a source of truth.

The `load_at_hour` curve is loaded from `betty-ai/data/features/partitions/<partition>.json` when present (produced by the offline pipeline at [`scheduling/features.py`](betty-ai/scheduling/features.py)) and labeled `"historical"`. When absent, a hand-coded synthetic curve is used and labeled `"synthetic"`. The card renders synthetic curves with a red "Pre-validation" banner explicitly stating that ranking is heuristic only (see §5.2).

### 4.4 `slurm_diagnose`

Runs **two** SSH commands in parallel for a pending job:

- `scontrol show job <id>` — JobState, Reason, ReqTRES, TimeLimit, partition/QOS.
- `sprio -hl -j <id>` — per-factor priority decomposition (AGE, FAIRSHARE, JOBSIZE, PARTITION, QOS, TRES). Optional — if sprio fails (job already started, doesn't exist, sprio disabled), diagnose still works without priority decomposition.

The Python diagnoser maps SLURM's `Reason` field through a curated lookup table (`recommender.py:_REASON_GUIDE`) to produce one or more plain-English causes plus concrete suggested actions. When `sprio` data is available, an additional layer fires: the dominant *bottleneck* factor (the smallest non-zero contribution) drives factor-specific advice from `_FACTOR_ADVICE`. For example, a job pending with `Reason=Priority` and a small FAIRSHARE factor produces:

> Your FAIRSHARE factor is the dominant drag — your account has been running heavy recently and is being de-prioritized to make room for others. (sprio factor = 0.000004)
>
> Suggested actions:
> - Wait for the rolling-window decay (typically days–weeks).
> - Check usage with `parcc_sreport.py --user <pennkey>`.
> - If urgent, ask PARCC about a temporary FairShare adjustment.

The diagnose card renders the per-factor breakdown as a sortable table, with the bottleneck row highlighted red and the dominant-positive row highlighted green so the user can see at a glance what's helping vs. hurting.

Layered on top: heuristics that consider the job's `TimeLimit` (e.g., walltimes >24h trigger a "backfill is unlikely" hint regardless of the SLURM Reason).

### 4.5 Anti-hallucination contract

The system prompt at [`betty-ai-web/src/agent/system-prompt.ts`](betty-ai-web/src/agent/system-prompt.ts) contains a section labeled "**CRITICAL — never invent how the tools work**" that enumerates each `slurm_*` tool's exact source files, command lines, and formulas. The model is instructed to cite those when asked "how does this work" rather than reverse-engineering capabilities from card output.

The card output is the second line of defense. Every tool's payload includes provenance fields (`sources`, `score_formula`, `vram_constraint.message`, `result.backend`, `result.explanation`) worded so the model has nothing to add. If the model strays anyway — it is an LLM, not a contract enforcer — the user can ask "what did the tool actually return?" and the JSON is right there. Trust comes from auditability, not promises.

This contract was explicitly verified during validation (see §6).

---

## 5. Safety and correctness contracts

Five contracts are encoded as code, tests, and visible UI signals, each addressing a specific failure mode that surfaced during review.

### 5.1 VRAM safety pre-filter

**Failure mode addressed.** Without VRAM-awareness, the constraint solver minimizing billing happily routes a 70B fine-tune to a 45 GB MIG slice that OOMs. The "savings" become a wasted submission.

**Contract.** `JobIntent.min_vram_per_gpu_gb` is an optional integer parameter. When set, `_candidate_partitions` filters out partitions whose `gpu_vram_gb` is below the floor *before* the constraint solver runs. Excluded partitions appear in `result.rejected` with a reason string ("`gpu_vram_gb=45 < required 100`") and are rendered as a greyed-out list under the shape table in the card UI.

**Visible signal.** The recommend card always shows a banner near the top:
- Green "**VRAM enforced** · VRAM ≥ N GB enforced. Partitions below this were excluded before solving." when `min_vram_gb` is set.
- Amber "**VRAM not constrained** · The solver picked the cheapest legal partition without knowing your workload's VRAM requirement. ..." when it is not.

**Integration.** The system prompt instructs the agent to call `gpu_calculate` first whenever the user mentions a model and method, then pipe the resulting `vram_needed_gb` into `slurm_recommend` as `min_vram_gb`.

**Tests.** [`test_recommender.py`](betty-ai/slurm_advisor/tests/test_recommender.py) includes `test_recommend_excludes_partitions_below_vram_floor`, `test_recommend_no_vram_floor_shows_disclaimer`, and `test_recommend_infeasible_when_vram_exceeds_all_gpus`.

### 5.2 Synthetic vs. historical load curve labeling

**Failure mode addressed.** A synthetic hand-coded hour-of-day load curve produces plausible-looking numbers ("03:00 = 10% load") that researchers may take as empirical truth.

**Contract.** Three layers:

1. The Python ranker labels its source explicitly: `load_curve_kind: "historical"` only when `data/features/partitions/<partition>.json` exists and is well-formed; otherwise `"synthetic"`. The provenance is added to the snapshot's `sources` list.
2. The CLI emits `load_curve_kind` as a top-level field of the calendar payload.
3. The card UI renders a red "Pre-validation" banner above the slot table whenever `load_curve_kind === 'synthetic'`, and the footer label color flips amber → red with the suffix `(pre-validation)`.

**Visible signal.** The banner reads: "**Pre-validation:** load curve is synthetic (hand-coded hour-of-day intuition, not real Betty history). Slot ranking is heuristic only. The historical curve will replace this when the nightly `scheduling/features.py` pipeline runs and writes `data/features/partitions/<p>.json`."

**Tests.** [`test_load_curve.py`](betty-ai/slurm_advisor/tests/test_load_curve.py) covers `test_load_real_curve_normalizes_to_peak`, `test_load_real_curve_rejects_malformed`, `test_propose_slots_tags_synthetic_when_no_real_curve`, and `test_propose_slots_uses_real_curve_when_present`.

### 5.3 Backfill estimate caveats

**Failure mode addressed.** SLURM's `squeue --start` returns timestamps from the backfill simulator, which runs at `bf_resolution` intervals and considers up to `bf_window` ahead (typically 1 day). The estimate is an upper bound that can shift if a higher-priority job arrives. Researchers may treat it as a commitment.

**Contract.** When `squeue --start` is one of the live sources, the calendar card's footer renders a footnote inline:

> **Note on est. start times:** SLURM's backfill simulator runs at `bf_resolution` intervals and looks up to `bf_window` ahead (typically 1 day). Estimates beyond that window are `N/A`; estimates within it are an *upper bound*, not a commitment — a higher-priority job arriving can push your start later.

This is rendered as inline footer text rather than a tooltip so it remains visible on phone screens.

### 5.4 Privacy: aggregation contract for `squeue`

**Failure mode addressed.** The command `squeue -h --start -t PD` returns one row per pending job across the entire cluster, including JobIDs of jobs belonging to other users. Retaining those rows in the LLM's context — even briefly — is a policy concern.

**Contract.** Three layers:

1. The TypeScript `parseSqueueStart` function ([`betty-ai-web/src/agent/tools/slurm-availability.ts`](betty-ai-web/src/agent/tools/slurm-availability.ts)) has a return type that does not include any per-job data. Its signature: `{ pending_by_partition: Record<string, number>; next_start_by_partition: Record<string, string> }`. Adding per-job data downstream is a type error.
2. A 22-line block comment in `fetchSnapshot` documents the data lifecycle: raw `stdout` is parsed into the two aggregate maps; the variable goes out of scope at the end of the try block; nothing per-job is stored on the snapshot.
3. The snapshot carries a typed `privacy_posture: 'squeue-aggregated-no-per-job-data'` field. The string is fixed and greppable, so a policy reviewer can verify the contract by `grep -r squeue-aggregated-no-per-job-data parcc1/`.

If PARCC policy review requires stricter (e.g., "do not run `squeue` across all users at all"), the fallback is to scope to `--me`, which loses cluster-wide queue depth but preserves personal-only state.

### 5.5 Graceful degradation on SSH failure

**Failure mode addressed.** Kerberos tickets expire, networks partition, login nodes go down. A tool that silently substitutes synthetic data for live data is worse than one that admits ignorance.

**Contract.** When `runRemote` fails inside `slurm_availability`'s `fetchSnapshot`, the relevant section of the snapshot stays empty rather than being filled with fabricated data:
- `sources` does not include the failed command name.
- `pending_jobs_by_partition` and `gpus_idle_by_partition` remain `{}`.
- The card renders the explicit footer: "Sources: (none — score uses synthetic curve only)".

A parallel signal pathway: the existing `ConnectionBadge` UI element in the chat header flips to "kinit needed" with the full SSH error text whenever any tool's `runRemote` returns `Permission denied`. This was verified during testing (see §6.2).

### 5.6 QOS GPU-cap enforcement

**Failure mode addressed.** Surfaced by [`test_persona_bob_over_qos_cap`](betty-ai/slurm_advisor/tests/test_scenarios.py): a 41-GPU request returned a 42-GPU configuration on dgx-b200. Partition geometry alone was honored; the QOS layer was completely absent from the constraint model.

**Contract.** A new helper `_max_qos_gpu_cap(policy, partition)` computes the most permissive GPU cap among QOSes allowed on each partition. The MiniZinc model now carries `array[PART] of int: max_qos_gpus` and enforces `nodes * gpus_per_node_out <= max_qos_gpus[pidx]`. The Python solver mirrors the same check in `_shape_for`.

**Visible signal.** When the request exceeds the cap, the partition appears in `result.rejected` with the specific reason: `"req 41 GPUs exceeds QOS cap 40"`.

**Tests.** `test_persona_bob_over_qos_cap` now asserts the returned configuration is ≤40 GPUs OR returns `feasible=False` with explanations.

### 5.7 NVLink awareness for distributed training

**Failure mode addressed.** Surfaced by [`test_persona_diego_distributed_training`](betty-ai/slurm_advisor/tests/test_scenarios.py): a 16-GPU distributed training request was routed to `b200-mig45` (32 MIG slices/node, fits in 1 node, cheapest billing). Technically legal under cluster geometry but performance-catastrophic — MIG slices have no NVLink between siblings, so tensor-parallel all-reduce would saturate PCIe instead of NVLink.

**Contract.** Three layers:

1. `PartitionSpec.nvlink: bool` field, populated from `betty_cluster.yaml` (which already correctly reported `nvlink: true` on dgx-b200 and `nvlink: false` on MIG partitions — `Policy.load` just wasn't reading it).
2. `JobIntent.requires_nvlink: bool` field. When `True`, `_candidate_partitions` excludes any partition with `nvlink: false` *before* the constraint solver runs.
3. The system prompt instructs the agent to set `requires_nvlink=True` for any "distributed training" / "tensor parallelism" / "multi-GPU model" workload.

**Visible signal.** When NVLink-only partitions are excluded, the recommend card's "Excluded partitions" list shows: `b200-mig45 — nvlink=false; required by distributed training`.

### 5.8 Defensive `sshare` parser

**Failure mode addressed.** A live test capture showed `sshare` rows whose values matched columns from a different tool (`parcc_quota.py`-style "INodes Used / Path / Used / Limit"), suggesting either a SLURM version difference in how `-h` suppresses headers or an MOTD wrapper injecting text into the SSH session.

**Contract.** [`parseSshareDefensive`](betty-ai-web/src/agent/tools/slurm-recommend.ts) implements three layered drops:

1. **Pipe-count check** — rows with the wrong number of `|`-delimited columns are dropped (catches MOTD lines like `Last login: ...`).
2. **Header-keyword filter** — rows whose `User` field matches a known header keyword (`User`, `Account`, `Src`, `Source`, `Path`, `Login`, `PennKey`) are dropped.
3. **Numeric validation** — rows whose `RawUsage` or `FairShare` columns aren't parseable as floats are dropped.

Dropped rows are *counted* (not silently hidden): the recommend card surfaces "N suspicious rows dropped" with up to 3 verbatim samples in a `<details>` disclosure, so the user (or Ryan) can see exactly what was filtered.

**Tests.** [`slurm-availability.test.ts`](betty-ai-web/src/agent/tools/slurm-availability.test.ts) covers six scenarios: well-formed accept, header drop, non-numeric drop, MOTD preamble drop, sample-cap (≤3), parent-account row preservation.

### 5.9 Reservation auto-feed into `slurm_availability`

**Failure mode addressed.** The Python ranker has always supported `BlackoutWindow` exclusions, but no caller was wiring them in — slots overlapping a maintenance window would still be recommended.

**Contract.** `fetchSnapshot` in [`slurm-availability.ts`](betty-ai-web/src/agent/tools/slurm-availability.ts) now runs `scontrol show res` in parallel with `sinfo` and `squeue --start`. The output is parsed by [`parseScontrolReservations`](betty-ai-web/src/agent/tools/slurm-availability.ts) which extracts:

- `StartTime` / `EndTime` (skipping `(null)` entries)
- `PartitionName` (with empty/`(null)` mapped to `undefined` for global blackouts)
- `ReservationName` + `Flags` (e.g. `MAINT`, `FLEX`) → `reason` string

The resulting `BlackoutWindow` list is fed to the slot ranker, which already excludes overlapping slots. When reservations are loaded, `'scontrol show res'` is added to `sources`.

**Tests.** Two scenario tests verify the round-trip: `test_availability_excludes_partition_specific_blackout` confirms a `dgx-b200`-scoped reservation doesn't block `b200-mig45` queries, and `test_availability_excludes_global_blackout` confirms a `partition=None` reservation blocks every partition. Five TS parser tests cover the stanza splitting, MAINT flag handling, and `(null)` timestamps.

---

## 6. Validation

### 6.1 Test coverage

The Python advisor package has **110** unit, integration, and scenario tests across five files:

| File | Tests | Purpose |
|---|---|---|
| [`test_parser.py`](betty-ai/slurm_advisor/tests/test_parser.py) | 6 | sbatch / time / mem unit parsing |
| [`test_recommender.py`](betty-ai/slurm_advisor/tests/test_recommender.py) | 12 | check/recommend/diagnose end-to-end (existing + VRAM tests from §5.1) |
| [`test_availability.py`](betty-ai/slurm_advisor/tests/test_availability.py) | 3 | core slot ranking |
| [`test_load_curve.py`](betty-ai/slurm_advisor/tests/test_load_curve.py) | 7 | historical vs. synthetic curve loading |
| [`test_scenarios.py`](betty-ai/slurm_advisor/tests/test_scenarios.py) | **82** | full scenario matrix (§§A–N): hardware variations, VRAM safety, walltime, CPU-only, 10-persona suite, cost monotonicity, check matrix, availability state × time-of-day, privacy, diagnose Reason matrix, sprio decomposition, sshare contract, reservations, dev-curve seeding |

The TypeScript adapter has **18** tests in [`slurm-availability.test.ts`](betty-ai-web/src/agent/tools/slurm-availability.test.ts) covering the `sinfo`, `squeue --start`, `parseSshareDefensive`, and `parseScontrolReservations` parsers — including underscore-bearing GRES type names like `b200_mig45_g`, MOTD-preamble drops, and `(null)` reservation timestamps.

**All 128 tests pass at time of writing.** `npm run typecheck` is clean for code in `src/agent/tools/` and `src/components/`. See [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](BETTY_SLURM_ADVISOR_TEST_PLAN.md) for the test strategy and [`raw/docs/2026-04-27-test-results.md`](raw/docs/2026-04-27-test-results.md) for per-dimension scoreboard + first-run findings.

### 6.2 End-to-end browser verification

The system was driven through the chat UI under multiple conditions:

| Condition | Outcome |
|---|---|
| Recommend with `min_vram_gb=100`, no SSH | Partition `dgx-b200` selected (billing 24,000); `b200-mig45` and `b200-mig90` both in `result.rejected` with VRAM reasons; green VRAM-enforced banner rendered |
| Recommend without `min_vram_gb`, no SSH | Partition `b200-mig45` selected (billing 4,056); amber VRAM-not-constrained banner rendered |
| Availability with fresh kinit | `sources: ["sinfo", "squeue --start"]`; "0/215 GPUs idle (45 pending)" reflects live cluster state; "SLURM est. earliest start in this partition: 2026-04-27T16:24:19" surfaced from squeue's backfill simulator output |
| Availability with expired kinit | `sources: []`; red "Pre-validation" banner rendered; ConnectionBadge flipped to "kinit needed" with full SSH error |
| Asked the agent "how does the score work?" | Agent quoted the formula verbatim from the card payload; cited the file paths `betty-ai/data/features/partitions/dgx-b200.json` and `betty-ai/slurm_advisor/availability.py:_DEFAULT_LOAD_BY_HOUR`; no invented weights |

The full transcript with payloads is preserved at [`raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md`](raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md).

---

## 7. Limitations

### 7.1 Single-user development context

All current testing uses a single PennKey (`jvadala`) and a single Kerberos cache on the developer's local machine. The SSH transport, ControlMaster pooling, and the entire chat backend run as one Unix user. Multi-user deployment requires either a per-user backend (the planned approach, §8.1) or a credential-delegation story we have not yet built.

### 7.2 Synthetic load curve is the development default

The `data/features/partitions/<p>.json` files that would supply a real hour-of-day load curve are produced by [`scheduling/features.py`](betty-ai/scheduling/features.py) from rolling sacct dumps. That offline pipeline exists and is unit-tested but is not currently scheduled to run on a production node. Until it is, every calendar card on a dev machine is labeled `synthetic (pre-validation)` — this is loud-by-design (§5.2).

**Mitigation:** [`slurm_advisor/scripts/seed_dev_load_curves.py`](betty-ai/slurm_advisor/scripts/seed_dev_load_curves.py) generates `data/features/partitions/<p>.json` files with configurable hour-of-day shapes (`academic` | `flat` | `nighttime-heavy` | `weekend-quiet`) so dev environments can flip the calendar card from synthetic→historical for E2E testing of the file-loading path that production will use. Every seeded file carries a `_dev_seed_marker: true` field so review tooling can detect accidental seeding on a production node. **This does not eliminate §7.2** — the steady state still requires the production cron — but it removes "untested loader code path" from the risk surface.

### 7.3 `sshare` output investigation: defensive parser shipped

A test capture of `sshare -h -P -U` showed rows whose values matched columns from a different tool (`parcc_quota.py`-style "INodes Used / Path / Used / Limit"), suggesting an MOTD wrapper or a SLURM version difference.

**Status:** Defensive parser shipped (§5.8). [`parseSshareDefensive`](betty-ai-web/src/agent/tools/slurm-recommend.ts) now drops header-keyword rows and non-numeric rows, while *counting* drops and surfacing up to 3 verbatim samples in the recommend card so we can audit what was filtered. The first 800 characters of raw stdout still appear in a `<details>` disclosure for cause analysis. A live capture with fresh kinit will confirm which symptom class Betty actually exhibits, but the parser already handles every plausible case.

### 7.4 No live QOS-cap usage

`betty_cluster.yaml` carries QOS caps as static values, and the constraint solver enforces them as upper bounds (§5.6). SLURM's accounting database tracks per-association *current usage* against those caps, but the advisor does not yet pull `sacctmgr show assoc -p` or use `GrpTRESMins` data. A pending job whose account has exhausted its monthly GPU-hour budget will currently be diagnosed only by SLURM's `Reason=AssocGrpGRES`, not by an explicit "your account has 0 of 24,000 GPU-hours remaining this period" message.

### 7.5 No `sdiag` (backfill scheduler health)

`sdiag` exposes scheduler internals: last cycle time, mean cycle time, depth tried, depth tried with backfill simulator. Surfacing these in the calendar card would let the agent qualify its advice (e.g., "backfill cycle time is 312s; recommendations may be coarser than usual"). Future work — see §8.4.

---

## 8. Future work

### 8.1 Open OnDemand Batch Connect deployment (multi-user)

The planned multi-user deployment is an Open OnDemand (OOD) Batch Connect application, modeled on the existing [`bc_osc_betty`](ood/bc_osc_betty/) Jupyter app on the cluster. Each authenticated PennKey will launch a dedicated agent session as their own Unix user, on a small compute or interactive node, with their own Kerberos ticket inherited from the OOD session.

Key properties of the OOD-vehicle approach:

- **Authentication is solved.** OOD already handles Penn SSO + Kerberos. The agent process inherits the user's environment, including a fresh `kinit` ticket for the duration of the session.
- **No shared service account.** Every SSH command Betty AI issues runs as the actual user, with their own quotas and audit trail.
- **Symmetry with existing PARCC infrastructure.** The deployment story is "another Batch Connect app," which the PARCC team already supports operationally.
- **Lifecycle is the OOD session.** Tickets expire when the session ends; no long-lived credential storage.

The implementation work is roughly:

1. A new `bc_betty_ai/` Batch Connect template under [`ood/`](ood/), modeled on the existing Jupyter app.
2. A `script.sh.erb` that starts the Next.js server bound to a random port, with the user's environment set up.
3. A `view.html.erb` that renders the chat UI and proxies WebSocket / SSE through OOD's reverse proxy.
4. A `form.yml` with whatever per-session configuration is appropriate (default partition, walltime).

The `slurm_*` tools require no changes to support this deployment. The MCP server and the four tools are already user-agnostic; the PennKey just becomes whatever Unix user the Batch Connect session runs as.

### 8.2 ~~`sprio` integration in `slurm_diagnose`~~ ✅ Shipped 2026-04-27

The diagnose tool now runs `sprio -hl -j <id>` in parallel with `scontrol show job <id>`. The Python diagnoser identifies the dominant bottleneck factor (smallest non-zero contribution) and dispatches factor-specific advice from `_FACTOR_ADVICE`. The card renders the per-factor breakdown as a sortable table with bottleneck/helper highlighting. See §4.4 and §5 for details.

### 8.3 ~~Reservation auto-feed into `slurm_availability`~~ ✅ Shipped 2026-04-27

`fetchSnapshot` now runs `scontrol show res` in parallel with the other live signals. The TS parser [`parseScontrolReservations`](betty-ai-web/src/agent/tools/slurm-availability.ts) extracts MAINT/FLEX flags and partition scope, mapped into `BlackoutWindow` entries the slot ranker excludes. See §5.9.

### 8.4 `sdiag` for backfill scheduler health

`sdiag` exposes `Backfill: Last cycle`, `Mean cycle`, `Last depth`, `Last depth (try sched)`, etc. Surfacing these in the calendar card as a "scheduler health" indicator would let the agent qualify its advice (e.g., "backfill cycle time is 312s; recommendations may be coarser than usual").

### 8.5 Nightly sacct → features pipeline

The offline pipeline [`scheduling/features.py`](betty-ai/scheduling/features.py) computes per-partition hour-of-day distributions from rolling 30-day sacct data. Once this runs nightly on a production node and writes its output to `data/features/partitions/<p>.json`, every calendar card flips from synthetic-curve (red, pre-validation) to historical-curve (green) automatically. The advisor side already auto-loads the file when present and labels honestly when not.

### 8.6 Live association/QOS usage

A `runRemote('sacctmgr show assoc -p ...')` call into `slurm_recommend` would let the recommendation card show "this job costs N billing-units; your account has M remaining this period". This pairs naturally with `sshare` data already being fetched.

### 8.7 Memory billing weight

`betty_cluster.yaml` does not currently carry `billing_weight_mem`. If PARCC policy ever bills memory, adding the weight is a one-line change to the YAML and a one-line change to the MiniZinc objective.

---

## 9. References and source map

### 9.1 Source files

**Python advisor package** ([`betty-ai/slurm_advisor/`](betty-ai/slurm_advisor/))

- `__init__.py` — package metadata and SCHEMA_VERSION
- `parser.py` — sbatch and time/memory unit parser
- `policy.py` — YAML-backed cluster constraints and violation enforcement
- `solver.py` — MiniZinc model and Python fallback solver
- `availability.py` — slot ranker, blackout handling, real/synthetic load curve
- `recommender.py` — top-level orchestrator (check/recommend/diagnose)
- `cli.py` — JSON-emitting CLI invoked by the TypeScript tools
- `tests/` — 28 unit and integration tests

**TypeScript agent tools** ([`betty-ai-web/src/agent/tools/`](betty-ai-web/src/agent/tools/))

- `slurm-shared.ts` — Python subprocess invocation, rich-card fence helper
- `slurm-check.ts` — sbatch lint tool
- `slurm-recommend.ts` — recommend tool with parallel `sshare` fetch
- `slurm-diagnose.ts` — pending-job diagnosis tool
- `slurm-availability.ts` — `sinfo` + `squeue --start` snapshot, slot ranker

**Chat UI components** ([`betty-ai-web/src/components/`](betty-ai-web/src/components/))

- `SlurmCards.tsx` — four rich-card renderers (`check`, `recommend`, `diagnose`, `calendar`)
- `ChatMessage.tsx` — markdown renderer with `betty-slurm-<kind>` fence dispatcher

**Configuration**

- [`betty-ai/configs/betty_cluster.yaml`](betty-ai/configs/betty_cluster.yaml) — partition specs, QOS caps, billing weights
- [`betty-ai-web/src/agent/system-prompt.ts`](betty-ai-web/src/agent/system-prompt.ts) — anti-hallucination contract section

### 9.2 Companion documents

- [`wiki/concepts/slurm-state-dimensionality.md`](wiki/concepts/slurm-state-dimensionality.md) — the live coverage matrix; updated whenever a new dimension is captured.
- [`raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md`](raw/docs/2026-04-27-slurm-advisor-evidence-report-ryb.md) — point-in-time test transcript with verbatim payloads.
- [`raw/docs/2026-04-27-slurm-advisor-architecture-and-reply-ryb.md`](raw/docs/2026-04-27-slurm-advisor-architecture-and-reply-ryb.md) — the working narrative behind this report's contracts and design decisions.

### 9.3 External tools

- **MiniZinc 2.9.6** with **Gecode 6.2.0**. Solver registration at `~/.minizinc/solvers/gecode.msc`; the `cbc` MIP solver bundled with the brew formula is a working fallback.
- **OpenSSH** with `ControlMaster` for connection pooling. Kerberos GSSAPI from local `kinit` cache.
- **claude-agent-sdk** (TypeScript) version 0.2.111. MCP server registration via `createSdkMcpServer`. Permission tiers via `canUseTool` callback.
- **Next.js 15** + **React 19** for the chat UI.

### 9.4 Cluster context

Betty (`login.betty.parcc.upenn.edu`) is PARCC's HPC/GPU cluster. Five partitions: `dgx-b200` (27 nodes × 8 B200 GPUs), `b200-mig45` (32 MIG slices), `b200-mig90` (16 MIG slices), `genoa-std-mem`, `genoa-lrg-mem`. SLURM 24.11.7. Authentication via Penn SSO + Kerberos + Duo. Documentation: <https://parcc.upenn.edu/training/getting-started/>.

---

*This document is maintained alongside the source code. When a new capability is added or a contract changes, the relevant section here, the wiki dimensionality page, and the system prompt's anti-hallucination contract should be updated in the same commit.*
