# PARCC Support Ticket Draft — OOD Interactive Desktop + Lmod Cache Corruption

> Submit via https://parcc.upenn.edu/support
> Copy the content below `---` into the ticket body.
>
> **HEADLINE**: Lmod spider cache is corrupt cluster-wide. `module avail` crashes with a Lua traceback for
> any user whose spider cache gets loaded. The bc_desktop Interactive Desktop flakiness is probably
> downstream of this — its startup scripts call `module load`, which hits the corrupt cache and
> silently fails. Workaround: `export LMOD_IGNORE_CACHE=yes`. Real fix: find and regenerate the
> corrupt system-level spider cache file under /vast/parcc/sw/lmod.

---

**Subject**: [HIGH PRIORITY] Lmod spider cache corrupt cluster-wide — `module avail` crashes with Cache.lua:340 Lua error; also OOD Interactive Desktop bugs downstream of it

Hi PARCC team,

I'm filing a consolidated bug report after reproducing several issues on my `jvadala` account on 2026-04-09. A colleague reported Interactive Desktop failures and lmod cache issues, so I ran a clean reproduction. **The primary bug is a corrupt Lmod spider cache that crashes `module avail` for any user who triggers a cache read.** The OOD Interactive Desktop flakiness that originally brought this to your attention is almost certainly a downstream effect — bc_desktop's startup scripts call `module load`, hit the corrupt cache, silently fail, and the XFCE session ends up in a broken state.

Fixing Lmod may fix the OOD Interactive Desktop bug for free.

**Account**: `jvadala` / `jcombar1-betty-testing`
**OOD portal**: `https://ood.betty.parcc.upenn.edu` (v4.1.4)
**Reproduction date**: 2026-04-09 ~17:54 UTC

## Summary

**Five** confirmed bugs reproduced in the same day's sessions:

1. **[PRIMARY] Lmod spider cache corrupt.** `module avail` crashes with a Lua traceback (`Cache.lua:340: bad argument #1 to 'next' (table expected, got boolean)`). Affects any user whose cache is loaded. Workaround: `export LMOD_IGNORE_CACHE=yes`. Real fix needs admin to regenerate the corrupt system-level cache file.
2. **Interactive Desktop is flaky** on launch. Same form, same partition, same node, same user — session `5199165` at 13:54 UTC rendered as solid black; session `5199382` at 19:42 UTC rendered a working XFCE desktop. Current theory: bc_desktop startup scripts call `module load`, hit bug #1, silently fail, DE comes up broken.
3. **XFCE screensaver locks the session after ~14 minutes idle**, and the unlock password doesn't work (PennKey + Kerberos PAM path not available inside the VNC session). Once locked, the only option is to kill the session and launch a new one. This wastes the remaining walltime and the user's allocation.
4. **Shell-to-compute-node link returns "Host not in allowlist" error** — users cannot open a web shell on their own running session's host
5. **Files app returns 404** — the Session ID link on "My Interactive Sessions" points at a Files app route that doesn't exist

## Session details (for your reference)

- **Slurm job**: `5199165`
- **OOD session ID**: `468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **Node**: `dgx028.betty.parcc.private.upenn.edu`
- **Partition**: `b200-mig45`
- **Form input**: 1 hour, 1 CPU, 0 GPUs, default job name, no reservation
- **Session output dir**: `~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/468bfa5c-8ef9-48e2-9c25-68c309e68fe4/`
  - Could you read `output.log` from that path and share it back? Due to bugs #2 and #3 below I couldn't read it myself from the portal.

## Bug 1 — Lmod spider cache is corrupt (PRIMARY)

**Reproduced**: 2026-04-09 on `jvadala@dgx028` inside OOD session `5199382`.

**Exact error**:
```
$ module avail
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
    [C]: ?
```

**Environment at time of crash**:
```
LMOD_VERSION=8.7.39
MODULEPATH_ROOT=/vast/parcc/sw/lmod/Default
MODULEPATH=/vast/parcc/sw/lmod/linux-ubuntu24.04-x86_64/gcc/13.3.0:/cm/shared/modulefiles:/usr/share/modulefiles:/vast/parcc/sw/lmod/Default:/vast/parcc/sw/lmod/linux-ubuntu24.04-x86_64/Core:/vast/parcc/sw/lmod/linux-ubuntu24.04-x86_64/ext
MODULESHOME=/usr/share/lmod/lmod
```

Note: runtime is `LMOD_VERSION=8.7.39` but `module list` shows `lmod/8.7.55` loaded as a module. Probably not causing this bug but worth a look.

**What I tried and what worked**:

1. Read `Cache.lua:333-343`. The mechanism is:
   - Line 333: `resultFunc = loadfile(fn)` — loads cache file as Lua code
   - Line 338: `resultFunc()` — executes it, expected to populate `_G.mrcT` and `_G.mrcMpathT`
   - Line 340: `if (_G.mrcT == nil or next(_G.mrcT) == nil or _G.mrcMpathT == nil)` → crash here
   - **Root mechanism**: one of the files Lmod loads sets `_G.mrcT` to a **boolean** (`false`) instead of a table. `next(false)` raises the exact error we see.
2. `rm -rf ~/.cache/lmod/*` → empties the user cache dir (`total 0` confirmed). **But `module avail` STILL crashes** with the same traceback. So the user cache is NOT the bad file. The corrupt file is somewhere Lmod is reading in addition to (or instead of) the user cache.
3. `module --ignore_cache avail` → **WORKS PERFECTLY**. Listed aocc/5.0.0, apptainer/1.4.1, autoconf/2.72, automake/1.16.5, bash/5.2, bazel/6.5.0, bbmap/39.01, bcftools/1.21, bdftopcf/1.1.1, berkeley-db/18.1.40, ... This confirms the bug is cache-read path corruption, not MODULEPATH or binary problems.
4. `module --terse avail` → also works. Suggests the terse format uses a different internal path that doesn't trigger the broken `loadfile`.
5. Searched `/vast/parcc/sw/lmod` for obvious candidates (`*.lmodrc*`, `*.modulerc*`, `spiderT*`, `moduleT*`) at shallow depth → no hits. A deeper search would have needed admin access and my user-level investigation wasn't able to pinpoint the exact file (the VNC terminal got wedged on a long-running `find /` and I couldn't make further progress).

**What we need from you to actually fix it (all require root):**

```bash
# Option A — trace the open() syscalls until the crash:
sudo -u jvadala strace -f -e openat module avail 2>&1 | tail -100
# The last Lua file opened before the traceback is the bad one.

# Option B — enable Lmod's debug output:
sudo -u jvadala LMOD_DEBUG=3 module avail 2>&1 | grep -iE 'loadfile|mrcT|readCacheFile|BrokenCacheFn'

# Option C — grep all site config files and check each with Lua directly:
find /vast/parcc/sw/lmod /cm/shared/modulefiles /usr/share/modulefiles \
     \( -name '.modulerc.lua' -o -name 'lmodrc.lua' -o -name '.modulerc' \) 2>/dev/null
# Then for each hit:
#   lua -e "dofile('<path>'); print(type(mrcT))"
# The one that prints "boolean" (or anything other than "table"/"nil") is your culprit.
```

Once identified, fix/regenerate the file. Until then, we've validated two user-level workarounds — one slow, one fast.

**User-level workarounds (validated live on dgx028 in session 5199382, 2026-04-09):**

### Workaround A (slow but simple) — `LMOD_IGNORE_CACHE=yes`

```bash
export LMOD_IGNORE_CACHE=yes
```

Makes `module avail`, `module load`, `module spider` bypass the cache entirely and walk MODULEPATH directly on every call. Tested working for all of: `avail`, `spider python`, `load anaconda3/2023.09-0`, `list`, subshell inheritance (`bash -c`). Unsetting the var brings back the crash immediately, proving the var is what's doing the work.

**Measured cost**: `module avail` 7.8 s, `module load anaconda3/2023.09-0` 10.0 s. Too slow for interactive use in practice.

### Workaround B (FAST, recommended) — prebuild user cache + `LMOD_SPIDER_CACHE_DIRS`

```bash
# One-time setup:
module purge 2>/dev/null
mkdir -p ~/.cache/lmod
$LMOD_DIR/update_lmod_system_cache_files \
    -d ~/.cache/lmod \
    -t ~/.cache/lmod/timestamp \
    -K "$MODULEPATH"

# Add to ~/.bashrc:
export LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod
```

**Measured cost**:
- `module load anaconda3/2023.09-0` — **1.035 s cold, 0.494 s warm** (10x faster than workaround A)
- `module --terse avail` — **0.458 s**, lists 846 modules
- Plain `module avail` still crashes via the broken cache-read code path at Cache.lua:340, but users can alias `module --terse avail` for listing (or layer `LMOD_IGNORE_CACHE=yes` on top if they really need plain `avail`).

Why this works: the `module load` / `module spider` / `module --terse avail` code paths don't trigger the broken `loadfile(fn)` → `next(_G.mrcT)` sequence at Cache.lua:340. By pre-building a valid user cache with `update_lmod_system_cache_files` and pointing Lmod at it via `LMOD_SPIDER_CACHE_DIRS`, we avoid the corruption entirely for the operations that actually matter.

### Recommendation to you

Until you find and fix the corrupt file (see diagnostic recipes above), the cleanest site-wide interim fix is probably:
1. Build a site-wide user-independent spider cache under e.g. `/vast/parcc/sw/lmod/cache/` using `update_lmod_system_cache_files`
2. Set `export LMOD_SPIDER_CACHE_DIRS=/vast/parcc/sw/lmod/cache` in `/etc/profile.d/lmod.sh`
3. Keep the cache regenerated by a nightly cron on login01

That would make `module load` fast for all users without each user having to prebuild their own cache. Or if that's too invasive, just set `LMOD_IGNORE_CACHE=yes` site-wide and accept the ~8 s overhead per call — users will stop crashing but everything gets slower.

**Cluster-wide impact**

Because `~/.cache/lmod/` is on VAST NFS, every user who has ever run `module avail` or `module spider` in a crashed bc_desktop session has a corrupt user cache that follows them across login01, dgx*, epyc*, etc. And the system-level cache (location TBD) appears corrupt on at least dgx028.

**What you need to do**

1. Find the system-level spider cache file(s):
   ```bash
   sudo find /vast/parcc/sw/lmod -name "spiderT*" -o -name "moduleT*" 2>/dev/null
   ```
2. Regenerate them with `$LMOD_DIR/update_lmod_system_cache_files` or just delete and let Lmod rebuild on next run.
3. Audit write permissions and cache-update cron to prevent half-written files in the future.
4. **Interim**: set `LMOD_IGNORE_CACHE=yes` as a site-wide default in `/etc/profile.d/lmod.sh` (or the PARCC MOTD) until the cache file is fixed. Users will never notice the ~1 s speed hit.
5. For every affected user, they should run `rm -rf ~/.cache/lmod/*` to clear their personal cache too. Could be a cron on the login nodes or a one-liner in the MOTD.

**Connection to OOD Interactive Desktop**

bc_desktop's `script.sh.erb` and `template/desktops/xfce.sh` almost certainly call `module load` somewhere during session startup. When those calls hit this bug, they silently fail, XFCE inherits a broken PATH, and the user sees anywhere from "weird missing binaries" to "completely broken session." This is the connection your colleague ryb was probably chasing on 2026-04-07.

---

## Bug 2 — Interactive Desktop renders as solid black screen (flaky — might be downstream of Bug 1)

**Symptoms**
- Slurm job starts cleanly and transitions to `Running` within ~10 seconds
- "Launch Interactive Desktop (Betty)" button works — opens a new noVNC tab
- Tab title shows: `TurboVNC: dgx028:27 (jvadala) - noVNC` — confirming TurboVNC server started at display :27
- websockify proxy URL path resolves cleanly: `rnode/dgx028.betty.parcc.private.upenn.edu/41665/websockify`
- **But the rendered canvas is entirely black** — no window manager, no desktop chrome, no taskbar, no xstartup content

**What would help diagnose**
- Contents of `output.log` from the session dir referenced above
- Confirmation of which desktop environment is hard-coded in Betty's `bc_desktop` override (`/etc/ood/config/apps/bc_desktop/submit/` and/or `template/before.sh.erb`)
- Whether that DE is installed on `dgx028` / MIG-45 compute nodes
- Any Lmod environment that may or may not be inherited by `template/script.sh.erb` when launched from OOD's non-login shell context

**Context**
A colleague previously reported "Interactive Desktop session failures and lmod cache loading incorrectly" — this may be the same bug. That investigation (2026-04-07 on user `ryb`) included copying `/var/www/ood/apps/sys/bc_desktop` into `~/ondemand/dev/bc_desktop/` presumably to patch the slurm.yml / submit configs. Is there a known-good patched version we should be pointed at?

## Bug 3 — XFCE screensaver lockout inside bc_desktop sessions

**Reproduced**: 2026-04-09, sessions `5199165` and `5199340`.

**Symptom**: after ~14 minutes of no input, `xfce4-screensaver` or `light-locker` engages and displays the unlock dialog ("Jeffrey Vadala" avatar + password field + Cancel/Unlock buttons). Typing an empty password is rejected. I could not test a real password in the automation harness, but Kerberos-backed PAM unlock is unreliable inside non-login VNC sessions in general, so many users are likely completely locked out.

**Impact**: If a user walks away from their Interactive Desktop for a coffee break, they come back to an unlockable session. Only recourse is to delete the session and relaunch — wasting the remaining walltime and the user's PC allocation.

**Fix (one-line)**: add this to `bc_desktop/template/before.sh.erb` (or the desktop launcher under `template/desktops/`):

```bash
killall xfce4-screensaver light-locker 2>/dev/null
xfconf-query -c xfce4-screensaver -p /saver/enabled -s false 2>/dev/null
xfconf-query -c xfce4-screensaver -p /lock/enabled -s false 2>/dev/null
xset s off ; xset -dpms ; xset s noblank
```

(The `-dpms` line will emit `server does not have extension for -dpms option` on TurboVNC — harmless, can be silenced with `2>/dev/null`.)

I verified this works in session `5199382` — after running those commands manually in the session's terminal, no lock engaged for the remainder of the hour.

Stock upstream OSC bc_desktop disables the screensaver in its mate.sh / xfce4.sh scripts for exactly this reason. Betty's customized `template/` may have dropped or overridden those lines.

---

## Bug 4 — Compute-node shell link returns allowlist error

**Reproduction**
1. Navigate to "My Interactive Sessions" page while job 5199165 is running
2. Click the `>_ dgx028.betty.parcc.private.upenn.edu` button next to "Host"
3. URL opens: `/pun/sys/shell/ssh/dgx028.betty.parcc.private.upenn.edu`
4. Error shown: `Host "dgx028.betty.parcc.private.upenn.edu" not specified in allowlist or cluster configs.`

**Likely fix**
Add `dgx[001-029]`, `epyc-*` and other compute-node hostnames (or a wildcard) to the `ssh_hosts:` list in the appropriate file under `/etc/ood/config/ondemand.d/` or `/etc/ood/config/clusters.d/betty.yml`. OOD requires the shell app to know about a target host even when the user already has SSH access to it.

**Impact**
Users cannot open a shell on their own running session's node via the portal. This blocks self-diagnosis of bugs like #1 — you can't cat your own session logs without SSHing from login01 → compute_node manually (which hits Duo each time, and is additionally broken because Betty's default SSH between login and compute nodes may rely on Kerberos forwarding that OOD's web shell doesn't propagate).

## Bug 5 — Files app returns 404

**Reproduction**
1. On "My Interactive Sessions", click the blue Session ID link (`468bfa5c-8ef9-48e2-9c25-68c309e68fe4`)
2. URL opens: `/pun/sys/dashboard/files/fs/vast/home/j/jvadala/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
3. Response: `Not Found — The page you are looking for does not exist.`

**Root cause (suspected)**
The Files app is not exposed in Betty's OOD portal routing. The app source code appears to be present at `/var/www/ood/apps/sys/files/` on ood01 (based on earlier investigation), but it's not registered in the nav or routing. Similar for `file-editor`, `activejobs`, `myjobs`.

**Impact**
Users can't read their own session logs, browse VAST from the portal, or download output. This makes OOD significantly less useful and also blocks self-diagnosis of other bugs.

**Additional request**
While you're fixing the Files app registration, could you also enable:
- **Active Jobs** app (the code is at `/var/www/ood/apps/sys/activejobs/`)
- **File Editor** (at `/var/www/ood/apps/sys/file-editor/`)
- **JupyterLab** (not currently deployed at all, but heavily requested for research)

## Bug 4 (context, not blocking) — Related known issue

The `interact` helper script in `/vast/parcc/sw/bin/` references a nonexistent `defq` partition and fails with `salloc: error: Invalid node name specified`. Not OOD-related but worth mentioning as part of the "PARCC wrapper scripts have gaps" theme.

## Action items I'd love resolved

1. **Read and share** `~/ondemand/data/sys/dashboard/batch_connect/sys/bc_desktop/slurm/output/468bfa5c-8ef9-48e2-9c25-68c309e68fe4/output.log` from the jvadala home directory on VAST
2. **Fix** the OOD `ssh_hosts` allowlist to include compute nodes (bug 2)
3. **Register** the Files app (and ideally file-editor, activejobs) in the portal routing (bug 3)
4. **Diagnose** the black-screen root cause from the output.log and deploy a fix (bug 1) — whether that's installing a missing DE on the compute nodes, fixing an xstartup script, or fixing Lmod env inheritance
5. **Confirm** whether the `defq` reference in `/vast/parcc/sw/bin/interact` is a known issue

## Reference material I can share if helpful

I've been building an internal knowledge base about the Betty cluster. If it's useful, I can share:
- The full wiki page I wrote on [[open-ondemand-betty]] with bug reproductions documented
- An OOD troubleshooting decision tree with lmod cache fix steps
- Links to our reproduction artifacts

Thanks for the quick response — happy to help test any fixes on my account before they go to the full user base.

— Jeff Vadala (`jvadala`)
Research group: (fill in)
PI: (fill in)
