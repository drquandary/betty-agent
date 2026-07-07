---
type: source
tags: [teams, digest, vast, storage, snapshots]
created: 2026-07-07
updated: 2026-07-07
related: [vast-storage, parcc-helper-tools, kenneth-chaney, parcc-tokens-as-a-service]
status: current
---

# 2026-07-07 Teams Chats Digest

## One-line summary
Small cycle — one new message: Ken Chaney reports VAST per-project snapshots are starting to populate and are now visible via `parcc_quota.py --snapshots`.

## Content

### VAST snapshots now populating (PARCC Group · Chaney, Kenneth P · ~1:14pm)
Follow-up to the 7/6 deployment of [[vast-storage]] per-project protected paths:
- Ken: "We are starting to see some of the snapshot data populate. If you've been reading and writing files, you can start to see it."
- Invocation shared: `/usr/bin/python3 $(which parcc_quota.py) --snapshots` (see [[parcc-helper-tools]]).
- The `--snapshots` view adds a **Snapshots** column to the quota table. Actively-used paths already show data — e.g. `/vast/projects/chaneyk/test` reports **13.18 GB** in snapshots against 10.39 GB used — while idle/new paths still read `0 B` or `-`, consistent with the ~2-week ramp Ken flagged on 7/6.
- Confirms the feature is live and observable now for projects that are reading/writing; snapshot counts will keep climbing over the next ~2 weeks. Relevant to backup/recovery posture for the [[parcc-tokens-as-a-service]] beta labs.

## See also
- [[vast-storage]]
- [[parcc-helper-tools]]

## Sources
- Teams digest `digest_20260707T133825.json`
