# Betty AI — LLM Training & Inference for Betty Cluster

A conversational AI agent that makes it dead simple to fine-tune and serve LLMs on UPenn's Betty HPC cluster (PARCC).

## What it does

Tell Betty AI what you want in plain English:

> "I want to fine-tune Llama 3 70B on my customer support dataset"

Betty AI will:
1. Ask clarifying questions (dataset size, training method, budget)
2. Calculate optimal GPU allocation and estimated cost
3. Generate production-ready Slurm job scripts
4. Check/create conda environments
5. Submit the job and monitor it

## Setup

### Prerequisites
- [Claude Code](https://claude.ai/code) installed
- Penn VPN or campus network
- Active Betty account (ColdFront allocation)

### First time setup

```bash
# 1. Clone this repo
git clone <repo-url> parcc1
cd parcc1

# 2. Configure your settings
cp betty-ai/configs/team.yaml.example betty-ai/configs/team.yaml
# Edit team.yaml with your PennKey and project path

# 3. Start Claude Code
claude
```

### On Betty (one-time)

```bash
# Set up shared conda environments
bash betty-ai/scripts/setup_env.sh /vast/projects/<your-project>

# Configure HuggingFace cache (critical — prevents filling home quota)
bash betty-ai/scripts/setup_hf_cache.sh /vast/projects/<your-project>

# If using gated models (Llama, etc.):
echo 'export HF_TOKEN=<your-token>' >> ~/.bashrc
```

## Usage

From the repo directory, run `claude` and invoke the agent:

```
/agent betty-ai
```

Or just ask questions naturally — the agent is referenced in CLAUDE.md.

### Example conversations

**Fine-tuning:**
> "Fine-tune Llama 3 8B on the alpaca dataset with LoRA"
> "Train a 70B model on my custom data — I have about 100K examples"
> "What's the cheapest way to fine-tune Mistral 7B?"

**Inference:**
> "Serve Llama 3 70B for my team"
> "Set up vLLM for Mixtral 8x22B"
> "I need a local API for code generation"

## Project structure

```
parcc1/
├── .claude/agents/betty-ai.md    The agent definition (the brain)
├── CLAUDE.md                      Cluster access + agent overview
├── PROJECT.md                     Per-project context template (customize for your work)
│
├── betty-ai/                      Machine-readable configs & templates
│   ├── models/                      Model registry + GPU calculator
│   ├── templates/                   Slurm, DeepSpeed, training script templates
│   ├── configs/                     Cluster specs, team settings, defaults
│   ├── scripts/                     Environment setup, monitoring helpers
│   └── generated/                   Per-session output (gitignored)
│
├── raw/                           [Wiki Layer 1] Immutable source documents
│   ├── docs/                        PARCC docs, papers, guides
│   ├── cluster_exploration/         Exploration session logs
│   ├── experiments/                 Raw training outputs
│   └── datasets/                    Dataset documentation
│
└── wiki/                          [Wiki Layer 2] Agent-maintained knowledge
    ├── SCHEMA.md                     Rules for wiki format and operations
    ├── index.md                      Catalog of all pages
    ├── log.md                        Chronological operation log
    ├── entities/                     Real things (cluster, partitions, storage)
    ├── concepts/                     Abstract ideas (LoRA, DeepSpeed, etc.)
    ├── models/                       Specific LLMs with our usage notes
    ├── sources/                      Summaries of raw sources
    └── experiments/                  One page per training run
```

## Knowledge base — Karpathy LLM Wiki pattern

This repo uses Karpathy's LLM Wiki pattern for persistent, compounding knowledge.
See `wiki/SCHEMA.md` for the full specification.

### Three layers
1. **`raw/`** — Source documents (agent reads, never writes)
2. **`wiki/`** — Agent-maintained markdown knowledge base
3. **`.claude/agents/betty-ai.md` + `CLAUDE.md`** — Schema telling the agent how to operate

### Three operations
- **Ingest** — Drop a source into `raw/`, say "ingest this" → agent updates the wiki
- **Query** — Ask "what do we know about X?" → agent searches the wiki first, files answer back
- **Lint** — Say "lint the wiki" → agent finds orphans, contradictions, stale claims

Every training run becomes an experiment page with links to model, dataset, and method pages.
Knowledge compounds over time instead of being re-derived from scratch each session.

## Key docs

- `BETTY_SYSTEM_GUIDE.md` — Complete cluster documentation (also in `raw/docs/`)
- `BETTY_LLM_AND_WORKFLOWS_GUIDE.md` — LLM workflow recipes (also in `raw/docs/`)
- `wiki/SCHEMA.md` — Wiki format and operation rules
- `PROJECT.md` — Per-project context (customize for each research effort)

## Team

Built for the research group at UPenn PARCC. Contact jvadala for access.
