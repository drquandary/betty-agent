# Email draft to ryb re: Lmod site spider cache

**To:** ryb@... (look up the exact address)
**Subject:** Betty lmod site spider cache missing `mrcT` — crashes `module avail` cluster-wide

Hi ryb,

Quick heads-up: the spider cache you regenerated yesterday at
`/vast/parcc/sw/lmod/site/cache/spiderT.lua` (Apr 8 16:45) is missing the
`mrcT` table assignment. When Lmod runs it, `_G.mrcT` stays as its initial
sentinel and then `Cache.lua:340` does `next(_G.mrcT)` which crashes:

```
/usr/bin/lua5.1: /usr/share/lmod/lmod/libexec/Cache.lua:340:
  bad argument #1 to 'next' (table expected, got boolean)
stack traceback:
    [C]: in function 'next'
    /usr/share/lmod/lmod/libexec/Cache.lua:340: in function 'l_readCacheFile'
    /usr/share/lmod/lmod/libexec/Cache.lua:555: in function 'build'
    /usr/share/lmod/lmod/libexec/ModuleA.lua:697: in function 'singleton'
    /usr/share/lmod/lmod/libexec/Hub.lua:1218: in function 'avail'
```

This hits any user whose `$MODULEPATH` routes through the `site/` cache,
which I think is everyone. I reproduced it on my own account on 2026-04-09
in an OOD Interactive Desktop session on dgx028.

## How I found the file

I traced `openat()` calls around the crash — the last Lua file lmod opens
successfully before the traceback is `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
(fd=3). Config file pointing lmod there is `/vast/parcc/sw/lmod/site/lmodrc.lua`
(fd=4), loaded from `libexec/../init/lmodrc.lua`.

## What the file actually contains

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

Note the `/vast/parcc/sw/lmod/alt/26.1.zen4/Core` reference — this looks
like the cache was regenerated as part of your `alt/` work (the dir you
created Apr 7 at 07:42), but the regeneration dropped the `mrcT` initializer.

Bare-Lua syntax check:
```
$ lua5.1 -e "dofile('/vast/parcc/sw/lmod/site/cache/spiderT.lua'); \
             print('mrcT=',type(mrcT),'mrcMpathT=',type(mrcMpathT))"
mrcT=  nil
mrcMpathT= table
```

So `mrcT` is never set. Compare a fresh cache I built under my `~/.cache/lmod/`
with `update_lmod_system_cache_files` — that one has `mrcT = {...}` at the top
and works fine.

## What's affected

All users going through the `site/` cache hit this on `module avail`,
`module spider` (some paths), and in some cases `module load` depending on
internal code path. The `--terse` avail path apparently doesn't trigger it
(different code path in Cache.lua).

## Suggested fix

Any of these would work:

```bash
# Option A — regenerate cleanly:
$LMOD_DIR/update_lmod_system_cache_files \
    -d /vast/parcc/sw/lmod/site/cache \
    -t /vast/parcc/sw/lmod/site/cache/timestamp \
    -K "$MODULEPATH"

# Option B — revert to the previous version if there's a backup

# Option C — nuke it and let Lmod fall back to walking MODULEPATH
# (slower for users but correct)
rm /vast/parcc/sw/lmod/site/cache/spiderT.lua
```

## Downstream bug connection

I also reproduced the OOD Interactive Desktop black-screen bug today, which
may be downstream of this: bc_desktop's template scripts call `module load`
at startup, and if those calls hit a broken cache, the XFCE session inherits
a half-broken environment. Fixing the spider cache should fix both at once.
(Some Interactive Desktop sessions work fine — maybe the good/bad launches
depend on which code path in Cache.lua gets exercised first.)

## Workaround I'm using meanwhile

I prebuilt my own user cache and set `LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod`
in my `~/.bashrc`. With that, `module load anaconda3/2023.09-0` takes ~1s
cold, ~0.5s warm. But obviously the real fix is on your end.

Thanks — happy to help verify anything on my account after you push a fix.

— Jeff Vadala
  jvadala / jcombar1-betty-testing
