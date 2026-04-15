# Betty Cluster — LLM, AI, and Research Workflows Guide

> **Last updated**: 2026-04-08 | Companion to `BETTY_SYSTEM_GUIDE.md`

---

## Table of Contents
1. [What You Need to Know First](#1-what-you-need-to-know-first)
2. [Fine-Tuning LLMs on Betty](#2-fine-tuning-llms-on-betty)
3. [Running/Serving LLMs (Inference)](#3-runningserving-llms-inference)
4. [Agent-Based Modeling](#4-agent-based-modeling)
5. [Environment Setup Recipes](#5-environment-setup-recipes)
6. [What's Missing & Improvement Opportunities](#6-whats-missing--improvement-opportunities)
7. [Cost/Billing Awareness](#7-costbilling-awareness)

---

## 1. What You Need to Know First

### GPU Hardware: NVIDIA B200
The B200 is NVIDIA's Blackwell-architecture datacenter GPU (successor to H100).

| Spec | B200 (Full) | B200 MIG-90 | B200 MIG-45 |
|------|-------------|-------------|-------------|
| **VRAM** | ~192 GB HBM3e | 90 GB slice | 45 GB slice |
| **FP16/BF16** | ~4.5 PFLOPS | proportional | proportional |
| **FP8** | ~9 PFLOPS | proportional | proportional |
| **NVLink** | 5th gen, 1.8 TB/s | N/A | N/A |
| **PCIe** | Gen 5 | Gen 5 | Gen 5 |

**Key implication**: A single B200 has ~192 GB VRAM — you can fit a **70B parameter model in FP16** on one GPU, or a **405B model across 4 GPUs**. This is vastly more capable than A100 (80 GB) or H100 (80 GB).

### What's Pre-Installed (Shared `pytorch` Conda Env)
| Package | Version | Status |
|---------|---------|--------|
| PyTorch | 2.7.1+cu126 | Installed |
| transformers | 4.32.1 | Installed (OLD — needs update) |
| datasets | 2.12.0 | Installed |
| huggingface-hub | 0.15.1 | Installed (OLD) |
| safetensors | 0.5.3 | Installed |
| nvidia-nccl-cu12 | 2.26.2 | Installed |
| **accelerate** | — | **MISSING** |
| **peft** | — | **MISSING** |
| **bitsandbytes** | — | **MISSING** |
| **deepspeed** | — | **MISSING** |
| **vllm** | — | **MISSING** |
| **trl** | — | **MISSING** |
| **flash-attention** | — | **MISSING** |
| **xformers** | — | **MISSING** |

### Internet Access
- **HuggingFace Hub**: Accessible (can download models)
- **PyPI**: Accessible (can pip install)
- **HF_HOME**: Not set by default — **you must configure this** or models download to home dir (50 GB quota!)

---

## 2. Fine-Tuning LLMs on Betty

### 2.1 What's Possible

| Model Size | GPUs Needed | Partition | QOS | Method |
|-----------|-------------|-----------|-----|--------|
| 7-8B (Llama 3, Mistral) | 1 B200 | dgx-b200 | normal | Full fine-tune or LoRA |
| 7-8B LoRA/QLoRA | 1 MIG-45 | b200-mig45 | mig | QLoRA with 4-bit |
| 13-14B | 1 B200 | dgx-b200 | normal | LoRA or full FP16 |
| 70B LoRA | 1 B200 | dgx-b200 | normal | QLoRA (4-bit base) fits in ~48 GB |
| 70B full fine-tune | 2-4 B200 | dgx-b200 | normal/dgx | FSDP or DeepSpeed ZeRO-3 |
| 405B (Llama 3.1) | 4-8 B200 | dgx-b200 | dgx | DeepSpeed ZeRO-3 + offload |

### 2.2 Recommended Stack for Fine-Tuning

```
PyTorch 2.7+ → transformers → peft (LoRA) → trl (SFT/DPO) → accelerate/deepspeed
```

### 2.3 Setup: Fine-Tuning Environment

```bash
# Create your own conda env (don't modify shared one)
module load anaconda3/2023.09-0
conda create -n llm-finetune python=3.11 -y
source activate llm-finetune

# Install the full LLM fine-tuning stack
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
pip install transformers>=4.45.0 datasets accelerate peft trl
pip install bitsandbytes  # for QLoRA 4-bit quantization
pip install deepspeed     # for multi-GPU training
pip install flash-attn --no-build-isolation  # faster attention
pip install wandb         # experiment tracking
pip install safetensors huggingface-hub

# CRITICAL: Set HuggingFace cache to project storage (NOT home!)
echo 'export HF_HOME=/vast/projects/<your-project>/hf_cache' >> ~/.bashrc
echo 'export TRANSFORMERS_CACHE=/vast/projects/<your-project>/hf_cache' >> ~/.bashrc
```

### 2.4 Example: Fine-Tune Llama 3 8B with LoRA

**Job script** (`finetune_llama3_lora.sh`):
```bash
#!/bin/bash
#SBATCH --job-name=llama3-lora
#SBATCH --partition=dgx-b200
#SBATCH --gpus=1
#SBATCH --cpus-per-task=28
#SBATCH --mem=200G
#SBATCH --time=12:00:00
#SBATCH --output=logs/llama3-lora-%j.out

module load anaconda3/2023.09-0
source activate llm-finetune

export HF_HOME=/vast/projects/<project>/hf_cache
export WANDB_PROJECT=llama3-finetune

python finetune.py \
    --model_name meta-llama/Meta-Llama-3-8B \
    --dataset_name your_dataset \
    --lora_r 16 \
    --lora_alpha 32 \
    --per_device_train_batch_size 4 \
    --gradient_accumulation_steps 4 \
    --num_train_epochs 3 \
    --learning_rate 2e-4 \
    --bf16 True \
    --output_dir /vast/projects/<project>/models/llama3-lora
```

### 2.5 Example: Multi-GPU Fine-Tune (70B with DeepSpeed)

```bash
#!/bin/bash
#SBATCH --job-name=llama70b-ds
#SBATCH --partition=dgx-b200
#SBATCH --gpus=4
#SBATCH --cpus-per-task=112
#SBATCH --mem=800G
#SBATCH --time=48:00:00
#SBATCH --qos=dgx

module load anaconda3/2023.09-0
source activate llm-finetune

export HF_HOME=/vast/projects/<project>/hf_cache

accelerate launch --num_processes=4 --use_deepspeed \
    --deepspeed_config ds_config_zero3.json \
    finetune.py \
    --model_name meta-llama/Meta-Llama-3-70B \
    --per_device_train_batch_size 1 \
    --gradient_accumulation_steps 8 \
    --bf16 True
```

### 2.6 Multi-Node Fine-Tuning (8+ GPUs)

```bash
#!/bin/bash
#SBATCH --job-name=llama-multinode
#SBATCH --partition=dgx-b200
#SBATCH --nodes=2
#SBATCH --gpus-per-node=8
#SBATCH --ntasks-per-node=1
#SBATCH --cpus-per-task=224
#SBATCH --time=72:00:00
#SBATCH --qos=dgx

# Get master node info
export MASTER_ADDR=$(scontrol show hostnames $SLURM_JOB_NODELIST | head -n1)
export MASTER_PORT=29500

srun torchrun \
    --nnodes=$SLURM_NNODES \
    --nproc_per_node=8 \
    --rdzv_id=$SLURM_JOB_ID \
    --rdzv_backend=c10d \
    --rdzv_endpoint=$MASTER_ADDR:$MASTER_PORT \
    finetune.py --deepspeed ds_config_zero3.json
```

---

## 3. Running/Serving LLMs (Inference)

### 3.1 What Fits Where

| Model | VRAM Needed (FP16) | VRAM Needed (4-bit) | Min GPUs | Partition |
|-------|-------------------|--------------------|----|-----------|
| Llama 3 8B | ~16 GB | ~5 GB | 1 MIG-45 | b200-mig45 |
| Mistral 7B | ~14 GB | ~4 GB | 1 MIG-45 | b200-mig45 |
| Llama 3 70B | ~140 GB | ~35 GB | 1 B200 | dgx-b200 |
| Mixtral 8x22B | ~88 GB | ~24 GB | 1 B200 | dgx-b200 |
| Llama 3.1 405B | ~810 GB | ~203 GB | 2 B200 (4-bit) | dgx-b200 |
| DeepSeek-V3 (671B MoE) | ~400 GB active | ~120 GB | 1-2 B200 | dgx-b200 |

### 3.2 Inference Options

#### Option A: vLLM (Recommended for Serving)
Best for: high-throughput API serving, batched inference, multi-user access

```bash
# Install
pip install vllm

# Single-GPU serving (fits 70B on one B200!)
#SBATCH --partition=dgx-b200
#SBATCH --gpus=1
#SBATCH --time=24:00:00

python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Meta-Llama-3-70B-Instruct \
    --tensor-parallel-size 1 \
    --port 8000 \
    --host 0.0.0.0

# Multi-GPU for 405B
#SBATCH --gpus=4
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Meta-Llama-3.1-405B-Instruct \
    --tensor-parallel-size 4 \
    --port 8000
```

#### Option B: Ollama (Simple Local Use)
Best for: quick experimentation, chat-style interaction

```bash
# Download ollama binary to your home
curl -fsSL https://ollama.com/install.sh | sh

# Run in a GPU job
#SBATCH --partition=b200-mig45
#SBATCH --gpus=1
#SBATCH --time=4:00:00

ollama serve &
ollama run llama3:8b
```

#### Option C: HuggingFace Transformers (Direct)
Best for: custom inference pipelines, research

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Meta-Llama-3-8B-Instruct",
    torch_dtype=torch.bfloat16,
    device_map="auto",
    cache_dir="/vast/projects/<project>/hf_cache"
)
tokenizer = AutoTokenizer.from_pretrained("meta-llama/Meta-Llama-3-8B-Instruct")
```

#### Option D: Text Generation Inference (TGI)
Best for: production-grade serving with Apptainer containers

```bash
module load gcc/13.3.0
module load apptainer/1.4.1

apptainer pull docker://ghcr.io/huggingface/text-generation-inference:latest
apptainer run --nv tgi.sif \
    --model-id meta-llama/Meta-Llama-3-70B-Instruct \
    --port 8080
```

### 3.3 Accessing a Running LLM from Your Machine

Since Betty is behind Penn network, you need SSH port forwarding:

```bash
# On your local machine:
ssh -N -L 8000:dgxXXX:8000 jvadala@login.betty.parcc.upenn.edu

# Then access from browser or curl:
curl http://localhost:8000/v1/models
curl http://localhost:8000/v1/chat/completions \
    -H "Content-Type: application/json" \
    -d '{"model":"meta-llama/Meta-Llama-3-70B-Instruct","messages":[{"role":"user","content":"Hello!"}]}'
```

---

## 4. Agent-Based Modeling

### 4.1 CPU vs GPU for ABM

Most agent-based modeling frameworks are **CPU-bound**, making the **genoa-std-mem** and **genoa-lrg-mem** partitions ideal:

| Framework | Best Partition | Why |
|-----------|---------------|-----|
| **Mesa** (Python) | genoa-std-mem | Pure Python, CPU-only |
| **NetLogo** (JVM) | genoa-std-mem | Java-based, multi-threaded |
| **MASON** (Java) | genoa-std-mem | Java, parallel-friendly |
| **Repast HPC** (C++) | genoa-std-mem | MPI-based, multi-node |
| **FLAME GPU** | dgx-b200 | GPU-accelerated ABM |
| **LLM-powered agents** | dgx-b200 | Need GPU for LLM inference |

### 4.2 Traditional ABM on Betty

#### Mesa (Python ABM)
```bash
#!/bin/bash
#SBATCH --job-name=mesa-abm
#SBATCH --partition=genoa-std-mem
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=32
#SBATCH --mem=100G
#SBATCH --time=24:00:00
#SBATCH --array=1-100  # parameter sweep!

module load anaconda3/2023.09-0
source activate abm-env

python run_simulation.py --seed=$SLURM_ARRAY_TASK_ID --config=params.yaml
```

**Slurm job arrays** are perfect for ABM parameter sweeps — run 100 simulations with different seeds in one submission (MaxArraySize = 15,001).

#### Repast HPC (Multi-Node MPI ABM)
```bash
#!/bin/bash
#SBATCH --partition=genoa-std-mem
#SBATCH --nodes=4
#SBATCH --ntasks-per-node=64
#SBATCH --time=12:00:00

module load openmpi/3.1.0
srun --mpi=pmix ./repast_simulation
```

### 4.3 LLM-Powered Agents on Betty

This is where Betty really shines — running **AI agents** that use LLMs for reasoning.

#### Architecture: Local LLM Serving + Agent Framework

```
┌─────────────────────────┐
│ GPU Node (dgx-b200)     │
│                         │
│  vLLM Server (port 8000)│ ← Serves Llama 70B
│         ↑               │
│  Agent Framework        │ ← CrewAI / AutoGen / LangGraph
│  (Python process)       │
│         ↑               │
│  Your code / tools      │
└─────────────────────────┘
```

#### Example: Multi-Agent System with vLLM Backend

```bash
#!/bin/bash
#SBATCH --job-name=llm-agents
#SBATCH --partition=dgx-b200
#SBATCH --gpus=1
#SBATCH --cpus-per-task=28
#SBATCH --mem=200G
#SBATCH --time=8:00:00

module load anaconda3/2023.09-0
source activate agents-env

export HF_HOME=/vast/projects/<project>/hf_cache

# Start vLLM server in background
python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Meta-Llama-3-70B-Instruct \
    --port 8000 &
sleep 30  # wait for model to load

# Run agent framework against local LLM
export OPENAI_API_BASE=http://localhost:8000/v1
export OPENAI_API_KEY=dummy  # vLLM doesn't need a real key

python run_agents.py
```

#### Agent Framework Options
| Framework | Best For | Install |
|-----------|----------|---------|
| **LangGraph** | Stateful multi-step agents | `pip install langgraph langchain` |
| **CrewAI** | Role-based agent teams | `pip install crewai` |
| **AutoGen** | Microsoft's multi-agent conversations | `pip install autogen-agentchat` |
| **DSPy** | Programmatic LLM pipelines | `pip install dspy-ai` |
| **smolagents** | HuggingFace lightweight agents | `pip install smolagents` |

### 4.4 Hybrid: ABM with LLM-Powered Agents

The most interesting pattern — agents in a simulation that use LLMs for decision-making:

```python
# Pseudocode: Mesa + vLLM hybrid
import mesa
import openai

client = openai.OpenAI(base_url="http://localhost:8000/v1", api_key="dummy")

class LLMAgent(mesa.Agent):
    def step(self):
        # Get environment state
        neighbors = self.model.grid.get_neighbors(self.pos, radius=2)
        state = self.describe_state(neighbors)
        
        # Ask LLM for decision
        response = client.chat.completions.create(
            model="meta-llama/Meta-Llama-3-70B-Instruct",
            messages=[{"role": "user", "content": f"Given state: {state}, what action?"}],
            max_tokens=50
        )
        action = self.parse_action(response.choices[0].message.content)
        self.execute(action)
```

---

## 5. Environment Setup Recipes

### 5.1 Recipe: LLM Fine-Tuning Env
```bash
conda create -n llm-ft python=3.11 -y && source activate llm-ft
pip install torch --index-url https://download.pytorch.org/whl/cu126
pip install transformers>=4.45 datasets accelerate peft trl bitsandbytes
pip install deepspeed flash-attn --no-build-isolation
pip install wandb tensorboard safetensors
```

### 5.2 Recipe: LLM Inference/Serving Env
```bash
conda create -n llm-serve python=3.11 -y && source activate llm-serve
pip install vllm  # includes torch, transformers
pip install openai  # client library
```

### 5.3 Recipe: Agent-Based Modeling Env
```bash
conda create -n abm python=3.11 -y && source activate abm
pip install mesa matplotlib numpy pandas scipy networkx
pip install jupyter  # for analysis
```

### 5.4 Recipe: LLM Agents Env
```bash
conda create -n agents python=3.11 -y && source activate agents
pip install vllm  # local LLM serving
pip install langchain langgraph crewai
pip install openai  # API client for vLLM
pip install pandas numpy  # data tools
```

### 5.5 Critical: HuggingFace Cache Location

**DO NOT** leave HF_HOME at default — model downloads will fill your 50 GB home quota instantly.

```bash
# Add to ~/.bashrc
export HF_HOME=/vast/projects/<your-project>/hf_cache
export TRANSFORMERS_CACHE=/vast/projects/<your-project>/hf_cache
export HF_DATASETS_CACHE=/vast/projects/<your-project>/hf_datasets_cache

# Create the directories
mkdir -p /vast/projects/<your-project>/hf_cache
mkdir -p /vast/projects/<your-project>/hf_datasets_cache
```

---

## 6. What's Missing & Improvement Opportunities

### For PARCC Admins / System Improvement

#### Critical Gaps
1. **Shared pytorch env is outdated** — transformers 4.32.1 is ~1 year old; current is 4.45+
2. **No LLM-specific packages** — accelerate, peft, deepspeed, vllm should be available
3. **No pre-built NGC containers** — no `/vast/parcc/sw/containers/` directory
4. **HF_HOME not configured** — users will blow their 50 GB home quota on model downloads
5. **No NCCL module** — critical for multi-GPU training (it's in pip but not system-level)
6. **`interact` script broken** — references nonexistent "defq" partition

#### OOD Improvements
7. **Add JupyterLab app** — most requested by ML researchers
8. **Add VS Code Server app** — modern development workflow
9. **Add file browser** — standard OOD feature
10. **Add Jupyter with GPU** — current betty-jupyter.sh is CLI-only with SSH tunneling

#### User Experience
11. **Need LLM quickstart guide** — users shouldn't have to figure out vllm/deepspeed setup
12. **Need shared model cache** — `/vast/parcc/shared/models/` with popular models pre-downloaded
13. **Need example job scripts** — for common LLM tasks (fine-tune, serve, multi-GPU)
14. **Need conda init guidance** — `conda activate` doesn't work by default; need `source activate`

### For Users: Workarounds

| Problem | Workaround |
|---------|------------|
| Old transformers | Create your own conda env with latest versions |
| No vLLM | `pip install vllm` in your env |
| Home quota fills up | Set `HF_HOME` to project directory |
| `conda activate` fails | Use `source activate <env>` instead |
| No Jupyter in OOD | Use `betty-jupyter.sh` + SSH tunnel |
| `interact` broken | Use `srun -p dgx-b200 --gpus=1 -t 00:30:00 --pty bash` directly |

---

## 7. Cost/Billing Awareness

### Billing Weights (PC minutes per minute)

| Resource | Billing Weight | Example: 1 GPU for 1 hour |
|----------|---------------|--------------------------|
| 1 B200 GPU (dgx-b200) | 1000 | ~1000 PC-min = 16.7 PC |
| 1 MIG-45 GPU | 250 | ~250 PC-min = 4.2 PC |
| 1 MIG-90 GPU | 500 | ~500 PC-min = 8.3 PC |
| 1 CPU core (genoa-std) | 10 | ~10 PC-min = 0.17 PC |
| 1 CPU core (genoa-lrg) | 15 | ~15 PC-min = 0.25 PC |

### Budget Planning

With your **12,000 PC** allocation:
| Scenario | PC Cost | How Much You Get |
|----------|---------|-----------------|
| 1 B200 for 1 hour | ~17 PC | ~700 hours total |
| 8 B200 for 1 hour | ~134 PC | ~90 hours total |
| 1 MIG-45 for 1 hour | ~4 PC | ~3000 hours total |
| 32 CPUs for 1 hour | ~5 PC | ~2400 hours total |

### Cost-Saving Tips
1. **Develop on MIG slices** — 4x cheaper than full B200
2. **Use QLoRA** — fits larger models on fewer GPUs
3. **Set `--time` tightly** — unused time still bills until job ends
4. **Use `scancel`** immediately when done with interactive sessions
5. **Profile first** on 1 GPU before scaling to multi-GPU
6. **Use checkpointing** — don't lose work if job hits time limit

---

## Appendix: B200 GPU Details (from Slurm)

```
Gres=gpu:B200:8(S:0-1)     # 8 GPUs, socket affinity 0-1
RealMemory=2063916          # ~2 TB system RAM per DGX node
CfgTRES=cpu=224,mem=2063916M,billing=8998,gres/gpu=8
```

The `S:0-1` socket binding means GPUs are split across both CPU sockets — important for NUMA-aware job placement when using partial allocations.

Each DGX B200 node has ~2 TB system RAM (not the 202 GB Slurm reports for scheduling — the full physical memory is higher, with Slurm reserving a portion for the OS).
