---
type: entity
tags: [people, parcc, systems, kerberos, ssh, infra, licensing]
created: 2026-06-16
updated: 2026-06-18
sources: [2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest]
related: [betty-cluster, kerberos-ssh-macos-fix, betty-auth-architecture, vast-storage, kenneth-chaney, jaime-combariza, ryan-bradley, jeffrey-vadala]
status: current
---

# Jamie Schnaitter

## One-line summary
PARCC systems engineer with deep Kerberos/SSH and infrastructure knowledge; authored the practical macOS Kerberos fix and handles licensing details and AHEAD incidents.

## Role
- Systems engineer at PARCC
- The team's Kerberos/SSH authority; works incidents with [[kenneth-chaney]] and [[jaime-combariza]]

## What he owns / drives
- **Kerberos / SSH expertise** — diagnosed the macOS login failures as Heimdal-vs-MIT environment pollution (any binary-package manager, not just conda, can override the system `ssh`/`kinit`) and supplied the practical fix: `export KRB5CCNAME="API:"` before `kinit`, after which MIT-vs-Heimdal stops mattering (unless macOS is too old for the API cache). See [[kerberos-ssh-macos-fix]] and [[betty-auth-architecture]].
- **Skeptic of imprecise explanations** — flagged the BettyAI conda-vs-venv SSH answer as "nonsense"; corrected the underlying mechanism.
- **Licensing** — handles Gurobi (helped jvadala with the academic license request form) and MATLAB network-license details.
- **Incident response** — opens AHEAD incidents (VAST user-file impact, 5/29); reported the BCM-01 outage (6/4) and root-owned-directory issues from the NFSv4 switch.
- Teams/Slack formatting tips (backticks); prefers Slack's markdown parser.
- **Compute-node SSH** — confirmed (6/18) that `pam_slurm_adopt` is now live, so users can SSH to a node where they have a running job; noted the multi-job-on-one-node cgroup caveat. See [[betty-auth-architecture]].

## See also
- [[kerberos-ssh-macos-fix]]
- [[betty-auth-architecture]]
- [[betty-cluster]]
- [[kenneth-chaney]]
- [[jaime-combariza]]

## Sources
- [[2026-06-16-teams-chats-digest]] — Kerberos diagnostics, licensing, and incident threads
- [[2026-06-18-teams-chats-digest]] — confirms pam_slurm_adopt is live + multi-job cgroup caveat
