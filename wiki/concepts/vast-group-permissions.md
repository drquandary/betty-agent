---
type: concept
tags: [permissions, vast, chgrp, chmod, setgid, facilitation, unix, hpc]
created: 2026-05-13
updated: 2026-05-13
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]
related: [vast-storage, ryan-bradley, betty-cluster]
status: current
---

# VAST group permissions on Betty

## One-line summary
Files on Betty's VAST share are gated by both **mode bits AND group membership** — `chmod g+r` alone is useless when the file's group is one the reader isn't in. The canonical fix in a setgid project directory is `chgrp <directory-group> <file>` or, when chgrp isn't convenient, `cp + mv` to inherit the directory's group via setgid. ryb's framing: *teaching users `stat`/`chmod`/`chgrp`/`setfacl` is a core PARCC facilitation responsibility.*

## Why this matters

Cross-group collaboration is the norm on Betty — a researcher in group A wants to share input data with a collaborator (or with the Betty Agent acting on jvadala's behalf) in group B, both members of a parent project group C. The VAST `/vast/projects/<project>/` directories are typically setgid-on-create, so newly created files inherit the parent dir's group. But the moment data crosses from elsewhere — `scp` from another cluster, a copy with `--preserve`, a `rsync -a` from home, or a file that predates the setgid bit — the original group ownership comes along for the ride, and the share silently breaks.

This is **the most common access-denied failure mode** for cross-group workflows on Betty, observed live in [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]].

## The mental model

A user can read a file iff **at least one** of these is true:
1. They own it AND the **owner** mode bits include `r` (e.g. `-r--------`)
2. They're in the file's group AND the **group** mode bits include `r` (e.g. `-----r----`)
3. The **other** mode bits include `r` (e.g. `--------r-`)
4. An **ACL** entry grants them read (rare on Betty; see *ACLs* below)

`chmod g+r` only widens path #2 — and it does nothing for a user who isn't in that group. The most common diagnostic mistake is "the mode looks right, why can't they read it?" The fix needs `id <user>` *and* `ls -l <file>` to be considered together.

## The diagnostic recipe

```bash
# Step 1: what groups is the would-be reader in?
id jvadala     # uid=…  groups=jvadala,sbgrid,rybParccDataScienceVast,rybParccDataScienceCeph,…

# Step 2: who owns the file, what's its group, what are its bits?
stat foo.xml
# or:
ls -la foo.xml
# expect e.g.  -rw-rw---- 1 ryb rybParccDataScienceVast 2.1M Apr 28 16:24 foo.xml

# Step 3: do any of the reader's groups match the file's group?
#  If yes: check the group bits. If readable, you're fine.
#  If no:  group bits don't help. Need chgrp or ACL or world-readable.

# Step 4: is the parent directory's setgid bit set?
ls -ld .
# drwxrwsr-x  ←  the trailing "s" on the group field = setgid on dir
# meaning: NEWLY-created files in this dir inherit the dir's group.
# Existing files that predate setgid don't.
```

## The four standard fixes

### Fix 1 — `chgrp` to a shared group (preferred when both writer and reader share a group)
```bash
chgrp rybParccDataScienceVast /vast/projects/ryb/parcc-data-science/tests/beast2/main-intro_equal-time-loc_ha_empirical_targeted_1.xml
```

Requires write or ownership on the file. Group must be one the **owner** is also a member of (`chgrp` for non-root requires the target group be in your supplementary groups). Doesn't change content.

### Fix 2 — `cp; mv` round-trip to inherit via setgid
```bash
cd /vast/projects/ryb/parcc-data-science/tests/beast2/
cp main-intro_equal-time-loc_ha_empirical_targeted_1.xml{,.new} && \
  mv main-intro_equal-time-loc_ha_empirical_targeted_1.xml{.new,}
```

The new file is created **inside the directory**, so it inherits the directory's group via setgid. Then mv overwrites the original. Doesn't change content. Works when you can write to the directory but `chgrp` is awkward (e.g. you're not the owner but you can `cp` it as yourself, then `mv` because you have dir-write).

**Tradeoff**: this changes file ownership to the copier (the new file is owned by whoever ran `cp`), which may itself break things downstream. Prefer fix 1.

### Fix 3 — add the reader to the file's group
```bash
# Run by a PARCC admin (not jvadala, not ryb):
gpasswd -a <pennkey> <groupname>
```

Takes effect on next login (and ColdFront propagation may delay up to an hour, per [[betty-cluster]]). Useful when the reader genuinely needs ongoing access to that group's files, not just a one-time share.

### Fix 4 — POSIX ACL grant (when you can't change ownership or group membership)
```bash
setfacl -m u:<pennkey>:r foo.xml
# verify:
getfacl foo.xml
```

Adds an additional permission tier above the standard mode bits. ACLs **do** copy/move through within VAST, but **do not** survive `scp`, `rsync` without `-A`, or copies from non-ACL filesystems. ryb's caveat from the chat: *"even ACLs do not help when you retain metadata when you transfer data from elsewhere, so just remaining vigilant is best."*

## When `chmod` alone is the right tool
- The reader is **already in the file's group** but the group bits don't grant read → `chmod g+r foo.xml` is the fix.
- The file is too permissive (`664` should be `640`) → `chmod o-r foo.xml`.
- A whole tree needs the group-readable bit set → `chmod -R g+rX <dir>` (uppercase `X` adds `x` only for directories or already-executable files; lowercase `x` would chmod every file executable).

But **never** assume `chmod g+r` alone fixes a "permission denied" — confirm group membership first.

## Common scenarios on Betty

### Scenario A: `scp` from a non-VAST source preserves wrong group
```bash
scp jvadala@otherhost:~/foo.xml /vast/projects/ryb/parcc-data-science/inputs/
ls -la /vast/projects/ryb/parcc-data-science/inputs/foo.xml
# Result: file owned by jvadala:jvadala, NOT the project group.
# Fix:
chgrp rybParccDataScienceVast /vast/projects/ryb/parcc-data-science/inputs/foo.xml
chmod 640 /vast/projects/ryb/parcc-data-science/inputs/foo.xml
```

For a directory tree:
```bash
chgrp -R rybParccDataScienceVast /vast/projects/ryb/parcc-data-science/inputs/newrun/
chmod -R g+rwX /vast/projects/ryb/parcc-data-science/inputs/newrun/
```

### Scenario B: `cp -a` (or `rsync -a`) on a project move
The `-a` flag preserves ownership and group. Inside a setgid project dir, the new files won't inherit — they'll retain whatever the source had. Drop `-a` or follow with a `chgrp -R` sweep.

### Scenario C: File predates the directory's setgid bit
Common when a project dir was made non-setgid and later updated. Older files have the wrong group; newer ones are correct. Fix is a one-time `chgrp -R` over the directory.

## The facilitation framing (ryb's chat, 2026-05-13)

ryb explicitly called this out as a teaching pillar for PARCC users:

- > "this is good practice. teaching users to be mindful of `chgrp` and `chmod` will be a big part of our facilitation effort"
- > "teaching the users `stat`, `chmod`, `chgrp`, and maybe `setfacl` will be important. … other than forgetting the codes e.g. 755, 600, etc, I probably use no more than 10 bash commands in a single day"
- > "we can also help them script around the permissions problems"
- > "we could also teach them ACLs eventually, but even ACLs do not help when you retain metadata when you transfer data from elsewhere"

The implication for the Betty Agent: when a user reports "permission denied," the agent's first move should be `id $USER` + `stat <file>` side-by-side, **not** `chmod g+r`. Suggesting the wrong chmod and watching it fail is the symptom of skipping the diagnosis.

## "Script around the permissions" — useful one-liners

```bash
# Sweep a project dir: fix group on every file that doesn't match the dir
DIR=/vast/projects/ryb/parcc-data-science/inputs
GRP=$(stat -c '%G' "$DIR")
find "$DIR" \! -group "$GRP" -print -exec chgrp "$GRP" {} +

# Re-impose 640 / 750 on a project tree
find "$DIR" -type f -exec chmod 640 {} +
find "$DIR" -type d -exec chmod 2750 {} +    # 2 = setgid bit on dir

# Make a copy that's guaranteed to inherit the dir's group
copy_with_dir_group() {
  local src=$1 dest_dir=$2
  cp "$src" "$dest_dir/" && chgrp "$(stat -c '%G' "$dest_dir")" "$dest_dir/$(basename "$src")"
}
```

A user-facing "permissions cheat-sheet dashboard" (jvadala's stated goal in the chat) is a future Betty Agent feature — a small page that shows the user's groups, the project dir's group, and a "fix this file" generator.

## See also
- [[vast-storage]] — the filesystem these rules apply to
- [[ryan-bradley]] — author of the facilitation framing in the source chat
- [[betty-cluster]] — ColdFront group-membership propagation behavior

## Sources
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
