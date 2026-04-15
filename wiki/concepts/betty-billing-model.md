---
type: concept
tags: [betty, billing, slurm, tres, pc-units]
created: 2026-04-08
updated: 2026-04-08
sources: [2026-04-08-betty-initial-exploration, 2026-04-08-betty-system-guide]
related: [slurm-on-betty, dgx-b200-partition, b200-mig45-partition, b200-mig90-partition, genoa-std-mem-partition, genoa-lrg-mem-partition, parcc-helper-tools]
status: current
---

# Betty Billing Model (PC Units)

## One-line summary
Betty charges Slurm allocations in **PC minutes**, computed from per-partition TRES billing weights applied to the resources you request — regardless of whether you actually use them.

## Billing weights
| Partition | CPU weight | GPU weight | 1 GPU-hour |
|-----------|-----------|-----------|------------|
| [[dgx-b200-partition]] | 35.7 | **1000** | ~17 PC |
| [[b200-mig90-partition]] | — | **500** | ~8 PC |
| [[b200-mig45-partition]] | — | **250** | ~4 PC |
| [[genoa-std-mem-partition]] | **10** | — | 0.17 PC (1 CPU) |
| [[genoa-lrg-mem-partition]] | **15** | — | 0.25 PC (1 CPU) |

Formula: `PC-minutes = weight * minutes` (summed over resources).

## Our allocation
- **Account**: `jcombar1-betty-testing`
- **Balance**: 12,000 PC (as of 2026-04-08)
- **Window**: monthly (resets 1st of each month)

## What you can do with 12,000 PC
| Scenario | Cost | Runway |
|----------|------|--------|
| 1 full B200 | 17 PC/hr | ~700 hours |
| 8 full B200 (1 node) | 134 PC/hr | ~90 hours |
| 1 MIG-45 slice | 4 PC/hr | ~3000 hours |
| 32 CPUs on genoa-std | 5 PC/hr | ~2400 hours |

## Cost-saving principles
1. **Develop on MIG** — 4x cheaper than full B200 ([[b200-mig45-partition]])
2. **QLoRA** > full fine-tune ([[qlora]])
3. **Set `--time` tight** — unused reserved time still bills
4. **`scancel` interactive sessions immediately**
5. **Profile on 1 GPU before scaling** to multi-GPU
6. **Checkpoint** to survive time limits

## Checking usage
```bash
parcc_sreport.py --user jvadala
```
See [[parcc-helper-tools]].

## See also
- [[slurm-on-betty]]
- [[dgx-b200-partition]]
- [[b200-mig45-partition]]

## Sources
- [[2026-04-08-betty-initial-exploration]]
- [[2026-04-08-betty-system-guide]]
