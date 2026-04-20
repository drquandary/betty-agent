---
type: experiment
tags: [experiment, template]
created: 2026-04-17
updated: 2026-04-17
model: []
dataset: []
method:
job_id:
sources: []
related: []
status: tentative
---

# Experiment Template

> This is the canonical template for a `wiki/experiments/` page. Copy it to
> `YYYY-MM-DD-<slug>.md` when filing a new run. Sections marked `(agent)` are
> overwritten by Betty AI between the `<!-- betty:auto-start -->` and
> `<!-- betty:auto-end -->` markers (see [[SCHEMA]] and decision D6). Sections
> marked `(user)` are yours — the agent will never touch them.

## Goal
<!-- (user) Why are we running this? What question does it answer? -->

## Status
<!-- betty:auto-start -->
_Betty AI writes submission state, Slurm JobID, and timestamps here._
<!-- betty:auto-end -->

## Runtime
<!-- betty:auto-start -->
_Betty AI writes elapsed time, exit code, node, and log pointers here._
<!-- betty:auto-end -->

## Lessons
<!-- (user) What did we learn? What would we do differently next time? -->
