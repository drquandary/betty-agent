#!/usr/bin/env bash
#
# preflight.sh — sanity-check before clicking Launch in the OOD portal.
#
# Catches the 80% of problems that would otherwise burn a Slurm
# allocation and leave you staring at a failed session card.
#
# Usage:
#   bash preflight.sh [--repo-dir <path>]
#
# Exit codes:
#   0  everything green
#   1  one or more checks failed (details above)
#   2  invalid arguments
#
# Intended to run on a Betty login node (or ood01), NOT from a compute
# node. Mirrors what before.sh.erb will encounter.
#

set -uo pipefail

REPO_DIR="${HOME}/betty-agent"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo-dir) REPO_DIR="$2"; shift 2 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

RED=$'\033[1;31m'; GREEN=$'\033[1;32m'; YELLOW=$'\033[1;33m'; GREY=$'\033[2m'; RST=$'\033[0m'

PASS=0
FAIL=0
WARN=0

ok()   { printf "  %s✓%s %-50s %s%s%s\n" "$GREEN" "$RST" "$1" "$GREY" "${2:-}" "$RST"; PASS=$((PASS+1)); }
fail() { printf "  %s✗%s %-50s %s%s%s\n" "$RED"   "$RST" "$1" "$GREY" "${2:-}" "$RST"
         [ -n "${3:-}" ] && printf "     %sfix:%s %s\n" "$YELLOW" "$RST" "$3"
         FAIL=$((FAIL+1)); }
warn_line() { printf "  %s!%s %-50s %s%s%s\n" "$YELLOW" "$RST" "$1" "$GREY" "${2:-}" "$RST"; WARN=$((WARN+1)); }

echo
echo "Betty AI — OOD launch preflight ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo

# 1. Repo present + current ----------------------------------------------

if [ -d "${REPO_DIR}/.git" ]; then
  head=$(git -C "${REPO_DIR}" rev-parse --short HEAD 2>/dev/null || echo "?")
  branch=$(git -C "${REPO_DIR}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
  ok "betty-agent repo" "${REPO_DIR} @ ${branch} (${head})"

  if [ ! -d "${REPO_DIR}/betty-ai-web" ]; then
    fail "betty-ai-web/ present" "missing" \
         "git checkout ${branch} && git reset --hard origin/${branch}"
  else
    ok "betty-ai-web/" "$(wc -l < "${REPO_DIR}/betty-ai-web/package.json") lines package.json"
  fi

  if [ ! -f "${REPO_DIR}/ood/bc_osc_betty/template/before.sh.erb" ]; then
    fail "OOD template present" "missing" \
         "cd ${REPO_DIR} && git pull"
  else
    ok "OOD template" "ood/bc_osc_betty/"
  fi
else
  fail "betty-agent repo" "not at ${REPO_DIR}" \
       "bash ood/bc_osc_betty/bootstrap.sh  (or git clone ... ${REPO_DIR})"
fi

# 2. Node.js ----------------------------------------------------------------

node_via=""
if module avail nodejs 2>&1 | grep -qiE "nodejs"; then
  node_via="module"
  # Try loading it to confirm it actually works
  if ( module load nodejs 2>/dev/null && command -v node >/dev/null ); then
    ok "node (via module)" "$(module load nodejs 2>/dev/null; node --version)"
  else
    warn_line "node module listed but 'module load nodejs' failed" "" ""
    node_via=""
  fi
fi
if [ -z "${node_via}" ]; then
  if command -v node >/dev/null 2>&1; then
    v=$(node --version | sed 's/v//' | cut -d. -f1)
    if [ "${v}" -ge 20 ]; then
      ok "node (system)" "$(node --version)"
      node_via="system"
    else
      warn_line "node too old (need 20+)" "found $(node --version)" ""
    fi
  fi
fi
if [ -z "${node_via}" ]; then
  if [ -d "${HOME}/.nvm" ]; then
    warn_line "node via nvm fallback" "~/.nvm present, will be used by before.sh"
  else
    warn_line "node not found; nvm will be installed on first launch" "~4min extra on cold start"
  fi
fi

# 3. Slurm reachable ------------------------------------------------------

if command -v sinfo >/dev/null 2>&1; then
  n=$(sinfo -h -o "%P" 2>/dev/null | sort -u | wc -l | tr -d ' ')
  if [ "${n}" -gt 0 ]; then
    ok "Slurm reachable" "sinfo reports ${n} partitions"
  else
    fail "Slurm reachable" "sinfo returned nothing" \
         "check that you're on a Betty login node, not a generic box"
  fi
else
  fail "Slurm available" "sinfo not on PATH" \
       "run this on a Betty login node (login.betty.parcc.upenn.edu)"
fi

# 4. Kerberos --------------------------------------------------------------

if klist -s 2>/dev/null; then
  exp=$(klist 2>/dev/null | awk '/krbtgt/ {print $3,$4}' | head -1)
  ok "Kerberos ticket" "expires ${exp}"
else
  warn_line "no Kerberos ticket" "unblocks sacct across cluster" \
            ""
fi

# 5. npm registry reachable -----------------------------------------------

if command -v curl >/dev/null 2>&1; then
  if curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://registry.npmjs.org/ 2>/dev/null | grep -q "200"; then
    ok "npm registry reachable" "registry.npmjs.org responds 200"
  else
    warn_line "npm registry unreachable" "compute nodes may have filtered egress" \
              "confirm with ryb; may need a private registry mirror"
  fi
fi

# 6. Provider keys (informational) ---------------------------------------

SECRETS="${HOME}/.betty-agent/secrets.env"
if [ -f "${SECRETS}" ]; then
  if grep -qE '^export (ANTHROPIC|LITELLM)_API_KEY=\S+' "${SECRETS}" 2>/dev/null; then
    ok "secrets.env has a provider key" "${SECRETS}"
  else
    warn_line "secrets.env present but no uncommented key" "edit ${SECRETS}"
  fi
else
  warn_line "no ${SECRETS}" "app will launch but chat won't work until this exists"
fi

# 7. OOD dev app deployed ------------------------------------------------

if [ -d "${HOME}/ondemand/dev/betty" ]; then
  ok "OOD dev slot" "~/ondemand/dev/betty/"
else
  warn_line "~/ondemand/dev/betty not populated" "bootstrap.sh will fix this"
fi

# Summary -----------------------------------------------------------------

echo
echo "  pass=${PASS}  warn=${WARN}  fail=${FAIL}"
echo
if [ "${FAIL}" -eq 0 ]; then
  echo "${GREEN}ready to Launch${RST}"
  echo "  https://ood.betty.parcc.upenn.edu/pun/dev/betty/"
  exit 0
else
  echo "${RED}fix the failing checks before launching${RST}"
  exit 1
fi
