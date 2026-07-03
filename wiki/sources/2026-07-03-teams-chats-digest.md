---
type: source
tags: [teams, digest, glm, model-serving, nginx, litellm]
created: 2026-07-03
updated: 2026-07-03
related: [glm-5.2, kenneth-chaney, jeffrey-vadala, vllm-serving]
status: current
---

# Teams Chats Digest — 2026-07-03

## One-line summary
Small cycle (3 new messages, all Chaney 1:1, all Jeffrey): a detailed **root-cause diagnosis of the served GLM-5.2 `413`** — it's the **nginx reverse-proxy `client_max_body_size` (~1 MB default)** in front of PARCC's hosted vLLM, not a model/litellm bug — with a concrete server-side fix.

## New this cycle
- **413 root cause = nginx body-size cap, not the model (Jeffrey, ~10:29 EDT).** Jeffrey posted an analysis concluding the `413 Request Entity Too Large` on the served GLM-5.2 endpoint is returned by the **nginx reverse proxy** sitting in front of PARCC's hosted **vLLM**, whose default **`client_max_body_size` is 1 MB**. [[z.ai|ZCode]]/agent runs send an OpenAI-style JSON body (prompt + context + tools + history) larger than that cap, so **nginx rejects it before it reaches vLLM/GLM**. Key points:
  - **Not a model or litellm bug**; the `retryable=false` flag means retrying won't help — the body must shrink or the cap must rise.
  - GLM-5.2 legitimately supports a **200K context window**, so large request bodies are *expected*; the proxy is just mis-sized for the model behind it.
  - **Server-side fix** (the real fix): whoever runs the GLM-5.2 vLLM endpoint should raise the nginx limit in that location/server block — e.g. `client_max_body_size 100m;` (or `0` = unlimited), `client_body_buffer_size 1m;`, `proxy_read_timeout 600s;` — then `nginx -t && nginx -s reload`. `100m` is a safe ceiling for a 200K-context model. If PARCC fronts vLLM with **litellm-proxy** instead of raw nginx the same 413 can surface, but the nginx fix is the relevant one because the error HTML explicitly names nginx.
  - **Hedge:** follow-ups "**the proxy server had limit**" / "**at least that's what it thinks**" — Jeffrey flags this as his agent's diagnosis, not yet confirmed against the actual PARCC proxy config → `tentative`.

## Distinction worth keeping
This **body-size** cap (bytes, nginx `client_max_body_size`) is a *different axis* from the **context-window** ceiling discussed 7/2 (tokens; the ~100k-vs-~800k `max_model_len` regression Ken said he'd look at). A large request can trip the 1 MB body limit *before* any token/context limit is evaluated. Both need to be right for long-horizon agent runs to work. See [[glm-5.2]].

## Pages touched
- [[glm-5.2]] — served-ceiling section: added the nginx `client_max_body_size` body-size diagnosis + fix (tentative), distinguished from the context-window cap.

## See also
- [[glm-5.2]]
- [[vllm-serving]]
- [[2026-07-02-teams-chats-digest]] — prior cycle: the 413 first surfaced + the ~800k→~100k context regression.
