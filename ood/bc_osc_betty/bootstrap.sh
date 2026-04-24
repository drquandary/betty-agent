#!/usr/bin/env bash
#
# bootstrap.sh — one-shot setup on a Betty login node.
#
# After this runs, you can click Launch in the OOD sandbox and expect
# things to actually work. Run it on ood01 or login01 — anywhere with
# access to /vast/projects and ~.
#
# Usage:
#   bash bootstrap.sh [--repo-dir <path>] [--branch <branch>]
#
# Defaults:
#   --repo-dir  $HOME/betty-agent    (override to use a shared project dir)
#   --branch    master
#
# What it does:
#   1. Clones (or pulls) drquandary/betty-agent.
#   2. Copies ood/bc_osc_betty/* to ~/ondemand/dev/betty/.
#   3. Creates ~/.betty-agent/secrets.env template if missing.
#   4. Runs preflight.sh and reports any failing checks.
#
# Idempotent. Re-run any time the repo changes.
#

set -euo pipefail

REPO_URL="${BETTY_REPO_URL:-https://github.com/drquandary/betty-agent.git}"
REPO_DIR="${HOME}/betty-agent"
BRANCH="master"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir) REPO_DIR="$2"; shift 2 ;;
    --branch)   BRANCH="$2";   shift 2 ;;
    -h|--help)
      sed -n '2,25p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

log() { printf "\033[1;36m[bootstrap]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[bootstrap]\033[0m %s\n" "$*"; }
die() { printf "\033[1;31m[bootstrap] ERROR\033[0m %s\n" "$*" >&2; exit 1; }

# 1. Repo ---------------------------------------------------------------

if [ -d "${REPO_DIR}/.git" ]; then
  log "repo present at ${REPO_DIR} — pulling"
  git -C "${REPO_DIR}" fetch --quiet origin
  git -C "${REPO_DIR}" checkout --quiet "${BRANCH}"
  git -C "${REPO_DIR}" pull --ff-only --quiet origin "${BRANCH}"
else
  log "cloning ${REPO_URL} into ${REPO_DIR}"
  git clone --quiet -b "${BRANCH}" "${REPO_URL}" "${REPO_DIR}"
fi

# 2. OOD app files ------------------------------------------------------

OOD_SRC="${REPO_DIR}/ood/bc_osc_betty"
OOD_DEST="${HOME}/ondemand/dev/betty"
[ -d "${OOD_SRC}" ] || die "OOD source missing: ${OOD_SRC}"

log "syncing ${OOD_SRC} -> ${OOD_DEST}"
mkdir -p "${OOD_DEST}/template"
# Copy everything *except* this bootstrap script + preflight (those live
# in the repo, not the OOD app dir).
for f in manifest.yml form.yml submit.yml.erb view.html.erb README.md; do
  [ -f "${OOD_SRC}/${f}" ] && cp "${OOD_SRC}/${f}" "${OOD_DEST}/${f}"
done
for f in before.sh.erb script.sh.erb after.sh.erb; do
  [ -f "${OOD_SRC}/template/${f}" ] && cp "${OOD_SRC}/template/${f}" "${OOD_DEST}/template/${f}"
done

# 3. Secrets template ---------------------------------------------------

SECRETS_DIR="${HOME}/.betty-agent"
SECRETS_FILE="${SECRETS_DIR}/secrets.env"
if [ ! -f "${SECRETS_FILE}" ]; then
  log "creating secrets template at ${SECRETS_FILE}"
  mkdir -p "${SECRETS_DIR}"
  chmod 700 "${SECRETS_DIR}"
  cat > "${SECRETS_FILE}" <<'EOF'
# Betty AI secrets — sourced by OOD's template/before.sh.erb at launch.
# At least one provider key must be uncommented and filled in.
#
# Anthropic (tool-enabled Claude path — best for actions):
# export ANTHROPIC_API_KEY=sk-ant-...
#
# PARCC LiteLLM gateway (tool-enabled gpt-oss-120b; free for PARCC members):
# export LITELLM_API_KEY=sk-...
#
# Optional: override the default SSH target (only used when
# BETTY_CLUSTER_MODE != "local", i.e. outside OOD):
# export BETTY_SSH_HOST=jvadala@login.betty.parcc.upenn.edu
EOF
  chmod 600 "${SECRETS_FILE}"
  warn "edit ${SECRETS_FILE} and set at least one provider key"
else
  log "secrets already present at ${SECRETS_FILE}"
fi

# 4. Preflight ----------------------------------------------------------

log "running preflight"
PREFLIGHT="${OOD_SRC}/preflight.sh"
if [ -x "${PREFLIGHT}" ]; then
  bash "${PREFLIGHT}" --repo-dir "${REPO_DIR}" || warn "preflight reported issues"
else
  warn "preflight.sh not found or not executable: ${PREFLIGHT}"
fi

log "done. Open https://ood.betty.parcc.upenn.edu/pun/dev/betty/ and click Launch."
