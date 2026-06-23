---
type: entity
tags: [people, parcc, systems, infra, ken, sandbox, model-serving]
created: 2026-06-16
updated: 2026-06-23
sources: [2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest, 2026-06-23-teams-chats-digest]
related: [betty-cluster, parcc-helper-tools, betty-ai-agent, surgical-tool-id-vlm, vast-storage, bcm-bright-cluster-manager, jaime-combariza, jamie-schnaitter, jeffrey-vadala]
status: current
---

# Kenneth Chaney (ken / kchaney)

## One-line summary
PARCC systems/infrastructure engineer who builds cluster tooling (`parcc_sandbox`, `parcc_sfree.py`), deploys quantized LLMs, and handles VAST/BCM/NFSv4 operations.

## Role
- Systems / infra engineer at PARCC
- Owns provisioning and model-serving infrastructure; partners with [[jaime-combariza]] and [[jamie-schnaitter]] on incidents; friendly working relationship with [[jeffrey-vadala]] (coffee/lunch, AI chat)

## What he owns / built
- **`parcc_sandbox`** — a sandboxing wrapper that runs a tool (e.g. `pi` / Claude code) with RW to the current dir and RO elsewhere; `parcc_sandbox -- pi`, add writable dirs with `-w ${OTHER_DIR}`. Deployed on login03. See [[parcc-helper-tools]].
- **`parcc_sfree.py`** — free/used node reporting; `--by node` for per-node granularity, `--json` for machine-readable output. Canonical data source he wants the [[betty-ai-agent]] dashboard to use.
- **Model serving** — deploys Unsloth quantized models on the B200 hardware, targeting native NVFP4 tensors. Interested in following Kimi-code.
  - **GLM-DSA deployment (in progress, 2026-06-18):** working out issues with the `glm-dsa` architecture. sglang did **not** provide day-zero support this release (a change from past releases). Serving at **Q4 quantization** with a measured **~2% performance hit**. Status: tentative/ongoing.
- **VAST / BCM / NFSv4 ops** — leads triage on the 6/16 `libhwloc.so.15` outage (restored the library) and the BCM→VAST new-user home-dir creation failure after the NFSv4+idmap switch (see [[betty-cluster]], [[bcm-bright-cluster-manager]]).
  - **Account sync paused (2026-06-23):** user creation and the remainder of the account sync are currently paused — this is what leaves new home folders broken. Plan: after the pending **Palo Alto TAC** firewall-support session, run one round of syncs and manually fix all home folders that get made.
- **Identity / EULA** — built first-pass EULA functionality in Grouper.
- Floated hosting jvadala's [[surgical-tool-id-vlm]] on the cluster for higher throughput.
- **Model recommendation to jvadala** — suggested the 120B open model jvadala now uses for the [[templeton-religious-trust-project]]; both wish for a published update to that model family.

## API-key / agent guidance (to jvadala)
- Use `parcc_sfree.py` as the dashboard data source; add a "booting AI in progress" label.
- A webserver with a **local proxy** is the agreed way to protect the provider API key (`user/agent → localhost proxy → PARCC LiteLLM gateway → provider model`).

## See also
- [[betty-cluster]]
- [[parcc-helper-tools]]
- [[betty-ai-agent]]
- [[surgical-tool-id-vlm]]
- [[jaime-combariza]]
- [[jamie-schnaitter]]

## Sources
- [[2026-06-16-teams-chats-digest]] — sandbox, dashboard, model-serving, and ops threads
- [[2026-06-18-teams-chats-digest]] — GLM-DSA deployment (Q4, no sglang day-zero support); 110 dB server-room note; 120B model recommendation to jvadala
- [[2026-06-23-teams-chats-digest]] — account sync paused; manual home-folder fixes planned after Palo Alto TAC session
