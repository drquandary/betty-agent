---
type: entity
tags: [betty, ood, web-portal, parcc, broken]
created: 2026-04-08
updated: 2026-04-10
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide, 2026-04-07-ryb-ood-bc-desktop-investigation, 2026-04-09-jvadala-ood-bug-reproduction, 2026-04-10-jaime-modules-sh-fix]
related: [betty-cluster, slurm-on-betty, ood-troubleshooting, b200-mig45-partition, vast-storage, betty-lmod-architecture]
status: current
---

# Open OnDemand on Betty

## One-line summary
Browser-based portal for Betty at `ood.betty.parcc.upenn.edu` — currently BETA with **multiple confirmed configuration bugs** (see [[#Known bugs]] below).

## Basics
- **URL**: `https://ood.betty.parcc.upenn.edu`
- **Version**: Open OnDemand 4.1.4
- **Status**: BETA — **NOT production-ready** as of 2026-04-09
- **Auth**: PennKey + Duo (Penn WebLogin SSO)
- **Access requirement**: on Penn network or Penn VPN
- **OOD host**: `ood01.betty.parcc.upenn.edu` (public IP `165.123.216.22`, Ubuntu 24.04.4 LTS)
- **Config paths on ood01**:
  - `/etc/ood/config/ood_portal.yml` — main portal config (multiple `.bak-*` backups suggest active troubleshooting)
  - `/etc/ood/config/clusters.d/` — cluster registration
  - `/etc/ood/config/apps/bc_desktop/` — per-app override for Interactive Desktop (has `slurm.yml` + `submit/`)
  - `/var/www/ood/apps/sys/<app>/` — system-wide apps
  - `~/ondemand/dev/<app>/` — per-user dev overrides, exposed at `/pun/dev/<app>`

## Available features (what actually works)
| Feature | Where | Status |
|---------|-------|--------|
| Betty Shell Access → login01/02 | Clusters menu | Works |
| System Status | Clusters menu | Unverified |
| Interactive Desktop form | Interactive Apps | Works — form submits, job queues, Slurm accepts |
| My Interactive Sessions page | Top nav | Works — shows session state |
| Launch VNC button | Sessions page | Works — opens noVNC via TurboVNC + websockify |
| noVNC tunnel | New tab after Launch | Works at TCP level |

## Missing / broken (vs typical OOD deployments)
| What | Expected | Actual |
|------|----------|--------|
| JupyterLab / Notebook app | Standard | **Missing** — use `betty-jupyter.sh` CLI + SSH tunnel instead |
| RStudio | Standard | **Missing** |
| VS Code Server | Standard | **Missing** |
| Files app | Standard (`/pun/sys/dashboard/files/...`) | **Returns 404 "Not Found"** — not wired into portal routing |
| File Editor | Standard | **Missing** |
| Active Jobs app | Standard | **Missing** |
| My Jobs app | Standard | **Missing** |

Note: `/var/www/ood/apps/sys/` on ood01 DOES contain `activejobs/`, `files/`, `file-editor/`, `myjobs/`, etc. — the app code exists on disk but isn't exposed in the portal navigation or routing. This is a portal config gap, not a missing-software gap.

## Known bugs

### Bug 1: Interactive Desktop renders as solid black screen
- **Reproduced**: 2026-04-09 on account `jvadala`, Slurm job `5199165`, OOD session `468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **Partition**: `b200-mig45` (dgx028)
- **Request**: 1 hour, 1 CPU, 0 GPUs, no reservation, defaults
- **Symptom**: VNC tunnel connects via websockify, noVNC shows `TurboVNC: dgx028:27 (jvadala)` in title, but the drawn canvas is entirely black with only the noVNC sidebar toggle visible. No desktop environment, no window manager, no taskbar, no xstartup chrome.
- **Suspected cause**: The desktop environment binary (mate-session / xfce4-session / etc.) isn't launching on MIG-45 compute nodes. Possible reasons:
  - DE binary not installed on compute node image
  - `xstartup` script missing or failing
  - DBus / session init failing on first run
  - Lmod environment not carrying into the non-login shell that `template/script.sh.erb` runs under
- **Log location**: `~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/<session-id>/output.log` — NOT yet read on this session because both alternative paths are also broken (see bugs 2 and 3)

### Bug 2: Shell-to-compute-node link returns allowlist error
- **Reproduced**: 2026-04-09, same session
- **Trigger**: Click the `>_` button next to the host (`dgx028.betty.parcc.private.upenn.edu`) on the "My Interactive Sessions" page
- **URL generated**: `/pun/sys/shell/ssh/dgx028.betty.parcc.private.upenn.edu`
- **Error shown**: `Host "dgx028.betty.parcc.private.upenn.edu" not specified in allowlist or cluster configs.`
- **Fix**: Add `dgx[001-029]`, `epyc-*` and similar to the `ssh_hosts:` list in `/etc/ood/config/ondemand.d/*.yml` (or wherever Betty's OOD keeps it). OOD still requires the shell app to know about a host even if the user already has SSH access to it.
- **Impact**: Users cannot open a shell on their own running compute-node session from the portal. Forces them to SSH from login01 → compute_node manually, which hits Duo again.

### Bug 3: Files app returns 404
- **Reproduced**: 2026-04-09, same session
- **Trigger**: Click Session ID link on "My Interactive Sessions" page (which generates a URL pointing at the Files app)
- **URL generated**: `/pun/sys/dashboard/files/fs/vast/home/j/jvadala/ondemand/data/...`
- **Response**: `Not Found — The page you are looking for does not exist.`
- **Cause**: The Files app is not registered in the portal routing. The app code exists at `/var/www/ood/apps/sys/files/` on ood01 but no route points to it.
- **Impact**: Users cannot browse, read, or download session output logs through the web. They must SSH and `cat` files manually.

### Bug 4: `interact` helper script references nonexistent `defq` partition
- Documented separately in [[parcc-helper-tools]] — not OOD specific but overlaps with the same "PARCC wrapper scripts are half-done" pattern.

### Bug 5: Lmod spider cache corruption — RESOLVED (2026-04-10)
**Status: RESOLVED** by Jaime on 2026-04-10. Jaime fixed `/etc/profile.d/modules.sh` on compute nodes to source PARCC's custom lmod (`/vast/parcc/sw/lmod/lmod`) instead of BCM's bundled lmod. This bypassed the corrupt site spider cache entirely. `module avail` and `module load` now work cleanly on all compute nodes without any user-side workarounds.

The corrupt file (`/vast/parcc/sw/lmod/site/cache/spiderT.lua`, owned by ryb, modified Apr 8 16:45) still exists on disk but is no longer hit. See [[betty-lmod-architecture]] for the full story.

**OOD Interactive Desktop XFCE sessions now work reliably** -- 3 sessions launched on 2026-04-10 all rendered correctly with no black screen. This confirms the hypothesis that Bug 1 (black screen) was caused by the Lmod crash breaking the session startup environment.

Previous workarounds (`LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod`, `LMOD_IGNORE_CACHE=yes`) are now optional but harmless.

Full investigation details preserved in [[ood-troubleshooting#Lmod cache corruption (CONFIRMED bug on Betty, 2026-04-09)]].

### Bug 6 (CONFIRMED 2026-04-09): XFCE screensaver lockout
- After ~14 min idle, `xfce4-screensaver` / `light-locker` engages and displays an unlock dialog
- PennKey password through the Kerberos PAM path is unreliable inside a non-login VNC session
- Users who walk away get locked out and have to kill + relaunch, wasting walltime and PC allocation
- One-line fix for `bc_desktop/template/before.sh.erb`:
  ```bash
  killall xfce4-screensaver light-locker 2>/dev/null
  xfconf-query -c xfce4-screensaver -p /saver/enabled -s false 2>/dev/null
  xfconf-query -c xfce4-screensaver -p /lock/enabled -s false 2>/dev/null
  xset s off ; xset -dpms ; xset s noblank
  ```
- Verified manually in session `5199382` — session stayed unlocked for the remainder of its hour after running these commands in the in-session terminal.

## Interactive Desktop form (Betty's customization)
Betty's form differs from stock upstream bc_desktop. Fields present:
- **Account** — pre-filled with your ColdFront account (e.g. `jcombar1-betty-testing`)
- **Time Limit (hours)** — 1-8 hour range (the "Max of 8 hours" is an OOD form cap, NOT a Slurm cap; Slurm partitions allow 7 days)
- **Partition** — dropdown: `b200-mig45` (default), `b200-mig90`, `dgx-b200`, `genoa-lrg-mem`, `genoa-std-mem`
- **Number of CPU Cores** — max 224 for b200, 64 for genoa-*
- **Number of GPUs** — free-form integer (no default/guidance)
- **Reservation** — free-form text, optional
- **Job Name** — free-form, defaults to `ood-desktop`

Fields **removed** from stock bc_desktop form.yml:
- `desktop` (gnome/kde/mate/xfce selector)
- `bc_vnc_idle`
- `bc_vnc_resolution`
- `bc_email_on_started`

Implication: the desktop environment is **hard-coded** somewhere in Betty's `submit.yml.erb` or `template/before.sh.erb` override, not user-selectable. If that hard-coded DE isn't installed on the target compute node → **black screen** (bug 1).

## Inode quota trap
OOD writes per-session staging files under `~/ondemand/data/sys/dashboard/batch_connect/...`. If a user approaches their inode cap, new sessions fail silently. Observed in the wild: user `ryb` at 88% of 250K inode limit while debugging bc_desktop failures. See [[ood-troubleshooting#Home inode quota]].

## How we currently use it
- Web shell (`/pun/sys/shell/ssh/login.betty.parcc.upenn.edu`) is the **only reliable path** right now
- This wiki and the Betty AI agent drive Betty primarily via this web shell through the Chrome-extension MCP
- SSH remains the primary access path for actual work

## See also
- [[betty-cluster]]
- [[slurm-on-betty]]
- [[ood-troubleshooting]]
- [[b200-mig45-partition]]
- [[vast-storage]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
- [[2026-04-07-ryb-ood-bc-desktop-investigation]]
- [[2026-04-09-jvadala-ood-bug-reproduction]]
