#!/usr/bin/env python3
"""Call the PARCC LiteLLM gateway for inference.

Reads endpoint config from betty-ai/configs/defaults.yaml (providers.litellm-parcc)
and the API key from betty-ai/configs/team.yaml (providers.litellm-parcc.api_key)
or the LITELLM_API_KEY env var.

Usage:
    python betty-ai/scripts/litellm_chat.py "your prompt here"
    echo "your prompt" | python betty-ai/scripts/litellm_chat.py -
    python betty-ai/scripts/litellm_chat.py --model openai/gpt-oss-120b --max-tokens 500 "prompt"
    python betty-ai/scripts/litellm_chat.py --system "You are terse." "prompt"
    python betty-ai/scripts/litellm_chat.py --json "prompt"   # full response
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

import yaml

CONFIG_ROOT = Path(__file__).resolve().parent.parent / "configs"


def load_yaml(path: Path) -> dict:
    if not path.exists():
        return {}
    with path.open() as f:
        return yaml.safe_load(f) or {}


def resolve_config() -> dict:
    defaults = load_yaml(CONFIG_ROOT / "defaults.yaml")
    team = load_yaml(CONFIG_ROOT / "team.yaml")
    provider = (defaults.get("providers", {}) or {}).get("litellm-parcc", {}) or {}
    team_provider = (team.get("providers", {}) or {}).get("litellm-parcc", {}) or {}

    api_key = os.environ.get("LITELLM_API_KEY") or team_provider.get("api_key")
    if not api_key or api_key.startswith("sk-REPLACE"):
        sys.exit(
            "error: no LiteLLM API key. Set LITELLM_API_KEY or "
            "providers.litellm-parcc.api_key in betty-ai/configs/team.yaml"
        )

    base_url = provider.get("base_url", "https://litellm.parcc.upenn.edu/v1")
    endpoint = provider.get("chat_endpoint", "/chat/completions")
    return {
        "url": base_url.rstrip("/") + endpoint,
        "api_key": api_key,
        "model": provider.get("default_model", "openai/gpt-oss-120b"),
        "max_tokens": provider.get("default_max_tokens", 100),
        "temperature": provider.get("default_temperature", 0.5),
    }


def chat(prompt: str, *, system: str | None, model: str, max_tokens: int,
         temperature: float, cfg: dict) -> dict:
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    body = json.dumps({
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }).encode()
    req = urllib.request.Request(
        cfg["url"],
        data=body,
        headers={
            "Authorization": f"Bearer {cfg['api_key']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"HTTP {e.code}: {e.read().decode(errors='replace')}")


def main() -> None:
    cfg = resolve_config()
    p = argparse.ArgumentParser(description="Call PARCC LiteLLM gateway")
    p.add_argument("prompt", help='prompt text, or "-" to read stdin')
    p.add_argument("--system", help="system prompt")
    p.add_argument("--model", default=cfg["model"])
    p.add_argument("--max-tokens", type=int, default=cfg["max_tokens"])
    p.add_argument("--temperature", type=float, default=cfg["temperature"])
    p.add_argument("--json", action="store_true", help="print full JSON response")
    args = p.parse_args()

    prompt = sys.stdin.read() if args.prompt == "-" else args.prompt
    resp = chat(
        prompt,
        system=args.system,
        model=args.model,
        max_tokens=args.max_tokens,
        temperature=args.temperature,
        cfg=cfg,
    )
    if args.json:
        print(json.dumps(resp, indent=2))
    else:
        print(resp["choices"][0]["message"]["content"])


if __name__ == "__main__":
    main()
