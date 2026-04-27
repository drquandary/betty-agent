---
type: concept
tags: [beast2, phylonco, single-cell, phylogenetics, bayesian, mcmc, error-models]
created: 2026-04-27
updated: 2026-04-27
sources: []
related: [beast2-on-betty, genoa-std-mem-partition, genoa-lrg-mem-partition, vast-storage, slurm-on-betty]
status: tentative
---

# BEAST-Phylonco

## One-line summary
Phylonco is a [BEAST2](https://www.beast2.org/) package ([bioDS/beast-phylonco](https://github.com/bioDS/beast-phylonco)) for Bayesian phylogenetic inference from **single-cell genomic data**, with explicit error models for allelic dropout, amplification error, and sequencing noise. On Betty it inherits BEAST2's deployment shape ([[beast2-on-betty]]) — Genoa CPU partitions, the checkpoint-and-chain pattern, multi-week wall times — and adds a one-time package-manager install step.

## What phylonco actually adds to BEAST2
- **Error-aware substitution models** for binary (presence/absence of a variant), nucleotide, and ternary (genotype) data. Standard BEAST2 substitution models assume noise-free observations — a non-starter for single-cell data where a single cell's genome is amplified ~10⁶× before sequencing.
- **Genotype likelihoods** as input rather than hard genotype calls — propagates uncertainty from the variant caller into the phylogenetic posterior.
- **Tree priors** appropriate for cell lineages (cellular coalescent, sampled-ancestor variants).

The package is a JAR plus XML schema extensions. Once installed, phylonco operators and likelihoods become available as element types in standard BEAST2 XML — the run loop, MCMC machinery, and BEAGLE integration are all stock BEAST2.

## Why this matters for Betty wall-time policy
Single-cell phylogenetic chains are the **worst case** for MCMC convergence on Betty:
- Per-cell error models add many nuisance parameters → slower mixing.
- Genotype-likelihood input means each per-step likelihood call is more expensive than for hard-call alignments.
- Realistic single-cell datasets (hundreds of cells × thousands of sites) routinely need **weeks** of chain time per replica, with multiple replicas required for convergence diagnostics.

When a phylonco group asks for a wall-time extension beyond Betty's 7-day policy, this is the expected workload — not a misconfiguration. The right answer is **not** a custom long-running queue; it's the [[beast2-on-betty]] checkpoint-and-chain pattern. See *Workflow recipe* below.

## Install on Betty (project-dir, shared)

The standard BEAST2 install path is described in [[beast2-on-betty]]. To add phylonco on top:

```bash
PROJ=/vast/projects/<project>
BEAST="${PROJ}/sw/beast"

# packagemanager defaults to ~/.beast/2.7/ — redirect to the project dir
# so all users on the project share one copy and home quotas don't fill.
PKG_DIR="${PROJ}/sw/beast2-packages"
mkdir -p "${PKG_DIR}"

"${BEAST}/bin/packagemanager" -dir "${PKG_DIR}" -add phylonco

# Verify
"${BEAST}/bin/packagemanager" -dir "${PKG_DIR}" -list | grep -i phylonco
```

Each user on the project then exports `BEAST_PACKAGE_PATH` (BEAST2 ≥ 2.7) or runs BEAST with `-packagedir "${PKG_DIR}"` so they pick up the shared install:

```bash
export BEAST_PACKAGE_PATH="${PROJ}/sw/beast2-packages"
beast -packagedir "${BEAST_PACKAGE_PATH}" analysis.xml
```

If packagemanager rejects the version pin, try the GitHub release tarball directly:

```bash
# Replace <ver> with a tag from https://github.com/bioDS/beast-phylonco/releases
curl -L -o phylonco.zip \
  "https://github.com/bioDS/beast-phylonco/releases/download/<ver>/phylonco.zip"
unzip -d "${PKG_DIR}/Phylonco" phylonco.zip
```

## Workflow recipe (recommended for any phylonco group on Betty)

This is the configuration to give a single-cell phylogenetics group when they ask "how do we run this on Betty for >7 days":

1. **Install phylonco once into a shared project dir** (see above). One install, all users.
2. **Pre-flight on a Genoa node**: 10k-step run of the actual XML to estimate per-step wall time. If a 10M-step chain is needed and per-step time is ~50 ms, that's ~6 days — chain three 7-day jobs to be safe.
3. **Set `storeEvery` in the BEAST2 XML** to bound re-work on requeue. Rule of thumb: 1M steps for chains running ~10M steps/day. Look for `<run ... storeEvery="...">` in the XML.
4. **Submit independent replicas as a Slurm array** (4 replicas is the typical minimum for convergence diagnostics):
   ```bash
   sbatch --array=1-4 betty-ai/templates/slurm/beast2_resume.sbatch.j2-rendered.sh
   ```
   Each task uses `-seed ${SLURM_ARRAY_TASK_ID}` so seeds are distinct and reproducible.
5. **Chain each replica with `--dependency=afterok`** for as many 7-day chunks as the chain needs. The `beast2_resume` template supports this directly via `-resume`.
6. **Combine after all replicas finish** with `LogCombiner` (10% burn-in is a reasonable default; tune by Tracer ESS):
   ```bash
   logcombiner -log run-1.log -log run-2.log -log run-3.log -log run-4.log \
               -o combined.log -burnin 10
   logcombiner -log run-1.trees -log run-2.trees -log run-3.trees -log run-4.trees \
               -o combined.trees -burnin 10
   treeannotator -burnin 10 combined.trees mcc.tree
   ```
7. **Inspect ESS in Tracer** before reporting results. Any parameter with ESS < 200 means more chain length is needed; <50 means the model isn't mixing and adding wall time won't help.

The slurm template at `betty-ai/templates/slurm/beast2_resume.sbatch.j2` is parameterized for this workflow — pass `xml_file=analysis.xml`, `replicas=4`, and the template handles the array + seed wiring.

## Common pitfalls (phylonco-specific, on top of [[beast2-on-betty]])

- **Hard-call genotypes passed as if they were uncertain** — defeats the whole point of phylonco's error models. Verify the input alignment uses one of phylonco's likelihood-aware datatypes, not a standard BEAST2 nucleotide alignment.
- **Allelic dropout rate fixed at zero** in the XML — phylonco's error model becomes a no-op. Confirm the dropout-rate operator is active and the prior is informative.
- **Mixing diagnosed by chain length alone** — for single-cell data, low ESS often means too many parameters for the dataset (overparameterization), not too short a chain. Adding wall time won't fix this; the model may need to be simplified.
- **Per-cell error rates not identifiable** — if every cell has its own dropout/amp-error rate, the model usually can't tell them apart from the data. Phylonco supports cell-shared rates as a default; only turn on per-cell rates with strong prior reasons.

## See also
- [[beast2-on-betty]] — base BEAST2 deployment, Slurm template, partition cheat-sheet, checkpoint pattern
- [[genoa-std-mem-partition]]
- [[genoa-lrg-mem-partition]]
- [[vast-storage]]
- [[slurm-on-betty]]

## Sources
<!-- No cited sources yet — page seeded from general phylonco + BEAST2 knowledge.
     Next ingest should attach the actual phylonco group's analysis XML,
     a successful packagemanager install log, and a benchmark from a real run. -->
