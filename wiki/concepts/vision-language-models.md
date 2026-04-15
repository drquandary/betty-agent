---
type: concept
tags: [vlm, multimodal, vision, llm]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-llm-workflows-guide]
related: [qwen2.5-vl-7b-instruct, lora-fine-tuning, qlora, b200-mig45-partition, huggingface-cache-management]
status: current
---

# Vision-Language Models (VLMs)

## One-line summary
LLMs with a vision encoder attached so they can take image (and sometimes video) inputs alongside text — trained with chat-style multimodal data.

## Architecture pattern
```
Image -> ViT encoder -> projector (MLP) -> image tokens
                                                |
                                                v
                    Text tokens ---------->  LLM decoder -> text output
```
Most modern VLMs (Qwen2.5-VL, LLaVA, Gemma 4) follow this late-fusion pattern.

## Training considerations vs pure LLM
- **Data format**: ShareGPT-style JSON/JSONL with image paths per turn
- **Preprocessing**: images must be resized / patchified at load time; more CPU overhead
- **VRAM**: vision encoder is small (~600M for Qwen2.5-VL ViT) but activations can be large
- **Loss masking**: only supervise assistant text tokens, not image tokens
- **Tooling**: **LLaMA-Factory** (`llamafactory-cli`) is the most convenient path

## Our use case
[[qwen2.5-vl-7b-instruct]] for **surgical tool identification**. Dataset: `data/curated_v2_train.jsonl` (6480 samples, ShareGPT format with images). Config: `configs/train_v2.yaml`.

## Betty fit
- 7B VLM inference / LoRA: [[b200-mig45-partition]] (1 slice)
- 7B VLM full fine-tune: 1 full B200 on [[dgx-b200-partition]]
- Larger VLMs (72B+): multi-GPU, usually LoRA/QLoRA

## Pitfalls
- Image tokens inflate sequence length — expect OOMs if you blindly reuse a text-LLM config
- Always set [[huggingface-cache-management]] correctly — VLM weights + processors are bulky
- Vision tower pretrain quality matters more than decoder size for narrow-domain tasks

## See also
- [[qwen2.5-vl-7b-instruct]]
- [[lora-fine-tuning]]
- [[qlora]]

## Sources
- [[2026-04-08-betty-llm-workflows-guide]]
