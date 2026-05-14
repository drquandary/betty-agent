# Betty AI — Implementation Plan

Authoritative brief for agents working on Phase 2. Each swarm agent starts cold — everything they need is here.

## Repo location (read this first)

The repo lives at `/Users/jvadala/BettyAgent /parcc1`. The parent directory `BettyAgent ` has a **literal trailing space**. Always quote Bash paths. Dedicated tools (Read, Glob, Grep, Edit, Write) handle it fine.

## Current state (Phase 1)

- Next.js 15 + React 19 chat GUI, Claude Agent SDK backend
- Entry points: [betty-ai-web/src/app/api/chat/route.ts](betty-ai-web/src/app/api/chat/route.ts) → [betty-ai-web/src/agent/server.ts](betty-ai-web/src/agent/server.ts)
- Tools exposed (under [betty-ai-web/src/agent/tools/](betty-ai-web/src/agent/tools)): `wiki_search`, `wiki_read`, `wiki_write`, `gpu_calculate`, `cluster_run`, `cluster_submit`, `cluster_status`, `slurm_availability`, `slurm_check`, `slurm_diagnose`, `slurm_recommend`
- System prompt: [betty-ai-web/src/agent/system-prompt.ts](betty-ai-web/src/agent/system-prompt.ts)
- Wiki: 15 concepts, 11 entities, 5 models, 7 sources; schema at [wiki/SCHEMA.md](wiki/SCHEMA.md)
- Python brain: [betty-ai/](betty-ai) — model registry, GPU calculator, Slurm/DeepSpeed/training templates

## Goal of this phase

1. Fix the prompt/code mismatch where the agent is told it can "file experiments" but has no write tool.
2. Add real cluster execution (read cluster state, submit sbatch jobs, poll status) over SSH with human-in-the-loop confirmation.
3. Dogfood the whole system end-to-end on one realistic user journey.

## Decisions (locked)

| # | Decision | Value |
|---|----------|-------|
| D1 | SSH credential strategy | Shell out to `ssh` CLI, inherit user's Kerberos cache (`kinit` on host) |
| D2 | SSH connection handling | Pool one connection per server process, 30s keepalive, auto-reconnect on failure |
| D3 | Server topology | Runs on user's laptop, Penn VPN required |
| D4 | `canUseTool` tiers | **Tier 0 auto-approve**: wiki reads, `gpu_calculate`, append-to-`wiki/log.md`. **Tier 1 prompt once per session**: read-only cluster commands in whitelist, wiki updates. **Tier 2 always prompt**: `cluster_submit`, wiki creates outside `experiments/` |
| D5 | Job output streaming | Defer live streaming. Phase 2 = poll `sacct` + tail `.out`/`.err` |
| D6 | Experiment page ownership | Marker-delimited regions: agent owns `## Status` / `## Runtime` between `<!-- betty:auto-start -->` / `<!-- betty:auto-end -->` markers. User owns `## Goal` / `## Lessons` |
| D7 | Cluster-read whitelist | Start minimal: `squeue`, `sinfo`, `parcc_*`, `ls /vast/...`, `cat` of jvadala's `.out`/`.err`/`.log` files. Expand from dogfood findings. `scancel` deferred |

## Test harness requirements (apply to ALL tracks)

Each deliverable must include automated tests. If the repo has no test runner yet, set one up — **vitest** is the right choice for this Next.js + TS stack. Add:

- `betty-ai-web/vitest.config.ts`
- `"test": "vitest run"` and `"test:watch": "vitest"` scripts in [betty-ai-web/package.json](betty-ai-web/package.json)
- Colocated `*.test.ts` files next to the unit under test (e.g., `wiki-write.test.ts`)

Tests must cover:
- **Happy path** — the expected input/output contract
- **Security boundaries** — path traversal, whitelist bypass attempts, malformed inputs
- **Error paths** — what happens when the filesystem, SSH, or network fails

Before reporting done, every agent runs `npm run typecheck` and `npm run test` and confirms both pass.

## Tracks

### Track A — `wiki_write` SDK tool

**Files**:
- NEW `betty-ai-web/src/agent/tools/wiki-write.ts` — mirror the traversal guard style in [betty-ai-web/src/agent/tools/wiki-read.ts](betty-ai-web/src/agent/tools/wiki-read.ts). Input: `{ page: string, body: string, mode: 'create' | 'update' | 'append' }`. Enforce: path resolves under `paths.wiki`, `.md` forced, frontmatter required on `create`, append-only for `wiki/log.md`. For `update`, preserve user-owned sections; agent-owned content lives between `<!-- betty:auto-start -->` and `<!-- betty:auto-end -->` markers (D6).
- NEW `betty-ai-web/src/agent/tools/wiki-write.test.ts` — vitest unit tests: happy path (create, append, update), path traversal rejection (`../`, absolute, symlinked), missing frontmatter rejection, marker-region preservation.
- MODIFY `betty-ai-web/src/agent/server.ts` — import and register `wikiWriteTool`, add to `allowedTools`. Add a `canUseTool` callback per D4. Export `writeWikiPage()` helper so Track C can auto-log experiments.
- MODIFY `betty-ai-web/src/app/api/chat/route.ts` — extend SSE frame types to carry a `tool_permission` event (a JSON frame the client can render as an Approve/Deny card). Keep backwards-compat with existing `text` frames.

**Acceptance**:
- Writes outside `wiki/` rejected by tests covering `../`, absolute paths, and symlinks.
- Schema-lint rejects `create` without required frontmatter (`name`, `description`, `type`).
- Marker-region preservation verified by round-trip test.
- Tier 2 writes (creates outside `experiments/`) fire `canUseTool`; Tier 1 writes (updates, experiments creates) fire `canUseTool` once per session; appends to `wiki/log.md` auto-approve.
- Exports `writeWikiPage(path, body, mode)` for server-side use by Track C.

### Track B — Wiki seed + UI confirmation card

**Files**:
- NEW `wiki/experiments/TEMPLATE.md` — frontmatter per [wiki/SCHEMA.md](wiki/SCHEMA.md), sections: `## Goal` (user), `## Status` (agent, marker-delimited), `## Runtime` (agent, marker-delimited), `## Lessons` (user).
- NEW `wiki/experiments/.gitkeep`
- MODIFY `wiki/index.md` — add "Experiments" section.
- NEW/MODIFY chat UI component under `betty-ai-web/src/components/` — render a `tool_permission` SSE frame as an Approve/Deny card. Post the result back via a new `POST /api/chat/permission` endpoint (add it to [betty-ai-web/src/app/api/chat/route.ts](betty-ai-web/src/app/api/chat/route.ts) or a new sibling route).
- NEW `betty-ai-web/src/components/*.test.tsx` — React Testing Library tests: card renders with tool name + args summary, Approve dispatches correct payload, Deny dispatches correct payload, disconnect during pending request fails closed.

**Acceptance**:
- `ls "wiki/experiments"` shows TEMPLATE.md.
- Manual browser test: asking the agent to file an experiment produces an approval card; click produces the right callback.
- UI unit tests pass.

### Track C — SSH transport + cluster tools

**Files**:
- NEW `betty-ai-web/src/agent/cluster/ssh.ts` — shell out to `ssh` CLI (D1). Pooled single connection via `ssh -M -S <control-socket>` ControlMaster (D2). Inherits Kerberos ticket from `kinit` cache on host. Auto-reconnect on socket failure. Export `runRemote(command): Promise<{stdout, stderr, exit}>` and `uploadFile(localPath | buffer, remotePath)`.
- NEW `betty-ai-web/src/agent/cluster/whitelist.ts` — regex allowlist (D7). Export `isSafeReadCommand(cmd): boolean`. Also export the regex list so [betty-ai-web/src/agent/system-prompt.ts](betty-ai-web/src/agent/system-prompt.ts) can render it inline (single source of truth).
- NEW `betty-ai-web/src/agent/cluster/*.test.ts` — unit tests for whitelist (positive + adversarial cases: `; rm -rf /`, command injection via backticks, unicode lookalikes).
- NEW `betty-ai-web/src/agent/tools/cluster-run.ts` — MCP tool. Input: `{ command: string }`. Rejects non-whitelisted. Returns `{stdout, stderr, exit}`. `readOnlyHint: true`. Tier 1 per D4.
- NEW `betty-ai-web/src/agent/tools/cluster-submit.ts` — Input: `{ script_body: string, sbatch_args?: string[], experiment_slug: string }`. Uploads script to `/vast/home/j/jvadala/.betty-ai/scripts/<slug>.sbatch`, runs `sbatch`, parses JobID. Tier 2 per D4. On success: calls Track A's `writeWikiPage()` to create `wiki/experiments/YYYY-MM-DD-<slug>.md` with the script inlined and `job_id` in frontmatter; appends a line to `wiki/log.md`. Atomic: if sbatch fails, no wiki write; if wiki write fails, error surfaces JobID for recovery.
- NEW `betty-ai-web/src/agent/tools/cluster-status.ts` — Input: `{ job_id: string }`. Runs `sacct -j <id> --format=JobID,State,Elapsed,ExitCode` or `squeue -j <id>`. Updates the matching experiment page's marker-delimited `## Status` / `## Runtime` sections via Track A's helper.
- NEW `betty-ai-web/src/agent/tools/cluster-*.test.ts` — mock SSH transport. Test: happy submit, rejected-command path, atomicity (sbatch fails → no wiki write), status update preserves user sections.
- MODIFY `betty-ai-web/src/agent/server.ts` — register the three tools in `allowedTools` and `bettyTools`. Extend `canUseTool` tiers per D4.

**Acceptance**:
- `cluster_run "squeue -u jvadala"` returns live output within 3s of warm connection (integration test, skipped in CI unless `BETTY_SSH_OK=1`).
- `cluster_run "rm -rf /"` rejected at whitelist, never reaches SSH.
- Submit atomicity verified by test.
- Status update preserves user-owned sections.

### Track D — System prompt + schema update

**Files**:
- MODIFY `betty-ai-web/src/agent/system-prompt.ts` — remove "Phase 1: can only TALK about commands". Document the three cluster tools with tier info (D4). Import whitelist from Track C and render it inline. Add good/bad `cluster_run` examples. Document auto-logging of submissions.
- MODIFY `wiki/SCHEMA.md` — add "Machine-written experiment pages" section explaining marker regions (D6) and what frontmatter fields Betty AI sets automatically.
- MAYBE MODIFY `.claude/agents/betty-ai.md` — only if that file is still the source of truth for some path. Otherwise leave.
- NEW `betty-ai-web/src/agent/system-prompt.test.ts` — snapshot test that `buildSystemPrompt()` includes tool names from `allowedTools` and the whitelist patterns.

**Acceptance**:
- Prompt contains `cluster_run`, `cluster_submit`, `cluster_status`, `wiki_write`.
- Prompt no longer says "in this phase you can only TALK".
- Snapshot test passes.

### Track E — Dogfood journey (after A+B+C+D land)

**Process**:
1. Fresh browser session. User prompt: *"Help me fine-tune Llama 3 8B with LoRA on a 500-example test dataset — start from zero."*
2. Walk full journey: cluster state check → partition recommendation → `gpu_calculate` → draft sbatch → confirm → submit → poll → capture logs → file results.
3. At each step, capture: (a) hallucinations, (b) missing citations, (c) missing tools, (d) UX friction.
4. Output: `wiki/experiments/2026-04-18-dogfood-llama3-8b-lora.md` + `raw/dogfood/2026-04-18-notes.md` with ranked gap list (≥5 items, severity labeled).

**Acceptance**: End-to-end submission reaches a SLURM JobID; auto-generated wiki page exists; gap list produced.

## Dependency graph

```
Wave 1 (parallel):
  Track A ── wiki_write tool + server.ts registration + SSE permission frame
  Track B ── wiki seed + UI confirmation card (touches UI files only)
  Track C.1 ─ SSH transport (ssh.ts + whitelist.ts, NO server.ts touch yet)

Sync S1 ── Wave 1 lands; A's writeWikiPage() helper exported; SSE protocol stable

Wave 2 (parallel):
  Track C.2 ─ cluster-run/submit/status tools + server.ts registration
  Track D ── system-prompt.ts + SCHEMA.md (references real tool names from A+C)

Sync S2 ── All tools live; integration tests green

Wave 3:
  Track E ── interactive dogfood, produces backlog for Phase 2b
```

**Conflict avoidance**: Only Track A modifies `server.ts` in Wave 1. Track C.1 in Wave 1 only creates new files. Track C.2 in Wave 2 re-enters `server.ts` after A has landed. Track D in Wave 2 reads the final tool names.

## Ready to execute checklist

- [x] D1–D7 locked
- [x] PLAN.md committed
- [ ] Wave 1 agents launched
- [ ] Wave 1 merged & tests green
- [ ] Wave 2 agents launched
- [ ] Wave 2 merged & tests green
- [ ] Dogfood journey complete
