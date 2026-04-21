---
type: concept
tags: [slurm, lmod, modules, interact, betty, admin]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-21-parcc-ops-discussion]
related: [slurm-on-betty, betty-lmod-architecture, parcc-helper-tools]
status: current
---

# `interact` script vs `salloc --pty bash` on Betty

## One-line summary
The `interact` helper invokes `bash -i`, which re-sources `/etc/profile` and `~/.bashrc` — so Lmod and PATH get rebuilt from scratch; a plain `salloc --pty bash` does not, and inherits the caller's current environment (including already-loaded modules).

## The observed difference (2026-04-21)
- `salloc -p genoa-std-mem --pty bash` → Lmod sources correctly, modules inherit from the login shell.
- `interact` (PARCC helper) running the *same* `salloc` under the hood → Lmod does **not** initialize the way users expect.
- The difference is one flag: `interact` uses `bash -i`, `salloc --pty bash` does not.

## Why `bash -i` changes things
When `bash` is started with `-i` (interactive), it re-executes the **full login initialization chain**: `/etc/profile` → `/etc/profile.d/*.sh` → `~/.bash_profile` (or `~/.bashrc` fallback). That chain re-runs `modules.sh`, which resets `MODULEPATH`, `LMOD_CMD`, and clears any loaded modules that were inherited from the parent shell.

Without `-i`, `bash` under `srun` inherits the parent environment verbatim — `MODULEPATH` stays as you had it, loaded modules stay loaded.

## Chaney's argument (from the thread)
> "Since the `interact` script has `-i`, it's basically reloading the profile, the same way it would be loaded when you go to the login node. Is there a reason we would want that? Usually people want to sort of 'drop in' to an interactive session and inherit everything they've already loaded. That's why the default behavior with all `srun` is to just inherit everything from the BASH environment and not kick off the profile again."

**Takeaway**: the `-i` in `interact` is almost certainly a bug, not a feature. Default `srun`/`salloc` inheritance is what users actually want.

## Proposed fix
Drop `-i` from the `interact` script. Let the child shell inherit the caller's env like any other `srun` invocation. If a user wants a clean login-like shell inside the allocation, they can always run `bash -l` themselves.

## Related context
- Historically, Betty's Lmod chain is fragile because two Lmod installations coexist (BCM's at `/usr/share/lmod/lmod` and PARCC's at `/vast/parcc/sw/lmod/lmod`) — see [[betty-lmod-architecture]]. Jaime's 2026-04-10 fix to `/etc/profile.d/modules.sh` made the profile-reload path prefer PARCC's Lmod, so `bash -i` is no longer *broken*, just slow and lossy.
- The `interact` script also had a separate issue on 2026-04-08 (referenced a nonexistent "defq" partition) — see [[2026-04-08-betty-initial-exploration]]. That was partition-name stale; this is environment-inheritance.

## See also
- [[slurm-on-betty]]
- [[betty-lmod-architecture]]
- [[parcc-helper-tools]]
- [[2026-04-10-jaime-modules-sh-fix]]

## Sources
- [[2026-04-21-parcc-ops-discussion]]
