---
type: entity
tags: [people, parcc, director, jcombar1, operations]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest, 2026-04-21-parcc-ops-discussion]
related: [betty-cluster, parcc-helper-tools, slurm-cli-filter, kenneth-chaney, jamie-schnaitter, ryan-bradley, jeffrey-vadala]
status: current
---

# Jaime Combariza (jcombar1)

## One-line summary
Senior/director-level PARCC staff who drives operational priorities — user/PI account issues, hardware purchasing, software licensing — and is the heavy tester of the SLURM cli_filter.

## Role
- PennKey / Betty username: `jcombar1`
- Senior PARCC staff; the Betty test account is `jcombar1-betty-testing` (see [[betty-cluster]])
- Sets operational priorities and surfaces user-facing problems; works with [[kenneth-chaney]] and [[jamie-schnaitter]] on infra and with [[jeffrey-vadala]] on outreach/onboarding

## What he owns / drives
- **CLI-filter acceptance testing** — the heavy tester ryb wants to satisfy before [[slurm-cli-filter]] is considered solid.
- **User / PI account issues** — flags PI-status problems (e.g. faculty `tamachad` not flagged `is_pi`), suspects a ColdFront↔Grouper miscommunication; reports root-owned home dirs from the BCM/NFSv4 breakage.
- **Hardware purchasing** — memory DIMM expansion (Dell ~$1400 vs third-party ~$1000; "nice but not critical," may wait for prices to drop).
- **Software licensing** — MATLAB/MathWorks (favors a network license over a vendor engineering call), EULA validity period (wants it valid as long as Betty is in production; consulting legal).
- **Incident reporting** — first to confirm cluster-wide `srun` failures during the 6/16 `libhwloc.so.15` outage (see [[betty-cluster]]); reported `parcc_quota` home-folder breakage (see [[parcc-helper-tools]]).

## Notes
- Was in (former East) Germany in the early '90s around reunification — small-talks history with jvadala.
- Earlier ops-chat context (GPU oversubscription, SLURM states) in [[2026-04-21-parcc-ops-discussion]].

## See also
- [[betty-cluster]]
- [[kenneth-chaney]]
- [[jamie-schnaitter]]
- [[ryan-bradley]]
- [[slurm-cli-filter]]

## Sources
- [[2026-06-16-teams-chats-digest]] — ops, licensing, account, and hardware threads
- [[2026-04-21-parcc-ops-discussion]] — earlier ops chat
