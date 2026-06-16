---
type: concept
tags: [vlm, vision-language-models, medical, surgical, inference, betty, vllm-serving]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest]
related: [vision-language-models, vllm-serving, betty-ai-agent, jeffrey-vadala, kenneth-chaney, betty-cluster]
status: tentative
---

# Surgical Tool-ID VLM

## One-line summary
A vision-language-model project of [[jeffrey-vadala]]'s that identifies surgical implements from images; predates the PARCC work but resurfaced as a candidate hosted service on Betty for higher throughput.

## What it is
- A VLM that performs **surgical implement identification** from camera images.
- jvadala has **benchmarks** and a **rigged GUI** demo.
- Original concept: feed a **VR headset's cameras** into the VLM and **display tool IDs** in the headset.
- Earlier **proof-of-concept ran on a phone** (demo video "Tool ID": `https://www.youtube.com/watch?v=Ra-bC_dAgG0`).

## Status

> **Status: tentative** — hosting is a discussed idea, not a committed project.

- GUI development **stalled**: the collaborating doctor took a residency in Seattle and never bought the VR headset.
- [[kenneth-chaney]] (~6/13) raised hosting the VLM on the cluster for **higher throughput** if many people use it, and asked jvadala for a screenshot of the identification output. jvadala agreed throughput would scale and that it could be helpful.

## Betty hosting notes (if pursued)
- Would slot into the standard VLM-serving path on Betty — see [[vision-language-models]] and [[vllm-serving]] for the inference-serving patterns.
- A higher-throughput hosted endpoint is the natural next step beyond the phone PoC.

## See also
- [[vision-language-models]]
- [[vllm-serving]]
- [[betty-ai-agent]]
- [[jeffrey-vadala]] — project author
- [[kenneth-chaney]] — proposed hosting it

## Sources
- [[2026-06-16-teams-chats-digest]] — the Chaney ↔ jvadala VLM-hosting thread
