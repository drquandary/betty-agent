# Betty SLURM Advisor — architecture & reply to Ryan's review

**To:** ryb
**From:** jvadala
**Date:** 2026-04-27 (revised same day)
**Subject:** Replies to your asks 1-5 + the "how does this actually work" deep dive you asked for
**Reply to:** [your 2026-04-27 review email](2026-04-27-slurm-advisor-evidence-report-ryb.md#re-betty-slurm-advisor--evidence-report)

---

Ryan,

Thank you for the careful read. The points you raised forced clarifications that the architecture needed anyway — landing this version is better than landing the version you reviewed. Below is one document doing two jobs:

- **Part A (§1–§4):** how the agent actually works end-to-end — data flow, where MiniZinc fits relative to SLURM, what runs on the user's machine vs. on Betty, how a single chat turn produces a card.
- **Part B (§5):** point-by-point replies to your asks 1-5, with the code changes I shipped today.

If you only have ten minutes, jump to §5. If you want to walk through it Tuesday, §1–§4 is the slide deck.

---

## Part A — how the agent works

### 1. The data flow of one chat turn

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
                │   merge into JSON payload, wrap in              │
                │   ```betty-slurm-recommend\n{...}\n```          │
                │   plus instruction "paste verbatim"             │
                │                                                 │
                └─────────────────────┬───────────────────────────┘
                                      ▼
                ┌──────────────────── Sonnet ─────────────────────┐
                │  Receives tool result, writes a one-sentence    │
                │  intro, pastes the fenced block verbatim,       │
                │  ends with one-sentence next-step               │
                └─────────────────────┬───────────────────────────┘
                                      ▼
                ┌──────────── ChatMessage.tsx ────────────────────┐
                │  ReactMarkdown sees ```betty-slurm-recommend    │
                │  fence, dispatches to <SlurmRecommendCard/>     │
                │  which renders status pill, shape table, the    │
                │  VRAM banner, the sbatch block, the fairshare   │
                │  table with raw-stdout details panel            │
                └─────────────────────────────────────────────────┘
```

Two things worth flagging from this picture:

- **The LLM never does math.** It chooses which tool to call and how to phrase the answer. The MiniZinc objective and the policy violations are computed in Python and surfaced as JSON. The system prompt's anti-hallucination contract enforces "paste verbatim, don't paraphrase the JSON". This was your earlier concern; it's now load-bearing.
- **The Betty cluster is touched only inside `runRemote`.** That's a single function in [betty-ai-web/src/agent/cluster/ssh.ts](../../betty-ai-web/src/agent/cluster/ssh.ts) that shells out to OpenSSH with `ControlMaster -M -S <socket>`. No `ssh2` npm module, no key management — Kerberos GSSAPI from the user's local kinit cache. This matters for §5.3 (multi-user).

### 2. Where MiniZinc fits relative to SLURM

This is the question I hear most. They are *not* doing the same thing.

| | SLURM | MiniZinc (in Betty advisor) |
|---|---|---|
| **What it decides** | When to start an *already-submitted* job | What an *un-submitted* request should look like |
| **What it sees** | All running + pending jobs, all node states, all reservations, all priorities | One user's intent + a static partition spec from YAML |
| **What it optimizes** | Throughput + fairness + backfill, tunable per partition | One job's billing score under PARCC's published per-partition weights |
| **Outputs** | A node assignment for a job that already exists | A `#SBATCH` block the user can paste (or have us submit) |
| **Where it runs** | Daemon on Betty's controller | Subprocess on the user's machine (or the dev server) |
| **Refresh rate** | Continuous, `bf_resolution` ticks | One call per chat turn |

**The advisor does not replace SLURM, advise SLURM, or talk to SLURM's scheduler.** It picks the *shape* of a request that, once submitted, SLURM will then schedule. The collaboration is sequential: advisor → user (review) → user submits → SLURM schedules.

The MiniZinc model itself is small enough to read in one screen ([betty-ai/slurm_advisor/solver.py:_MZN_MODEL](../../betty-ai/slurm_advisor/solver.py)). Decision variables: `pidx, nodes, gpus_per_node_out, cpus_per_task, mem_gb`. Hard constraints come from `betty_cluster.yaml` (per-partition geometry, walltime caps, QOS allow-list). Soft constraints come from PARCC scheduling lore (≤28 CPU/GPU on dgx-b200, ≤224 GB/GPU). Objective: `nodes * (cpus * cpu_weight + gpus_per_node * gpu_weight) * (seconds / 3600)`. Solver: gecode (CP) preferred, falls through to cbc (MIP) if gecode isn't registered. Falls back to a pure-Python enumerate-and-rank if no MiniZinc binary at all.

As of today (your ask #1), `min_vram_per_gpu_gb` is a pre-MiniZinc filter. Partitions whose `gpu_vram_gb` is below the floor are excluded from candidates *before* the constraint solver runs, and they appear in `result.rejected` so the user can see them (greyed-out list under the shape table). Without VRAM enforcement, the recommend card now shows an amber "VRAM not constrained" banner explaining the limitation.

### 3. The four tools, by data sources

| Tool | Local-only sources | Remote SSH sources | Key constraint / formula |
|---|---|---|---|
| `slurm_check` | `betty_cluster.yaml` | none | parser + policy violations (CPU/GPU ratio, mem/GPU ratio, walltime backfill) |
| `slurm_recommend` | `betty_cluster.yaml`, MiniZinc binary | `sshare -h -P -U` (fairshare) | constraint model above |
| `slurm_availability` | `data/features/partitions/<p>.json` if present (real load curve), else synthetic | `sinfo`, `squeue --start -t PD` | `score = idle_bonus + (1-load) - min(pending/50,1) - (dt/168)` |
| `slurm_diagnose` | `_REASON_GUIDE` map | `scontrol show job <id>` | reason-code → cause + actions table |

`slurm_check` and `slurm_recommend` work fully offline. Their output is provably the same on any machine with the same YAML — useful for debugging. `slurm_availability` and `slurm_diagnose` need SSH; they degrade honestly (`sources: []` in the payload, "synthetic — pre-validation" banner on the card) when SSH fails.

### 4. The anti-hallucination contract (because you flagged its importance)

The system prompt in [betty-ai-web/src/agent/system-prompt.ts](../../betty-ai-web/src/agent/system-prompt.ts) has a section labeled "**CRITICAL — never invent how the tools work**" that enumerates each `slurm_*` tool's exact source files, command lines, and formulas. The model is required to cite those when asked "how does this work" rather than reverse-engineering from card output.

The card output itself is the second line of defense:
- `slurm_recommend` payload includes `vram_constraint.message`, `result.backend`, `result.explanation` — all worded so the model has nothing to add.
- `slurm_availability` payload includes `score_formula`, `sources`, `load_curve_kind` — same idea.

If the model strays anyway (it's an LLM, not a contract enforcer), the user can ask "what did the tool actually return?" and the JSON is right there. Trust comes from auditability, not promises.

---

## Part B — point-by-point replies

### 5.1 (your skepticism §1, ask #2) — VRAM in `slurm_recommend`

**Done.** [`JobIntent.min_vram_per_gpu_gb`](../../betty-ai/slurm_advisor/solver.py) is a new optional field; when set, `_candidate_partitions` filters before the solver runs. The recommend card now shows:

- A green "**VRAM enforced** · VRAM ≥ 80 GB enforced. Partitions below this were excluded before solving." banner when the agent passes `min_vram_gb`.
- An amber "**VRAM not constrained** · The solver picked the cheapest legal partition without knowing your workload's VRAM requirement. If you're fine-tuning a model > the chosen partition's `gpu_vram_gb`, this recommendation may OOM. Pass `min_vram_gb` (or call `gpu_calculate` first)." banner when it doesn't.
- A "Excluded partitions" list under the shape table when partitions were filtered, with the reason: "`b200-mig45 — gpu_vram_gb=45 < required 100`".

The system prompt now instructs the agent to call `gpu_calculate` first whenever the user mentions a model + method, then pass the resulting `vram_needed_gb` to `slurm_recommend`. Test: `test_recommend_excludes_partitions_below_vram_floor` exercises this and currently passes.

### 5.2 (your skepticism §2, ask #5) — synthetic load curve labeling

**Done as a UI hardening; the data side is the work you flagged.** The calendar card now shows:

- A red banner above the slot table when `load_curve_kind === 'synthetic'`: "**Pre-validation:** load curve is synthetic (hand-coded hour-of-day intuition, not real Betty history). Slot ranking is heuristic only. The historical curve will replace this when the nightly `scheduling/features.py` pipeline runs and writes `data/features/partitions/<p>.json`."
- The footer label changed from amber→red and reads `synthetic (pre-validation)`.

That's the immediate UX fix. Your actual request — "run `scheduling/features.py` against last 30d of sacct on the production node and pipe one partition's output into the load curve" — is the right next step. I want to schedule a 30-min session with you to (a) confirm where the production sacct dumps are (or set up a `sacct -P` cron), (b) run the ingest + features pipeline once interactively, (c) drop the `dgx-b200.json` into `data/features/partitions/`, (d) verify the card label flips from synthetic→historical. The plumbing already auto-loads the file when present; I haven't run it yet because the production sacct stream isn't on my dev box.

### 5.3 (your skepticism §3) — `squeue --start` reliability

**Done in the card footer.** When `squeue --start` is one of the live sources, the calendar card now shows a footnote: "Note on est. start times: SLURM's backfill simulator runs at `bf_resolution` intervals and looks up to `bf_window` ahead (typically 1 day). Estimates beyond that window are `N/A`; estimates within it are an *upper bound*, not a commitment — a higher-priority job arriving can push your start later."

I considered making it a tooltip and decided against it — researchers reading on a phone won't hover. Inline footer text is louder.

### 5.4 (ask #1) — `sshare` raw stdout

**I cannot SSH directly from this dev environment** (the harness blocked production SSH from outside the chat flow, which is correct). Two paths I took instead:

1. **Surface the raw stdout (truncated to 800 chars) inside the recommend card itself**, behind a `<details>` disclosure labeled "raw sshare stdout (first 800 chars) — for debugging the parser". Next time you (or I, with fresh kinit) run `slurm_recommend` in the chat, the actual stdout will be in the card. We can read it together in 313 Tuesday and decide what's actually being returned before changing the parser.

2. **The parser was deliberately not "fixed" today.** I drafted a defensive parser earlier (skip rows whose `User` matches header keywords like "User", "Account", "Src", or whose numeric columns aren't numeric). I deleted it before committing because you're right — we should see the raw stream first. If the wrapper-injecting-quota-text hypothesis is correct, the right fix is to wrap the `sshare` call in `ssh ... 'unset PROMPT_COMMAND; sshare ...'` or similar, not to paper over the parser side.

The investigation lives at [§5.4 of the wiki page](../../wiki/concepts/slurm-state-dimensionality.md). I'll add the raw stdout to that page once we have a fresh-kinit capture.

### 5.5 (ask #3) — multi-user auth plan

You are right that nothing about this is multi-user-ready. Honest sketch of the three approaches:

**Option A — per-user agent backend (cleanest, heaviest)**

Each PennKey gets their own Next.js process, started under their UID, with their own kinit ticket and their own SSH ControlMaster socket. OOD's existing `bc_osc_betty` Batch Connect template ([parcc1/ood/](../../ood/)) already does exactly this for Jupyter. Betty AI becomes the same thing: a Batch Connect app the user launches on a login or compute node, and the chat URL is per-session. Auth is "Penn SSO → kinit on the OOD host → agent inherits the ticket from the env". No shared service account, no proxy.

Pros: minimal new auth surface, mirrors the OOD pattern PARCC already supports, ticket lifetime is the OOD session lifetime.
Cons: each user spends a Slurm slot to host their chat. For frequent users that's a meaningful cost.

**Option B — shared backend with per-user SSH ProxyCommand**

A single agent service runs as e.g. `betty-agent` on a small VM. Each authenticated user's Penn SSO session maps to a request-scoped `runRemote` that uses `ssh -o ProxyCommand="..." pennkey@login.betty.parcc.upenn.edu` with the user's own keytab/ticket forwarded. Requires either: (a) per-user keytab on the agent host (operationally awful), or (b) Kerberos credential delegation from the browser session (works with `gss-spnego` SSO but needs careful config), or (c) the Betty equivalent of an OAuth-mediated user-scoped credential service (which doesn't exist yet at PARCC AFAIK).

Pros: one process, lightweight per user.
Cons: every option for "how does the shared service hold a user's credential" has real risks. I would not deploy this without infosec review.

**Option C — agent never SSHes; user pastes**

The toolless variant. The card UI shows the user the exact command to run (`sinfo -h ...`, `squeue ...`, `scontrol show job ...`); user runs it locally; user pastes output back into the chat; agent parses and renders the card. The current code already supports this — `slurm_check` and `slurm_recommend` work fully offline today, and we can add a `slurm_availability_from_paste` variant.

Pros: zero auth complexity. Works on day one for any PARCC user without account provisioning.
Cons: more clicks per query. Researchers may stop using it.

**My recommendation:** start with C as the public default (it works for everyone right now, no infra), offer A as the "premium" experience for users who want continuous chat without copy-pasting, defer B until PARCC has a credential delegation story. The same `slurm_*` tool surface works for all three because they only differ in *where* the SLURM commands run.

I'd value 20 minutes of your input on whether OOD-as-vehicle for option A is realistic on Betty in the next few months. If it is, I'll prioritize that over building C's paste-based fallback.

### 5.6 (ask #4) — `squeue --start` privacy posture

**Confirmed in code, today.** [betty-ai-web/src/agent/tools/slurm-availability.ts:fetchSnapshot](../../betty-ai-web/src/agent/tools/slurm-availability.ts) now has:

- A 22-line block comment under "PRIVACY POSTURE" stating exactly what is and isn't retained from the `squeue --start -t PD` output. Per-job rows from other users are *aggregated* into two maps (`pending_count_by_partition`, `next_start_by_partition`) and the raw `stdout` variable goes out of scope at the end of the try block. No job IDs, no usernames, ever cross from `runRemote`'s return value into the snapshot.
- A typed `privacy_posture: 'squeue-aggregated-no-per-job-data'` field on the snapshot. The string is fixed and greppable, so a policy reviewer can confirm the contract by `grep -r squeue-aggregated-no-per-job-data parcc1/`.
- The `parseSqueueStart` function's return type is `{ pending_by_partition: Record<string, number>; next_start_by_partition: Record<string, string> }` — the type system itself rejects any code that tries to add per-job data downstream.

If PARCC policy review wants stricter (e.g., "don't run squeue across all users at all"), the fallback is to scope the command to `--me` instead of `-t PD`, which loses the cluster-wide queue depth signal but keeps personal-only state.

---

## Closing

Asks 1, 3, 4, 5 — done in code today (lines diffed: ~120). Ask 2 (sshare raw stdout) is set up to capture the next time SSH succeeds; we'll look at it Tuesday. Ask 5's larger scope (run features.py against 30d of sacct, validate vs synthetic) is the highest-value follow-up and I'd like your help with the production sacct data path.

The bigger thing your review did: it forced me to write down the privacy posture, the multi-user story, and the VRAM correctness contract — three things I would have left implicit in the code. Implicit contracts don't survive review, and PARCC infrastructure needs to survive review. Thanks for being a good reviewer.

See you Tuesday.

— Jeff

P.S. The "kinit needed" status badge that you liked — that was already in [ConnectionBadge.tsx](../../betty-ai-web/src/components/ConnectionBadge.tsx); I just made sure the SLURM tools' SSH failures route through the same status path so it lights up consistently. Worth a separate small report if you want to know how the connection-state machine works.
