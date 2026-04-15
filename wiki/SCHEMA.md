# Wiki Schema — How the Agent Maintains This Knowledge Base

> This file is the CONTRACT between you (the researcher) and the Betty AI agent.
> It tells the agent how to organize, update, and navigate the wiki.
> Based on Karpathy's LLM Wiki pattern.

## The Three Layers

### 1. Raw Sources (`raw/`)
**Immutable inputs.** The agent reads from these but NEVER modifies them.
- `raw/docs/` — PARCC documentation, papers, articles
- `raw/cluster_exploration/` — Captured output from Betty exploration sessions
- `raw/experiments/` — Raw training logs, metrics, checkpoints references
- `raw/datasets/` — Dataset documentation (not the data itself — data stays in `data/`)

### 2. The Wiki (`wiki/`)
**LLM-maintained knowledge base.** The agent OWNS this — creates, updates, and cross-references.
- `wiki/entities/` — Real things that exist (Betty cluster, dgx-b200 partition, DGX B200 GPU, VAST storage)
- `wiki/concepts/` — Abstract ideas (LoRA, DeepSpeed ZeRO-3, QLoRA, tensor parallelism, gradient checkpointing)
- `wiki/models/` — Specific LLMs with resource specs and our experience using them
- `wiki/sources/` — Summaries of raw sources (one `.md` per source document)
- `wiki/experiments/` — One page per training run with config, results, lessons
- `wiki/index.md` — Catalog of every wiki page, organized by category
- `wiki/log.md` — Chronological log of ingests, queries, lint passes

### 3. The Schema (this file + `CLAUDE.md` + `.claude/agents/betty-ai.md`)
**Configuration for the agent.** Tells it how to operate on the wiki.

---

## Page Conventions

### File naming
- Lowercase, hyphens for spaces: `dgx-b200-partition.md`, `lora-fine-tuning.md`
- Entity pages: short, canonical name
- Concept pages: the common term, not a sentence
- Source pages: `YYYY-MM-DD-short-title.md`
- Experiment pages: `YYYY-MM-DD-exp-NNN-brief-desc.md`

### Page structure (YAML frontmatter + markdown)

```yaml
---
type: entity | concept | model | source | experiment
tags: [betty, gpu, slurm]  # for Dataview / search
created: 2026-04-08
updated: 2026-04-08
sources: [source-page-1, source-page-2]  # what sources contributed
related: [other-page, another-page]  # cross-references
status: current | superseded | tentative
---

# Page Title

## One-line summary
<!-- What this page is about in a sentence -->

## Content
<!-- Main body - structured by page type -->

## See also
- [[related-page-1]]
- [[related-page-2]]

## Sources
- [[source-2026-04-08-betty-exploration]] — Initial cluster audit
```

### Cross-references
Use `[[page-name]]` wiki-link syntax (Obsidian-compatible).
The agent should create bidirectional links — if A references B, B should reference A.

---

## Operations

### INGEST
When a new source arrives (raw doc, paper, exploration session output, etc.):

1. Read the source from `raw/`
2. Write a summary page at `wiki/sources/YYYY-MM-DD-title.md`
3. Identify entities, concepts, and models mentioned
4. For each one:
   - If a wiki page exists: update it with new info, add source reference, flag contradictions
   - If not: create a new entity/concept/model page
5. Update `wiki/index.md` with any new pages
6. Append to `wiki/log.md`: `## [YYYY-MM-DD] ingest | <source title>` with bullet list of pages touched
7. Report to user: what was added, what was updated, what contradictions found

**A single source should typically touch 5-15 wiki pages.**

### QUERY
When the user asks a question:

1. Read `wiki/index.md` first to see what exists
2. Drill into relevant pages
3. Synthesize an answer with `[[citations]]` back to wiki pages
4. **Ask the user**: "Should I file this answer back into the wiki?"
   - If yes: create or update a page, usually in `wiki/concepts/` or a comparison page
   - Append to log: `## [YYYY-MM-DD] query | <question>` + resulting page

### LINT
Periodically (or on request), health-check the wiki:

1. Find orphan pages (no inbound links) — propose merging or linking
2. Find contradictions between pages — propose resolution
3. Find stale claims (superseded by newer sources) — update or mark `status: superseded`
4. Find concepts mentioned but without their own page — propose creating
5. Find data gaps — suggest web searches or new sources
6. Check `index.md` matches actual files in `wiki/`
7. Report findings; user decides what to act on

---

## Project-Specific Rules

### Betty cluster is the PRIMARY ENTITY
Almost everything else (partitions, GPUs, storage, QOS) is a child of Betty. Keep these pages tight and factual — the agent should prefer updating existing Betty pages over creating parallel ones.

### Models: one page per model
`wiki/models/qwen2.5-vl-7b-instruct.md`, `wiki/models/llama-3-70b.md`, etc.
Each should mirror the data in `betty-ai/models/model_registry.yaml` but with:
- Our specific experience (what worked, what didn't)
- Benchmark results on our datasets
- Links to experiment pages that used this model

### Experiments: one page per training run
Template:
```markdown
---
type: experiment
model: [[qwen2.5-vl-7b-instruct]]
dataset: [[medical-tools-v2]]
method: lora
job_id: 5195231
status: running | complete | failed | killed
---

# Exp 001: Qwen2.5-VL LoRA on Medical Tools v2

## Goal
<!-- What were we trying to learn/achieve? -->

## Config
<!-- Link or inline config -->

## Results
<!-- Metrics, observations -->

## Lessons
<!-- What we learned, next steps -->
```

### Never duplicate data from `betty-ai/`
The `betty-ai/` directory has **machine-readable configs** (YAML, templates). The wiki has **human-readable knowledge**. Don't copy the YAML into wiki pages — link to it with: `See \`betty-ai/models/model_registry.yaml\` for full specs.`

---

## What to Track Over Time

1. **Every training run** → `wiki/experiments/` page
2. **Every cluster change** noticed → update `wiki/entities/betty-cluster.md`
3. **Every new model tried** → `wiki/models/<model>.md` + mention on dataset page
4. **Every insight** worth remembering → `wiki/concepts/` page
5. **Every failed approach** → document it so we don't repeat it

---

## Index Format

`wiki/index.md` should look like:

```markdown
# Wiki Index

## Entities
- [[betty-cluster]] — PARCC's DGX B200 supercomputer at UPenn (2 sources)
- [[dgx-b200-partition]] — Main GPU partition, 27 nodes, 216 B200 GPUs (1 source)
- [[vast-storage]] — InfiniBand NFS filesystem (1 source)

## Concepts
- [[lora-fine-tuning]] — Parameter-efficient fine-tuning method (3 sources)
- [[deepspeed-zero-3]] — Sharded training for large models (2 sources)

## Models
- [[qwen2.5-vl-7b-instruct]] — Vision-language model, 7B params, our current focus (1 experiment)
- [[llama-3-70b]] — Text-only 70B, not yet used

## Experiments
- [[2026-04-08-exp-001-qwen-vl-baseline]] — status: planned

## Recent sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-parcc-getting-started]]
```

## Log Format

`wiki/log.md` entries always start with `## [YYYY-MM-DD] <op>` so they're grep-able:

```markdown
## [2026-04-08] ingest | Betty cluster initial exploration
- Created: [[betty-cluster]], [[dgx-b200-partition]], [[b200-mig45-partition]], [[vast-storage]], [[parcc-helper-tools]]
- Updated: [[index]]
- Notes: First pass, many gaps remain

## [2026-04-08] query | What's the cheapest way to fine-tune a 7B model?
- Searched: [[dgx-b200-partition]], [[b200-mig45-partition]], [[lora-fine-tuning]], [[qlora]]
- Answer filed: [[cost-comparison-7b-methods]]

## [2026-04-08] lint | Monthly health check
- Orphan pages: 2 (proposed linking)
- Contradictions: 0
- Stale claims: 1 (dgx015 marked down, verified still down)
```

---

## Quick Commands the Agent Should Understand

- **"Ingest this"** → INGEST operation
- **"What do we know about X?"** → QUERY operation (consult wiki first, not external knowledge)
- **"Lint the wiki"** → LINT operation
- **"Start experiment 001"** → Create experiment page, generate Slurm script, submit, link everything
- **"What experiments have we run?"** → Read `wiki/index.md` experiments section + recent log entries
- **"What did we learn from <experiment>?"** → Read that experiment page
