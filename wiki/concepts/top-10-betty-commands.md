---
type: concept
tags: [cheat-sheet, facilitation, commands, lmod, permissions, slurm, dashboard]
created: 2026-05-13
updated: 2026-05-13
sources: [2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]
related: [vast-group-permissions, betty-lmod-architecture, parcc-helper-tools, slurm-on-betty, ryan-bradley]
status: current
---

# Top 10 Betty commands — facilitation cheat-sheet

## One-line summary
The ~10 bash commands that account for almost all day-to-day Betty user friction. Designed to back a "command guide dashboard" surface in `betty-ai-web` and to give the Betty Agent a tight script for facilitation moments. Coverage: file permissions (`stat`/`chmod`/`chgrp`/`setfacl`), modules (`module spider`/`module load`), Slurm (`squeue`/`sinfo`/`sbatch`/`sacct`), storage (`parcc_quota.py`/`parcc_du.py`), and the access-debugging triplet.

## Why this exists
- ryb's facilitation observation in the 2026-05-13 chat: he uses "no more than 10 bash commands in a single day" on the cluster and the recurring failure mode is users not knowing `stat`/`chmod`/`chgrp`/`setfacl`.
- Most cross-group collaboration failures on VAST trace to permission-bit and group-ownership confusion ([[vast-group-permissions]]).
- Module-system corner cases on Betty are well documented but scattered ([[betty-lmod-architecture]], [[ood-troubleshooting]]).
- A short, opinionated reference belongs in the wiki AND in a planned `/dashboard` cheat-sheet route in the web app.

## The 10 commands

### 1. `id` — who am I, and what groups can I access?
```bash
id              # uid, gid, and supplementary groups
id jvadala      # same for another user (works if you can read /etc/passwd)
groups          # just the group list
```
**Use it when**: any time "permission denied" surprises you. Step 1 of every access-debugging session. The groups your account belongs to determine which files you can read on VAST.

### 2. `stat` — full metadata on a file or directory
```bash
stat foo.xml
stat -c '%U:%G %a %n' foo.xml          # compact: owner:group mode name
stat -c '%G' /vast/projects/<proj>     # just the group of a project dir
```
**Use it when**: pairing with `id` to diagnose access. Together they answer: "do my groups intersect the file's group, and do the right mode bits grant read?"

### 3. `chmod` — change permission bits
```bash
chmod 640 foo.xml                       # rw- r-- ---
chmod g+r foo.xml                       # add group-read
chmod -R g+rwX /vast/projects/<proj>/inputs   # recursive: rwX adds x only to dirs / already-exec files
chmod g+s /vast/projects/<proj>/inputs        # setgid on dir: new files inherit dir's group
```
**Common codes worth memorising**:
- `600` rw owner only — sensitive XML/configs/keys (BEAST researcher's "I can't share this" default)
- `640` rw owner + r group — typical shared input
- `750` rwx owner + rx group — shared executable / directory
- `2750` setgid + 750 — shared project dir where new files inherit the group

**Use it when**: opening a file to your group, or tightening a too-permissive one. Remember: `chmod g+r` is only useful if the reader is already in the file's group; otherwise see `chgrp`.

### 4. `chgrp` — change group ownership
```bash
chgrp rybParccDataScienceVast foo.xml
chgrp -R rybParccDataScienceVast /vast/projects/<proj>/inputs/
```
**Use it when**: a file you own is in the wrong group (e.g. `scp` brought in your default user group instead of the project group). Requires you to own the file AND be in the target group.

**The "cp+mv" trick** when chgrp isn't convenient and the parent dir is setgid:
```bash
cp foo.xml{,.new} && mv foo.xml{.new,}
```
The new file inherits the parent dir's group via setgid; mv replaces the original. Tradeoff: ownership changes to the copier.

Full reasoning: [[vast-group-permissions]].

### 5. `setfacl` / `getfacl` — POSIX ACLs (when chgrp isn't enough)
```bash
setfacl -m u:jvadala:r foo.xml         # grant jvadala read regardless of group
setfacl -m g:rybParccDataScienceVast:rwx /vast/projects/<proj>/shared
setfacl -d -m g:rybParccDataScienceVast:rwx /vast/projects/<proj>/shared  # default ACL for new entries
getfacl foo.xml
setfacl -x u:jvadala foo.xml           # remove a specific entry
```
**Use it when**: you need to grant access to a *specific* user who isn't (and shouldn't be) in any of the file's groups. ACLs override mode bits but don't survive `scp` without `-A` or copies from non-ACL filesystems.

### 6. `module spider` / `module load` — find and activate software
```bash
module spider beast               # find BEAST and show how to load it
module spider beast2/2.7.7        # show every prereq path for this version
module load arch/b200             # load the B200 toolchain (overspack)
module load beast2                # load BEAST2 on top of arch/b200
module list                       # what's loaded right now
module purge                      # unload everything
```
**Use it when**: looking for or activating any scientific software. **Always use `module spider` first** — `module avail` has historically crashed on Betty ([[ood-troubleshooting]]), and `spider` walks every alt/arch chain anyway. The `arch/b200` module is the gateway to GPU-built versions of most scientific software ([[betty-software-deployment]]).

### 7. `parcc_quota.py` / `parcc_du.py` — storage budget
```bash
parcc_quota.py                                 # all your quotas at a glance
parcc_du.py /vast/projects/<proj>              # what's taking up project space
parcc_du.py /vast/projects/<proj> --depth 2    # drill deeper
```
**Use it when**: before any large download, training-data move, or model cache placement. Filling your `$HOME` quota is the #1 self-inflicted Betty failure mode. Set `HF_HOME=/vast/projects/<proj>/hf_cache` before any HuggingFace operation.

### 8. `parcc_sfree.py` / `sinfo` — what compute is available
```bash
parcc_sfree.py                       # human-friendly: free GPUs per partition
parcc_sfree.py --by node             # per-node breakdown, including PLANNED state
sinfo -s                             # raw Slurm summary
sinfo -p dgx-b200 --states=IDLE      # only idle nodes in one partition
```
**Use it when**: choosing a partition before submitting. Watch for node-state suffixes (e.g. trailing `-` means "planned by backfill"); full glossary in [[slurm-node-state-modifiers]].

### 9. `squeue` / `sbatch` / `scancel` — Slurm job lifecycle
```bash
sbatch run.sh                                  # submit a job
squeue -u $USER                                # your queue
squeue -u $USER -o "%.18i %.30j %.8T %.10M %.6D %R"   # readable layout
scancel 5742742                                # cancel one job
scancel -u $USER -t PENDING                    # cancel all your pending jobs
sacct -j 5742742 --format=JobID,State,ExitCode,Elapsed,MaxRSS    # post-mortem
parcc_sdebug.py --job 5742742                  # diagnose a failure
parcc_sdebug.py --node dgx028                  # diagnose a node
```
**Use it when**: any time you submit a job. `sacct` and `parcc_sdebug.py` are the difference between "the job died, I don't know why" and "exit 0:53 on dgx028 — known transient signal" — see [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] for a real example.

### 10. `find` (with `-group` / `-perm`) — sweep for permissions problems
```bash
# Files in a project dir that DON'T match the project group:
DIR=/vast/projects/<proj>
GRP=$(stat -c '%G' "$DIR")
find "$DIR" \! -group "$GRP" -print
# Auto-fix:
find "$DIR" \! -group "$GRP" -exec chgrp "$GRP" {} +

# Files in $HOME bigger than 1 GB (quota offenders):
find ~ -type f -size +1G -printf '%s %p\n' | sort -nr | head

# World-writable files (security review):
find /vast/projects/<proj> -perm -o+w -print
```
**Use it when**: cleaning up a project dir, debugging "why can't anyone read this," or hunting quota offenders.

## Honorable mentions (numbers 11-15)

| Command | Use case |
|---|---|
| `parcc_sqos.py` | Your QoS limits per partition |
| `parcc_sreport.py --user $USER` | Your usage/billing summary |
| `srun -p <partition> --pty bash` | Quick interactive shell on a compute node ([[interact-script-vs-salloc]]) |
| `kinit jvadala@UPENN.EDU` | Refresh Kerberos ticket before SSH |
| `scp -p` ↔ `rsync -av` | Move files into VAST; **always followed by a `chgrp -R` sweep** (see #4) |

## "Script around the permissions" — drop-in snippets

Bundle these into a user's `~/bin/` or a project `scripts/` dir:

```bash
# permcheck <file>: show owner, group, mode, and whether $USER can read
permcheck() {
  local f=$1
  stat -c 'owner=%U group=%G mode=%a' "$f"
  echo "user groups: $(id -Gn)"
  if [[ -r "$f" ]]; then echo "READABLE by $USER"; else echo "NOT readable by $USER"; fi
}

# fixgroup <dir>: chgrp -R any file in <dir> whose group != dir's group
fixgroup() {
  local d=$1
  local g=$(stat -c '%G' "$d")
  find "$d" \! -group "$g" -print -exec chgrp "$g" {} +
}

# copy_into <src> <dest_dir>: cp and chgrp to the dest dir's group
copy_into() {
  local src=$1 dest=$2
  cp "$src" "$dest/"
  chgrp "$(stat -c '%G' "$dest")" "$dest/$(basename "$src")"
}
```

A future Betty Agent skill (`/perm-check <path>`) could front this — until then these are copy-paste-friendly.

## Dashboard integration (planned)

This page is intended to back a `betty-ai-web` route — e.g. `/dashboard/commands` — that surfaces the same content as searchable cards. Suggested skeleton:

- Tabs: **Permissions** | **Modules** | **Storage** | **Slurm** | **Search**
- Each command card shows: the form, a 1-line "use it when," a real example pulled from this wiki, and a "copy" button
- The Permissions tab embeds a small live form: enter a file path on Betty and it runs `permcheck` via the existing API surface
- All examples cross-link back to the wiki pages cited here

Implementation isn't part of this ingest — captured as a follow-up.

## See also
- [[vast-group-permissions]] — the full chgrp/chmod/setfacl playbook with diagnostic recipes
- [[betty-lmod-architecture]] — why `module avail` is the wrong call on Betty
- [[parcc-helper-tools]] — full list of `parcc_*.py` scripts
- [[slurm-on-betty]] — Slurm command reference
- [[ood-troubleshooting]] — when modules / OOD misbehave
- [[ryan-bradley]] — author of the "10 commands a day" framing

## Sources
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
