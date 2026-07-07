---
type: source
tags: [teams, digest, vast, storage, snapshots]
created: 2026-07-07
updated: 2026-07-07
related: [vast-storage, parcc-helper-tools, kenneth-chaney, parcc-tokens-as-a-service, open-ondemand-betty, ryan-bradley, gromacs-on-betty, slurm-on-betty, jamie-schnaitter, dgx-b200-partition, bhuv-jain]
status: current
---

# 2026-07-07 Teams Chats Digest

## One-line summary
Several pulls this day. (1) Ken Chaney reports VAST per-project snapshots starting to populate via `parcc_quota.py --snapshots`. (2) Ryan Bradley 1:1 — GROMACS onboarding bench ran; users **can** register a custom Jupyter kernel (a separate env) on OOD, independent of the curated "PyTorch 2.10 (Zen4)" default — Ryan wants perf numbers for Thursday's training deck; late pull adds an `import torch` `ModuleNotFoundError` in the custom kernel (Ryan can't repro → likely wrong `sys.executable`). (3) Jamie Schnaitter flags a Slurm **b200 "license" desync** — 8 DGX nodes idle but no b200 licenses free, stranding GPUs; **root-caused later the same day** to MIG jobs taking 1 license per MIG slice (not per B200), with the `b200` cap raised to 2000. (4) Bhuv Jain meeting agreed for **Friday 3pm** (in-person hoped) + Outlook Scheduling-Assistant how-to for Ryan's calendar.

## Content

### VAST snapshots now populating (PARCC Group · Chaney, Kenneth P · ~1:14pm)
Follow-up to the 7/6 deployment of [[vast-storage]] per-project protected paths:
- Ken: "We are starting to see some of the snapshot data populate. If you've been reading and writing files, you can start to see it."
- Invocation shared: `/usr/bin/python3 $(which parcc_quota.py) --snapshots` (see [[parcc-helper-tools]]).
- The `--snapshots` view adds a **Snapshots** column to the quota table. Actively-used paths already show data — e.g. `/vast/projects/chaneyk/test` reports **13.18 GB** in snapshots against 10.39 GB used — while idle/new paths still read `0 B` or `-`, consistent with the ~2-week ramp Ken flagged on 7/6.
- Confirms the feature is live and observable now for projects that are reading/writing; snapshot counts will keep climbing over the next ~2 weeks. Relevant to backup/recovery posture for the [[parcc-tokens-as-a-service]] beta labs.

### GROMACS onboarding bench ran (Bradley 1:1 · Bradley/Vadala · ~1:51pm)
Ryan checked in on the two onboarding tasks he'd assigned. Jeffrey: **"The gromacs bench ran. I think it worked fine? I'm getting used to spack."** So the [[gromacs-on-betty]] compile-and-benchmark onboarding item (originally targeted Wed 7/1) is effectively complete; only a light results-sanity-check remains.

### Custom Jupyter kernels ARE user-addable on OOD (Bradley 1:1 · Bradley/Vadala · ~1:59–2:04pm)
Ryan's ipykernel task was to see **whether it's easy for users to add a custom kernel** to OOD Jupyter. Jeffrey did it: he **installed a separate environment, independent of the default "PyTorch 2.10 (Zen4)" kernel**, and registered it as a custom ipykernel. Ryan confirmed the approach ("that's correct") and said it **sounds like adding a custom kernel is easy** — he plans to **include it in Thursday's (7/9) training slide deck** "as long as that works out of the box."
- This refines the 7/1 "PARCC-curated environments only" note on [[open-ondemand-betty]]: the curated envs are what appear in the picker by default, but a user **can** register their own ipykernel from a self-installed environment. See [[open-ondemand-betty#Custom ipykernel registration]].
- Ryan's two follow-up asks (Jeffrey committed to both, "I've got time now"): **(1)** report the **notebook performance in the custom env** and compare against the default PyTorch 2.10 (Zen4) kernel; **(2)** if PyTorch was also installed in the custom env, **run the notebook in the default environment** to confirm the default isn't much worse. Origin of the confusion: Jeffrey assumed "make an env" meant a fully **independent** env (it did — that's what Ryan wanted for the custom-kernel test).

### Slurm B200 "licenses" desynced — idle nodes stranded (PARCC Group · Schnaitter, Jamie · ~4:17pm)
Jamie: **"it looks like something is off with the 'licenses' in slurm. there are 8 DGX nodes idle but there are no more b200 licenses available."**
- Reveals that [[slurm-on-betty]] gates full-B200 allocation with a Slurm **`Licenses=`** (`b200`) counter — a cluster-wide admission axis on top of gres/QOS — and the pool drifted out of sync: **8 idle [[dgx-b200-partition]] nodes couldn't be filled** because the scheduler read the b200 licenses as exhausted.
- Classic **stale/leaked license count** (jobs not releasing, or a total no longer matching deployed GPUs). Debug: `scontrol show lic` vs actually-idle DGX GPUs, then reconcile. Same stranded-capacity class as the [[2026-04-17-dgx002-gpu5-oversubscription]] gres incident, one layer up. New tentative section filed at [[slurm-on-betty#Licenses — B200 gating (tentative)]].

### Custom Jupyter kernel — `import torch` fails, Ryan can't reproduce (Bradley 1:1 · Bradley/Vadala · ~3:52pm)
Continuation of the ipykernel thread above. Jeffrey: "default kernel starts but `import torch` throws `ModuleNotFoundError`." Ryan couldn't reproduce and asked him to **check `sys.executable` and the kernel names** — pointing at the usual custom-kernel pitfall: the registered ipykernel's `kernel.json` points at a **Python interpreter that doesn't have torch installed**, rather than a real torch problem. Jeffrey suspected mis-registration ("Maybe I did it wrong") and stepped out. Fix path: from the failing kernel print `sys.executable`, compare against the env where torch lives, and re-run `ipykernel install` if they mismatch. Gates the perf-comparison deliverable Ryan wants for the 7/9 deck. See [[open-ondemand-betty#Custom ipykernel registration]].

### B200 license desync ROOT-CAUSED + cap raised (PARCC Group · Chaney/Schnaitter · ~4:20pm)
Follow-up that resolves the ~4:17pm b200-license report above. Jamie asked how the **928** total was computed; Ken: **`29 × 8 × 4`** (nodes × GPUs/node × 4). Diagnosis (Jamie): **MIG jobs take 1 license per MIG *slice* rather than 1 per B200**, so MIG usage drains the [[slurm-on-betty]] `b200` pool faster than a per-B200 count assumes → the idle-node stranding. Ken **updated the `job_submit` script** to fix the accounting bugs but noted it **doesn't update already-running jobs**, so the pool can stay artificially exhausted until in-flight jobs drain. Since the license count can legitimately exceed the GPU count (real allocation is gated by other factors) and over-provisioning is harmless, Ken proposed **+50% on all three** pools; **Jamie raised `b200` to 2000** (CPU pools left as-is). Filed to [[slurm-on-betty#Licenses — B200 gating]] (section promoted out of "tentative").

### Bhuv Jain meeting set for Friday 3pm + Outlook calendar how-to (Bradley 1:1 · Vadala/Bradley · ~4:34pm)
Jeffrey got an email from Prof. [[bhuv-jain]] and **agreed to a Friday 3pm** meeting ("only because i cant do the 3pm thursd[a]y one"). Ryan is fine with it and **hopeful it can be in-person** — "(as long as you consulted my outlook calendar!)". How to check Ryan's availability: in Outlook, when scheduling a meeting choose **"Scheduling Assistant"** and enter **`ryb@upenn.edu`**. This partly resolves the ~11:46am "Bhuv never confirmed" uncertainty (a slot is now agreed on Jeffrey's side); still owes a calendar cross-check + in-person confirmation. Session then interrupted — Jeffrey's laptop battery died (~4:47pm).

### Custom Jupyter kernel — Ryan's "wrong kernel / no torch" hypothesis (Bradley 1:1 · Bradley/Vadala · ~5:50pm)
Continuation of the ipykernel `ModuleNotFoundError` thread. Ryan's leading guess: **the notebook is attached to the second kernel on the list** — "if you created **'PyTorch Zen4 Betty'** but didn't install pytorch, that might explain the module error." So the failure may not be a `sys.executable` path bug but simply a **self-made kernel whose env never had torch `pip install`ed**. Jeffrey questioned whether he was even expected to install it himself ("I Was supposed to install it? Then I set it up"), will **check logs**, and **committed to looking at it first thing tomorrow (7/8)**. Fix path: confirm torch is present in the env backing "PyTorch Zen4 Betty" (`pip list | grep torch`); if absent, install it there or re-point the kernel at curated `venv-pytorch-v01`. Note the name drift vs the curated **"PyTorch 2.10 (Zen4)"** default. Filed to [[open-ondemand-betty#Custom ipykernel registration]].

## See also
- [[vast-storage]]
- [[parcc-helper-tools]]
- [[open-ondemand-betty]]
- [[gromacs-on-betty]]
- [[ryan-bradley]]
- [[slurm-on-betty]]

## Sources
- Teams digest `digest_20260707T133825.json`
- Teams digest `digest_20260707T141131.json`
- Teams digest `digest_20260707T161820.json`
- Teams digest `digest_20260707T165220.json`
- Teams digest `digest_20260707T175841.json`
