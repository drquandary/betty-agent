# Project Context — Betty AI Agent

> This file describes the project the agent is actively working on.
> The agent reads this automatically at session start.

## Research Overview

**Project name**: Betty AI
**PI / Lab**: _TBD_
**Group**: UPenn PARCC (Advanced Research Computing Center)
**Betty account**: _TBD_
**Allocation**: _TBD_

### Goal
Betty AI is a general-purpose conversational research assistant for the Betty HPC cluster. It helps Penn researchers do **whatever research task they need** on Betty — fine-tune LLMs, serve inference endpoints, run multi-node MPI jobs, explore datasets, debug Slurm failures, set up conda environments — without having to hand-write Slurm scripts or memorize cluster quirks.

The agent is *not* tied to a specific model or dataset. It's an orchestrator: it asks what the user wants, picks appropriate resources, generates the right job scripts, submits, and monitors.

### Current focus
_TBD — fill in what you're actively building next (e.g. web GUI polish, new agent tool, wiki ingestion flow, specific user workflow)_

---

## What Betty AI is made of

Betty AI has two halves plus a knowledge layer:

### 1. Agent brain — `betty-ai/`
Python + YAML configs, templates, and helper scripts that the agent uses to reason about the cluster:
- `models/model_registry.yaml` — VRAM/resource database for common LLMs
- `models/gpu_calculator.py` — resource allocation calculator
- `templates/` — Slurm, DeepSpeed, training, and conda environment templates
- `configs/betty_cluster.yaml` — machine-readable cluster specs
- `configs/defaults.yaml` — default behaviors
- `configs/team.yaml.example` — per-user config template
- `scripts/` — env setup and sanity-check helpers

### 2. Web GUI — `betty-ai-web/`
A Next.js 15 + React 19 chat interface built on `@anthropic-ai/claude-agent-sdk`:
- `src/app/api/chat/route.ts` — chat API endpoint
- `src/agent/server.ts` — agent server setup
- `src/agent/system-prompt.ts` — agent persona/instructions
- `src/agent/tools/` — agent tools: `gpu-calculate`, `wiki-read`, `wiki-search`
- `src/components/` — chat UI (ChatPane, ChatMessage, QuickStartTiles, StatusBar)

### 3. Knowledge base — `raw/` + `wiki/`
Karpathy-style LLM Wiki pattern:
- `raw/` — immutable source documents (PARCC docs, papers, exploration logs, experiment outputs)
- `wiki/` — agent-maintained markdown knowledge base with entities, concepts, models, sources, experiments
- `wiki/SCHEMA.md` — rules the agent follows to keep the wiki clean
- `wiki/index.md` — catalog of all pages
- `wiki/log.md` — chronological operation log

---

## Betty cluster specifics

### Paths
```
Personal:  /vast/home/j/jvadala
Projects:  /vast/projects/<project>
```

### Environment activation (on Betty)
```bash
module load anaconda3
source activate /vast/projects/<project>/envs/<env>
```

### Key helper scripts (PARCC-provided)
- `parcc_quota.py`, `parcc_du.py` — storage
- `parcc_sfree.py`, `parcc_sqos.py` — partitions, QOS limits
- `parcc_sreport.py --user jvadala` — usage/billing
- `parcc_sdebug.py` — debug failed jobs or nodes

See `CLAUDE.md` for the full cluster quick-reference.

---

## Team

| Name | PennKey | Role | Focus |
|------|---------|------|-------|
| Jeff Vadala | `jvadala` | Builder / maintainer | Agent, GUI, wiki system |

_Add teammates here as they join._

---

## Common tasks the agent should handle

The agent is general-purpose, but should be especially fluent at:

1. **Fine-tuning LLMs** — pick GPUs, generate Slurm + DeepSpeed/LoRA scripts, submit, monitor
2. **Serving inference** — set up vLLM/TGI endpoints, expose to the team
3. **Multi-node / MPI jobs** — generate `sbatch` scripts with `srun --mpi=pmix`
4. **Environment management** — create/activate conda envs in `/vast/projects/...`
5. **Debugging** — parse Slurm failure logs, diagnose node/partition issues
6. **Wiki operations** — ingest new `raw/` docs into `wiki/`, answer "what do we know about X?" from wiki, run lint passes
7. **Cost estimation** — estimate GPU-hours and cluster point (PC) usage before submitting

---

## What worked / what didn't

### Worked
- _TBD — log successful experiments with links to `[[wiki/experiments/...]]` pages_

### Didn't work
- _TBD — document failed approaches so the agent doesn't re-suggest them_

---

## Known issues & gotchas

- `conda activate` doesn't work on Betty — use `source activate` instead
- Home dir is only 50 GB — always set `HF_HOME` to `/vast/projects/<project>/hf_cache`
- `interact` helper script is broken — use `srun` directly
- Login nodes are for editing/syncing/submitting only — **never** train on login nodes
- Project membership changes in ColdFront can take up to 1 hour to propagate
- ColdFront membership must be confirmed by the PI if login fails
- The local repo's parent directory is literally `BettyAgent ` with a trailing space — quote Bash paths accordingly

---

## Next steps / roadmap

- [ ] Fill in the `_TBD_` fields above (PI, allocation, current focus)
- [ ] _Add next concrete milestones here_
