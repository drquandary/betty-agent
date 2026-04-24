# Betty AI under Open OnDemand — Integration Plan

> ryb gave Jeff sandbox access on `ood01.betty.parcc.upenn.edu`. This plan
> turns Betty AI into an OOD Batch Connect app so researchers launch it
> from the OOD portal just like Jupyter or a VS Code server — no local
> setup, no SSH config, no Mac required.

## Decision: fork `bc_osc_codeserver`, not `bc_osc_jupyter`

**Fork code-server.** It is the closer fit in every dimension:

| Property | bc_osc_codeserver | bc_osc_jupyter |
|----------|-------------------|----------------|
| `form.yml` | ~20 lines | 400+ lines (cluster-switch conditionals, k8s branch) |
| `submit.yml.erb` | 4 lines (just `basic` template + conn_params) | ~140 lines of ERB conditionals |
| Proxy prefix | `/rnode/<host>/<port>/` — **raw node**, native WS upgrade | `/node/<host>/<port>/` — also handles WS but baked-in login redirect |
| Config coupling | None — just launches a binary and connects | Jupyter `config.py` with hashed password, kernel config |
| Mental model | "start an HTTP server on `$port`, proxy browser to it" | "start a Jupyter server with these kernels" |
| Adaptation diff | ~30–60 lines across 5 files | Several hundred to rip out jupyter-specific machinery |

`/rnode/` is specifically what we need: Next.js has custom WebSocket routes
(xterm.js, the permission-card SSE stream), and `/rnode/` is the OOD
reverse-proxy path that forwards WebSocket upgrades transparently.

If we later want a multi-port setup (Next.js on one port, an external
terminal bridge on another), we can do it on top of the code-server
template by calling `find_port` twice in `before.sh.erb` — same pattern,
just two exports.

## What the researcher sees

```
1. User opens  https://ood.betty.parcc.upenn.edu  (Duo'd via Shibboleth)
2. In the app dashboard, clicks "Betty AI"
3. Fills a short form:
      Partition        [auto_select: b200-mig45 | b200-mig90 | dgx-b200 | genoa-std-mem]
      Hours            [number:   default 4, max 24]
      Account          [auto_accounts select]
      Working dir      [path: default /vast/projects/<team>/betty-agent]
4. Submits. OOD generates a Slurm job, waits for it to start.
5. Dashboard shows "Running on dgx-mig45-07, ready in ~45s".
6. "Connect to Betty AI" button appears. Clicks it.
7. Browser opens /rnode/dgx-mig45-07/40123/ — Next.js chat UI loads.
8. Works the same as local: provider menu, chat, wiki, dashboard.
9. When the session ends (user clicks Delete, or time runs out), the
   Slurm job is torn down, no resources leak.
```

**No Kerberos ticket on the user's Mac. No SSH config. No ControlMaster.
No `npm install` on the laptop.** Everything runs on the compute node.

## Repo layout under this plan

Two options, pick one:

**A. New repo `bc_osc_betty`** — forked from OSC's template, lives alongside
the main `betty-agent` repo. Deployed via packaging to
`~/ondemand/dev/betty/` for sandbox, later to `/var/www/ood/apps/sys/betty/`
for cluster-wide. Keeps OOD packaging separate from the app code.

**B. Subdirectory `ood/` inside `betty-agent`** — `ood/bc_osc_betty/` with
the six OOD files, `betty-ai-web/` is the actual app. One repo to clone
on the compute node, `before.sh.erb` reads the sibling `betty-ai-web/`
for the build.

**Recommend B.** One checkout on `/vast/projects/...` serves both the OOD
bootstrap and the app code. No version skew between them. Simpler to
iterate.

```
betty-agent/
├── ood/
│   └── bc_osc_betty/
│       ├── manifest.yml
│       ├── form.yml
│       ├── submit.yml.erb
│       ├── view.html.erb
│       ├── icon.png                    (pulled from OSC template, swap later)
│       └── template/
│           ├── before.sh.erb
│           ├── script.sh.erb
│           └── after.sh.erb
├── betty-ai-web/                       (existing, unchanged)
└── betty-ai/                           (existing, unchanged)
```

## Architecture deltas from the Mac-dev flow

### 1. Transport: no more SSH when we're already on the cluster

Current: `src/agent/cluster/ssh.ts` wraps every Slurm command in
`ssh user@host "cmd"`, reuses the user's `~/.ssh/config` ControlMaster.

Under OOD: we ARE on a compute node under `pam_slurm_adopt`, with the
user's Kerberos creds forwarded. `squeue` etc. just work locally.

**Refactor**: add a transport abstraction with two implementations.

```typescript
// src/agent/cluster/transport.ts
export interface ClusterTransport {
  run(cmd: string): Promise<RemoteResult>;
  runParseable(cmd: string): Promise<RemoteResult>;
  upload(content: string | Buffer, remotePath: string): Promise<void>;
}

// src/agent/cluster/ssh.ts          — existing implementation, unchanged
// src/agent/cluster/local.ts         — NEW: spawns commands directly
// src/agent/cluster/index.ts         — picks impl by BETTY_CLUSTER_MODE
```

The `local` transport is ~50 lines. `child_process.spawn('squeue', [...])`
instead of `spawn('ssh', ['host', ...])`. Same `RemoteResult` shape.
`annotateAuthError` still runs (it's generic over stderr). The terminal-mirror
feature becomes a no-op in local mode.

Env switch: `BETTY_CLUSTER_MODE=local` set by `before.sh.erb`. Tests use
the existing `__setSpawnForTests` hook either way.

### 2. Terminal pane: drop it for v1

The split-pane xterm.js exists because when Betty AI runs on your Mac,
the user wanted to see what actions the agent took against the cluster.

Under OOD, the user is already on Betty — the OOD dashboard has a
"Shell Access" tab that opens a real SSH session to the compute node.
Duplicating that in-app adds a second port, a second websocket, more
surface area.

**v1: drop the terminal pane.** Chat + dashboard + settings only. Single
port, cleaner. The agent's tool-call history already logs every cluster
command in the chat as a tool-use card — the mirror was redundant.

**v2 (optional): add it back** with a second `find_port` call and a
secondary WS route on the same Next.js process. ~30 lines. Only do this
if a user asks.

### 3. Secrets: user-level file, not the submit form

`ANTHROPIC_API_KEY` and `LITELLM_API_KEY` must NOT appear in the submit
form (OOD would persist them in the job script, world-readable on disk).

**Pattern**: on first run, the app checks for `~/.betty-agent/secrets.env`
and creates it with a template if missing. The file is `chmod 600`, in
the user's home (VAST), never part of the OOD job spec.

`before.sh.erb` sources it:
```bash
[ -f ~/.betty-agent/secrets.env ] && source ~/.betty-agent/secrets.env
```

### 4. Build cache on VAST

`npm install` + `next build` = 3–5 minutes. If we do it on every launch,
users wait. Cache aggressively:

- **Repo checkout**: `/vast/projects/<team>/betty-agent/` (or user home)
- **`node_modules/`**: same dir; preserved across launches
- **`.next/` build output**: same dir; preserved
- **Package lockfile check**: if `package-lock.json` sha256 hasn't changed
  since the last `npm install`, skip `npm install` entirely. Save the
  hash to `.next/.cache/package-lock.sha256`.
- **Git pull optional**: `before.sh.erb` checks `BETTY_AUTO_UPDATE` env;
  default off (reproducibility). Explicit "Update" toggle in form.yml.

Cold start (first ever launch): ~4 minutes. Warm start: ~15 seconds.

### 5. Node runtime on the compute node

Two paths; we pick one in `before.sh.erb`:

- `module load nodejs/20` if available on Betty.
  Check: `ssh betty "module spider nodejs"` — verify version >= 20 on next
  ControlMaster session.
- Fallback: ship `nvm` install script; target `~/.nvm/versions/node/v20.x`.
  One-time ~1 min install, cached under home.

Decision after first sandbox deploy — whichever shows up first.

## The six files (sketch)

### `ood/bc_osc_betty/manifest.yml`

```yaml
---
name: Betty AI
category: Interactive Apps
subcategory: AI Assistants
role: batch_connect
description: |
  A conversational assistant for fine-tuning, serving, and managing
  LLMs and other research workloads on the Betty cluster.
```

### `ood/bc_osc_betty/form.yml`

```yaml
---
cluster: "betty"
attributes:
  bc_num_hours:
    value: 4
    min: 1
    max: 24
  account:
    widget: auto_accounts
  partition:
    widget: select
    options:
      - ["b200-mig45 (dev, 1 GPU slice)", "b200-mig45"]
      - ["b200-mig90 (1 larger GPU slice)", "b200-mig90"]
      - ["dgx-b200 (full node)", "dgx-b200"]
      - ["genoa-std-mem (CPU only)", "genoa-std-mem"]
  working_dir:
    widget: path_selector
    directory: "/vast/projects"
    show_hidden: false
    show_files: false
  gpus:
    widget: number_field
    value: 1
    min: 0
    max: 8
form:
  - bc_num_hours
  - account
  - partition
  - gpus
  - working_dir
```

### `ood/bc_osc_betty/submit.yml.erb`

```yaml
---
batch_connect:
  template: "basic"
  conn_params:
    - password
script:
  native:
    - "--partition=<%= partition %>"
    - "--account=<%= account %>"
    - "--time=<%= bc_num_hours.to_i %>:00:00"
    - "--gres=gpu:<%= gpus %>"
```

### `ood/bc_osc_betty/template/before.sh.erb`

```bash
#
# Allocate a port + generate a password. Betty AI runs here.
#
export port=$(find_port ${host})
export password=$(create_passwd 16)

# User secrets never enter the job script.
[ -f "${HOME}/.betty-agent/secrets.env" ] && source "${HOME}/.betty-agent/secrets.env"

export BETTY_CLUSTER_MODE=local                 # no SSH needed on-node
export BETTY_WORKING_DIR="<%= working_dir %>"
export BETTY_REPO="${BETTY_WORKING_DIR}/betty-agent"

# Node runtime
if module spider nodejs 2>&1 | grep -q 'nodejs'; then
  module load nodejs/20
else
  # nvm fallback
  [ -d "${HOME}/.nvm" ] || { curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash; }
  export NVM_DIR="${HOME}/.nvm" && source "${NVM_DIR}/nvm.sh"
  nvm use 20 2>/dev/null || nvm install 20
fi

cd "${BETTY_REPO}/betty-ai-web"

# Incremental build — skip npm install if lockfile unchanged
LOCK_HASH=$(sha256sum package-lock.json | cut -d' ' -f1)
if [ "$(cat .next/.cache/package-lock.sha256 2>/dev/null)" != "${LOCK_HASH}" ]; then
  npm ci
  mkdir -p .next/.cache && echo "${LOCK_HASH}" > .next/.cache/package-lock.sha256
fi

npm run build
```

### `ood/bc_osc_betty/template/script.sh.erb`

```bash
#!/bin/bash
set -euo pipefail

cd "${BETTY_REPO}/betty-ai-web"

# Next.js binds the assigned port + requires no password (OOD handles
# auth via the session cookie). We pass the OOD-generated password
# through a header check in middleware.
export PORT=${port}
export BETTY_OOD_PASSWORD=${password}
export NODE_ENV=production

exec npm run start -- --port ${port}
```

### `ood/bc_osc_betty/template/after.sh.erb`

```bash
# Standard: wait up to 10 min for the server to open the port; if it
# doesn't, OOD will mark the session failed and clean it up.
wait_until_port_used "${host}:${port}" 600
```

### `ood/bc_osc_betty/view.html.erb`

```erb
<form action="/rnode/<%= host %>/<%= port %>/" method="get" target="_blank">
  <button class="btn btn-primary" type="submit">
    Connect to Betty AI
  </button>
</form>
```

Password handling: the middleware in Next.js checks a session cookie set
by the first request. For v1, the `/rnode/` layer + OOD session cookie
is sufficient (only the authenticated user can hit that path). We wire
the password into Next.js as a belt-and-suspenders auth check in a
later hardening pass.

## The one app refactor — `cluster/transport.ts`

```typescript
// src/agent/cluster/transport.ts
export type RemoteResult = { stdout: string; stderr: string; exit: number };
export interface ClusterTransport {
  run(cmd: string): Promise<RemoteResult>;
  runParseable(cmd: string): Promise<RemoteResult>;
  upload(content: string | Buffer, remotePath: string): Promise<void>;
}

// src/agent/cluster/index.ts
import type { ClusterTransport } from './transport';
import { SshTransport } from './ssh';
import { LocalTransport } from './local';

export function getTransport(): ClusterTransport {
  const mode = process.env.BETTY_CLUSTER_MODE ?? 'ssh';
  return mode === 'local' ? new LocalTransport() : new SshTransport();
}
```

Every existing caller (`cluster_run` tool, `/api/cluster/jobs`, etc.)
switches from `import { runRemote } from './cluster/ssh'` to
`getTransport().run(cmd)`. Six-file diff.

Tests for `LocalTransport` mirror the existing `ssh.test.ts` shape —
the `__setSpawnForTests` hook already exists.

## Secrets model

`~/.betty-agent/secrets.env` — `chmod 600`, in VAST home:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
export LITELLM_API_KEY=sk-...
```

On first launch the app detects a missing file and renders an in-app
setup screen: "We need an API key. Run the following in a terminal and
refresh."

Never put these in `form.yml` (OOD serializes form fields into the job
script, which lands on disk under `~/ondemand/data/`).

## Sandbox deploy recipe (what Jeff does tomorrow)

```bash
# On your Mac, locally:
cd ~/BettyAgent*/parcc1
mkdir -p ood/bc_osc_betty/template
# (create the six files per the sketches above)
git add ood/bc_osc_betty
git commit -m "ood: bc_osc_betty app skeleton (sandbox)"
git push

# On Betty (ood01):
ssh jvadala@ood01.betty.parcc.upenn.edu
mkdir -p ~/ondemand/dev/betty
cd /vast/projects/<team>/betty-agent && git pull
cp -r ood/bc_osc_betty/* ~/ondemand/dev/betty/

# In your browser:
# https://ood.betty.parcc.upenn.edu/pun/dev/betty/
# Click "Launch" — OOD submits the Slurm job, waits for Next.js to start,
# clicks Connect — you're in.
```

## Phased build

| Phase | Scope | Owner-blocking question |
|-------|-------|-------------------------|
| **4.0** | Six OOD files committed to repo; sandbox deploy recipe validated | Is `module load nodejs/20` available on the compute partitions? |
| **4.1** | `ClusterTransport` abstraction + `LocalTransport` + tests (10 vitest cases) | None — local refactor |
| **4.2** | `before.sh.erb` build caching (lockfile-hash skip) + measured cold/warm launch | — |
| **4.3** | Secrets flow (first-run setup screen) + docs | — |
| **4.4** | Drop terminal pane under `BETTY_DEPLOY_TARGET=ood` feature flag | — |
| **4.5** | Hardening: password check middleware, session-cookie plumbing, CSP for iframes | — |
| **4.6** | Promote to production OOD: ryb moves app to `/var/www/ood/apps/sys/betty/` | Ask ryb for the production deploy |

Each phase is independently reviewable; 4.0 alone is a working sandbox.

## Open questions for ryb

1. **Node on compute nodes** — `module load nodejs/20` or do we bundle?
2. **Outbound HTTPS from compute nodes** — confirm access to
   `api.anthropic.com` and `litellm.parcc.upenn.edu` from a job running
   on dgx-mig45. (Betty's compute VLAN often restricts egress.)
3. **`/rnode/` WebSocket** — confirm OOD's nginx config on Betty has the
   WebSocket upgrade rules for `/rnode/` (default OSC config does; some
   site customizations disable it).
4. **Promotion path** — when the sandbox is solid, what's the path from
   `~/ondemand/dev/betty/` to cluster-wide `/var/www/ood/apps/sys/betty/`?
5. **Icon** — OSC template has a placeholder `icon.png`. Any PARCC brand
   guidance, or can we use something neutral?

## What's explicitly out of scope (v1)

- **Multi-user session sharing.** One user, one session — standard OOD.
- **GPU-accelerated inference inside the OOD job.** The agent calls out
  to LiteLLM / Anthropic; local models (vLLM, etc.) are a separate
  deployment and a later phase.
- **Production deploy.** Sandbox only until we've iterated.
- **Terminal split-pane.** Deferred to v2 if users ask.
- **Container-based isolation.** Bare Slurm job for now; could wrap in
  Apptainer later if needed.

## Success criteria for v1 (Phase 4.0 done)

1. Jeff launches Betty AI from the OOD dashboard in his sandbox.
2. Next.js loads in the browser.
3. Chat message round-trips through LiteLLM.
4. `cluster_run squeue -u jvadala` returns results (proves LocalTransport).
5. Wiki read tool returns `[[betty-cluster]]` content.
6. Session tears down cleanly when the time-limit expires.
