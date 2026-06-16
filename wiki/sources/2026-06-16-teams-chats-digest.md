---
type: source
tags: [teams, parcc, facilitation, slurm, cli-filter, gromacs, kerberos, ssh, vlm, betty-ai, grants, nvidia, licensing, people]
created: 2026-06-16
updated: 2026-06-16
related: [ryan-bradley, jaime-combariza, kenneth-chaney, jamie-schnaitter, jeffrey-vadala, slurm-cli-filter, gromacs-on-betty, kerberos-ssh-macos-fix, betty-auth-architecture, surgical-tool-id-vlm, erf-user-facilitation, betty-ai-agent, betty-cluster, parcc-helper-tools]
status: current
---

# 2026-06-16 — Teams chats digest (PARCC / Betty)

## One-line summary
A digest of 8 Microsoft Teams chats (278 new messages, ~2026-04-08 → 2026-06-16) between jvadala and the PARCC team — Ryan Bradley (ryb), Jaime Combariza, Kenneth Chaney, Jamie Schnaitter — covering the SLURM `cli_filter` `--mem` bug, the GROMACS 1.5M-water onboarding exercise, the macOS Heimdal-vs-MIT Kerberos SSH fix, a cluster-wide `libhwloc.so.15` outage, the surgical tool-ID VLM hosting idea, the Betty AI agent proxy design, and ERF/CI-facilitation onboarding.

## Source artifact
- Raw Teams export: `/Users/jvadala/ProjectInstaSim/TeamTuI/teams-web-tui/knowledge/raw/seed.json` (shape: `data.chats[].new_messages[].{sender,timestamp,text}`)
- Pre-distilled notes (synthesis guide): `/Users/jvadala/ProjectInstaSim/TeamTuI/teams-web-tui/knowledge/wiki/*.md`
- Generated at: `2026-06-16T15:59:15`; 8 chats, 278 new messages total.

## Chats covered
1. **Bradley, Ryan Patrick** (71 msgs, 6/11–6/16) — repo/branch workflow, ERF facilitation, the CLI-filter `--mem` bug, GROMACS 1.5M-water exercise + benchmark links, macOS Kerberos SSH, CI-culture resources (Spack tutorials, OSCER / Henry Neeman).
2. **PARCC Group** (69 msgs, 6/15–6/16) — the macOS Kerberos thread (Jamie + ryb diagnostics), conda-vs-venv SSH debate, the `libhwloc.so.15` outage + `srun` failures, BCM/NFSv4 home-dir-creation breakage (root-owned dirs, skel not copied), `parcc_quota` home-folder logic broken, ColdFront↔Grouper PI miscommunication, EULA-in-Grouper, MATLAB/MathWorks licensing, VAST VMS portal flakiness.
3. **Chaney, Kenneth P** (75 msgs, 5/20–6/15) — `parcc_sandbox` build/deploy, the Betty AI dashboard (`parcc_sfree.py --by node --json`), API-key/proxy design, Unsloth/NVFP4 model deployment, Kimi-code, the surgical tool-ID VLM hosting idea.
4. **Combariza, Jaime E.** (19 msgs, 4/08–6/15) — meeting logistics, HireIT hiring, simulation-group funding, German-conference outreach, PyTorch/AWS.
5. **Schnaitter, Jamie** (16 msgs, 6/04–6/15) — BCM-01 outage, Gurobi license request form.
6. **Catch Up - RHOS** (8 msgs, 5/29) — PARCC training links (multi-node training, zero-to-MPI), VAST user-file impact → AHEAD incident.
7. **PARCC <> NVIDIA** (17 msgs, 5/21–5/27) — recurring NVIDIA meetings; guest roster.
8. **Vadala, Jeffrey (You)** (3 msgs) — self-chat, no content.

## Key threads (synthesized)

### SLURM cli_filter `--mem` bug
jvadala found a bug in ryb's Lua `cli_filter`: when both `--mem` and `--mem-per-cpu` are involved, `--mem` is mishandled and propagates into an error. ryb: he rarely uses `--mem`; tests cover the memory *amount* but not actual `--mem`-flag *usage*. Fix plan: prevent `--mem` propagating unless it disagrees with `--mem-per-cpu`, add a test, jvadala retests. ryb recommends putting the updated filter invocation in `~/.bashrc` for interactive sessions. `--mem` is the key flag for AI/ML users. See [[slurm-cli-filter]].

### GROMACS 1.5M-water onboarding exercise
ryb completed (himself, "last week") a compile-and-run of a 1.5M-water-molecule GROMACS test and recommends jvadala do the same — high priority, *without AI assistance*, because it "covers a lot of basics on our cluster" and generalizes. Benchmark inputs: `https://ftp.gromacs.org/pub/benchmarks/`; install guide: `https://manual.gromacs.org/current/install-guide/index.html`. See [[gromacs-on-betty]].

### macOS Kerberos SSH failure + fix
Intermittent `Permission denied (publickey,gssapi-with-mic)` SSHing to Betty, especially on Macs. Root cause: two Kerberos providers (macOS default **Heimdal** vs **MIT**) collide via environment pollution (any binary-package manager — conda, brew — can install its own `ssh`/MIT `kinit`). Fix (Jamie): `export KRB5CCNAME="API:"` before `kinit` on macOS; with that set correctly, MIT-vs-Heimdal stops mattering (unless macOS is too old for the API cache). GUI apps (VSCode) use launchd → clean Heimdal unless launched from a polluted terminal. ryb has a long diagnostic checklist (`klist`, `kinit --version`, `~/.ssh/config` GSSAPI flags, etc.). See [[kerberos-ssh-macos-fix]] and [[betty-auth-architecture]].

### libhwloc.so.15 outage (6/16)
`libhwloc.so.15` went missing → `dlopen(.../mpi_pmix.so)` failed → cluster-wide `srun` failures (`Invalid MPI type 'pmix'`), nodes going down. Restored by Chaney (put `libhwloc.so.15` back); AHEAD doing an RCA on how it was deleted. Concurrent: BCM→VAST new-user home-dir creation fails after the NFSv4+idmap switch (dir owned by root, `/etc/skel` not copied), blocking OOD login for new users. See [[betty-cluster]] and [[parcc-helper-tools]].

### Surgical tool-ID VLM
Chaney asked jvadala for a screenshot of the surgical-implement-identification output, floating the idea of hosting the VLM on Betty for higher throughput. jvadala has benchmarks, a rigged GUI (stalled — collaborating doctor moved to a Seattle residency, never bought the VR headset), and a phone proof-of-concept. See [[surgical-tool-id-vlm]].

### Betty AI agent + proxy design
jvadala's Betty assistant exists as a web dashboard and a pi/Claude agent (built on Chaney's Kimi setup). Chaney guidance: use `parcc_sfree.py` (`--by node`, `--json`) as the data source; add a "booting AI in progress" label; webserver + local proxy for API-key protection (`user/agent → localhost proxy → PARCC LiteLLM gateway → provider model`). See [[betty-ai-agent]].

### ERF / CI-facilitation onboarding + repo workflow
ryb wants jvadala to compile codes that work with ERF as a facilitation acclimatization exercise, via separate directories + a shared GitHub repo tested in complete isolation with a branch-and-merge loop (avoid hardcoding/"naturalizing" structure). ryb recommends CI-culture resources: LLNL HPCIC Spack tutorials (Jul–Sep) and OSCER / Henry Neeman's Virtual Residency. See [[erf-user-facilitation]].

## See also
- [[slurm-cli-filter]] — the `--mem` bug
- [[gromacs-on-betty]] — 1.5M-water onboarding exercise + benchmark data
- [[kerberos-ssh-macos-fix]] — the Heimdal-vs-MIT `KRB5CCNAME="API:"` fix
- [[betty-auth-architecture]] — Kerberos/SSH auth on Betty
- [[surgical-tool-id-vlm]] — medical VLM hosting idea
- [[erf-user-facilitation]] — ERF code task + CI facilitation onboarding
- [[ryan-bradley]], [[jaime-combariza]], [[kenneth-chaney]], [[jamie-schnaitter]], [[jeffrey-vadala]]

## Sources
<!-- Self-evident: this page summarizes the raw Teams export cited above. -->
