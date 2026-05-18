---
type: concept
tags: [beast2, mcmc, phylogenetics, checkpoint, resume, slurm, hpc]
created: 2026-05-18
updated: 2026-05-18
sources: [2026-05-18-beast2-resume-smoke-test]
related: [beast2-on-betty, beast-phylonco, slurm-on-betty, genoa-std-mem-partition, vast-storage]
status: current
---

# BEAST2 Resume — Step-by-Step Runbook

## One-line summary
BEAST2 writes a `<xml>.state` checkpoint automatically as your chain runs; to continue an interrupted chain on Betty you re-submit the **same XML in the same directory** with `-resume` instead of `-overwrite`. Chain several 7-day sbatch jobs with `--dependency=afterok` to get arbitrarily long runs.

## Why this page exists
The general [[beast2-on-betty]] page covers BEAST2 broadly. This page is the focused runbook for one question: **"my chain didn't finish in one wall-time — how do I keep it going?"** Hand this to a lab member who has never touched Slurm and they should be able to follow it.

## How it works (30-second version)
1. BEAST2 dumps the full chain state to a file named exactly `<your-xml>.state` every `storeEvery` MCMC steps (default 5000; production XMLs usually set this much larger, e.g. 500,000).
2. `<xml>.state` lives next to your XML, in your current working directory.
3. When you launch BEAST2 with `-resume`, it reads `<xml>.state`, restores the chain, and **appends** new samples to the existing `.log` and `.trees` files.
4. Without `-resume`, BEAST2 either refuses to overwrite or (with `-overwrite`) silently starts from scratch — losing your prior work.

The only difference between the first job and every subsequent job is one flag: `-overwrite` vs `-resume`.

## What you have to set up on Betty (one time)

### 1. Pick a project dir, not your home dir
A 7-day BEAST2 chain produces tens of GB of `.trees` and `.log` files. Your `$HOME` (50 GB quota) will fill up and your chain will crash. Always run from:

```bash
PROJ=/vast/projects/<your-project>
mkdir -p ${PROJ}/runs/exp-NNN-shortname
cd ${PROJ}/runs/exp-NNN-shortname
```

See [[vast-storage]] for why VAST is the right tier.

### 2. Confirm BEAST2 loads
Betty has BEAST2 under the `arch/b200` overspack stack. From any compute node (lmod is broken on login nodes — known issue, see [[ood-troubleshooting]]):

```bash
source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast1 beast2       # purge conflicting modules, then load
beast -version                    # should print "BEAST v2.7.x"
```

The `-openmpi -beast1` purge matters: `openmpi` and `beast1` set environment variables that confuse BEAST2's classpath. The wiki page [[beast-phylonco]] has the full module story.

### 3. Set `storeEvery` in your XML so resume actually helps
Open your `.xml` and find the `<state>` element. Add or adjust the `storeEvery` attribute:

```xml
<state id="state" spec="State" storeEvery="500000">
  ...
</state>
```

Rule of thumb: pick `storeEvery` so re-work after a kill is **< 5% of total runtime**. For a chain running ~10M states/day, `storeEvery=500000` (~1 hour of re-work) is safe.

If `storeEvery` is too high, a job killed at walltime loses hours of work. If it's too low, you spend MCMC time on disk I/O. 500k–1M is a reasonable default for production chains.

## The two sbatch scripts (copy these)

### `b2_first.sh` — initial submission
```bash
#!/bin/bash
#SBATCH -p genoa-std-mem
#SBATCH -c 1
#SBATCH -t 7-00:00:00
#SBATCH --qos=genoa-std
#SBATCH -J b2-myrun
#SBATCH -o slurm-%j.out
#SBATCH --requeue
#SBATCH --signal=B:USR2@300

source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast1 beast2

beast -beagle -beagle_CPU -beagle_SSE -overwrite -threads 1 \
  myanalysis.xml
```

### `b2_resume.sh` — every subsequent submission (identical except `-resume`)
```bash
#!/bin/bash
#SBATCH -p genoa-std-mem
#SBATCH -c 1
#SBATCH -t 7-00:00:00
#SBATCH --qos=genoa-std
#SBATCH -J b2-myrun-r
#SBATCH -o slurm-%j.out
#SBATCH --requeue
#SBATCH --signal=B:USR2@300

source /vast/parcc/sw/lmod/z/go.sh
ml arch/b200
ml -openmpi -beast1 beast2

beast -beagle -beagle_CPU -beagle_SSE -resume -threads 1 \
  myanalysis.xml
```

The Slurm header is intentionally identical. The only real difference is `-overwrite` → `-resume`. Don't try to be clever — copy two files, change one flag.

### Why those Slurm flags matter

| Flag | What it does | Why you need it |
|------|--------------|-----------------|
| `-t 7-00:00:00` | 7-day walltime | The max for `genoa-std` QoS. Asking for 30 days is the wrong question — chain seven 7-day jobs instead. |
| `--requeue` | Slurm auto-resubmits if the node dies | A node reboot mid-chain won't kill your run; the next start will read `.state` and resume. |
| `--signal=B:USR2@300` | Sends SIGUSR2 to your job 300s before walltime kill | BEAST2 catches this and flushes the `.state` file before the kernel reaps it. Without this you may lose up to `storeEvery` states. |
| `-threads 1` | One BEAGLE thread | On CPU, BEAST2's MCMC is single-threaded; extra threads only help if BEAGLE likelihood evaluation dominates. Benchmark before going higher. **On GPU, `-threads 1` is mandatory** — see the [[beast2-on-betty]] GPU pitfall. |

## Run the chain

### Step-by-step for users

```bash
# Step 1: copy your XML into a project-dir run folder
cd /vast/projects/<proj>/runs/exp-001-myrun
cp ~/myanalysis.xml .

# Step 2: edit storeEvery in the XML (one time) — see above

# Step 3: write b2_first.sh and b2_resume.sh next to the XML
#         (use the templates above, change the XML filename)

# Step 4: submit the first job
jid=$(sbatch --parsable b2_first.sh)
echo "First job: ${jid}"

# Step 5: chain six more 7-day continuations
#         Each one waits for the previous to *finish* (afterany — not afterok),
#         then starts and -resumes from the .state file
for i in 1 2 3 4 5 6; do
  jid=$(sbatch --parsable --dependency=afterany:${jid} b2_resume.sh)
  echo "Chained continuation ${i}: ${jid}"
done

# That's it. squeue shows seven jobs queued; the first runs immediately,
# each later one starts only when the previous succeeds.
squeue -u $USER
```

The total wall-clock budget is **49 days** of continuous chain. Your `.log` and `.trees` files grow monotonically; downstream tools (Tracer, TreeAnnotator, LogCombiner) see them as a single chain.

### Why `afterany` and not `afterok`

A BEAST2 chain that hits its walltime is killed by Slurm with SIGTERM and `sacct` will mark the job `FAILED` with exit code `0:12` — even though BEAST2 wrote a perfectly valid `.state` checkpoint moments before. With `afterok`, the next link in the chain would be held in `DependencyNeverSatisfied` and your whole chain stalls after the first walltime kill.

`afterany` fires once the previous job *finishes*, regardless of exit code, which is what you want: the chain continues, picks up the `.state` file, and BEAST2 advances from where it left off.

The only reason to use `afterok` would be if your chain finishes the target sample count *naturally* within a single walltime (rare for multi-week chains). For those, just submit once with no dependency.

If you see `DependencyNeverSatisfied` anyway, look at the failed job's `slurm-<id>.out` for a real failure (OOM, missing module, corrupted `.state`), fix the cause, and re-submit the resume manually (`sbatch b2_resume.sh`).

## How to verify resume actually worked

**Trust the `.log` file, not the `.state` file's sample number.** The `.log` records cumulative samples across all resume segments. The `.state` file's `sample='...'` attribute resets to `0` at the start of each resume cycle — so reading it after a resume gives you the *segment-local* count, not cumulative progress. This is normal BEAST2 behavior and surprises everyone the first time.

Three checks, in order of trust:

1. **`<xml>.log` tail** — last sample number is **greater** than the last sample number in the `.log` *before* you resumed. This is the only honest cumulative-progress check.
2. **`<xml>.state` mtime** — was modified after the resume job started. If not, BEAST2 hasn't reached its first `storeEvery` checkpoint yet (wait a few minutes on a fast chain, an hour on a slow one).
3. **`squeue -u $USER`** — the resume job is `R` (running), not `PD` with `DependencyNeverSatisfied`.

A one-liner you can run **before** resuming to record the baseline:
```bash
PRE_LOG=$(tail -1 myanalysis.xml.log | awk '{print $1}')
echo "pre-resume cumulative samples: ${PRE_LOG}"
```

…and the same after the resume job has run for at least one `storeEvery` interval:
```bash
POST_LOG=$(tail -1 myanalysis.xml.log | awk '{print $1}')
POST_STATE_MTIME=$(stat -c '%y' myanalysis.xml.state)
echo "post-resume cumulative samples: ${POST_LOG}"
echo "post-resume .state mtime:       ${POST_STATE_MTIME}"
echo "delta samples this segment:     $(( POST_LOG - PRE_LOG ))"
```

If `POST_LOG > PRE_LOG` and the `.state` mtime is fresh, resume worked. If the `.state` file's internal `sample='0'` puzzles you, that's expected — it's the per-segment counter, not the cumulative one.

## Gotchas (in order of how often they bite)

### `.state` file missing → fresh chain instead of resume
BEAST2 silently starts from scratch if `<xml>.state` isn't where it expects (next to the XML, in cwd). Symptoms: a brand-new tiny `.log` file appears; sample numbers start at 0; existing `.log` gets clobbered.

**Cause**: usually you ran the script from a different directory, or the prior chain was killed before the first `storeEvery` checkpoint.

**Fix**: always `cd` into the run dir at the top of your sbatch script (the templates above do this implicitly because Slurm starts in the submission dir). For new XMLs, confirm a `.state` file appears within `storeEvery` steps of starting.

### `storeEvery` too high → walltime kill loses hours
If you set `storeEvery=10000000` and your chain runs at 1M states/hour, a walltime kill can lose up to 10 hours. Use 500k–1M for production.

### `-resume` and `-overwrite` together → undefined behavior
You can't pass both. Some BEAST2 versions error; others silently honor one. Keep two separate scripts.

### Mixing BEAST 1 and BEAST 2 modules → wrong binary
If `beast1` is loaded, `beast` may resolve to the BEAST1 binary, which has **completely different** flags (`-save_every`, not `storeEvery`). Always `ml -beast1 beast2`. See [[beast-phylonco]] for the BEAST1 contrast and why this trips people up.

### Forgot to set `-seed` → unreproducible replicas
Resume itself doesn't care about `-seed` (the chain state encodes the RNG), but if you're running array replicas, each one must pass `-seed ${SLURM_ARRAY_TASK_ID}` or chains may collide.

### `~/.beast/2.7/` fills home quota
Package installs land in `~/.beast/2.7/` by default. For a shared install, use `-packagedir /vast/projects/<proj>/sw/beast2-packages` in the `beast` call (templates in `betty-ai/templates/slurm/beast2_resume.sbatch.j2` already do this).

### Output to `$HOME` fills your 50 GB quota
A 500M-state chain on a 5535-taxon dataset writes ~10–30 GB to `.trees`. Always run in `/vast/projects/<proj>/runs/`. See [[vast-storage]].

## When resume *won't* save you
- **XML changed mid-chain**: if you edit the model, priors, or operators in the XML between runs, `-resume` will error (state file references the old model topology). Either resume with the original XML or start fresh.
- **BEAST2 version changed**: state files are mostly forward-compatible within a 2.7.x series but not guaranteed across major versions. Pin your version (`ml beast2/2.7.7`) for long chains.
- **Filesystem clobbered**: if you delete the `.state` file, it's gone. There is no recovery — the `.log` and `.trees` files alone do not contain enough state to resume.

## Validated against
- Live smoke test on 2026-05-18 against the wild-aves HA empirical XML (5535 taxa) at sample 120.5M — resume picked up cleanly and `.log` continued past the pre-resume sample. See [[2026-05-18-beast2-resume-smoke-test]].
- Prior production chain `slurm-5708953` (`/vast/projects/ryb/parcc-data-science/tests/beast2/`) hit walltime, was resumed three times across a 21-day chain, produced a single combined `.log` with no gaps.

## See also
- [[beast-checkpointing]] — companion reference covering BEAST**1** + BEAST**2** restart side-by-side; read that if you also use BEAST1 (which does NOT auto-checkpoint and is the more dangerous case)
- [[beast2-on-betty]] — the broader BEAST2 / Betty page (partitions, BEAGLE backends, heap sizing, replica patterns)
- [[beast-phylonco]] — single-cell phylogenetics on top of BEAST2; same resume pattern applies
- [[slurm-on-betty]] — `--dependency`, `--requeue`, `--signal` reference
- [[genoa-std-mem-partition]] — where most BEAST2 chains land
- [[vast-storage]] — why `/vast/projects/` not `$HOME`
- `betty-ai/templates/slurm/beast2_resume.sbatch.j2` — Jinja2 template with replica-array support

## Sources
- [[2026-05-18-beast2-resume-smoke-test]] — Live verification of the runbook on Betty
