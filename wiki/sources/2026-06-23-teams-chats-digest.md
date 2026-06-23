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

## Pages touched
- Updated [[betty-cluster]] — added 2026-06-23 update to the BCM→VAST home-dir open-issue entry (sync paused; post-TAC manual fix plan)
- Updated [[kenneth-chaney]] — recorded the paused account sync and his post-Palo-Alto-TAC resync + manual home-folder fix plan

## Sources
- PARCC Group Teams chat, Kenneth Chaney, 2026-06-23T14:36Z (digest `digest_20260623T105335.json`)
