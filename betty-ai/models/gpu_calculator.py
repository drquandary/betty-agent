#!/usr/bin/env python3
"""GPU allocation calculator for LLM tasks on the Betty cluster.

Reads model_registry.yaml (same directory) and betty_cluster.yaml (../configs/)
to recommend optimal GPU partition, count, QOS, and resource settings.

Usage:
    python gpu_calculator.py --model meta-llama/Meta-Llama-3-70B --method lora
    python gpu_calculator.py --model meta-llama/Meta-Llama-3-70B --method full --max-budget-pc 500
    python gpu_calculator.py --model meta-llama/Meta-Llama-3-8B --method qlora --dataset-tokens 10000000
"""

import argparse
import json
import math
import os
import sys

import yaml


# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_MODEL_REGISTRY_PATH = os.path.join(_THIS_DIR, "model_registry.yaml")
_CLUSTER_CONFIG_PATH = os.path.join(_THIS_DIR, "..", "configs", "betty_cluster.yaml")


def _load_yaml(path: str) -> dict:
    """Load a YAML file and return its contents as a dict."""
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# ---------------------------------------------------------------------------
# Core calculation
# ---------------------------------------------------------------------------

# Template mapping: method -> (sbatch template, training script)
_TEMPLATES = {
    "lora": ("finetune_lora.sbatch.j2", "finetune_sft.py.j2"),
    "qlora": ("finetune_qlora.sbatch.j2", "finetune_sft.py.j2"),
    "full": ("finetune_full.sbatch.j2", "finetune_sft.py.j2"),
    "inference": ("serve_vllm.sbatch.j2", None),
}

# Conda env mapping
_CONDA_ENVS = {
    "lora": "llm-finetune",
    "qlora": "llm-finetune",
    "full": "llm-finetune",
    "inference": "llm-inference",
}


def _select_deepspeed(num_gpus: int) -> str | None:
    """Choose DeepSpeed config based on GPU count."""
    if num_gpus <= 1:
        return None
    if num_gpus <= 4:
        return "ds_zero2.json"
    if num_gpus <= 8:
        return "ds_zero3.json"
    return "ds_zero3_offload.json"


def _select_partition_and_gpus(
    vram_needed_gb: float,
    cluster: dict,
    max_budget_pc: float | None = None,
) -> tuple[str, int, float, int, int]:
    """Pick cheapest partition that fits VRAM requirements.

    Returns (partition, num_gpus, vram_available_gb, cpus_per_task, mem_gb).
    """
    partitions = cluster["partitions"]

    # Candidate list: (partition_name, num_gpus, vram_avail, cpus, mem, total_billing)
    candidates = []

    # --- MIG-45 (single slice = 45 GB) ---
    if vram_needed_gb <= 45:
        p = partitions["b200-mig45"]
        billing = p["billing_weight_gpu"]
        cpus = p["default_cpus_per_gpu"]
        mem = p.get("default_mem_per_gpu_gb", 56)
        candidates.append(("b200-mig45", 1, 45.0, cpus, mem, billing))

    # --- MIG-90 (single slice = 90 GB) ---
    if vram_needed_gb <= 90:
        p = partitions["b200-mig90"]
        billing = p["billing_weight_gpu"]
        cpus = p.get("default_cpus_per_gpu", 7)
        mem = p.get("default_mem_per_gpu_gb", 112)
        candidates.append(("b200-mig90", 1, 90.0, cpus, mem, billing))

    # --- Full B200 GPUs ---
    p = partitions["dgx-b200"]
    gpu_vram = p["gpu_vram_gb"]  # 192
    cpus_per_gpu = p["default_cpus_per_gpu"]  # 28
    mem_per_gpu = p["default_mem_per_gpu_gb"]  # 224
    billing_per_gpu = p["billing_weight_gpu"]  # 1000
    max_gpus_per_node = p["gpus_per_node"]  # 8
    max_nodes = p["max_nodes_per_job"]  # 8

    num_gpus_needed = max(1, math.ceil(vram_needed_gb / gpu_vram))
    total_gpus_available = max_gpus_per_node * max_nodes  # 64

    if num_gpus_needed <= total_gpus_available:
        ngpus = num_gpus_needed
        cpus = ngpus * cpus_per_gpu
        mem = ngpus * mem_per_gpu
        total_billing = ngpus * billing_per_gpu
        candidates.append(("dgx-b200", ngpus, ngpus * gpu_vram, cpus, mem, total_billing))

    if not candidates:
        raise ValueError(
            f"Model requires {vram_needed_gb:.0f} GB VRAM which exceeds "
            f"maximum cluster capacity ({total_gpus_available} x {gpu_vram} GB = "
            f"{total_gpus_available * gpu_vram} GB)."
        )

    # Filter by budget if specified
    if max_budget_pc is not None:
        # Budget filtering happens later after time estimation; for now just
        # sort by billing weight (cheapest first).
        pass

    # Sort by total billing weight (cheapest first)
    candidates.sort(key=lambda c: c[5])

    chosen = candidates[0]
    return chosen[0], chosen[1], chosen[2], chosen[3], chosen[4]


def _select_qos(partition: str, num_gpus: int, cluster: dict) -> str:
    """Select QOS based on partition and GPU count."""
    if partition.startswith("b200-mig"):
        if num_gpus <= 8:
            return "mig"
        return "mig-max"

    # dgx-b200
    if num_gpus <= 8:
        return "normal"
    if num_gpus <= 32:
        return "dgx"
    return "gpu-max"


def _format_walltime(hours: float) -> str:
    """Format hours as HH:MM:SS for sbatch --time."""
    total_seconds = int(hours * 3600)
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    if h >= 24:
        days = h // 24
        h = h % 24
        return f"{days}-{h:02d}:{m:02d}:{s:02d}"
    return f"{h:02d}:{m:02d}:{s:02d}"


def calculate(
    model: str,
    method: str,
    dataset_tokens: int | None = None,
    epochs: int = 3,
    max_budget_pc: float | None = None,
    max_time_hours: float | None = None,
    batch_size: int | None = None,
) -> dict:
    """Calculate optimal GPU allocation for an LLM task on Betty.

    Args:
        model: HuggingFace model ID (must be a key in model_registry.yaml).
        method: One of 'lora', 'qlora', 'full', 'inference'.
        dataset_tokens: Estimated total training tokens for time estimation.
        epochs: Number of training epochs (default 3).
        max_budget_pc: Maximum budget in PC (priority credits).
        max_time_hours: Maximum walltime in hours.
        batch_size: Per-device batch size override.

    Returns:
        dict with allocation recommendation.
    """
    if method not in ("lora", "qlora", "full", "inference"):
        raise ValueError(f"Unknown method '{method}'. Must be one of: lora, qlora, full, inference")

    # ------------------------------------------------------------------
    # Load configs
    # ------------------------------------------------------------------
    registry = _load_yaml(_MODEL_REGISTRY_PATH)
    cluster = _load_yaml(_CLUSTER_CONFIG_PATH)

    # ------------------------------------------------------------------
    # Look up model
    # ------------------------------------------------------------------
    models_raw = registry.get("models", [])
    # Convert list format (from YAML) to dict keyed by hf_id
    if isinstance(models_raw, list):
        models = {m["hf_id"]: m for m in models_raw if "hf_id" in m}
    else:
        models = models_raw
    if model not in models:
        raise ValueError(
            f"Model '{model}' not found in model_registry.yaml. "
            f"Available models: {', '.join(sorted(models.keys()))}"
        )
    model_info = models[model]

    # Get VRAM for requested method — map CLI method names to registry keys
    vram_reqs = model_info.get("vram_gb", {})
    method_to_vram_key = {
        "lora": "lora_fp16",
        "qlora": "qlora_4bit",
        "full": "fp16_full_finetune",
        "inference": "fp16_inference",
    }
    vram_key = method_to_vram_key.get(method, method)
    if vram_key not in vram_reqs:
        raise ValueError(
            f"Method '{method}' (key: {vram_key}) not found for model '{model}'. "
            f"Available methods: {', '.join(sorted(vram_reqs.keys()))}"
        )
    vram_needed_gb = vram_reqs[vram_key]

    # ------------------------------------------------------------------
    # Select partition & GPUs
    # ------------------------------------------------------------------
    partition, num_gpus, vram_available_gb, cpus_per_task, mem_gb = (
        _select_partition_and_gpus(vram_needed_gb, cluster, max_budget_pc)
    )

    # ------------------------------------------------------------------
    # QOS
    # ------------------------------------------------------------------
    qos = _select_qos(partition, num_gpus, cluster)

    # ------------------------------------------------------------------
    # Templates
    # ------------------------------------------------------------------
    sbatch_template, training_script = _TEMPLATES[method]
    conda_env = _CONDA_ENVS[method]

    # Override template for multi-GPU inference
    if method == "inference" and num_gpus > 1:
        sbatch_template = "serve_vllm_tp.sbatch.j2"

    # Override template for multi-GPU/multi-node training
    if method in ("lora", "qlora", "full") and num_gpus > 1:
        if num_gpus > 8:
            sbatch_template = "finetune_multinode.sbatch.j2"
        else:
            sbatch_template = "finetune_deepspeed.sbatch.j2"

    # ------------------------------------------------------------------
    # DeepSpeed
    # ------------------------------------------------------------------
    deepspeed_config = _select_deepspeed(num_gpus) if method != "inference" else None

    # ------------------------------------------------------------------
    # Time estimation
    # ------------------------------------------------------------------
    estimated_time_hours = None
    if dataset_tokens is not None and method != "inference":
        tokens_per_sec = model_info.get("tokens_per_sec", {}).get(method)
        if tokens_per_sec:
            efficiency = 0.85
            total_tokens = dataset_tokens * epochs
            estimated_time_hours = total_tokens / (tokens_per_sec * num_gpus * efficiency * 3600)
            estimated_time_hours = round(estimated_time_hours, 2)

    # ------------------------------------------------------------------
    # Cost estimation
    # ------------------------------------------------------------------
    billing_weight = cluster["partitions"][partition]["billing_weight_gpu"]
    estimated_cost_pc = None
    if estimated_time_hours is not None:
        estimated_cost_pc = round(num_gpus * billing_weight * estimated_time_hours)

    # ------------------------------------------------------------------
    # Walltime
    # ------------------------------------------------------------------
    walltime_sbatch = None
    if estimated_time_hours is not None:
        buffered_hours = estimated_time_hours * 1.3
        walltime_hours = math.ceil(buffered_hours)
        # Enforce max_time_hours constraint
        if max_time_hours is not None:
            walltime_hours = min(walltime_hours, max_time_hours)
        # Enforce partition max walltime (convert "D-HH:MM:SS" to hours)
        max_wt_str = cluster["partitions"][partition].get("max_walltime", "7-00:00:00")
        parts = max_wt_str.split("-")
        if len(parts) == 2:
            max_wt_hours = int(parts[0]) * 24
            hms = parts[1].split(":")
            max_wt_hours += int(hms[0])
        else:
            hms = parts[0].split(":")
            max_wt_hours = int(hms[0])
        walltime_hours = min(walltime_hours, max_wt_hours)
        walltime_sbatch = _format_walltime(walltime_hours)
    elif max_time_hours is not None:
        walltime_sbatch = _format_walltime(max_time_hours)
    else:
        # Default walltime when no estimation possible
        if method == "inference":
            walltime_sbatch = "04:00:00"
        else:
            walltime_sbatch = "24:00:00"

    # ------------------------------------------------------------------
    # Warnings & notes
    # ------------------------------------------------------------------
    warnings = []
    notes_parts = []

    # Gated model check
    if model_info.get("gated", False):
        warnings.append("Model is gated - HF_TOKEN required")

    # Large job warning
    if num_gpus > 8:
        num_nodes = math.ceil(num_gpus / 8)
        warnings.append(
            f"Multi-node job: {num_nodes} nodes x {min(8, num_gpus)} GPUs. "
            f"Ensure your code supports distributed training."
        )

    # Budget check
    if max_budget_pc is not None and estimated_cost_pc is not None:
        if estimated_cost_pc > max_budget_pc:
            warnings.append(
                f"Estimated cost ({estimated_cost_pc} PC) exceeds budget ({max_budget_pc} PC). "
                f"Consider using a cheaper method (qlora) or fewer epochs."
            )
            # Suggest cheaper alternatives
            cheaper_methods = {"full": "lora", "lora": "qlora"}
            if method in cheaper_methods:
                alt = cheaper_methods[method]
                if alt in vram_reqs:
                    warnings.append(f"Try --method {alt} for lower cost.")

    # Time constraint check
    if max_time_hours is not None and estimated_time_hours is not None:
        if estimated_time_hours > max_time_hours:
            warnings.append(
                f"Estimated time ({estimated_time_hours:.1f}h) exceeds time limit "
                f"({max_time_hours}h). Consider more GPUs or fewer epochs."
            )

    # Generate notes
    p_info = cluster["partitions"][partition]
    gpu_type = p_info.get("gpu_type", "GPU")
    if num_gpus == 1:
        notes_parts.append(
            f"Single {gpu_type} has {vram_available_gb:.0f} GB VRAM, "
            f"sufficient for {model_info.get('short_name', model.split('/')[-1])} {method}"
        )
    else:
        notes_parts.append(
            f"{num_gpus}x {gpu_type} providing {vram_available_gb:.0f} GB total VRAM "
            f"for {model_info.get('short_name', model.split('/')[-1])} {method}"
        )

    if deepspeed_config:
        notes_parts.append(f"DeepSpeed {deepspeed_config} recommended for multi-GPU")

    notes = ". ".join(notes_parts) if notes_parts else None

    # ------------------------------------------------------------------
    # Build result
    # ------------------------------------------------------------------
    result = {
        "model": model,
        "method": method,
        "partition": partition,
        "num_gpus": num_gpus,
        "qos": qos,
        "cpus_per_task": cpus_per_task,
        "mem_gb": mem_gb,
        "vram_needed_gb": vram_needed_gb,
        "vram_available_gb": vram_available_gb,
        "estimated_time_hours": estimated_time_hours,
        "estimated_cost_pc": estimated_cost_pc,
        "walltime_sbatch": walltime_sbatch,
        "deepspeed_config": deepspeed_config,
        "conda_env": conda_env,
        "template": sbatch_template,
        "training_script": training_script,
        "warnings": warnings,
        "notes": notes,
    }

    # Add multi-node info if applicable
    if num_gpus > 8:
        result["num_nodes"] = math.ceil(num_gpus / 8)
        result["gpus_per_node"] = min(8, num_gpus)

    # Add batch_size if provided
    if batch_size is not None:
        result["batch_size"] = batch_size

    return result


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Calculate optimal GPU allocation for LLM tasks on the Betty cluster.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""\
Examples:
  %(prog)s --model meta-llama/Meta-Llama-3-70B --method lora
  %(prog)s --model meta-llama/Meta-Llama-3-70B --method full --max-budget-pc 500
  %(prog)s --model meta-llama/Meta-Llama-3-8B --method qlora --dataset-tokens 10000000
""",
    )
    parser.add_argument(
        "--model", required=True,
        help="HuggingFace model ID (key into model_registry.yaml)",
    )
    parser.add_argument(
        "--method", required=True, choices=["lora", "qlora", "full", "inference"],
        help="Training/inference method",
    )
    parser.add_argument(
        "--dataset-tokens", type=int, default=None,
        help="Estimated total training tokens (for time/cost estimation)",
    )
    parser.add_argument(
        "--epochs", type=int, default=3,
        help="Number of training epochs (default: 3)",
    )
    parser.add_argument(
        "--max-budget-pc", type=float, default=None,
        help="Maximum PC (priority credit) budget",
    )
    parser.add_argument(
        "--max-time-hours", type=float, default=None,
        help="Maximum walltime in hours",
    )
    parser.add_argument(
        "--batch-size", type=int, default=None,
        help="Per-device batch size (optional override)",
    )

    args = parser.parse_args()

    try:
        result = calculate(
            model=args.model,
            method=args.method,
            dataset_tokens=args.dataset_tokens,
            epochs=args.epochs,
            max_budget_pc=args.max_budget_pc,
            max_time_hours=args.max_time_hours,
            batch_size=args.batch_size,
        )
    except (ValueError, FileNotFoundError) as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    # Print warnings to stderr
    for w in result.get("warnings", []):
        print(f"WARNING: {w}", file=sys.stderr)

    # Print JSON result to stdout
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
