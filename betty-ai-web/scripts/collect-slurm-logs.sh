#!/usr/bin/env bash
#
# collect-slurm-logs.sh — pull the four Slurm log files from Betty into the
# local inbox, using the existing SSH ControlMaster (Duo already authed).
#
# Usage:
#   betty-ai-web/scripts/collect-slurm-logs.sh [--dry-run]
#
# Writes to:
#   parcc1/raw/slurm_logs/inbox/
#
# After this, run:
#   make -C parcc1/betty-ai/scheduling all
#
# Environment:
#   BETTY_SSH_HOST    — SSH target (default: jvadala@login.betty.parcc.upenn.edu)
#   BETTY_SACCT_SINCE — --starttime for sacct (default: 7 days ago)

set -euo pipefail

HOST="${BETTY_SSH_HOST:-jvadala@login.betty.parcc.upenn.edu}"
SINCE="${BETTY_SACCT_SINCE:-$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d '7 days ago' +%Y-%m-%d)}"
TS="$(date +%Y%m%d%H%M)"

# Resolve inbox relative to this script's location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INBOX="${BETTY_INBOX:-$SCRIPT_DIR/../../raw/slurm_logs/inbox}"
mkdir -p "$INBOX"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=true; fi

echo "[collect] host=$HOST"
echo "[collect] since=$SINCE"
echo "[collect] inbox=$INBOX"
echo "[collect] timestamp=$TS"

# Preflight: is the ControlMaster alive? If not, bail with a clear hint —
# trying to SSH without it will trigger Duo inside a non-TTY shell and hang.
if ! ssh -O check "$HOST" 2>/dev/null; then
  cat >&2 <<EOF
[collect] SSH ControlMaster is not live for $HOST.
[collect] In a normal Terminal, run:
[collect]   ssh $HOST
[collect] approve Duo, then re-run this script.
EOF
  exit 1
fi

# sacct format is not negotiable — without these fields we can't compute
# queue_wait. Format string is single-quoted to the local shell and then
# passed literally to the remote.
SACCT_FMT='JobID,User,Account,Partition,QOS,Submit,Eligible,Start,End,Elapsed,Planned,State,ExitCode,ReqTRES,AllocTRES,ReqMem,ReqCPUS,ReqNodes,NodeList,Reason'

run() {
  local name="$1"; shift
  local out="$INBOX/${name}-${TS}.log"
  if $DRY_RUN; then
    echo "[dry-run] ssh $HOST $* > $out"
    return
  fi
  echo "[collect] $name ..."
  ssh "$HOST" "$@" > "$out"
  local n
  n=$(wc -l < "$out" | tr -d ' ')
  echo "[collect]   -> $out ($n lines)"
}

run sinfo                   sinfo
run scontrol-show-res       scontrol show reservation
run scontrol-show-nodes     scontrol show nodes -o

# sacct is a special case: we want .tsv extension to signal parsable2 format
SACCT_OUT="$INBOX/sacct-week-${TS}.tsv"
if $DRY_RUN; then
  echo "[dry-run] ssh $HOST sacct -a -S $SINCE -X --parsable2 -o $SACCT_FMT > $SACCT_OUT"
else
  echo "[collect] sacct (since $SINCE) ..."
  ssh "$HOST" "sacct -a -S '$SINCE' -X --parsable2 -o $SACCT_FMT" > "$SACCT_OUT"
  n=$(wc -l < "$SACCT_OUT" | tr -d ' ')
  echo "[collect]   -> $SACCT_OUT ($n lines)"
fi

echo "[collect] done. Next: make -C betty-ai/scheduling all"
