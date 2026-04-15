---
type: source
tags: [betty, lmod, fix, admin, modules]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-lmod-architecture, ood-troubleshooting, open-ondemand-betty]
status: current
---

# Jaime's /etc/profile.d/modules.sh Fix (2026-04-10)

## One-line summary
Jaime fixed the cluster-wide `module avail` crash by changing `/etc/profile.d/modules.sh` on compute nodes to source PARCC's lmod instead of BCM's bundled lmod.

## What was changed
- **File**: `/etc/profile.d/modules.sh` on all compute nodes
- **Before**: sourced BCM's (Bright Cluster Manager) bundled lmod at `/usr/share/lmod/lmod`
- **After**: sources PARCC's custom lmod at `/vast/parcc/sw/lmod/lmod`

## Why this fixes the crash
BCM's lmod init chain reads the site spider cache at `/vast/parcc/sw/lmod/site/cache/spiderT.lua`. That file was missing the `mrcT` table (due to a broken regeneration by ryb's `update.sh` on Apr 8 16:45), causing `next(false)` to crash at `Cache.lua:340`. PARCC's lmod uses its own init chain that does not hit the broken cache in the same way, so the crash is bypassed entirely.

## What it resolved
- `module avail` works cleanly on all compute nodes
- `module load` works without user-side workarounds
- OOD Interactive Desktop XFCE sessions now launch reliably (the black-screen bug was caused by `module load` failures during session startup)

## What's still broken
- The corrupt file `/vast/parcc/sw/lmod/site/cache/spiderT.lua` still exists on disk (same timestamp: Apr 8 16:45, owner: ryb)
- If anyone ever switches `/etc/profile.d/modules.sh` back to BCM's lmod, the crash will return

## What ryb still needs to do
- Fix `/vast/parcc/sw/lmod/site/cache/update.sh` so future cache regenerations produce a valid `mrcT` stanza in `spiderT.lua`
- Regenerate the current `spiderT.lua` to include `mrcT` (or delete it)
- The underlying bug in the cache generation tool has not been addressed

## Verification command
```bash
env -u LMOD_SPIDER_CACHE_DIRS -u LMOD_IGNORE_CACHE bash --norc -c 'source /etc/profile.d/modules.sh; module avail 2>&1 | head -5'
```

## See also
- [[betty-lmod-architecture]]
- [[ood-troubleshooting]]
- [[open-ondemand-betty]]
