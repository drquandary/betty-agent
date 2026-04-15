#!/bin/bash
# Configure HuggingFace cache on project storage (NOT home dir!)
# Usage: bash setup_hf_cache.sh <project_path>

set -euo pipefail

PROJECT_PATH="${1:?Usage: setup_hf_cache.sh <project_path>}"

HF_CACHE="${PROJECT_PATH}/hf_cache"
HF_DATASETS="${PROJECT_PATH}/hf_datasets_cache"

echo "=== HuggingFace Cache Setup ==="
mkdir -p "$HF_CACHE" "$HF_DATASETS"

# Add to bashrc if not already there
BASHRC="$HOME/.bashrc"
if ! grep -q "HF_HOME=" "$BASHRC" 2>/dev/null; then
    echo "" >> "$BASHRC"
    echo "# HuggingFace cache — Betty AI setup" >> "$BASHRC"
    echo "export HF_HOME=${HF_CACHE}" >> "$BASHRC"
    echo "export TRANSFORMERS_CACHE=${HF_CACHE}" >> "$BASHRC"
    echo "export HF_DATASETS_CACHE=${HF_DATASETS}" >> "$BASHRC"
    echo "[ADDED] HF_HOME exports to ~/.bashrc"
else
    echo "[SKIP] HF_HOME already in ~/.bashrc"
fi

echo ""
echo "Cache dirs:"
echo "  Models:   ${HF_CACHE}"
echo "  Datasets: ${HF_DATASETS}"
echo ""
echo "Run 'source ~/.bashrc' to apply, or log out and back in."
