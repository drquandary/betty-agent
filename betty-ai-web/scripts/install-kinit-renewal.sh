#!/usr/bin/env bash
# Install a launchd agent that runs `kinit -R` periodically to renew the
# user's Kerberos ticket. Renewal does not require re-entering the PennKey
# password OR re-Duo as long as the existing ticket is still within its
# renewable lifetime (`klist` shows "renew until").
#
# Usage:
#   ./betty-ai-web/scripts/install-kinit-renewal.sh        # install + load
#   ./betty-ai-web/scripts/install-kinit-renewal.sh status # check state
#   ./betty-ai-web/scripts/install-kinit-renewal.sh uninstall
#
# After install, do one interactive `kinit -r 7d jvadala@UPENN.EDU` to get a
# ticket with a long renewable lifetime; the daemon then keeps it alive.

set -euo pipefail

PLIST_LABEL="edu.upenn.parcc.betty.kinit-renew"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"
LOG_PATH="$HOME/Library/Logs/betty-kinit-renew.log"
PRINCIPAL="jvadala@UPENN.EDU"
INTERVAL_SECONDS=14400  # 4h

cmd=${1:-install}

case "$cmd" in
  install)
    mkdir -p "$(dirname "$PLIST_PATH")"
    cat > "$PLIST_PATH" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>/usr/bin/kinit -R ${PRINCIPAL} 2>&1 | /usr/bin/tee -a ${LOG_PATH}</string>
  </array>
  <key>StartInterval</key><integer>${INTERVAL_SECONDS}</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>${LOG_PATH}</string>
  <key>StandardErrorPath</key><string>${LOG_PATH}</string>
</dict>
</plist>
EOF
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    launchctl load "$PLIST_PATH"
    echo "Installed: $PLIST_PATH"
    echo "Renews every ${INTERVAL_SECONDS}s. Logs: $LOG_PATH"
    echo
    echo "Next step — get a renewable ticket once (interactive, enter PennKey):"
    echo "  kinit -r 7d ${PRINCIPAL}"
    echo "Then verify with: klist  (should show a 'renew until' line)"
    ;;
  uninstall)
    launchctl unload "$PLIST_PATH" 2>/dev/null || true
    rm -f "$PLIST_PATH"
    echo "Removed: $PLIST_PATH"
    ;;
  status)
    if launchctl list | grep -q "$PLIST_LABEL"; then
      echo "launchd: loaded"
    else
      echo "launchd: NOT loaded"
    fi
    [ -f "$LOG_PATH" ] && echo && echo "--- last 20 log lines ---" && tail -20 "$LOG_PATH"
    echo
    klist -s && echo "klist: ticket valid" || echo "klist: NO valid ticket — run kinit"
    ;;
  *)
    echo "usage: $0 {install|uninstall|status}" >&2
    exit 2
    ;;
esac
