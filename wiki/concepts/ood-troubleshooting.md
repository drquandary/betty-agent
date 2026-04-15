---
type: concept
tags: [ood, troubleshooting, bc_desktop, lmod, slurm]
created: 2026-04-09
updated: 2026-04-10
sources: [2026-04-07-ryb-ood-bc-desktop-investigation, 2026-04-10-jaime-modules-sh-fix, 2026-04-10-ryb-overspack-deployment-docs]
related: [open-ondemand-betty, slurm-on-betty, vast-storage, huggingface-cache-management, parcc-helper-tools, betty-lmod-architecture]
status: current
---

# OOD Troubleshooting (Betty)

## One-line summary
Decision tree for diagnosing Open OnDemand session failures on Betty, especially Interactive Desktop (`bc_desktop`) launch errors and lmod cache issues.

## Where the actual errors live

OOD does NOT show the real error in the browser. You must dig into the session directory on disk:

```
~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/output/<session-id>/
├── output.log         ← PRIMARY: Slurm + VNC + desktop launch output
├── script.sh          ← the generated sbatch script (good to inspect)
├── user_defined_context.json
├── vnc.conf
└── connection.yml     ← populated once VNC is up
```

Find the most recent session id:
```bash
ls -ltrh ~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/output/ | tail
```

Then read:
```bash
cat ~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/output/<sid>/output.log
```

## Decision tree

### Symptom: session "Queued" forever, never starts
- Check queue: `squeue -u $USER`
- Check if Slurm even received it: `sacct -u $USER -S today --format=JobID,State,Reason,ExitCode`
- Common `Reason` values and fixes:
  - `Resources` — partition full, wait or switch partition
  - `QOSMaxJobsPerUserLimit` — you've hit a per-user cap; `parcc_sqos.py` to see limits
  - `AssocMaxCpuMinutesPerJobLimit` — job too big for QOS
  - `Invalid account/QOS` — form has `bc_account` wrong; fix in the launch form
  - `ReqNodeNotAvail` — requested node is down (we know [[betty-cluster]] has **dgx015 down** as of 2026-04-08)

### Symptom: session starts then immediately "Completed" (dies fast)
Read `output.log`. Common causes:
1. **lmod cache corruption** (see [[#Lmod cache issues]] below)
2. **Missing VNC components** on the compute node:
   ```bash
   srun -p <partition> -t 00:05:00 --pty bash -c 'which vncserver Xvnc websockify turbovnc'
   ```
   If any are missing → PARCC admin fix needed
3. **Missing desktop environment binary**:
   ```bash
   srun -p <partition> -t 00:05:00 --pty bash -c 'which mate-session xfce4-session gnome-session'
   ```
4. **$HOME inode quota full** — see [[#Home inode quota]]
5. **Bad `script.sh`** — the per-app `/etc/ood/config/apps/bc_desktop/slurm.yml` override may be generating malformed sbatch

### Symptom: session starts, VNC "Launch" button appears, but clicking it fails
- Check `connection.yml` in the session dir — should have `host`, `port`, `password`, `spassword`
- Usually a websockify / noVNC proxy issue on the OOD host side
- Report to PARCC support

## Home inode quota (common silent failure)

OOD writes many small files under `~/ondemand/data/` per session. If you approach your inode cap, new sessions fail silently without a clear error.

Check with:
```bash
parcc_quota.py
```

Look at the **INodes Used / INode Limit** column. At **>85%** you are at risk.

Observed in the wild: user `ryb` was at 219.94K / 250K = **88% inodes** while debugging bc_desktop failures.

Cleanup:
```bash
# How many OOD session dirs are stacking up?
find ~/ondemand/data/sys/dashboard/batch_connect -maxdepth 5 -type d | wc -l

# Old sessions are safe to delete (preserve recent ones):
find ~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/output -maxdepth 1 -mtime +14 -exec rm -rf {} \;
```

Also check `.cache/`, `.local/share/Trash/`, old conda envs in `~/envs/`, and pip wheel caches.

## RESOLUTION (2026-04-10) — Lmod crash RESOLVED

**Status: RESOLVED** by Jaime on 2026-04-10.

**What Jaime fixed**: `/etc/profile.d/modules.sh` on compute nodes was sourcing BCM's (Bright Cluster Manager) bundled lmod at `/usr/share/lmod/lmod`. Jaime changed it to source PARCC's custom lmod at `/vast/parcc/sw/lmod/lmod` instead. This changed which lmod binary initializes on compute nodes, which changed the init chain, which bypassed the broken site spider cache entirely.

**Verification**: `env -u LMOD_SPIDER_CACHE_DIRS -u LMOD_IGNORE_CACHE bash --norc -c 'source /etc/profile.d/modules.sh; module avail 2>&1 | head -5'` works cleanly on compute nodes.

**What's still broken**: The corrupt file `/vast/parcc/sw/lmod/site/cache/spiderT.lua` (owned by ryb, modified Apr 8 16:45) still exists on disk with the same timestamp. Nobody hits it anymore because PARCC's lmod uses its own init chain. ryb still needs to fix `update.sh` so future cache regenerations produce a valid `mrcT` stanza.

**Our workarounds are now optional**: The `LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod` + prebuilt user cache workaround is no longer needed but is harmless to leave in `~/.bashrc`. It won't conflict with PARCC's lmod.

**Key lesson**: When debugging module crashes on HPC, check WHICH lmod binary is actually running before diving into cache files. BCM clusters can have competing lmod installations. See [[betty-lmod-architecture]] for the full picture.

---

*Investigation details below preserved for reference:*

## Lmod cache corruption (CONFIRMED bug on Betty, 2026-04-09)

**Status**: actively broken on Betty as of 2026-04-09. Reproduced on `jvadala` account in live session `5199382` on dgx028.
**Runtime**: `LMOD_VERSION=8.7.39` (note: `module list` shows `lmod/8.7.55` loaded as a module — there is a version mismatch between the runtime Lmod and the module-wrapped Lmod; probably irrelevant to this bug but worth noting).

### The error signature (exact stack trace)

When you run `module avail`, `module spider`, or anything that triggers spider-cache load, you get:

```
/usr/bin/lua5.1: /usr/share/lmod/lmod/libexec/Cache.lua:340:
  bad argument #1 to 'next' (table expected, got boolean)
stack traceback:
    [C]: in function 'next'
    /usr/share/lmod/lmod/libexec/Cache.lua:340: in function 'l_readCacheFile'
    /usr/share/lmod/lmod/libexec/Cache.lua:555: in function 'build'
    /usr/share/lmod/lmod/libexec/ModuleA.lua:697: in function 'singleton'
    /usr/share/lmod/lmod/libexec/Hub.lua:1218: in function 'avail'
    /usr/share/lmod/lmod/libexec/cmdfuncs.lua:144: in function 'cmd'
    /usr/share/lmod/lmod/libexec/lmod:513: in function 'main'
    /usr/share/lmod/lmod/libexec/lmod:584: in main chunk
```

### Root cause — FULLY IDENTIFIED 2026-04-09

**The corrupt file is `/vast/parcc/sw/lmod/site/cache/spiderT.lua`.**

```
-rw-r--r-- 1 ryb bettySWAdmin 3709916 Apr  8 16:45 /vast/parcc/sw/lmod/site/cache/spiderT.lua
```

Owned by **ryb** (user who was also investigating bc_desktop issues in the 2026-04-07 terminal log), modified **2026-04-08 at 16:45 UTC**, 3.7 MB.

The Lmod config file that tells the runtime to load this cache is `/vast/parcc/sw/lmod/site/lmodrc.lua` (visible in the strace trace above the spiderT.lua open).

### What's wrong with the file

The first 15 lines:
```lua
timestampFn = {
    false,
}
mrcMpathT = {
  ["/vast/parcc/sw/lmod/alt/26.1.zen4/Core"] = {
    hiddenT = {
      ["abseil-cpp/20260107.1-4wli46q"] = {
        kind = "hidden",
      },
      ...
```

The file defines `timestampFn` and `mrcMpathT` but **never defines `mrcT`**. When `Cache.lua:338` executes `resultFunc()` on this file, `_G.mrcT` is left uninitialized (or, depending on Lmod's internal sentinel, set to `false`). Then line 340 runs `next(_G.mrcT)` on the boolean and crashes with `bad argument #1 to 'next' (table expected, got boolean)`.

Note the MODULEPATH reference: `/vast/parcc/sw/lmod/alt/26.1.zen4/Core`. The `alt/` subdirectory is an experimental module layout that ryb created on 2026-04-07 (see [[2026-04-07-ryb-ood-bc-desktop-investigation]] — ryb's `ls -la /vast/parcc/sw/lmod/` showed the `alt/` dir timestamped Apr 7 07:42). **The broken file is a cache regenerated to include the alt/ layout, but the regeneration dropped the `mrcT` stanza** — probably a bug in how `update_lmod_system_cache_files` was invoked, or a partial write, or manual editing that left out the `mrcT` initialization.

Syntax check results (from `lua -e "dofile('...'); print(type(mrcT))"`):
```
mrcT type:      nil
mrcMpathT type: table
```

In a fresh Lua interpreter `mrcT` is nil (not present), but inside Lmod's runtime context `_G.mrcT` has a sentinel value of `false` that the cache is supposed to overwrite.

### Definitive proof the file is the bug (bare-Lua reproduction, no admin needed)

You can reproduce the exact Lmod crash using bare `lua5.1` on the broken file, bypassing all of Lmod's internals:

```bash
lua5.1 -e 'mrcT = false; dofile("/vast/parcc/sw/lmod/site/cache/spiderT.lua"); next(mrcT)'
```

Output:
```
lua5.1: (command line):1: bad argument #1 to 'next' (table expected, got boolean)
stack traceback:
    [C]: in function 'next'
    (command line):1: in main chunk
    [C]: ?
```

Compare to the Lmod crash:
```
/usr/bin/lua5.1: /usr/share/lmod/lmod/libexec/Cache.lua:340: bad argument #1 to 'next' (table expected, got boolean)
stack traceback:
    [C]: in function 'next'
    /usr/share/lmod/lmod/libexec/Cache.lua:340: in function 'l_readCacheFile'
    ...
```

**Same error, same root cause.** The bare-Lua version skips all of Lmod's layers and reproduces the crash purely from the broken file content. This is the most definitive proof possible without root access to fix the file in place.

And the fix is verified with:
```bash
(echo 'mrcT = {}'; cat /vast/parcc/sw/lmod/site/cache/spiderT.lua) > /tmp/spiderT-fixed.lua
lua5.1 -e 'mrcT = false; dofile("/tmp/spiderT-fixed.lua"); next(mrcT or {}); print("next ok")'
# prints: next ok
```

Prepending `mrcT = {}` to the file makes both globals well-formed and eliminates the crash entirely.

### How to find it yourself (reproducible, no admin needed)

```bash
# Capture every file lmod opens during a crashing module avail:
unset LMOD_SPIDER_CACHE_DIRS LMOD_IGNORE_CACHE
strace -f -e openat -o /tmp/lmod-trace.$$ bash -c 'module avail 2>&1'
# Last file opened successfully before the crash is the corrupt one:
grep -a '\.lua"' /tmp/lmod-trace.$$ | tail -5
# Verify the broken file with bare Lua:
lua5.1 -e "dofile('/vast/parcc/sw/lmod/site/cache/spiderT.lua'); print('mrcT=',type(mrcT),'mrcMpathT=',type(mrcMpathT))"
# If mrcT prints "nil" but mrcMpathT prints "table" → that's the bug.
```

### Fix — can only be done by the file owner (ryb) or root

```bash
# Option A: regenerate the site cache freshly
$LMOD_DIR/update_lmod_system_cache_files \
    -d /vast/parcc/sw/lmod/site/cache \
    -t /vast/parcc/sw/lmod/site/cache/timestamp \
    -K "$MODULEPATH"
# Option B: restore from backup (if there is one in /vast/parcc/sw/lmod/site/cache/spiderT.lua.bak-*)
# Option C: delete the file so Lmod falls back to walking MODULEPATH (slow but correct)
rm /vast/parcc/sw/lmod/site/cache/spiderT.lua
```

**Normal users (jvadala included) CANNOT fix this file** — permissions are `rw-r--r--` and owner is `ryb`, group is `bettySWAdmin` (read-only). The `/vast/parcc/sw/lmod/site/cache/` directory itself is also not writable by normal users. **You have to ask ryb** or whoever has write access to regenerate.

**PRE-FIX TEXT PRESERVED BELOW FOR HISTORY — superseded by the definitive finding above:**

---

### Root cause (as far as we got — needs admin to finish)

Lmod reads one or more cache files via `loadfile()` at `Cache.lua:333`, then executes them with `resultFunc()` at line 338 to populate two globals: `_G.mrcT` (module resolver config table) and `_G.mrcMpathT` (modulepath index). Line 340 then does:

```lua
if (_G.mrcT == nil or next(_G.mrcT) == nil or _G.mrcMpathT == nil) then
    LmodError{msg="e_BrokenCacheFn",fn=fn}
end
```

On Betty, **one of the loaded files leaves `_G.mrcT` as a boolean (`false`)** instead of a table. `next(false)` raises the Lua error. The bad file is **executable Lua code** — not the giant `spiderT` dump. It's the kind of thing admins put in a `.modulerc.lua` or a site `lmodrc.lua` to define defaults, hidden modules, and family conflicts.

### Where the bad file lives (to be confirmed by an admin)

We **did not find the exact path** from user-level access. What we ruled out:
- `~/.cache/lmod/` — emptied with `rm -rf ~/.cache/lmod/*`, crash still happens. So **it is NOT the user cache.** (This contradicts an earlier version of these notes that said the user cache clear was the fix — that was wrong; correcting here.)
- `/etc/lmod/` — doesn't exist on dgx028.
- `/vast/parcc/sw/lmod/*.lmodrc*` / `*.modulerc*` — no hits at top level (deeper search not completed because the VNC terminal got wedged on an earlier `find /` command).

An admin with root can pinpoint the file in seconds:

```bash
# Method 1: trace every file Lmod opens, crash will happen right after loading the bad one
strace -f -e openat module avail 2>&1 | tail -80

# Method 2: make Lmod print more about what it's loading
LMOD_DEBUG=3 module avail 2>&1 | grep -iE 'loadfile|mrcT|BrokenCacheFn|readCacheFile'

# Method 3: find all candidate files under MODULEPATH + site config
find /vast/parcc/sw/lmod /cm/shared/modulefiles /usr/share/modulefiles \
     \( -name '.modulerc.lua' -o -name 'lmodrc.lua' -o -name '.modulerc' \
     -o -name 'spiderT*' -o -name 'moduleT*' \) 2>/dev/null
# Then for each hit, run: lua -e "dofile('<path>'); print(type(mrcT))"
# Any file where type(mrcT) != "table" is the culprit.
```

Once identified, either delete the file, fix whatever line sets `mrcT` to a non-table, or regenerate via `$LMOD_DIR/update_lmod_system_cache_files`.

### The fast workaround (recommended, validated 2026-04-09 on dgx028)

**TL;DR**: Prebuild your own Lmod cache, point Lmod at it, and use `module --terse avail` instead of plain `module avail`.

```bash
# ---- One-time setup: run these 3 commands once ----
# (Put them in a script if you want, or just paste them into a shell on login01 or any Betty node.)
module purge 2>/dev/null  # reset state
mkdir -p ~/.cache/lmod
# $LMOD_DIR points to /usr/share/lmod/lmod on Betty. Verify with `echo $LMOD_DIR` after a successful module command.
$LMOD_DIR/update_lmod_system_cache_files \
    -d ~/.cache/lmod \
    -t ~/.cache/lmod/timestamp \
    -K "$MODULEPATH"
# This writes ~3.4 MB of spiderT.lua + spiderT.luac_5.1 + timestamp into ~/.cache/lmod

# ---- Persistent: add to ~/.bashrc ----
echo 'export LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod' >> ~/.bashrc
# Optional convenience alias — avoids the broken plain `module avail`:
echo 'alias ma="module --terse avail"' >> ~/.bashrc
```

After this, `module load <anything>` works in about **1 second cold and half a second warm**. That's what your colleague cares about.

### Measured timings on dgx028 (session 5199382, b200-mig45, VAST NFS)

| Operation | Broken state | `LMOD_IGNORE_CACHE=yes` (slow) | **Prebuilt cache + `LMOD_SPIDER_CACHE_DIRS`** (fast) |
|-----------|--------------|-------------------------------|------------------------------------------------------|
| `module load anaconda3/2023.09-0` cold | 💥 crash (0.08 s) | ~10 s | **1.035 s** ✓ |
| `module load anaconda3/2023.09-0` warm (2nd call in same shell) | — | — | **0.494 s** ✓ |
| `module --terse avail` | ✓ 0.458 s (already works, different code path) | ✓ | **0.458 s** ✓ |
| `module --terse avail` (2nd call) | 0.474 s | | **0.474 s** ✓ |
| Plain `module avail` | 💥 0.085 s crash | ✓ 7.812 s | 💥 0.085 s crash (the broken cache-read path is still broken) |

**`module load` is the operation people actually care about**, and the fast workaround gets it under 1 second. That's basically what Lmod should always look like.

### Why plain `module avail` still crashes with the fast workaround

Plain `module avail` goes through `Cache.lua:333-340` which does `loadfile(fn)` / `next(_G.mrcT)` — that hits the corrupt file. `module load`, `module --terse avail`, and `module spider` take code paths that populate `mrcT` differently and don't trigger the crash. If you really need plain `module avail`, alias it to `--terse` or add `LMOD_IGNORE_CACHE=yes` on top (at the 10 s penalty per call).

### Why `LMOD_IGNORE_CACHE=yes` is slow (for reference — use the fast workaround instead)

Setting `LMOD_IGNORE_CACHE=yes` forces Lmod to skip ALL cache files and walk MODULEPATH directly on every single call. Measured cost on Betty: **~7.8 s per `module avail`, ~10 s per `module load`**. Not acceptable for interactive use. Only use it if you can't prebuild the user cache for some reason, or if you absolutely need plain `module avail` to work.

### Subshell / sbatch inheritance confirmed

Because `LMOD_SPIDER_CACHE_DIRS` is exported via `~/.bashrc`, it propagates into:
- `bash -c '...'` child processes ✓ (tested)
- Slurm batch jobs launched with `sbatch` ✓ (by inheritance, unless your site config strips env — unlikely on Betty)
- Apptainer containers run with default env-passing ✓

If you want to be belt-and-suspenders about it inside a job script:
```bash
#SBATCH ...
export LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod
module load anaconda3/2023.09-0
```

### If the cache ever goes stale

Whenever PARCC adds new modules to the cluster, you might miss them. Regenerate your user cache:
```bash
$LMOD_DIR/update_lmod_system_cache_files \
    -d ~/.cache/lmod \
    -t ~/.cache/lmod/timestamp \
    -K "$MODULEPATH"
```
Or drop a cron/systemd-timer that runs this nightly on login01.

### About clearing `~/.cache/lmod/` (optional, doesn't fix it)

An earlier version of these notes said `rm -rf ~/.cache/lmod/*` was the fix. **That was wrong.** We tested it live and the crash still happens with an empty user cache. The corruption is in a system-level file, not the user cache. You can still clear the user cache as hygiene — Lmod will rebuild it — but don't expect it to fix anything.

### What PARCC admins need to do (real fix)

1. Find the system-level corrupt cache file:
   ```bash
   find /vast/parcc/sw/lmod -name "spiderT*" -o -name "moduleT*" 2>/dev/null
   ```
2. Regenerate with the Lmod helper:
   ```bash
   $LMOD_DIR/update_lmod_system_cache_files -d <cache_dir> -t <timestamp_file> -K <modulepath>
   ```
   Or simply delete the corrupt file and let Lmod rebuild it on the next `module avail`.
3. Audit write permissions on the cache dir so interrupted writes can't leave half-written files.
4. Consider setting `LMOD_IGNORE_CACHE=yes` as a site-wide default in the MOTD or `/etc/profile.d/lmod.sh` until the root cause is addressed — users will never notice the ~1s speed penalty.

### Why this connects to the bc_desktop black-screen bug

`bc_desktop`'s `script.sh.erb` runs `module load` calls at session startup to set up the XFCE environment. If `module load` hits this cache bug, the desktop launcher script silently fails to set up its PATH, and XFCE starts with a broken environment → unpredictable state → session looks broken. **The Lmod bug and the bc_desktop bug your colleague reported are the same bug at the root.** Fix Lmod, and bc_desktop flakiness probably resolves at the same time.

### The old "safe" fix (superseded but still documented)
```bash
rm -rf ~/.cache/lmod ~/.lmod.d/.cache
lmod --regenerate_cache       # force rebuild
module --force purge
module load anaconda3/2023.09-0
```
This works for the USER cache side but not the system cache side — use `LMOD_IGNORE_CACHE=yes` until PARCC fixes the system cache.

### OOD-specific lmod gotcha (separate from the above)
OOD's `bc_desktop` sessions run the template scripts under a non-login shell. If your `~/.bashrc` does module loads that depend on `~/.bash_profile`-only exports, the session inherits a broken module environment. Fix by making sure module loads happen in `~/.bashrc` (or the `before.sh.erb` template), not in profile-only files.

## What to collect before asking PARCC for help

1. `parcc_quota.py` output
2. Session ID from the failed OOD attempt
3. Full `output.log` from that session dir
4. Output of `module list` from an interactive `srun` on the target partition
5. `sacct -j <jobid> --format=JobID,State,Reason,ExitCode,NodeList` for the failed job
6. Screenshot of the browser error (if any)

## See also
- [[open-ondemand-betty]]
- [[slurm-on-betty]]
- [[parcc-helper-tools]]
- [[huggingface-cache-management]]

## Sources
- [[2026-04-07-ryb-ood-bc-desktop-investigation]]
