---
type: concept
tags: [beast, beast2, beast1, mcmc, checkpointing, slurm, resume]
created: 2026-05-15
updated: 2026-05-18
sources: [2026-05-15-beast2-ha-wild-aves-bench, 2026-05-15-beast1-5535-taxa-bench, 2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]
related: [beast2-on-betty, beast1-on-betty, beast-phylonco, beagle-tuning, beagle-gpu-tuning, slurm-on-betty]
status: current
---

# Restarting Dead BEAST Runs on Betty

## One-line summary
BEAST chains routinely outlive a single SLURM walltime; BEAST2 auto-checkpoints (just add `-resume`), but BEAST1 does NOT — you must opt in *before* the run starts with `-save_every` / `-save_stem`, or the dead run is unrecoverable.

## Why this page exists
Multi-day-to-multi-week BEAST chains are the norm on Betty. Getting checkpointing wrong wastes days of compute. Two real cases on Betty so far have resulted in unrecoverable dead runs because the BEAST1 checkpointing flags were not set at submission time.

## BEAST2 — auto-checkpoints, just add `-resume`

BEAST2 writes `<your-xml>.xml.state` to disk every 500,000 states *automatically*, with no flag needed. The state file lives next to your XML.

To restart from a dead run, replace `-overwrite` with `-resume`:

```bash
beast -beagle -beagle_CPU -beagle_SSE -resume -threads 1 run.xml
```

Verify the checkpoint before resubmitting:

```bash
ls -la run.xml.state          # exists?
head -5 run.xml.state         # last sample is in the comment line
```

The chain continues from the last `.xml.state`. The `.log` and `.trees` files are appended (BEAST2 detects the resume and trims any post-checkpoint trailing samples).

**Caveat:** if you change any model component in the XML between runs, `-resume` rejects the state file. The `-resume` is sample-identical only.

## BEAST1 — must opt in *before* the run starts

BEAST1 does **not** auto-checkpoint. If you didn't pass `-save_every` / `-save_stem` on the original submission, the run is unrecoverable when it dies. Always include these flags from day one for production BEAST1.

Setup:

```bash
beast -beagle -beagle_GPU -beagle_double -beagle_scaling dynamic \
      -save_every 1000000 -save_stem run.state \
      -threads 1 run.xml
```

This writes `run.state.<sample>` files every 1M states. To restart:

```bash
LATEST=$(ls -t run.state.* | head -1)
beast -beagle -beagle_GPU -beagle_double -beagle_scaling dynamic \
      -load_state $LATEST -force_resume \
      -threads 1 run.xml
```

The `-force_resume` flag is needed if you've changed *anything* (often you haven't, but BEAST1 is paranoid). Without it, a checksum mismatch aborts the resume.

## Drop-in production recipes

### BEAST2 single-chain CPU with resume

```bash
#SBATCH -p genoa-std-mem
#SBATCH -c 1
#SBATCH -t 3-00:00:00
#SBATCH --qos=genoa-std
source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast1 beast2

beast -beagle -beagle_CPU -beagle_SSE -resume -threads 1 run.xml
```

Use this same script with `-overwrite` for the initial submission, then flip to `-resume` for every subsequent chained submission until the chain hits the target sample count.

### BEAST1 production with checkpoints from day one

```bash
#SBATCH -p dgx-b200
#SBATCH --gres=gpu:1
#SBATCH -c 4
#SBATCH -t 3-00:00:00
#SBATCH --qos=dgx
source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast2 beast1

beast -beagle -beagle_GPU -beagle_double -beagle_scaling dynamic \
      -save_every 1000000 -save_stem run.state \
      -overwrite -threads 1 run.xml
```

## Coordinating chained sbatch jobs

For a 7-day chain on a 3-day walltime partition, chain submissions with `--dependency=afterany:<prev_jobid>`:

```bash
JOB1=$(sbatch --parsable b2_production_cpu.sh)
JOB2=$(sbatch --parsable --dependency=afterany:$JOB1 b2_production_cpu_resume.sh)
JOB3=$(sbatch --parsable --dependency=afterany:$JOB2 b2_production_cpu_resume.sh)
```

`afterany` (not `afterok`) is correct — a slurm-walltime kill is a non-zero exit but the `.xml.state` checkpoint is still valid, and we want the next job to pick up regardless.

Pair with `--requeue` and `--signal=B:USR2@300` (see [[beast2-on-betty]] for the full chain pattern with signal trapping) for graceful checkpoint flush on time-limit kill.

## Two real cases on Betty

- **BEAST2 wild-aves HA** (the case study in [[2026-05-15-beast2-ha-wild-aves-bench]]): chain at sample 120,951,000 needed restart; `-resume` worked first try because BEAST2's auto-checkpoint had been silently saving the whole time. No data loss.
- **BEAST1 first production run**: ran several days without `-save_every` flags. When walltime killed it, no checkpoints existed. Chain was unrecoverable. *Lesson*: BEAST1 production scripts must include checkpointing flags from the very first submission.

## See also
- [[beast2-on-betty]] — full production patterns including signal-trapped chained jobs
- [[beast1-on-betty]] — BEAST1 sibling page; has its own deep dive on `-save_every` / `-save_stem` with the staged slurm template
- [[beast-phylonco]] — phylonco install adds nothing checkpointing-specific
- [[beagle-tuning]] — BEAGLE flag reference
- [[beagle-gpu-tuning]] — GPU-side flag deep dive
- [[2026-05-15-beast2-ha-wild-aves-bench]] — BEAST2 resume verified
- [[2026-05-15-beast1-5535-taxa-bench]] — BEAST1 case
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]] — original session that surfaced both checkpointing footguns
- [[slurm-on-betty]] — `--dependency`, `--requeue`, `--signal` syntax
- `betty-ai/templates/slurm/beast1_checkpoint.sbatch.j2` — parameterized BEAST1 checkpoint template

## Sources
- [[2026-05-15-beast2-ha-wild-aves-bench]]
- [[2026-05-15-beast1-5535-taxa-bench]]
- [[2026-05-13-jvadala-ryb-beast2-beagle-bench-and-perms]]
