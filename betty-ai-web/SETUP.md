# Betty AI — New User Setup

Hand this file to a fresh Claude Code agent (or a new team member). Following it in order gets them from zero to "Betty responds and can run cluster commands on Betty."

Estimated time: 10–15 minutes. About 2 min of it is waiting for Duo to push.

---

## Prerequisites

Must be true before you start:

- [ ] Mac or Linux workstation. (Windows users: use WSL2.)
- [ ] Node 20+ installed (`node --version`).
- [ ] `ssh`, `kinit`, `klist` on `PATH` (standard on macOS; `brew install krb5` if missing).
- [ ] You have a **PennKey** with access to a PARCC ColdFront project on Betty. If you don't, stop here — email PARCC or your PI.
- [ ] You are on Penn campus **or** connected to the Penn VPN. Betty's SSH is not reachable off-VPN.
- [ ] You have an API key for at least one model provider:
  - Anthropic key (for the tool-enabled Claude Code path), **or**
  - PARCC LiteLLM key (for `openai/gpt-oss-120b` via the PARCC gateway).

---

## 1. Get the repo

The project lives at:

```
/Users/<you>/BettyAgent /parcc1/
```

Note the trailing space in `BettyAgent ` — it's real. Always quote paths with that parent directory.

Structure you care about:

```
parcc1/
├── betty-ai/                       # Python brain: Slurm templates, GPU calculator, configs
│   ├── configs/
│   │   ├── defaults.yaml           # Team defaults — do NOT edit
│   │   ├── team.yaml.example       # Copy this → team.yaml
│   │   └── betty_cluster.yaml      # Cluster specs (machine-readable)
│   ├── models/
│   │   ├── model_registry.yaml     # VRAM/runtime estimates per HF model
│   │   └── gpu_calculator.py       # Resource planner (called by the agent)
│   └── scripts/
│       └── litellm_chat.py         # Standalone CLI to test LiteLLM
│
├── betty-ai-web/                   # Next.js GUI — YOU WILL RUN THIS
│   ├── .env.example                # Copy this → .env.local
│   ├── SETUP.md                    # this file
│   ├── package.json
│   ├── scripts/
│   │   ├── doctor.mjs              # `npm run doctor` — health check
│   │   ├── install-kinit-renewal.sh# Sets up auto-renewing Kerberos
│   │   ├── dev-phase2.mjs          # Starts terminal bridge + Next.js
│   │   └── terminal-server.mjs     # WebSocket PTY bridge
│   └── src/                        # App code; don't need to touch for setup
│
├── wiki/                           # Karpathy-style agent-maintained knowledge
│   ├── SCHEMA.md                   # How the wiki is organized (read this)
│   ├── index.md                    # Catalog of all pages
│   ├── log.md                      # Chronological activity log
│   └── entities|concepts|models|experiments|workflows|sources/*.md
│
├── raw/                            # Immutable sources (agent reads, never writes)
├── CLAUDE.md                       # Project-wide context for the agent
├── PROJECT.md                      # Research-specific context (team, experiments)
└── README.md
```

---

## 2. Configure your personal settings

### 2a. `betty-ai/configs/team.yaml`  (gitignored)

```bash
cd "/Users/<you>/BettyAgent /parcc1/betty-ai/configs"
cp team.yaml.example team.yaml
```

Then edit `team.yaml`. Replace the placeholders under `user:` and `paths:` with your own PennKey and ColdFront project name. Under `providers.litellm-parcc.api_key`, paste your LiteLLM key if you have one (otherwise leave `sk-REPLACE_ME`).

### 2b. `betty-ai-web/.env.local`  (gitignored)

```bash
cd "/Users/<you>/BettyAgent /parcc1/betty-ai-web"
cp .env.example .env.local
```

Edit `.env.local`:

```
ANTHROPIC_API_KEY=<your key, or leave blank if using Claude subscription CLI auth>
LITELLM_API_KEY=<your PARCC LiteLLM key>
WIKI_PATH=../wiki
BETTY_AI_PATH=../betty-ai
```

At least one of `ANTHROPIC_API_KEY` or `LITELLM_API_KEY` must be set.

---

## 3. Kerberos + SSH one-time setup

Betty's SSH requires Kerberos + Duo. The agent's cluster tools reuse your authenticated SSH session via OpenSSH `ControlMaster`, so you do Duo **once** and the session stays alive.

### 3a. Add an SSH config block

Append this to `~/.ssh/config` (create the file if it doesn't exist):

```
Host login.betty.parcc.upenn.edu
    User <your-pennkey>
    GSSAPIAuthentication yes
    GSSAPIDelegateCredentials yes
    PreferredAuthentications gssapi-with-mic,keyboard-interactive,publickey
    ControlMaster auto
    ControlPath ~/.ssh/cm/%r@%h:%p
    ControlPersist 8h
    ServerAliveInterval 60
```

Create the socket directory:

```bash
mkdir -p ~/.ssh/cm && chmod 700 ~/.ssh/cm
```

### 3b. Install auto-renewing Kerberos (recommended)

From the repo:

```bash
cd "/Users/<you>/BettyAgent /parcc1/betty-ai-web"
./scripts/install-kinit-renewal.sh install
```

This registers a macOS launchd agent that runs `kinit -R` every 4 hours. No more mid-day auth failures.

### 3c. Get a renewable ticket

```bash
kinit -r 7d <your-pennkey>@UPENN.EDU
```

**Important**: the realm `UPENN.EDU` must be UPPERCASE. `upenn.edu` fails with `CLIENT_NOT_FOUND`.

Enter your PennKey password when prompted.

Verify:

```bash
klist
```

Should show `Principal: <you>@UPENN.EDU` and a "renew until" line ~7 days out.

### 3d. Open the Duo'd SSH session once

In a normal terminal (not the web UI — Duo needs a TTY):

```bash
ssh login.betty.parcc.upenn.edu
```

Approve Duo (push or code). You're now on Betty. The `ControlMaster` socket at `~/.ssh/cm/<user>@login.betty.parcc.upenn.edu:22` is now alive and will be reused by the agent for the next 8 hours.

You can leave that session open or close it — the socket persists either way.

---

## 4. Install + verify

```bash
cd "/Users/<you>/BettyAgent /parcc1/betty-ai-web"
npm install
npm run doctor
```

`npm run doctor` prints a punch list. Fix any red items it shows. All green means you're ready.

Common red items and what to do:
- **Kerberos ticket: missing** → `kinit <you>@UPENN.EDU` (see 3c).
- **SSH ControlMaster: not running** → re-run step 3d.
- **LITELLM_API_KEY: unset** → fill it in `.env.local` (step 2b).
- **wiki/ directory: missing** → check `WIKI_PATH` in `.env.local`.

---

## 5. Run it

```bash
npm run dev:phase2
```

This starts:
- The WebSocket PTY bridge on `ws://127.0.0.1:3001/terminal`
- Next.js on `http://localhost:3000`

Open `http://localhost:3000` in your browser.

The header should show a green **Betty ready** pill. If it's red, re-run `npm run doctor` to diagnose.

---

## 6. First conversation

Click the **Options** button (top-left) and pick a provider:
- **Claude Code OAuth** — tool-enabled. Betty can run cluster commands. Best for actions.
- **PARCC LiteLLM** — tool-enabled with `gpt-oss-120b`. Faster, free, but only read-only tools (no `cluster_submit`).
- **OpenAI API key** or **Local Qwen** — text-only fallbacks.

Try: *"check my jobs"*. Betty should call `squeue -u <you>` via SSH and show results. You'll see the command mirror into the terminal pane on the right tagged `[betty-agent]`.

---

## 7. Cheat sheet

| Question | Answer |
|----------|--------|
| Agent says "Permission denied" on SSH | Your ticket expired or the ControlMaster died. Run `klist -s; ssh -O check login.betty.parcc.upenn.edu` and whichever fails, redo step 3c or 3d. |
| Terminal pane disconnected | Click **Local** button. If still broken, check `scripts/terminal-server.mjs` logs. |
| Want to see what wiki pages exist | Click **Lint wiki** in the header — shows orphans + broken links + stale pages. |
| Want to add a model | PARCC admin adds it to LiteLLM → it appears in the Options model dropdown within 60s. No code changes. |
| Chat history reset on reload | Click **Clear chat** in the top of the chat pane — it's stored in localStorage under `betty-ai-chat-history`. |
| How do I know the ticket expired | Header badge flips from green "Betty ready" to red "kinit needed" within 30s. |

---

## 8. Reference docs in the repo

Read in this order if you want depth:

1. `parcc1/CLAUDE.md` — cluster basics, SSH, storage, Slurm
2. `parcc1/PROJECT.md` — this group's research context
3. `parcc1/wiki/SCHEMA.md` — how the Karpathy wiki is organized
4. `parcc1/betty-ai/configs/betty_cluster.yaml` — machine-readable cluster specs
5. `parcc1/betty-ai/models/model_registry.yaml` — VRAM/runtime per HF model
6. `parcc1/BETTY_SYSTEM_GUIDE.md` — long-form cluster docs
7. `parcc1/BETTY_LLM_AND_WORKFLOWS_GUIDE.md` — long-form LLM workflow docs

Agent persona and tool wiring: `parcc1/.claude/agents/betty-ai.md`.
