# bc_osc_betty — OOD Interactive App for Betty AI

Derived from [OSC/bc_osc_codeserver](https://github.com/OSC/bc_osc_codeserver).
Runs Betty AI (Next.js + the scheduling analytics pipeline) as a Batch
Connect app on Open OnDemand.

## User flow

1. Log in to `https://ood.betty.parcc.upenn.edu` (PennKey + Duo).
2. Click **Betty AI** under Interactive Apps.
3. Pick partition, hours, account, working directory.
4. **Launch** — OOD submits a Slurm job.
5. Wait ~15s (warm) / ~4min (cold) for Next.js to boot.
6. **Connect to Betty AI** opens the chat UI in a new tab.

No local Mac setup. No SSH. No Kerberos config. Inference providers
(Anthropic / PARCC LiteLLM) are read from `~/.betty-agent/secrets.env`.

## Files

| File | Role |
|------|------|
| `manifest.yml` | App metadata shown in the OOD dashboard |
| `form.yml` | Form fields: partition, hours, account, GPUs, working dir |
| `submit.yml.erb` | Slurm resource request (cpus, mem, time, gpus) |
| `view.html.erb` | "Connect" button — GET form to `/rnode/<host>/<port>/` |
| `template/before.sh.erb` | Pre-launch: Node setup, `npm ci` (cached), `next build` |
| `template/script.sh.erb` | Launch: `npx next start -p $port` |
| `template/after.sh.erb` | `wait_until_port_used` — 600s grace period |

## Sandbox deploy (Jeff, development)

**Fast path** — one command does everything:

```bash
# On a Betty login node (or ood01):
curl -fsSL https://raw.githubusercontent.com/drquandary/betty-agent/master/ood/bc_osc_betty/bootstrap.sh | bash
```

That clones the repo, copies the OOD app to `~/ondemand/dev/betty/`,
creates `~/.betty-agent/secrets.env` if missing, and runs `preflight.sh`.

**Manual path** if you want control:

```bash
# On a Betty login node, one-time:
git clone https://github.com/drquandary/betty-agent.git ~/betty-agent
bash ~/betty-agent/ood/bc_osc_betty/bootstrap.sh
```

Edit `~/.betty-agent/secrets.env` to add a provider key.

Browse to `https://ood.betty.parcc.upenn.edu/pun/dev/betty/` → Launch.

To iterate on the OOD app itself: edit files in `~/ondemand/dev/betty/`
(or re-run `bootstrap.sh` to pull the latest from master), click Launch
again. No OOD restart — `/pun/dev/` is live-reloaded.

## Preflight

Run before every Launch to catch 80% of failures before they burn a
Slurm allocation:

```bash
bash ~/betty-agent/ood/bc_osc_betty/preflight.sh
```

Checks: repo present, `betty-ai-web/` intact, Node 20+ available
(module / system / nvm), Slurm reachable, Kerberos ticket, npm registry
reachable, provider key, OOD slot populated. Exit code 0 = ready.

## Production deploy (ryb, after sandbox is solid)

```bash
sudo cp -r ~jvadala/ondemand/dev/betty/ /var/www/ood/apps/sys/betty/
sudo chown -R root:root /var/www/ood/apps/sys/betty/
# No OOD restart — OSC docs confirm hot-pickup.
```

Any authenticated Penn user then sees **Betty AI** in their dashboard.

## One-time user setup — secrets

The form does NOT take API keys (OOD persists form fields into the job
script on disk at `~/ondemand/data/`, which is not the right place for
secrets). Users write keys to a file the job sources at launch:

```bash
mkdir -p ~/.betty-agent
cat > ~/.betty-agent/secrets.env <<'EOF'
# At least one of these must be set.
# export ANTHROPIC_API_KEY=sk-ant-...
# export LITELLM_API_KEY=sk-...
EOF
chmod 700 ~/.betty-agent
chmod 600 ~/.betty-agent/secrets.env
```

If the file is missing, Betty still launches — the provider menu shows
an in-app setup prompt on the first chat message.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `[betty] ERROR: expected betty-agent at ...` | `git clone git@github.com:drquandary/betty-agent <working_dir>/betty-agent` |
| `npm ci` fails on compute node with DNS error | Compute-node VLAN may block `registry.npmjs.org`. Run `npm install` once on the login node under the same dir to warm `node_modules/`. |
| Session opens but shows "LiteLLM: unauthorized" | `secrets.env` not present or `LITELLM_API_KEY` not exported. |
| Terminal tab is missing | Intentional under OOD — use the **Shell Access** tab in the OOD dashboard instead. Re-enable with `unset NEXT_PUBLIC_BETTY_DEPLOY_TARGET` in `before.sh.erb` if you want it back. |
| WebSocket errors in browser console | OOD's `/rnode/` must have nginx WebSocket-upgrade rules — confirm with ryb if missing. |

## Design references

- [OOD interactive apps tutorial](https://osc.github.io/ood-documentation/latest/tutorials/tutorials-interactive-apps.html)
- [bc_osc_codeserver](https://github.com/OSC/bc_osc_codeserver) — the fork source
- Design doc: `raw/docs/2026-04-24-ood-integration-plan.md`
