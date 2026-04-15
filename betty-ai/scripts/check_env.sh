#!/bin/bash
# Check if a conda environment has required packages for LLM work
# Usage: bash check_env.sh <env_path> <finetune|serve>

set -euo pipefail

ENV_PATH="${1:?Usage: check_env.sh <env_path> <finetune|serve>}"
TASK="${2:-finetune}"

module load anaconda3/2023.09-0
source activate "$ENV_PATH" 2>/dev/null || { echo "ERROR: Cannot activate ${ENV_PATH}"; exit 1; }

echo "=== Environment Check: ${ENV_PATH} ==="
echo "Task type: ${TASK}"
echo ""

MISSING=()

if [ "$TASK" = "finetune" ]; then
    PACKAGES=("torch" "transformers" "datasets" "accelerate" "peft" "trl" "bitsandbytes" "deepspeed" "safetensors")
elif [ "$TASK" = "serve" ]; then
    PACKAGES=("vllm" "openai")
else
    echo "Unknown task: ${TASK}"; exit 1
fi

for pkg in "${PACKAGES[@]}"; do
    if python -c "import ${pkg}" 2>/dev/null; then
        VERSION=$(python -c "import ${pkg}; print(getattr(${pkg}, '__version__', 'unknown'))" 2>/dev/null)
        echo "[OK] ${pkg} ${VERSION}"
    else
        echo "[MISSING] ${pkg}"
        MISSING+=("$pkg")
    fi
done

echo ""
if [ ${#MISSING[@]} -eq 0 ]; then
    echo "All required packages present."
    exit 0
else
    echo "Missing packages: ${MISSING[*]}"
    echo "Install with: pip install ${MISSING[*]}"
    exit 1
fi
