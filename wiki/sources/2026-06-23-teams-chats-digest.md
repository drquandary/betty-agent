---
type: source
tags: [betty, teams, accounts, provisioning, home-dirs, bcm, vast, firewall]
created: 2026-06-23
updated: 2026-06-23
related: [betty-cluster, kenneth-chaney, bcm-bright-cluster-manager, vast-storage]
status: current
---

# Teams Chats Digest — 2026-06-23

## One-line summary
Ken Chaney explains the broken new-user home directories: account provisioning (user creation + sync) is still paused, and he will resync and manually fix home folders after the pending Palo Alto TAC firewall session.

## What's new this cycle

- **Account sync still paused → broken home dirs** (Kenneth Chaney, PARCC Group, 2026-06-23T14:36Z): the previously reported BCM→VAST new-user home-dir creation failure (root-owned dirs, `/etc/skel` not copied) is a downstream effect of **user creation and the remainder of the account sync being paused**, not a separate bug. Continuation of the 6/16–6/18 home-dir incident → [[betty-cluster]].
- **Resolution plan**: after the pending **Palo Alto TAC** (firewall vendor technical-support) session, Ken will run **one round of syncs** and **manually fix all user home folders** that get made. Status: planned/pending the TAC session → [[kenneth-chaney]].

## Midday update (16:13–16:22Z)

- **Hold escalated to highest priority** (Jaime Combariza, PARCC Group, 16:13Z): three new PIs onboarded today; with the provisioning hold still in place this is now top priority — "PARCC will not function properly if part of the system is down for weeks."
- **Manual workaround in progress** (Kenneth Chaney, 16:16–16:19Z): Ken is putting a workaround in place while awaiting **BCM and/or VAST**, manually running the fix, targeting **~1pm** ("ready this afternoon").
- **Approvals don't auto-propagate** (Jaime, 16:18Z): Jaime approved the new projects/allocations, but these will **not propagate to Betty until the sync resumes** (Ken's fix) — confirms the paused sync is the gating dependency.
- **Durable insight — paused user creation cascades** (Ken, 16:21–16:22Z): "Not having the user creation blocks all of our automations… the downstream automations assume that the users are in place properly." Account provisioning is the upstream dependency for the rest of the PARCC automation pipeline.
- **Emergency storage request** (Jaime relaying Gavin, 16:20Z): emergency to increase `wharton_lliu1` storage to **4TB**; Ken saw it on Slack.

## Workaround verified (16:33–16:40Z)

- **Manual fix good for users** (Kenneth Chaney, 16:33Z): the manual workaround for the broken new-user home dirs is confirmed working.
- **Remaining syncs verified** (Ken, 16:34Z): verifying the rest of the syncs "in order: groups, VAST, Ceph, Slurm."
- **All syncs verified, workaround durable** (Ken, 16:40Z): syncs verified. Ken dislikes needing the workaround but states it **should always be safe even after the root cause is fixed** — so it can stay in place as a permanent safety net rather than being unwound once the upstream pause is resolved. New-user provisioning is unblocked; the paused-sync root cause remains open.

## Pages touched
- Updated [[betty-cluster]] — added 2026-06-23 update to the BCM→VAST home-dir open-issue entry (sync paused; post-TAC manual fix plan); midday: hold now top priority, manual workaround ~1pm, approvals won't propagate until sync resumes; afternoon: workaround verified good, syncs (groups/VAST/Ceph/Slurm) verified, safe even post-root-cause
- Updated [[kenneth-chaney]] — recorded the paused account sync, post-Palo-Alto-TAC resync + manual home-folder fix plan, the durable insight that paused user creation blocks all downstream automations, and the verified-workaround outcome

## Sources
- PARCC Group Teams chat, Kenneth Chaney, 2026-06-23T14:36Z (digest `digest_20260623T105335.json`)
- PARCC Group Teams chat, Combariza & Chaney, 2026-06-23T16:13–16:22Z (digest `digest_20260623T122658.json`)
- PARCC Group Teams chat, Kenneth Chaney, 2026-06-23T16:33–16:40Z (digest `digest_20260623T125933.json`)
