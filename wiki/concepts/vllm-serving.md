---
type: concept
tags: [llm, inference, serving, vllm]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [dgx-b200-partition, b200-mig45-partition, llama-3-70b, deepseek-v3, huggingface-cache-management]
status: current
---

# vLLM Serving

## One-line summary
High-throughput LLM inference server using PagedAttention and continuous batching, with an OpenAI-compatible REST API out of the box.

## Why vLLM on Betty
- **Throughput**: 10-20x better than naive HuggingFace `generate` for concurrent requests
- **OpenAI API-compatible**: drop-in for any code that speaks `openai`
- **Tensor parallelism**: `--tensor-parallel-size N` shards a single model across N GPUs
- **Single-GPU 70B inference**: a single B200 (192 GB) fits Llama 3 70B FP16 (~144 GB)

## Starting a server
```bash
#SBATCH --partition=dgx-b200
#SBATCH --gpus=1

python -m vllm.entrypoints.openai.api_server \
    --model meta-llama/Meta-Llama-3-70B-Instruct \
    --tensor-parallel-size 1 \
    --port 8000 --host 0.0.0.0
```

## Tensor parallelism sizing
| Model | TP size | Partition |
|-------|---------|-----------|
| 7-70B | 1 | [[b200-mig45-partition]] or [[dgx-b200-partition]] |
| Mixtral 8x22B (141B) | 2 | [[dgx-b200-partition]] |
| Llama 3.1 405B | 4-5 | [[dgx-b200-partition]] |
| [[deepseek-v3]] 671B MoE | 8 | [[dgx-b200-partition]] |

See `betty-ai/models/model_registry.yaml` for per-model recommendations.

## Accessing from outside Betty
SSH port forward from your local machine:
```bash
ssh -N -L 8000:dgxXXX:8000 jvadala@login.betty.parcc.upenn.edu
```
Then hit `http://localhost:8000/v1/chat/completions` normally.

## Gotchas
- Always set `HF_HOME` to project storage — see [[huggingface-cache-management]]
- vLLM is **not** in Betty's shared conda env — `pip install vllm` in your own env
- `--max-model-len` should match your actual context needs; too high wastes KV cache

## Alternatives
- **Ollama**: simpler chat UX, weaker throughput
- **TGI**: production-grade, via Apptainer container
- **Raw transformers**: only for one-off research snippets

## See also
- [[dgx-b200-partition]]
- [[huggingface-cache-management]]
- [[llama-3-70b]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
