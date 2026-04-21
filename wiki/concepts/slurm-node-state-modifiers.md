---
type: concept
tags: [slurm, sinfo, admin, betty]
created: 2026-04-21
updated: 2026-04-21
sources: [2026-04-21-parcc-ops-discussion]
related: [slurm-on-betty, parcc-helper-tools]
status: current
---

# SLURM Node State Modifiers

## One-line summary
The trailing-character suffixes after a node state in `sinfo` output (`mix-`, `alloc*`, `idle~`, etc.) are state *modifiers* — they describe a condition layered on top of the base state, not a distinct state.

## Why this page exists
On 2026-04-21 it was unclear what `mix-` meant versus plain `mix`. Chaney initially thought it meant "not all resources in use" (which is what `MIXED` itself means); actually the `-` is a modifier indicating the node has been planned for a higher-priority job by the backfill scheduler. `parcc_sfree.py --by node` surfaces this as `MIXED+PLANNED`. Page captures the full modifier glossary so we don't have to look it up again.

## The modifier glossary
| Suffix | Meaning |
|--------|---------|
| `*` | Node is not responding to the controller. Will be placed in DOWN if it stays unresponsive. Exceptions: COMPLETING, DRAINED, DRAINING, FAIL, FAILING. |
| `~` | Node is powered off. |
| `#` | Node is being powered up or configured. |
| `!` | Node is pending power down. |
| `%` | Node is being powered down. |
| `$` | Node is in a reservation flagged as `maintenance`. |
| `@` | Node is pending reboot. |
| `^` | Node reboot has been issued. |
| `-` | Node is **planned by the backfill scheduler for a higher priority job**. Surfaces as `MIXED+PLANNED` in `parcc_sfree.py --by node`. |

## Base states these modifiers attach to
`idle`, `mix` (a.k.a. `mixed`), `alloc`, `drain`, `down`, `fail`, `maint`, `resv`, `comp`, etc. So you can see combinations like `idle~` (idle + powered off), `alloc*` (alloc + not responding), `mix-` (mixed + backfill-planned).

## Practical notes
- Seeing `mix-` or `alloc-` does NOT mean anything is wrong — it means the scheduler has earmarked the node for an upcoming higher-priority job.
- If you try to submit a small job that could fit on a `mix-` node, the scheduler may refuse because accepting it would delay the planned higher-priority job (unless your job fits within the remaining backfill window).
- Why SLURM shows `-` instead of the word `PLANNED` in `sinfo`: `sinfo` format is single-character-suffix by design; the long form (`MIXED+PLANNED`) is only rendered in tools like `parcc_sfree.py` that explicitly decode it.

## Example
```
$ sinfo -N -o "%N %T"
dgx002 mix-         # mixed + backfill-planned
dgx015 down*        # down + not responding
dgx024 idle~        # idle + powered off
```

## See also
- [[slurm-on-betty]]
- [[parcc-helper-tools]] — `parcc_sfree.py --by node` renders the long form
- Slurm docs: `sinfo(1)` — "NODE STATE CODES" section

## Sources
- [[2026-04-21-parcc-ops-discussion]]
