# Wiki Log

> Chronological record of ingests, queries, and lint passes.
> Entry prefix: `## [YYYY-MM-DD] <operation> | <brief title>`
> Grep the last 5 with: `grep "^## \[" log.md | tail -5`

---

## [2026-06-23] ingest | Teams digest — account sync paused, post-TAC home-folder fix plan
- Source: [[2026-06-23-teams-chats-digest]] (PARCC Group, Kenneth Chaney, 2026-06-23T14:36Z, digest `digest_20260623T105335.json`)
- Created: [[2026-06-23-teams-chats-digest]]
- Updated: [[betty-cluster]] (BCM→VAST home-dir open issue: 2026-06-23 update), [[kenneth-chaney]] (paused account sync + post-TAC plan), [[index]]
- Key fact: broken new-user home dirs are caused by user creation + account sync being paused; after the pending Palo Alto TAC firewall session, Ken will run one round of syncs and manually fix all home folders made.

## [2026-06-18] ingest | Teams digest — Ken GLM-DSA deployment + 110 dB server-room note
- Source: [[2026-06-18-teams-chats-digest]] (Kenneth Chaney 1:1, 2026-06-18T21:52–22:17Z, digest `digest_20260618T181730.json`)
- Updated: [[kenneth-chaney]] (GLM-DSA deployment: Q4 quant, ~2% hit, no sglang day-zero support), [[betty-cluster]] (new Facility section, ~110 dB server-room noise), [[2026-06-18-teams-chats-digest]] (two new bullets + source)
- Key facts: Ken deploying `glm-dsa` (architecture issues, sglang skipped day-zero support, serving Q4 @ ~2% perf hit); Betty machine room ≈ 110 dB (ear protection required) → on-site audio recording impractical (relevant to an anthropology study of PARCC).

## [2026-06-18] ingest | Teams digest — ryb sandbox cuda-in-hierarchy follow-up
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Ryan Bradley, 2026-06-18T18:54Z, digest `digest_20260618T151039.json`)
- Updated: [[betty-lmod-architecture]] (sandbox-tree / RPATH-vs-hierarchy follow-up in design section), [[2026-06-18-teams-chats-digest]] (new bullet + source)
- Key fact: CUDA-in-hierarchy blocks two simultaneous CUDA versions; CUDA-omitted allows them (binaries RPATH'd at build time). ryb wants real-world examples before deciding. No decision.

## [2026-06-18] ingest | Teams digest — module hierarchy vs flat naming design discussion
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Jamie Schnaitter quoting ryb, 2026-06-18T18:15–18:16Z, digest `digest_20260618T143742.json`)
- Updated: [[betty-lmod-architecture]] (new "Module hierarchy vs flat naming" section, status: tentative), [[2026-06-18-teams-chats-digest]] (new bullet + source)
- Key fact: open debate — hierarchical MODULEPATH (clean names, but `ml beast1` forces unload of cuda/13.1 deps) vs flat toolchain-encoded names (Jamie's UCF `beast/beast-1.2.3-mvapich2-2.3.6-gcc-9.4.2`). No decision.

## [2026-06-18] ingest | Teams digest — pam_slurm_adopt now live + multi-job cgroup caveat
- Source: [[2026-06-18-teams-chats-digest]] (PARCC Group, Jamie Schnaitter, 2026-06-18)
- Created: [[2026-06-18-teams-chats-digest]]
- Updated: [[betty-auth-architecture]] (deployment status + multi-job cgroup caveat), [[jamie-schnaitter]] (compute-node SSH note), [[index]]
- Key fact: `pam_slurm_adopt` is deployed — SSH to a node with a running job works; with multiple jobs on one node the session adopts only one job's cgroup.

## [2026-04-21] add | GROMACS workflow + Ryan Bradley entity
- Sponsor: Ryan Bradley (ryb), PARCC director — wants GROMACS first-class on Betty
- Created concept page: [[gromacs-on-betty]] — partition cheat-sheet (MIG45 for <50k atoms, MIG90 to 300k, full B200 beyond, Genoa for grompp/analysis), `-nb/-pme/-bonded/-update gpu` flag guidance, replica/REMD/FEP patterns, validation benchmark set (benchMEM/benchPEP/benchRIB). **Status: tentative** — no confirmed `module spider gromacs` output yet; page lists three fallback install paths (overspack module, NGC container, conda).
- Created entity page: [[ryan-bradley]] — role, project paths, what ryb owns (overspack, lmod, OOD debugging), GROMACS open items (module-vs-container decision, benchmark set, billing account, trajectory retention).
- Added Slurm template: `betty-ai/templates/slurm/gromacs_mdrun.sbatch.j2` — single-GPU mdrun with `-cpi` checkpoint resume, `--requeue`, three gromacs_source branches (module/container/conda), OpenMP pinning, project-dir working directory.
- Updated: [[index]] (new entity + new concept).
- Open for ryb: confirm module availability, supply blessed benchmark .tpr set, pick billing account, decide VAST vs Ceph for trajectory archive.

## [2026-04-21] ingest | PARCC ops chat — GPU oversubscription, SLURM states, VAST tenant setting
- Source captured: `raw/ops_chat/2026-04-21-parcc-ops-discussion.md` (verbatim chat between Jaime Combariza, Kenneth Chaney, jvadala)
- Created source pages: [[2026-04-21-parcc-ops-discussion]], [[2026-04-17-dgx002-gpu5-oversubscription]]
- Created concept pages: [[slurm-gres-conf]], [[slurm-node-state-modifiers]], [[slurm-select-type-parameters]], [[interact-script-vs-salloc]]
- Updated: [[vast-storage]] (added open thread on tenant-level setting), [[index]]
- Key findings filed:
  - dgx002 GPU-5 double-booking incident (2026-04-17): two jobs, both got `CUDA_VISIBLE_DEVICES=0`; `/etc/slurm/gres.conf` missing on node, `UniqueId:(null)` on every GRES row despite `AutoDetect=nvml`; cgroup plugins loaded. Not reproducible on 2026-04-21 — status `tentative`.
  - `sinfo` node-state trailing `-` means "planned by backfill for higher-priority job"; `parcc_sfree.py --by node` renders this as `MIXED+PLANNED`. Full modifier glossary captured.
  - `interact` helper uses `bash -i` which re-sources login profile (resets Lmod); plain `salloc --pty bash` inherits caller's env. Chaney argues `-i` should be dropped.
  - `SelectTypeParameters=CR_Core_Memory` currently; Jaime evaluating `CR_Pack_Nodes` add-on. Needs a test cluster to validate.
- Open threads (unresolved, NOT filed as fixes):
  - VAST tenant-level setting (exact setting name TBD)
  - `gres.conf` not symlinked next to `slurm.conf` — is `/etc/slurm` ground truth on Betty?
  - dgx024: user `ldugan` running processes without matching SLURM job while `jojolee` held the allocation (job 5359912) — Chaney investigating
  - Nsight install/activate pending on Ahead
  - Dell quote awaiting internal approval; ETA concerning
- Notes: the chat also included Jaime's desire for a test cluster (noted on both [[slurm-select-type-parameters]] and [[2026-04-17-dgx002-gpu5-oversubscription]]).

## [2026-04-16] handoff | Session handoff written for incoming agent
- Created: `raw/docs/2026-04-16-session-handoff.md`
- Context: Jeff wanted to expand Betty AI beyond LLMs to multi-task orchestrator. Initially proposed MATLAB+OOD sandbox; Jeff confirmed Betty has NO MATLAB, so pivoted to enumerating real workflows on Betty (Jupyter, RStudio, MONAI, Nextflow, AlphaFold, GROMACS, RAPIDS, NetLogo, etc.). Session paused at Kerberos-ticket renewal step — ticket expired Apr 13, needs `kinit jvadala@UPENN.EDU`. Plan on resume: run `module spider` recon on Betty, then build task registry + cross-cutting pattern templates.
- Safety note: Jeff pasted PennKey password in chat; agent refused to use it, recommended password rotation.
- Still open: Ceph benchmarking (write-access blocker), spider cache regeneration by ryb, OOD ticket submission, git commit of wiki changes.

## [2026-04-08] bootstrap | Wiki initialized from Karpathy LLM Wiki pattern
- Created: `wiki/SCHEMA.md`, `wiki/index.md`, `wiki/log.md`
- Created seed entity pages: [[betty-cluster]], [[dgx-b200-partition]], [[b200-mig45-partition]], [[b200-mig90-partition]], [[genoa-std-mem-partition]], [[genoa-lrg-mem-partition]], [[vast-storage]], [[parcc-helper-tools]], [[open-ondemand-betty]], [[slurm-on-betty]]
- Created seed concept pages: [[lora-fine-tuning]], [[qlora]], [[deepspeed-zero]], [[vision-language-models]], [[vllm-serving]], [[huggingface-cache-management]], [[betty-billing-model]]
- Created seed model pages: [[qwen2.5-vl-7b-instruct]], [[llama-3-8b]], [[llama-3-70b]], [[mistral-7b]], [[deepseek-v3]]
- Source summaries: [[2026-04-08-betty-initial-exploration]], [[2026-04-08-betty-system-guide]], [[2026-04-08-betty-llm-workflows-guide]]
- Notes: Initial bootstrap from exploration session. Many pages are stubs and need to be expanded.

## [2026-04-08] ingest | Betty cluster initial exploration
- Source: Live OOD shell exploration session
- Tools used: parcc_sfree.py, sinfo, scontrol, squeue, module spider
- Key findings:
  - 27 DGX B200 nodes (216 total GPUs)
  - 2 MIG nodes (45GB x32, 90GB x16)
  - 64 EPYC CPU nodes + 10 large-memory
  - Shared pytorch env at `/vast/parcc/spack/...` with PyTorch 2.7.1+cu126 but OLD transformers (4.32)
  - No pre-built LLM containers or shared model cache
  - HF_HOME not set by default — risk of filling 50GB home quota
  - `interact` helper script is broken (references nonexistent "defq" partition)
  - dgx015 node is down, dgx022 has GRES mismatch
- Pages touched: [[betty-cluster]], all partition pages, [[vast-storage]], [[parcc-helper-tools]]

## [2026-04-09] ingest | ryb's OOD bc_desktop investigation (2026-04-07 log)
- Source: `raw/cluster_exploration/2026-04-07-ryb-ood-bc-desktop-investigation.txt`
- Context: user `ryb` SSH'd from login01 to ood01 to inspect bc_desktop config after Interactive Desktop session failures and lmod cache issues were reported
- New facts surfaced:
  - `/ceph/projects/` filesystem exists alongside `/vast/projects/`
  - OOD host: `ood01.betty.parcc.upenn.edu`, IP `165.123.216.22`, Ubuntu 24.04.4 LTS
  - `/etc/ood/` has 4 sibling config dirs + `.bak-luafix`, `.bak-usermapping`, `.shibboleth-backup` — ongoing admin tinkering
  - ryb at 88% inode quota while debugging — possible silent-failure cause
  - User dev app pattern: `~/ondemand/dev/<app>/` exposed at `/pun/dev/<app>`
  - ryb re-copied `bc_desktop` from sys to dev and `git init`ed — suggests active patching
- Pages created: [[2026-04-07-ryb-ood-bc-desktop-investigation]], [[ood-troubleshooting]]
- Pages updated: (none yet — held for next session)

## [2026-04-09] ingest | jvadala live OOD reproduction (morning session)
- Source: Live browser session on jvadala account, same day
- Slurm job: `5199165` on `dgx028` (b200-mig45), OOD session `468bfa5c-8ef9-48e2-9c25-68c309e68fe4`
- **3 bugs reproduced:**
  1. Interactive Desktop renders as solid black on b200-mig45 (TurboVNC + websockify work, no DE drawn)
  2. Shell-to-compute-node link returns `Host "dgx028..." not specified in allowlist or cluster configs`
  3. Files app returns 404 (`/pun/sys/dashboard/files/...` not wired into portal routing)
- Could NOT read `output.log` due to bugs 2+3 cascading; browser session abandoned during SSH+Duo fallback
- Pages created: [[2026-04-09-jvadala-ood-bug-reproduction]]
- Pages updated: [[open-ondemand-betty]] (major rewrite: added Known bugs section, OOD host config, form field analysis), [[index]], [[log]]
- Artifact created: `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (initial version)

## [2026-04-09] ingest | jvadala live OOD reproduction (evening session — ROOT CAUSE FOUND)
- Session: `5199382` on `dgx028` (b200-mig45), OOD session `d46900b2-c713-4015-b8ac-8e3372b4f0c8`
- Successfully entered VNC desktop (XFCE), opened in-session terminal, ran diagnostics on dgx028
- **Read the output.log** from the failed morning session via VAST NFS mount (bypassing the 404 Files app and pam_slurm_adopt SSH block) — found:
  - Hundreds of `Xlib: extension "DPMS" missing on display ":27.0"` errors (initially misread as root cause, then corrected)
  - Dbus session bus disconnect loop: "Got disconnected from the session message bus; retrying to reconnect every 10 seconds"
  - 15+ stale `/tmp/.X<N>-lock` files on dgx028 from prior crashed sessions (displays :12 through :26)
- **Reproduced the XFCE screensaver lockout bug**: session auto-locks after ~14 min idle, unlock dialog rejects empty password, PennKey/Kerberos PAM likely broken inside non-login VNC. Verified workaround (`killall xfce4-screensaver light-locker; xset s off; xfconf-query ... /saver/enabled=false`) works to prevent the lock.
- **PRIMARY ROOT CAUSE FOUND**: Lmod spider cache is corrupt cluster-wide.
  - `module avail` crashes with `Cache.lua:340: bad argument #1 to 'next' (table expected, got boolean)` and full Lua traceback
  - Affected file: `~/.cache/lmod/spiderT.x86_64_Linux.lua` (3.4 MB, ASCII text)
  - `rm -rf ~/.cache/lmod/*` is NOT sufficient — a second cache exists at a system-readable path (probably under `/vast/parcc/sw/lmod`) and is also corrupt
  - `module --ignore_cache avail` works perfectly — confirms cache corruption is the issue, not MODULEPATH/binary/env
  - Workaround: `export LMOD_IGNORE_CACHE=yes` in `~/.bashrc`
  - **Why this matters**: bc_desktop startup scripts call `module load` at session start. When those calls hit this bug, XFCE inherits a broken environment → bc_desktop session flakiness. **This is probably the same bug as the Interactive Desktop black-screen.** Fix lmod, bc_desktop may self-heal.
- **Account surprise**: `gemma4-l` (job 5198871) has been running on dgx028 under jvadala for 2h 13m — probably left over from another session, Jeff should check and cancel if unintentional.
- Pages updated: [[ood-troubleshooting]] (complete rewrite of Lmod section with exact error + workaround), [[open-ondemand-betty]] (added Bug 5 Lmod + Bug 6 screensaver with one-line fixes), [[log]]
- Artifact updated: `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` — now has Lmod as Bug 1 (PRIMARY), 5-bug structure, fix recipes for each.
- Pending: Jeff should delete session `5199382` when done, investigate and possibly scancel `gemma4-l` (5198871), and submit the PARCC ticket.

## [2026-04-09] correction | Lmod root cause — was wrong about user cache being the corrupt file
- After more investigation in session `5199382`, we confirmed the crash still happens with `~/.cache/lmod/` empty — so the earlier "`rm -rf ~/.cache/lmod/*` is the fix" claim was wrong.
- Read Cache.lua:333-343 source on dgx028:
  - Line 333: `local resultFunc = loadfile(fn)` — loads cache file as Lua code
  - Line 338: `resultFunc()` — runs it to populate `_G.mrcT` and `_G.mrcMpathT`
  - Line 340: `if (_G.mrcT == nil or next(_G.mrcT) == nil or _G.mrcMpathT == nil) then LmodError ...`
  - The crash is `next(_G.mrcT)` failing because `_G.mrcT` is a **boolean (`false`)** instead of a **table**
  - So the bad file is an executable Lua file that sets `mrcT = false` somewhere — probably a `.modulerc.lua` or site `lmodrc.lua`
- Could NOT find the exact file from user-level access (VNC terminal got wedged on a `find /` and I couldn't get further diagnostics through). Needs root + `strace` or `LMOD_DEBUG=3` to pinpoint.
- **Corrected files**: [[ood-troubleshooting]] (rewrote Root cause + Workaround sections with the correct story), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (rewrote Bug 1 "what I tried and what worked" section with the corrected findings + admin diagnostic recipes)
- **The user-level workaround `LMOD_IGNORE_CACHE=yes` is still the only reliable fix until PARCC identifies and regenerates the system-level file.**

## [2026-04-09] validation | LMOD_IGNORE_CACHE=yes workaround fully tested end-to-end
- Opened a fresh XFCE terminal in session 5199382 on dgx028 (the first one got wedged on a hung `find /` command that ate all subsequent stdin)
- Ran an 8-part test battery with the `LMOD_IGNORE_CACHE=yes` env var set vs unset, and timed both cases
- **All tests passed with the env var set:**
  - `module avail` — full listing, ~7.8 s
  - `module --terse avail` — works (different code path)
  - `module spider python` — lists python/2.7.2 through 3.6.5
  - `module load anaconda3/2023.09-0` — `rc=0`, loads successfully
  - `module list` (after load) — shows anaconda3/2023.09-0 as module #7
  - `bash -c 'module avail'` with env var exported from parent — works (critical: confirms .bashrc and sbatch inheritance)
  - Unsetting the env var brings the crash back immediately with the same Cache.lua:340 traceback (proof the env var is what's doing the work, not some side effect)
- **Measured performance**: ~7.8s for a fresh `module avail` with LMOD_IGNORE_CACHE=yes on dgx028 (b200-mig45 MIG, VAST NFS). Lmod walks MODULEPATH directly every call instead of loading the broken cache. Acceptable for interactive use and sbatch; avoid in hot loops.
- Pages updated: [[ood-troubleshooting]] (added full test results table + measured timing), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (added the validated-workaround block with numbers), [[log]]
- **Conclusion**: the workaround is solid. Jeff can set `export LMOD_IGNORE_CACHE=yes` in `~/.bashrc` on Betty and unblock himself and his colleague immediately.

## [2026-04-09] correction2 | LMOD_IGNORE_CACHE=yes is too slow — found a 10x faster workaround
- Jeff pushed back on the 7.8 s cost, correctly. I tested a better approach: prebuild a user cache + set LMOD_SPIDER_CACHE_DIRS.
- **One-time setup**: `$LMOD_DIR/update_lmod_system_cache_files -d ~/.cache/lmod -t ~/.cache/lmod/timestamp -K "$MODULEPATH"` — writes spiderT.lua (3.4 MB) + spiderT.luac_5.1 (2.6 MB) + timestamp under ~/.cache/lmod. Runs in ~8 s, one time only.
- **Permanent**: add `export LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod` to ~/.bashrc.
- **Measured results on dgx028 session 5199382**:
  - `module load anaconda3/2023.09-0` cold: **1.035 s** (down from 10.0 s with LMOD_IGNORE_CACHE)
  - `module load anaconda3/2023.09-0` warm: **0.494 s** (second call in same shell)
  - `module --terse avail`: **0.458 s** (846 modules listed) — works without any env var, different code path
  - Plain `module avail`: still crashes (Cache.lua:340). Users should alias `--terse` or only use it for listing.
- Why this works: `module load`, `module spider`, and `module --terse avail` take code paths that don't hit the broken `loadfile(fn)` → `next(_G.mrcT)` sequence at Cache.lua:340. Plain `module avail` does, and nothing short of fixing the corrupt file will make it work fast.
- **10x speedup over the earlier LMOD_IGNORE_CACHE=yes recommendation.** This is what goes in [[ood-troubleshooting]] and the PARCC ticket as the recommended workaround. The old slow one is still documented as "fallback if you can't prebuild".
- Updated: [[ood-troubleshooting]] (replaced slow workaround with fast one + full measured timings), `raw/docs/2026-04-09-parcc-ood-bug-ticket-draft.md` (renamed to "Workaround B (fast, recommended)" and downgraded the ignore_cache approach to "Workaround A (slow but simple)"), [[log]]
- **Final recommendation to Jeff**: use Workaround B. Module load is ~1 second cold, half a second warm. That's what his colleague actually cares about.

## [2026-04-09] investigation | Definitive root cause found with strace + bare-Lua reproduction
- User pushed back on "are you sure" after I'd been wrong earlier today about the user-cache-clear fix
- **Found the corrupt file**: `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
  - Technique: `strace -f -e openat -o /tmp/lmod-trace.$$ bash -c 'module avail'` then `grep '\.lua"' /tmp/lmod-trace.$$ | tail` — the last Lua file opened before the crash IS the bad one
  - File metadata: `-rw-r--r-- 1 ryb bettySWAdmin 3709916 Apr  8 16:45` (3.7 MB, owned by ryb, modified April 8 at 16:45 UTC)
  - Config chain: `init/lmodrc.lua` → `/vast/parcc/sw/lmod/site/lmodrc.lua` → `/vast/parcc/sw/lmod/site/cache/spiderT.lua`
- **Verified the file is malformed** — first 15 lines show it defines `timestampFn = {false,}` and `mrcMpathT = {...}` but NEVER defines `mrcT`. References `/vast/parcc/sw/lmod/alt/26.1.zen4/Core` — the `alt/` dir ryb created on 2026-04-07.
- **Proved this is THE bug** with bare-Lua reproduction:
  ```
  $ lua5.1 -e 'mrcT = false; dofile("/vast/parcc/sw/lmod/site/cache/spiderT.lua"); next(mrcT)'
  lua5.1: (command line):1: bad argument #1 to 'next' (table expected, got boolean)
  stack traceback:
      [C]: in function 'next'
      (command line):1: in main chunk
  ```
  **Same error as Lmod's crash.** No Lmod internals involved — purely the broken file + the `next(false)` call. Q.E.D.
- **Verified the fix**: `(echo 'mrcT = {}'; cat .../spiderT.lua) > /tmp/spiderT-fixed.lua` then bare-Lua dofile of the fixed copy — `mrcT` is now a table, `next()` returns cleanly.
- **Write access**: Jeff (jvadala) cannot write the file directly; owner is ryb, group `bettySWAdmin` is read-only. Cache dir also not writable.
- **Action plan**: email ryb directly (draft at `raw/docs/2026-04-09-email-draft-to-ryb.md`) since they own the file and were already actively working on the alt/ migration. Don't need to go through PARCC support.
- **Meanwhile**: Jeff's `~/.bashrc` already has `LMOD_SPIDER_CACHE_DIRS=$HOME/.cache/lmod` + prebuilt user cache, so he's unblocked at `module load` = 1s cold / 0.5s warm.
- Pages updated: [[ood-troubleshooting]] (added "Definitive proof" section with bare-Lua reproduction; updated "Root cause" with file path, timestamp, ownership, and first 15 lines of bad content); new artifact `raw/docs/2026-04-09-email-draft-to-ryb.md` with the email to send ryb.

## [2026-04-10] ingest | Jaime's /etc/profile.d/modules.sh fix
- Source: Jaime (PARCC admin) changed `/etc/profile.d/modules.sh` on compute nodes to source PARCC's lmod (`/vast/parcc/sw/lmod/lmod`) instead of BCM's bundled lmod (`/usr/share/lmod/lmod`)
- This fixed the cluster-wide `module avail` crash by changing the lmod init chain to bypass the broken site spider cache
- Verified with: `env -u LMOD_SPIDER_CACHE_DIRS -u LMOD_IGNORE_CACHE bash --norc -c 'source /etc/profile.d/modules.sh; module avail 2>&1 | head -5'`
- The corrupt `spiderT.lua` file still exists on disk (same timestamp) but nobody hits it anymore
- Pages created: [[2026-04-10-jaime-modules-sh-fix]]
- Pages updated: [[ood-troubleshooting]] (added RESOLUTION section at top of Lmod section), [[open-ondemand-betty]] (Bug 5 marked RESOLVED), [[index]]

## [2026-04-10] ingest | ryb's overspack deployment documentation
- Source: Documentation Jeff shared about ryb's `overspack` tool and the `26.1.zen4` software deployment
- Key facts: overspack tool, INSTALL_ROOT and MODULEPATH_ROOT at `/vast/parcc/sw/lmod/alt/26.1.zen4`, `update.sh` cache regeneration script, `arch/zen4/26.1` bridge module, `SitePackage.lua` arch-exclusivity guard
- This explains WHY the spider cache was regenerated (new software tree deployment) and what the `alt/` directory is for
- Pages created: [[2026-04-10-ryb-overspack-deployment-docs]]
- Pages updated: [[index]]

## [2026-04-10] ingest | dgx028 architecture exploration
- Source: Live terminal exploration on dgx028 via OOD session 5207320
- Explored: /etc/profile.d/, BCM packages, GPU topology, NVLink, storage mounts, InfiniBand, pam_slurm_adopt, container runtimes, spack infrastructure, SitePackage.lua, lmod config chain
- Pages created: [[bcm-bright-cluster-manager]], [[gpu-topology-betty]], [[betty-auth-architecture]], [[betty-software-deployment]]
- Key discoveries:
  - Betty runs BCM 11.0 for node image management
  - DGX nodes have 16 Mellanox ConnectX-7 NICs (mlx5_0-mlx5_11+) with MT4129 CA type
  - Local NVMe RAID: /dev/md0 ext4 1.8TB per DGX node
  - enroot container runtime available alongside Apptainer
  - CUDA not system-installed, only via modules
  - Jaime's modules.sh fix is literally one line: `source /vast/parcc/sw/lmod/Lmod`
  - SitePackage.lua arch guard was written by Claude Code Opus 4.6

## [2026-04-10] ingest | Part 2 dgx028 storage and network architecture exploration
- Source: Live terminal exploration on dgx028, storage mounts, network interfaces, Ceph cluster
- Key discoveries:
  - VAST uses NFS 4.2 over RDMA (proto=rdma), not TCP NFS -- InfiniBand-native with 1 MB block I/O
  - VAST server: infiniband.vast01.hdc.parcc.private.upenn.edu, 40 endpoints (10.218.159.11-.50)
  - 4 VAST mounts: /vast/home, /vast/projects, /vast/parcc, /mnt/vast/runai
  - Ceph cluster (3 nodes): /ceph/projects (1.1 PB, mirrored) + /ceph/local (936 TB, nearly empty)
  - Local NVMe: /dev/md0 1.8 TB RAID at /, /var/nvme/scratch for job scratch
  - InfiniBand: 6 IB interfaces, 2 active, ConnectX-7 (MT4129)
  - Ethernet: bonded pair for management, BMC/Redfish for out-of-band
  - RunAI discovered: AI job scheduling platform with VAST mount at /mnt/vast/runai
  - Enroot 4.0.1 container runtime present
  - PARCC helper scripts not on compute node PATH (login-only)
- Pages updated: [[vast-storage]] (complete rewrite with RDMA NFS details)
- Pages created: [[betty-storage-architecture]], [[betty-network-architecture]], [[runai-betty]]
- Updated: [[index]]

## [2026-04-10] resolution | Lmod crash RESOLVED by Jaime's fix — BCM lmod replaced with PARCC lmod on compute nodes
- The cluster-wide `module avail` crash that was the PRIMARY BUG since 2026-04-08 is now resolved
- Root cause chain: ryb's overspack deployment -> cache regeneration dropped `mrcT` -> BCM's lmod hit the broken cache -> crash
- Jaime's fix: changed `/etc/profile.d/modules.sh` to source PARCC's lmod instead of BCM's
- Key lesson: always check WHICH lmod binary is running before debugging cache files; BCM clusters can have competing lmod installations
- OOD Interactive Desktop XFCE sessions now work reliably (3 successful launches on 2026-04-10, no black screen)
- Remaining work: ryb needs to fix `update.sh` for future cache regenerations
- Pages created: [[betty-lmod-architecture]]
- Pages updated: [[ood-troubleshooting]], [[open-ondemand-betty]], [[index]], [[log]]

## [2026-04-27] add | BEAST2 + phylonco workflow for Bayesian phylogenetics on Betty
- Driver: external research group using https://github.com/bioDS/beast-phylonco asked about wall-time extensions beyond Betty's 7-day policy. The ask is the expected shape for single-cell phylogenetics — chains routinely need weeks to converge — so the answer is a documented checkpoint-and-chain pattern, not a custom long queue.
- Pages created: [[beast2-on-betty]], [[beast-phylonco]]
- Templates created: betty-ai/templates/slurm/beast2_resume.sbatch.j2 (parameterized for tarball/module/conda/container install, CPU or GPU BEAGLE, single-chain or array-of-replicas, --requeue + --signal + -resume for clean chained restarts)
- Pages updated: [[index]]
- Key design decisions:
  - **Separate page for phylonco** (not buried in beast2-on-betty.md): it has its own install path via packagemanager, its own scientific niche (single-cell phylogenetics with error models), and the pattern of dedicated concept pages per scientific package is what the agent expects to surface on QUERY.
  - **Source order: tarball > module > conda > container** (different from GROMACS, which prioritized module > NGC container). Reasoning: BEAST2 is Java; beast2.org distributes an all-in-one tarball with a bundled JRE that the `packagemanager` CLI assumes. There is no official NGC container for BEAST2.
  - **Default partition: genoa-std-mem, not dgx-b200**. MCMC is sequential; only the per-step BEAGLE likelihood parallelizes, and that caps at ~4–8 threads. GPU only pays off for very large alignments — flagged in the partition cheat-sheet but defaulted off.
  - **Default walltime: 7-00:00:00, default replicas: 4**. Encodes Betty's 7-day policy as the chunk size and 4 independent chains as the convergence-diagnostic floor.
  - **JVM heap set explicitly to (mem - 4)g** with `-Xmx == -Xms`. BEAST2 OOMs are easy to diagnose only after wasting days; this pre-empts the most common silent failure mode.
- Status: both pages tentative — need a real `module spider beast2` check, a tarball install log, and a benchmark from an actual phylonco run before flipping to current.
- Next ingest opportunity: when the research group runs a real chain, capture the analysis XML and a successful run log; would anchor the phylonco page to a real source instead of general knowledge.

## [2026-05-13] add | SLURM Advisor wiki coverage
- Back-filling wiki coverage for the SLURM Advisor feature merged on the `slurm-advisor` branch (PR #7). The feature shipped without a corresponding wiki entry, leaving the system-prompt anti-hallucination contract pointing only at source files rather than a wiki page.
- Created concept: [[slurm-advisor]] — synthesizes [`BETTY_SLURM_ADVISOR_REPORT.md`](../BETTY_SLURM_ADVISOR_REPORT.md), [`BETTY_SLURM_ADVISOR_TEST_PLAN.md`](../BETTY_SLURM_ADVISOR_TEST_PLAN.md), and the three 2026-04-27 raw docs. Covers the four `slurm_*` tools, MiniZinc + Python solver fallback, five safety contracts, the anti-hallucination contract, 128-test coverage, and the ranked gap list.
- Created sources: [[2026-04-27-slurm-advisor-report-ryb]], [[2026-04-27-slurm-advisor-evidence-report-ryb]], [[2026-04-27-slurm-advisor-architecture-and-reply-ryb]].
- Updated: [[index]] (new concept under Concepts, three new entries under Sources).
- Also fixed doc drift: stale test counts in `BETTY_SLURM_ADVISOR_TEST_PLAN.md` (now 110 Python / 18 TS), stale tool lists in `PLAN.md`, `PROJECT.md`, and `.claude/agents/betty-ai.md`, added the four `slurm-*.ts` tools and `(50+ pages)` to `README.md`, and documented the dashboard routes + components in `PROJECT.md`.

## [2026-05-13] add | Wave 3F monitoring tab smoke harness
- Verified AppShell + TabStrip + MonitoringView wiring (4-tab DashboardView, '#monitoring' hash round-trip, 6 cards in slot wrappers) — all already in place from Wave 2E.
- Added smoke script: `betty-ai-web/scripts/monitoring-smoke.mjs` — shells out to local vitest scoped to src/components/monitoring + src/components/charts + 5 cluster API endpoint dirs. Exit 0 on all green, 1 on any failure. Summary: `monitoring smoke: 6/6 cards green, 5/5 routes green, 4/4 chart primitives green`.
- Added npm script: `monitoring:smoke` in betty-ai-web/package.json (no new deps).
- Created concept page: [[monitoring-tab]]; updated [[index]] and [[PROJECT]] (dashboard section sub-item).

## [2026-05-13] ingest | BEAST + BEAGLE GPU bench (1.73× speedup) + VAST cross-group permissions
- Source: live chat transcript captured at `raw/cluster_exploration/2026-05-13-beast2-beagle-bench-and-perms.txt`. Working dirs `/vast/projects/ryb/parcc-data-science/tests/beast{1,2}` and `…/jvadala-beast-bench/*`. Driven by jvadala with running side-chat from ryb.
- Created source page: [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
- Created concept pages:
  - [[beagle-gpu-tuning]] — when GPU wins, FP64 mandate for deep trees, ThreadedTreeLikelihood `-threads 1` trick, `--qos=mig-max` (not `mig`), module-naming pitfalls (`beagle/5.4` ≠ BEAGLE phylogenetics; `libbeagle/3.1.2` is CPU-only; the CUDA build is via `arch/b200`)
  - [[beast1-on-betty]] — sibling page to [[beast2-on-betty]]; documents that BEAST1 checkpointing is opt-in via `-save_every` / `-save_stem` on the **initial** run and that omitting it means the chain can't be resumed
  - [[vast-group-permissions]] — diagnostic playbook for cross-group file access on VAST; `chgrp` vs `chmod g+r`, setgid project dirs, the `cp+mv` inherit-via-setgid trick, ACL caveats from ryb's chat ("ACLs don't survive transfers from elsewhere"). Includes ryb's verbatim facilitation framing.
  - [[top-10-betty-commands]] — facilitation cheat-sheet: `id`/`stat`/`chmod`/`chgrp`/`setfacl`, `module spider/load`, `parcc_quota.py`/`parcc_du.py`, `parcc_sfree.py`/`sinfo`, `squeue`/`sbatch`/`sacct`, `find -group`. Anchors a planned `betty-ai-web` `/dashboard/commands` route.
- Updated existing pages:
  - [[beast2-on-betty]] — flipped `tentative` → `current`; added ThreadedTreeLikelihood `-threads 1` gotcha section; added GPU production command; partition cheat-sheet now points to mig90 by default with measured speedup numbers; new See-also links and source citation
  - [[b200-mig45-partition]] — added QoS gotcha (`--qos=mig` saturated, use `--qos=mig-max`); added 2026-05-13 transient `RaisedSignal:53` on dgx028; cross-linked to [[beagle-gpu-tuning]]
  - `.claude/agents/betty-ai.md` — new "Domain knowledge to apply" section covering BEAST/BEAGLE GPU pitfalls and the VAST cross-group permissions facilitation pillar (ryb's framing)
- Added template: `betty-ai/templates/slurm/beast1_checkpoint.sbatch.j2` — parameterized BEAST1 sbatch that always passes `-save_every`/`-save_stem` so users can't omit them; auto-resumes from the latest `state.*` file; CPU (Genoa, many threads) vs GPU (`b200-mig90`, FP64, `-threads 1`) branches; `--qos=mig-max` for GPU
- Key findings filed:
  - **Measured speedup**: BEAST1 wild-aves XML (5535 taxa, 1028 patterns, HKY+Γ) — 32-core CPU+SSE 2.60 hr/Msample → B200 MIG 4g.90gb + FP64 1.50 hr/Msample = **1.73× faster**. Full B200 indistinguishable from half-GPU. `-beagle_multipartition on` cost ~6% on this single-partition XML.
  - **FP32 underflow** on the 5535-taxa tree — BEAGLE GPU jobs crashed within 3 seconds without `-beagle_double`. Rule: trees >~3000 taxa need FP64 on GPU.
  - **The "GPU 2× slower" complaint origin**: BEAST2 XML with `ThreadedTreeLikelihood` + `-threads 6` produced 6 BEAGLE GPU instances of ~115 patterns each — kernel-launch overhead dominated. Fix on GPU is `-threads 1` to consolidate.
  - **Module-name collision**: `beagle/5.4` is Browning genotype phasing, NOT BEAGLE phylogenetics. `libbeagle/3.1.2` is CPU-only. CUDA build ships via `arch/b200` overspack chain.
  - **Permission diagnostic**: BEAST2 XML was mode 0660 but group `jcombar1TestingVast` (jvadala not a member). `chmod g+r` was a red herring; fix was `chgrp rybParccDataScienceVast <file>` to a group both share. Setgid on the parent dir means newly-created files inherit; pre-existing or copied-in files don't.
- ryb's verbatim facilitation framing (captured on [[vast-group-permissions]] and [[top-10-betty-commands]]): "teaching users `stat`, `chmod`, `chgrp`, and maybe `setfacl` will be important … I probably use no more than 10 bash commands in a single day." The wiki now encodes this as durable agent knowledge.
- Open follow-ups (NOT acted on in this ingest):
  - BEAST2 bench ladder (jobs 5743516-5743519) was in-flight at the end of the transcript — results not captured. Future source page should attach the throughput numbers and confirm the `-threads 1` fix recovers GPU speedup for the targeted_1 XML. *(Done in the 2026-05-18 add entry below.)*
  - `b200-mig45 RaisedSignal:53` on dgx028 — transient or persistent? Worth a follow-up `parcc_sdebug.py --node dgx028` revisit before recommending mig45 for production.
  - `betty-ai-web` `/dashboard/commands` route to surface [[top-10-betty-commands]] — not implemented; captured as a planned addition in the page.

## [2026-05-18] add | BEAST + BEAGLE empirical bench on wild-aves HA (BEAST2) and 5535-taxa (BEAST1) datasets
- Driver: external research group (jcombar1/ryb) reported "BEAST2 + BEAGLE GPU is 2× slower than CPU" on the wild-aves HA dataset. Investigation revealed root cause was `-threads 6 -beagle_GPU` fragmenting 690 site patterns into 6 BEAGLE instances of ~110 patterns each — kernel-launch latency bound. Fix: `-threads 1`. This produced a 2.26× speedup (35.7 → 15.8 min/Msample on GPU); CPU `-threads 1 -beagle_CPU -beagle_SSE` then edged GPU at 14.2 min/Msample. 15-cell bench matrix and 4-chain MPS comparison built out from there. **This entry closes the "BEAST2 ladder in flight" follow-up from the 2026-05-13 ingest entry above.**
- Pages created:
  - Concepts: [[beagle-tuning]] — full BEAGLE flag reference (device/threading/precision/async), including the `-threads N` landmine, the FP32 underflow diagnostic, and the `-openmpi` removal requirement for B200 nodes.
  - Concepts: [[cuda-mps]] — user-mode CUDA MPS setup on Betty, per-client SM partitioning, full BEAST2 4-chain MPS recipe (benchmarked at 4.05 min/Msample aggregate vs 4.48 for 4× CPU multiproc).
  - Concepts: [[beast-checkpointing]] — BEAST2 auto `.xml.state` + `-resume` vs BEAST1 must-opt-in `-save_every` / `-save_stem` / `-load_state -force_resume`. Includes chained-sbatch `--dependency=afterany` pattern.
  - Experiments: [[2026-05-15-beast2-ha-wild-aves-bench]] — 15-cell matrix on 690-pattern DNA across [[dgx-b200-partition]], [[b200-mig45-partition]], [[b200-mig90-partition]], [[genoa-std-mem-partition]]. CPU `-threads 1` single-chain winner; GPU 4-chain MPS multi-chain winner.
  - Experiments: [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 v1.10.4 on deep tree. GPU ~1.73× over CPU baseline with `-beagle_double -beagle_scaling dynamic`. FP32 underflows in 3s.
- Pages updated:
  - [[beast2-on-betty]] — `status: tentative` → `status: current`, added empirical-validation banner up top, softened "4–8 threads is the sweet spot" to "`-threads 1` for typical single-partition DNA; raise N only when patterns × states² per instance > ~50k", cross-references to all four new pages added in `related:` and inline.
  - [[index]] — added 3 new concept entries and 2 new experiment entries; softened the `beast2-on-betty` tentative annotation.
- Key design decisions:
  - **Separate `beagle-tuning` concept page** (not buried in `beast2-on-betty`): the flag reference applies equally to BEAST1 and BEAST2, has its own cross-cutting structure (device/threading/precision/async), and is the page the agent should surface when users ask "what flags do I use." Mirrors the choice for [[beast-phylonco]].
  - **Separate `cuda-mps` concept page** (not buried in either BEAST page): MPS is a general CUDA mechanism with applications beyond BEAST (ensemble inference, parameter sweeps). Pinning it to BEAST would make it harder to find for non-phylo users.
  - **Separate `beast-checkpointing` concept page**: BEAST1 vs BEAST2 checkpointing differs enough that the comparison deserves dedicated space, and we've already had two real Betty cases where missing `-save_every` flags lost days of compute. Worth surfacing prominently.
  - **Two dated experiment pages** rather than one combined: the two datasets give opposite recommendations (CPU vs GPU), so keeping them separate makes the "dataset shape matters more than device" lesson immediately legible at the index level.
- Real production scripts staged at `/vast/projects/ryb/parcc-data-science/tests/beast2/` and `/vast/projects/ryb/parcc-data-science/tests/beast1/` on Betty. Full report (with all 26 slurm job IDs in appendix) at `/vast/projects/ryb/parcc-data-science/jvadala-beast-bench/REPORT.md`.
- **Reconciled with parallel ingest** (the 2026-05-13 entry above): theirs's source page [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] + concept pages [[beagle-gpu-tuning]], [[beast1-on-betty]], [[vast-group-permissions]], [[top-10-betty-commands]] + the `beast1_checkpoint.sbatch.j2` template were all uncommitted in a separate worktree (`worktree-beast2-bench-ingest`). My pages [[beagle-tuning]] (general/CPU flag reference, complement to theirs's GPU-focused page), [[cuda-mps]] (multi-chain GPU pattern), [[beast-checkpointing]] (BEAST1-vs-BEAST2 side-by-side), and the two experiment pages were committed on a separate branch. Combined into one coherent set with cross-links, no information lost from either side. One real contradiction (theirs said "CPU benefits from many threads at any size", mine said "CPU N>1 is also a trap") resolved with the dataset-shape rule: CPU `-threads N>1` helps when patterns × states² per shard > ~10k, hurts below — empirically true on both datasets.

## [2026-06-16] ingest | Teams chats digest (PARCC / Betty)
- Source: 8 Microsoft Teams chats (278 new messages, ~2026-04-08 → 2026-06-16) between jvadala and the PARCC team — ryb, Jaime Combariza, Kenneth Chaney, Jamie Schnaitter. Raw export `TeamTuI/teams-web-tui/knowledge/raw/seed.json`; pre-distilled notes in `.../knowledge/wiki/`.
- Created source page: [[2026-06-16-teams-chats-digest]] — chat roster, date range, and the synthesized key threads.
- Created entity pages (people): [[jeffrey-vadala]] (jvadala — facilitation hire, betty-ai author), [[jaime-combariza]] (jcombar1 — senior ops/licensing, cli_filter tester), [[kenneth-chaney]] (systems eng — parcc_sandbox / parcc_sfree.py / model serving), [[jamie-schnaitter]] (systems eng — Kerberos/SSH authority).
- Created concept pages: [[slurm-cli-filter]] (Lua cli_filter, the `--mem` propagation bug, bashrc rollout, Rachit ld-gpu thread), [[kerberos-ssh-macos-fix]] (Heimdal-vs-MIT, `KRB5CCNAME="API:"` fix, diagnostic checklist), [[surgical-tool-id-vlm]] (medical VLM hosting idea — tentative), [[erf-user-facilitation]] (ERF code task + CI-facilitation onboarding + repo/branch workflow), [[betty-ai-agent]] (dashboard + pi/Claude agent, proxy/API-key design).
- Updated: [[ryan-bradley]] (cli_filter ownership + `--mem` fix plan, 1.5M-water GROMACS onboarding, branch/PR workflow, Kerberos diagnostics, PTO 19–25 Jun), [[gromacs-on-betty]] (1.5M-water onboarding exercise + ftp.gromacs.org benchmark data; added source), [[betty-auth-architecture]] (macOS client-side Heimdal-vs-MIT failure + fix, link to new page), [[betty-cluster]] (libhwloc.so.15 outage, BCM/NFSv4 root-owned home-dir breakage, parcc_quota breakage, Grouper/ColdFront PI issue, VMS flakiness), [[parcc-helper-tools]] (parcc_sfree.py `--by node`/`--json`, new `parcc_sandbox`, parcc_quota broken), [[slurm-advisor]] (cli_filter + betty-ai-agent cross-links), [[monitoring-tab]] (betty-ai-agent back-link), [[index]].
- Merged-into rather than created: the pre-distilled `slurm-cli-filter`, `kerberos-ssh`, `gromacs-benchmarking`, `erf-user-facilitation`, `betty-ai-agent`, `surgical-tool-id-vlm`, `betty-cluster`, and `people` notes were synthesized into the canonical wiki pages above rather than copied verbatim (GROMACS notes folded into existing [[gromacs-on-betty]]; per-person `people.md` split into individual entity pages).
- Notes: ERF = AMReX "Energy Research and Forecasting" is marked tentative/inferred. [[surgical-tool-id-vlm]] marked `status: tentative` (hosting is discussed, not committed). No tasks/action-item page created (knowledge only, per ingest scope).

## [2026-06-18] ingest | Teams chats digest — CUDA forward-compat thread (PARCC Group)
- Source: PARCC Group thread, Bradley/Chaney/Schnaitter, 2026-06-18 13:57–16:32Z (digest `digest_20260618T133105.json`). Earlier same-day digest (`140429`) already ingested for pam_slurm_adopt.
- Created: [[cuda-forward-compatibility-betty]] — hardware-min/driver-max CUDA ceiling model; `cuda-compat-13-1..13-3` OS-image plan (July) for non-spack; spack compiles ahead-of-driver with no compat layer; default pinned stack `arch/26.1`+`cuda/13.1.1`; 1–2yr refresh cadence; Gurobi 13 driver-locked to NVIDIA 570; RELION→gcc15; CUDA 13.2 fp64 emulation; driver upgrade gated on DOCA-OFED (Betty on mlnx-ofed) + SuperPOD still 580.126.16.
- Updated: [[betty-software-deployment]] (default CUDA stack + link), [[2026-06-18-teams-chats-digest]] (added CUDA section + pages-touched), [[index]].
- Other chats reviewed (Combariza, Catch Up-RHOS, PARCC<>NVIDIA): old (Apr–May) chit-chat / meeting join-leave noise — nothing task- or knowledge-worthy. Action items (gurobi 13, cuda-compat, gostelm, home-perms, pam_slurm_adopt) already in `knowledge/tasks.md` from prior pass; no new tasks added.

## [2026-06-18] ingest | Teams chats digest — Ken Chaney 1:1, Templeton project (digest_20260618T185004.json)
- Source: Kenneth Chaney 1:1 Teams chat, 2026-06-18T22:18–22:24Z (10 new msgs; continuation of the same chat already ingested through 22:17Z). Other 7 chats had no new messages this cycle.
- Created: [[templeton-religious-trust-project]] — jvadala's Templeton-funded research using a 120B open LLM (per Ken's suggestion) to classify ~2000 free-text religious-experience responses (4 classifications × bootstrapped 10×, speed-bound) into knowledge graphs for SNA; early "q2" ~86%. Status: tentative (model identity inferred).
- Updated: [[jeffrey-vadala]] (added project + 6/18 source), [[kenneth-chaney]] (120B model recommendation to jvadala), [[2026-06-18-teams-chats-digest]] (new Templeton section + pages-touched), [[index]].
- Tasks: none added — status/chit-chat, no action item (Jeffrey already offered GLM-DSA help in prior pass).

## [2026-06-23] ingest | Teams chats digest — provisioning hold escalation (digest_20260623T122658.json)
- Source: PARCC Group chat, Combariza & Chaney, 2026-06-23T16:13–16:22Z (10 new msgs; same-day continuation of the 14:36Z paused-sync thread). Other 7 chats had no new messages.
- Updated: [[2026-06-23-teams-chats-digest]] (added midday-update section + 2nd source), [[betty-cluster]] (midday escalation on home-dir issue), [[kenneth-chaney]] (manual workaround, downstream-automation insight, wharton_lliu1 4TB).
- Tasks: added 3 to `knowledge/tasks.md` (Others/FYI) — hold still in place / top priority, approvals won't propagate till sync resumes; emergency wharton_lliu1 → 4TB storage; (workaround ~1pm folded into hold item).
