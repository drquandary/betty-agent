# Wiki Log

> Chronological record of ingests, queries, and lint passes.
> Entry prefix: `## [YYYY-MM-DD] <operation> | <brief title>`
> Grep the last 5 with: `grep "^## \[" log.md | tail -5`

---

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
