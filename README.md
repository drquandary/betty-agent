# Betty Agent — AI Assistant for Research Computing on Betty Cluster

A conversational AI agent and web interface that makes it dead simple to run any research computing workload on UPenn's Betty HPC cluster (PARCC). From LLM fine-tuning to multi-node simulations, data analysis to GPU-accelerated workflows — just describe what you need in plain English.

## What it does

Tell Betty Agent what you want in plain English:

> "I want to fine-tune Llama 3 70B on my customer support dataset"
> "I need 4 GPUs for 8 hours — what partition should I use?"
> "Why is my job 12345 still pending?"
> "When is the best time to submit a 2-day GROMACS run this week?"
> "Is this sbatch script reasonable?" *(paste script)*
> "Run a multi-node MPI simulation with 8 nodes"
> "Set up a Jupyter notebook server with GPU access"

Betty Agent will:
1. Ask clarifying questions (resource needs, software requirements, budget)
2. Calculate optimal compute allocation and estimated cost
3. **Validate sbatch scripts and recommend partition shapes via the [SLURM Advisor](BETTY_SLURM_ADVISOR_REPORT.md) — a constraint-solver-backed tool that catches policy violations before they hit the scheduler**
4. Generate production-ready Slurm job scripts
5. Check/create conda environments and dependencies
6. Submit the job and monitor it
7. **Diagnose pending jobs** — explain why your job is stuck and what to do about it
8. Update the knowledge wiki with experiment details

## Capabilities by Research Phase

### ✅ Phase 1: LLM Fine-tuning & Inference (Current)
The agent is battle-tested for:
- **Fine-tuning** foundation models (Llama, Mistral, etc.) with LoRA/QLoRA/full fine-tuning
- **Serving** inference endpoints with vLLM/TGI
- **Resource optimization** for GPU memory, DeepSpeed configurations
- **Cost estimation** and GPU allocation strategies

### 🚀 Future Phases: General Research Computing
The same conversational interface and automation capabilities extend to:
- **Multi-node MPI jobs** for simulations, modeling, and parallel computing
- **Data processing pipelines** with Spark, Dask, or custom workflows
- **Interactive computing** (Jupyter, RStudio) with GPU access
- **Batch analysis** for bioinformatics, physics, chemistry, climate science
- **Custom software environments** and dependency management
- **Debugging** cluster issues, quota management, job optimization

**The architecture is general-purpose** — LLM workflows are just the first fully-implemented use case.

## Key Features

### 🎯 **SLURM Advisor — constraint-solver-backed job-shape recommendation**
*See full architecture in [`BETTY_SLURM_ADVISOR_REPORT.md`](BETTY_SLURM_ADVISOR_REPORT.md).*

A subsystem of Betty Agent that helps researchers shape and validate SLURM job submissions *before* they reach the scheduler. Four specialized tools:

- **`slurm_check`** — Lints any sbatch script against PARCC policy: per-partition geometry, QOS GPU caps, CPU-per-GPU ratios, memory caps, walltime backfill heuristics. Returns a status (`ok` / `revise` / `block`) with suggested fixes.
- **`slurm_recommend`** — Given high-level intent ("2 GPUs for 8 hours, fine-tuning a 70B model"), runs a [MiniZinc](https://www.minizinc.org/) constraint solver to pick the cheapest legal partition shape. Pre-filters by VRAM floor and NVLink requirement; falls back to deterministic Python search when MiniZinc isn't installed.
- **`slurm_availability`** — Combines live `sinfo` + `squeue --start` + `scontrol show res` with hour-of-day load profile to rank candidate time-slots. Renders a calendar table in chat.
- **`slurm_diagnose`** — Runs `scontrol show job` + `sprio -hl` in parallel; maps SLURM Reason codes to plain-English causes and identifies which priority factor (FAIRSHARE/JOBSIZE/AGE/...) is dragging the job down.

Five safety contracts encoded as code, tests, and visible UI signals: VRAM safety, synthetic-vs-historical curve labeling, backfill estimate caveats, queue privacy, graceful SSH degradation. **128 tests passing** (110 Python + 18 TypeScript) including an 82-case scenario matrix across hardware variations, VRAM requirements, walltime, time-of-day, and 10 realistic researcher personas — see [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](BETTY_SLURM_ADVISOR_TEST_PLAN.md).

### 🖥️ **Dual Interface**
- **Web GUI**: Next.js chat interface with integrated terminal, real-time job monitoring, and status bar
- **Claude Code CLI**: Native agent for local development and automation

### 🔧 **Cluster Execution**
- **Direct SSH integration**: Execute commands on Betty via authenticated sessions
- **Slurm job submission**: Generate and submit batch jobs with `cluster_submit`
- **Real-time monitoring**: Poll job status, tail logs, parse `sacct` output
- **Human-in-the-loop**: Multi-tier permission system for safe command execution

### 🧠 **Agent Tools**
- `wiki_search` / `wiki_read` / `wiki_write` — Query and maintain knowledge base
- `gpu_calculate` — Resource planning (wraps Python calculator)
- `cluster_run` — Execute whitelisted read-only commands on Betty
- `cluster_submit` — Submit Slurm jobs with experiment tracking
- `cluster_status` — Monitor job state and update wiki experiment pages
- **`slurm_check`** / **`slurm_recommend`** / **`slurm_availability`** / **`slurm_diagnose`** — SLURM Advisor (see Key Features above)

### 📚 **Knowledge Management**
- **Karpathy LLM Wiki pattern**: Persistent, compounding knowledge across sessions
- **Auto-documentation**: Experiments filed to wiki with configs, results, and lessons learned
- **Smart search**: Agent searches wiki first, then files answers back for future reference

### 🔐 **Security & Permissions**
- **Tier 0**: Auto-approved (wiki reads, GPU calculations)
- **Tier 1**: Prompt once per session (read-only cluster commands)
- **Tier 2**: Always prompt (job submission, wiki page creation)
- Command whitelist prevents destructive operations

### 🔌 **Model Provider Support**
- **Anthropic Claude**: Full tool-enabled agent (primary)
- **PARCC LiteLLM**: Free GPU-backed LLMs via `openai/gpt-oss-120b` gateway
- **OpenAI / Local models**: Text-only fallback support

## Setup

### Prerequisites
- **Penn VPN or campus network** (required for Betty SSH access)
- **Active Betty account** with ColdFront allocation
- **Node.js 20+** (for web GUI) or **[Claude Code](https://claude.ai/code)** (for CLI)
- **Kerberos tools**: `kinit`, `klist` (standard on macOS; `brew install krb5` if missing)
- **API key** for Anthropic or PARCC LiteLLM

### Quick Start — Web GUI

```bash
# 1. Clone and configure
git clone <repo-url> parcc1
cd parcc1/betty-ai-web
npm install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local: add ANTHROPIC_API_KEY or LITELLM_API_KEY

# 3. Configure SSH with Kerberos
# See betty-ai-web/SETUP.md for full SSH/Kerberos setup

# 4. Get Kerberos ticket (one-time per session)
kinit -r 7d <pennkey>@UPENN.EDU

# 5. Open Betty SSH session for Duo authentication
ssh login.betty.parcc.upenn.edu
# Approve Duo push — creates ControlMaster socket

# 6. Run the web app
npm run dev:phase2
# Open http://localhost:3000
```

The web GUI includes:
- **Chat interface** with markdown rendering and quick-start tiles
- **Integrated terminal** (xterm.js) mirroring agent commands
- **Status bar** showing cluster connectivity and ticket expiry
- **Multi-provider support** (Claude, LiteLLM, OpenAI, local models)

### Quick Start — Claude Code CLI

```bash
# 1. Clone and configure
git clone <repo-url> parcc1
cd parcc1

# 2. Configure your settings
cp betty-ai/configs/team.yaml.example betty-ai/configs/team.yaml
# Edit team.yaml with your PennKey and project path

# 3. Start Claude Code
claude

# 4. Invoke the agent
/agent betty-ai
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

For detailed setup including SSH troubleshooting, see `betty-ai-web/SETUP.md`.

## Usage

### Example conversations

**LLM fine-tuning (Phase 1 - fully supported):**
> "Fine-tune Llama 3 8B on the alpaca dataset with LoRA"
> "Train a 70B model on my custom data — I have about 100K examples"
> "What's the cheapest way to fine-tune Mistral 7B?"

**Inference (Phase 1 - fully supported):**
> "Serve Llama 3 70B for my team"
> "Set up vLLM for Mixtral 8x22B"
> "I need a local API for code generation"

**General research computing (future phases):**
> "Run a 16-node MPI job for my CFD simulation"
> "Set up a Jupyter server with 2 A100s for the team"
> "Process 200GB of genomic data with custom Python pipeline"
> "Train a computer vision model on ImageNet"

**Cluster operations (all phases):**
> "Check my jobs"
> "What partitions are available?"
> "Show me the last 50 lines of job 12345's output"

**Wiki operations (all phases):**
> "Ingest raw/docs/new-paper.md"
> "What do we know about DeepSpeed ZeRO-3?"
> "Lint the wiki"

### How it works

1. **You ask** in natural language
2. **Agent searches wiki** for existing knowledge
3. **Agent asks clarifying questions** if needed
4. **Generates Slurm script** or executes cluster command
5. **Requests permission** (Tier 1/2 tools only)
6. **Submits and monitors** job on Betty
7. **Files results** to wiki experiment page

All cluster commands run over SSH using your authenticated ControlMaster session. The agent never stores credentials — it inherits your Kerberos ticket.

## Project structure

```
parcc1/
├── .claude/agents/betty-ai.md    Agent definition (CLI mode)
├── CLAUDE.md                      Cluster access + agent overview
├── PROJECT.md                     Per-project context template
│
├── betty-ai/                      Python brain: configs, templates, calculators
│   ├── models/
│   │   ├── model_registry.yaml      Model VRAM/resource database
│   │   └── gpu_calculator.py        Resource allocation calculator
│   ├── templates/                   Slurm, DeepSpeed, training script templates
│   │   ├── slurm/                     Batch job templates
│   │   ├── deepspeed/                 DeepSpeed config templates
│   │   ├── training/                  Training script templates
│   │   └── conda/                     Conda environment templates
│   ├── configs/
│   │   ├── betty_cluster.yaml       Machine-readable cluster specs
│   │   ├── defaults.yaml            Default behaviors
│   │   └── team.yaml.example        Per-user config template
│   └── scripts/
│       ├── setup_env.sh               Environment setup
│       ├── setup_hf_cache.sh          HuggingFace cache config
│       ├── check_env.sh               Environment sanity check
│       └── litellm_chat.py            LiteLLM CLI test tool
│
├── betty-ai-web/                  Next.js 15 + React 19 web GUI
│   ├── src/
│   │   ├── app/                       Next.js app router
│   │   │   ├── api/chat/route.ts        SSE chat endpoint
│   │   │   └── page.tsx                 Split layout: chat | terminal
│   │   ├── agent/
│   │   │   ├── server.ts                Agent SDK runtime
│   │   │   ├── system-prompt.ts         Agent persona/instructions
│   │   │   ├── knowledge/loader.ts      Wiki index loader
│   │   │   ├── cluster/
│   │   │   │   ├── ssh.ts                 SSH transport (ControlMaster)
│   │   │   │   └── whitelist.ts           Read-only command whitelist
│   │   │   └── tools/
│   │   │       ├── wiki-search.ts         Search wiki/*.md
│   │   │       ├── wiki-read.ts           Read one wiki page
│   │   │       ├── wiki-write.ts          Create/update wiki pages
│   │   │       ├── gpu-calculate.ts       Wrap Python calculator
│   │   │       ├── cluster-run.ts         Execute read-only commands
│   │   │       ├── cluster-submit.ts      Submit Slurm jobs
│   │   │       └── cluster-status.ts      Monitor job status
│   │   └── components/
│   │       ├── ChatPane.tsx             Chat UI + quick-start tiles
│   │       ├── ChatMessage.tsx          Message bubbles
│   │       └── StatusBar.tsx            Connectivity status
│   ├── scripts/
│   │   ├── dev-phase2.mjs               Start web + terminal bridge
│   │   ├── terminal-server.mjs          WebSocket PTY bridge
│   │   ├── doctor.mjs                   Health check tool
│   │   └── install-kinit-renewal.sh     Auto-renew Kerberos
│   ├── SETUP.md                       Detailed setup guide
│   └── README.md                      Web GUI overview
│
├── raw/                           [Wiki Layer 1] Immutable sources
│   ├── docs/                        PARCC docs, papers, guides
│   ├── cluster_exploration/         Exploration session logs
│   ├── experiments/                 Raw training outputs
│   ├── datasets/                    Dataset documentation
│   └── ops_chat/                    PARCC operations discussions
│
└── wiki/                          [Wiki Layer 2] Agent-maintained knowledge
    ├── SCHEMA.md                     Rules for wiki format and operations
    ├── index.md                      Catalog of all pages
    ├── log.md                        Chronological operation log
    ├── entities/                     Real things (cluster, partitions, GPUs)
    ├── concepts/                     Abstract ideas (LoRA, DeepSpeed, etc.)
    ├── models/                       Specific LLMs with usage notes
    ├── sources/                      Summaries of raw sources
    ├── experiments/                  One page per training run
    └── workflows/                    Common task patterns
```

## Knowledge base — Karpathy LLM Wiki pattern

This repo uses Karpathy's LLM Wiki pattern for persistent, compounding knowledge.
See `wiki/SCHEMA.md` for the full specification.

### Three layers
1. **`raw/`** — Source documents (agent reads, never writes)
2. **`wiki/`** — Agent-maintained markdown knowledge base (49+ pages)
3. **`.claude/agents/betty-ai.md` + `CLAUDE.md`** — Schema telling the agent how to operate

### Three operations
- **Ingest** — Drop a source into `raw/`, say "ingest this" → agent updates the wiki
- **Query** — Ask "what do we know about X?" → agent searches the wiki first, files answer back
- **Lint** — Say "lint the wiki" → agent finds orphans, contradictions, stale claims

Every training run becomes an experiment page with links to model, dataset, and method pages.
Knowledge compounds over time instead of being re-derived from scratch each session.

## Development Phases

### ✅ Phase 1 (Complete)
- Chat interface with markdown rendering
- Wiki tools: search, read
- GPU calculator integration
- Quick-start tiles and status bar
- Multi-provider support (Claude, LiteLLM, OpenAI)

### ✅ Phase 2 (Current)
- **Wiki write capabilities**: Create/update/append to wiki pages
- **Cluster execution**: SSH transport with ControlMaster pooling
- **Slurm job submission**: Full lifecycle from script generation to monitoring
- **Permission system**: Three-tier tool approval (auto, once-per-session, always-prompt)
- **Terminal integration**: xterm.js with WebSocket PTY bridge
- **Command mirroring**: Agent cluster commands visible in terminal pane
- **Auto-documentation**: Experiments filed to wiki with marker-delimited regions

### 🟡 Phase 3 (Planned)
- Live log streaming from running jobs
- Session logging to SQLite
- Golden eval harness for regression testing
- Job cancellation with `scancel` (currently deferred)

### 🟡 Phase 4 (Future)
- Multi-user session management
- Team experiment sharing
- Cost dashboards and quota tracking
- Slack/Teams notifications for job completion

## Key docs

- **`betty-ai-web/SETUP.md`** — Detailed setup guide with SSH/Kerberos troubleshooting
- **`BETTY_SYSTEM_GUIDE.md`** — Complete cluster documentation
- **`BETTY_LLM_AND_WORKFLOWS_GUIDE.md`** — LLM workflow recipes and best practices
- **`wiki/SCHEMA.md`** — Wiki format and operation rules
- **`PROJECT.md`** — Per-project context (customize for each research effort)
- **`PLAN.md`** — Current implementation plan and decisions
- **`CLAUDE.md`** — Quick reference for cluster access

## Architecture

### Data Flow
```
User prompt → Chat UI → SSE endpoint → Agent SDK
                                          ↓
                            ┌─────────────┴─────────────┐
                            ↓                           ↓
                    Search wiki index           Calculate resources
                            ↓                           ↓
                    Generate Slurm script      Request permission
                            ↓                           ↓
                    SSH to Betty               Submit job (sbatch)
                            ↓                           ↓
                    Monitor status             Update wiki experiment page
                            ↓
                    Terminal mirror (tagged [betty-agent])
```

### Security Model
- **No stored credentials**: Inherits your Kerberos ticket and SSH ControlMaster
- **Command whitelist**: Read-only operations verified before execution
- **Permission tiers**: User approval required for writes and submissions
- **Marker regions**: Agent-owned sections clearly delimited in wiki pages
- **Audit trail**: All operations logged to `wiki/log.md`

## Technology Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, xterm.js
- **Backend**: Anthropic Agent SDK (TypeScript), Node.js API routes
- **Terminal**: node-pty, WebSocket bridge
- **Cluster**: SSH ControlMaster, Slurm, Kerberos/Duo
- **Models**: Claude Sonnet 4.5 (primary), PARCC LiteLLM gateway
- **Testing**: Vitest for unit tests

## Contributing

See `PLAN.md` for current development tracks and implementation decisions. All new features should include:
- Vitest unit tests with security boundary coverage
- Updates to `wiki/SCHEMA.md` if wiki operations change
- Documentation in relevant README files

## Team

Built for researchers at UPenn PARCC. Contact jvadala for access.

## License

MIT (code) — cluster access requires active PARCC allocation
