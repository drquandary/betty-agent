---
type: source
tags: [ood, bc_desktop, bug-reproduction, jvadala, bug-ticket]
created: 2026-04-09
updated: 2026-04-09
source_file: (live browser session — no raw file)
source_date: 2026-04-09
related: [open-ondemand-betty, ood-troubleshooting, b200-mig45-partition, 2026-04-07-ryb-ood-bc-desktop-investigation]
status: current
---

# Live OOD Bug Reproduction (2026-04-09, jvadala)

## One-line summary
Live reproduction session on `jvadala` account attempting to verify colleague's OOD Interactive Desktop failures — reproduced 3 confirmed bugs in 10 minutes, could not read `output.log` due to cascading OOD config gaps.

## Session timeline

### 17:54:40 UTC — Launched Interactive Desktop
- **Form values**: Account `jcombar1-betty-testing`, Time Limit 1 hour, Partition `b200-mig45`, 1 CPU, (no GPU field set), no reservation, job name default (`ood-desktop`)
- **Slurm job ID**: `5199165`
- **OOD session ID**: `468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **Allocation**: 1 node, 2 cores on `dgx028.betty.parcc.private.upenn.edu`
- **Ready**: within ~10 seconds (state went Queued → Running very fast)

### Immediately after: clicked "Launch Interactive Desktop (Betty)"
- New tab opened with URL: `…/noVNC-1.3.0/vnc.html?autoconnect=true&path=rnode%2Fdgx028.betty.parcc.private.upenn.edu%2F41665%2Fwebsockify&…`
- Tab title: `TurboVNC: dgx028:27 (jvadala) - noVNC` — confirming TurboVNC is the VNC server being used, display :27
- **Rendered canvas: solid black with only the noVNC sidebar toggle visible**
- No desktop environment drawn, no window manager, no taskbar

### Tried to diagnose via compute-node shell link
- Clicked the `>_ dgx028.betty.parcc.private.upenn.edu` button on "My Interactive Sessions"
- URL: `/pun/sys/shell/ssh/dgx028.betty.parcc.private.upenn.edu`
- **Error**: `Host "dgx028.betty.parcc.private.upenn.edu" not specified in allowlist or cluster configs.`

### Tried to read output.log via Files app
- Clicked Session ID link on "My Interactive Sessions"
- URL: `/pun/sys/dashboard/files/fs/vast/home/j/jvadala/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **Error**: `Not Found — The page you are looking for does not exist.`

### Fell back to SSH via login01 web shell
- Navigated to `/pun/sys/shell/ssh/login.betty.parcc.upenn.edu`
- Got Duo 2FA prompt (Duo Push to phone failed, fell back to SMS to XXX-XXX-9571)
- **Session abandoned** — user closed browser before completing auth; SMS loop was frustrating enough to halt the investigation
- Job `5199165` was **still running on dgx028 with ~25 min remaining** when the browser was closed
- **Action item**: delete session 5199165 to stop billing (~4 PC/hour on MIG-45) if it hasn't timed out on its own

## Confirmed bugs (see [[open-ondemand-betty#Known bugs]] for full detail)
1. **Black-screen Interactive Desktop** on b200-mig45
2. **Shell link broken** to compute nodes (allowlist missing `dgx*`)
3. **Files app 404** — not wired into portal routing

## NOT confirmed (still open questions)
- Why is the desktop black? (need `output.log`, admin-side access required due to bugs 2+3)
- Does the same bug happen on `dgx-b200`, `b200-mig90`, `genoa-std-mem`?
- Is this the same bug ryb was debugging on 2026-04-07? Very likely yes.
- Is lmod cache corruption contributing? Unknown without log.

## Pages created / updated
- **Updated**: [[open-ondemand-betty]] — added Known bugs section with all three bugs, OOD host config details, form field analysis
- **Already existed** (from earlier today): [[ood-troubleshooting]] — diagnostic decision tree
- **New**: this source page

## Recommended next step for the user
**File a PARCC support ticket** referencing this session. Draft at `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md`. PARCC admins have root access and can read the `output.log` directly to diagnose the black-screen cause. We've done the reproduction work for them.

## Open questions for PARCC to answer via ticket
1. Contents of `~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/468bfa5c-8ef9-48e2-9c25-68c309e68fe4/output.log`
2. Why is `dgx*` not in the OOD `ssh_hosts` allowlist?
3. Why is the Files app not exposed in the portal?
4. Which desktop environment is hard-coded in Betty's `bc_desktop` submit template?
5. Is that DE installed on b200-mig45 compute nodes?
