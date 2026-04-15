#!/bin/bash
# Setup shared conda environments for LLM work on Betty
# Usage: bash setup_env.sh <project_path>
# Example: bash setup_env.sh /vast/projects/jcombar1-betty-testing

set -euo pipefail

PROJECT_PATH="${1:?Usage: setup_env.sh <project_path>}"
ENV_BASE="${PROJECT_PATH}/envs"

echo "=== Betty AI Environment Setup ==="
echo "Project path: ${PROJECT_PATH}"
echo "Environments: ${ENV_BASE}"

module load anaconda3/2023.09-0

# --- Fine-tuning environment ---
FT_ENV="${ENV_BASE}/llm-finetune"
if [ -d "$FT_ENV" ]; then
    echo "[OK] llm-finetune env exists at ${FT_ENV}"
else
    echo "[CREATING] llm-finetune environment..."
    conda create -p "$FT_ENV" python=3.11 -y
    source activate "$FT_ENV"
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu126
    pip install "transformers>=4.45.0" "datasets>=2.18" "accelerate>=0.30" "peft>=0.10" "trl>=0.8"
    pip install bitsandbytes deepspeed safetensors "huggingface-hub>=0.22"
    pip install flash-attn --no-build-isolation
    pip install wandb tensorboard
    echo "[DONE] llm-finetune environment created"
fi

# --- Serving environment ---
SERVE_ENV="${ENV_BASE}/llm-serve"
if [ -d "$SERVE_ENV" ]; then
    echo "[OK] llm-serve env exists at ${SERVE_ENV}"
else
    echo "[CREATING] llm-serve environment..."
    conda create -p "$SERVE_ENV" python=3.11 -y
    source activate "$SERVE_ENV"
    pip install vllm openai
    echo "[DONE] llm-serve environment created"
fi

echo ""
echo "=== Setup Complete ==="
echo "Activate with: source activate ${FT_ENV}"
echo "            or: source activate ${SERVE_ENV}"
