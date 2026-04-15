---
type: source
tags: [ood, bc_desktop, troubleshooting, admin, ryb]
created: 2026-04-09
updated: 2026-04-09
source_file: raw/cluster_exploration/2026-04-07-ryb-ood-bc-desktop-investigation.txt
source_date: 2026-04-07
related: [open-ondemand-betty, ood-troubleshooting, vast-storage, betty-cluster]
status: current
---

# ryb's OOD bc_desktop Investigation (2026-04-07)

## One-line summary
Terminal log of user `ryb` SSHing into `ood01.betty.parcc.upenn.edu` to inspect the Interactive Desktop app config and make a dev copy at `~/ondemand/dev/bc_desktop` — context is Interactive Desktop session failures and lmod cache loading issues reported by colleagues.

## What this source tells us

### New facts about Betty (not in previous wiki)
- **There is a `/ceph/projects/` filesystem** in addition to `/vast/projects/` — ryb has `/ceph/projects/ryb/parcc-data-science` mounted with a 1.07 TB quota. Not mentioned in any prior source.
- **OOD host**: `ood01.betty.parcc.upenn.edu`, public IP `165.123.216.22`, Ubuntu 24.04.4 LTS, kernel `6.8.0-106-generic`.
- **OOD host flag**: "System restart required" — ood01 has pending kernel updates.
- **OOD config is in `/etc/ood/`** with multiple sibling dirs: `ood/`, `ood2/`, `ood3/`, `ood4/` and an archived `ood.tar.zst`. Suggests iterated configs or staged upgrades.
- **Multiple `ood_portal.yml` backups**: `.bak-20251113-151723`, `.bak-luafix`, `.bak-usermapping`, `.shibboleth-backup` — history of auth and Lua resolver troubleshooting.
- **bc_desktop system app** lives at `/var/www/ood/apps/sys/bc_desktop/` with standard OSC layout (form.yml, submit.yml.erb, template/desktops/{gnome,kde,mate,xfce}.sh).
- **Per-app overrides** live at `/etc/ood/config/apps/bc_desktop/` (contains `slurm.yml` and a `submit/` dir).
- **User dev apps** at `~/ondemand/dev/<app>/` — these appear at `/pun/dev/<app>` in the portal and let users develop patched versions without root.
- **ryb has SSH access from login01 to ood01** — indicates admin or developer privilege; normal users cannot do this.

### bc_desktop app structure (from `/var/www/ood/apps/sys/bc_desktop/`)
- `form.yml` — accepts `desktop` (gnome/kde/mate/xfce), `bc_vnc_idle`, `bc_vnc_resolution`, `bc_account`, `bc_num_hours`, `bc_num_slots`, `bc_queue`, `node_type: null`, `bc_email_on_started`
- `submit.yml.erb` — minimal, just `batch_connect: {template: vnc}`
- `template/desktops/{gnome,kde,mate,xfce}.sh` — desktop environment launch scripts
- Unmodified from upstream OSC bc_desktop v0.2.2 (2019)

### Storage quotas (ryb)
- `/vast/home/r/ryb` — **37.85 GB / 50 GB (76%), 219.94K / 250K inodes (88% — HIGH)**
- `/vast/projects/ryb/parcc-data-science` — 1.46 TB / 2 TB (73%), 531.89K / 10M inodes
- `/ceph/projects/ryb/parcc-data-science` — 0 B / 1.07 TB, 2 / 1.02M inodes (provisioned but empty)

**Inode quota at 88% is a red flag.** OOD writes many small files under `~/ondemand/data/sys/dashboard/batch_connect/...` per session. If ryb hits the inode cap, new Interactive Desktop sessions will fail to write their staging files and die silently. See [[huggingface-cache-management]] for the broader "do not fill home" pattern.

### ryb's workflow in this log
1. SSH to login01, then to ood01
2. Explored OOD config in `/etc/ood/` and `/var/www/ood/apps/sys/bc_desktop/`
3. Examined per-app override at `/etc/ood/config/apps/bc_desktop/`
4. Found an existing `~/ondemand/dev/bc_desktop/` with patched slurm.yml (grep found "As desktop jobs are limited to one node" help text)
5. Deleted the dev copy and re-copied fresh from `/var/www/ood/apps/sys/bc_desktop/` — implies ryb is resetting to upstream to re-debug
6. `git init`ed the dev copy to track changes
7. **Session ends here — no actual error message captured**

### What is NOT in this log
- No actual bc_desktop failure error text
- No `output.log` from a failed session
- No Slurm job ID or `sacct` output
- No lmod cache error text (despite this being the reason for the investigation per Jeff)
- No mention of which partition was failing
- No end-user session attempt — this is admin-side investigation only

## Pages created / updated

- **Created**: [[ood-troubleshooting]] — new concept page with diagnostic decision tree for OOD session failures
- **Updated**: [[open-ondemand-betty]] — added OOD host details, config paths, dev app pattern, known backups, inode-quota warning
- **Updated**: [[vast-storage]] — added `/ceph/projects/` as a known filesystem
- **Updated**: [[betty-cluster]] — added ood01 as a known named host

## Contradictions / surprises vs prior wiki
- Prior wiki only knew about VAST (`/vast/home`, `/vast/projects`). Betty also has **Ceph** project storage — this is new.
- Prior wiki did not know about the `ood01` host or its IP.
- Prior wiki treated OOD as a single unit — now we know it has per-user `dev/` override directories, per-app `/etc/ood/config/apps/` overrides, and multiple backup configs suggesting ongoing admin maintenance.

## Open questions for the user
1. Can we get the actual `output.log` from a failed `bc_desktop` session? Path: `~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/output/<session-id>/output.log`
2. What was the exact lmod cache error? Screenshot or text dump needed.
3. Which partition was your colleague trying to launch on? (dgx-b200, genoa-std-mem, b200-mig45?)
4. Is `/ceph/projects/` available to all Betty users or only specific groups?
