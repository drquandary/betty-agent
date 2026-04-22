---
type: entity
tags: [betty, user-group, bioinformatics, pathobiology, penn-vet]
created: 2026-04-22
updated: 2026-04-22
sources: []
related: [betty-cluster]
status: current
---

# Moncla Lab

## One-line summary
Penn Vet Pathobiology research group studying RNA virus emergence, evolution, and transmission using phylodynamics and population genetics

## Overview

**PI**: Louise Moncla (lhmoncla@upenn.edu)
**Institution**: University of Pennsylvania School of Veterinary Medicine, Department of Pathobiology
**Status**: Assistant Professor, 2024 Pew Biomedical Scholar
**Research focus**: Highly pathogenic H5Nx avian influenza, viral evolution, phylodynamics

## Research domains

### Active work
- **Phylogenetic / phylodynamic inference** — Nextstrain builds (maintain nextstrain-ceirr for CEIRR network), BEAST-style Bayesian tree inference, ancestral state reconstruction
- **Viral deep-sequencing pipelines** — Within-host RNA virus sequence data processing (illumina_pipeline repo), short-read alignment, variant calling, QC at scale
- **H5N1 / HPAI surveillance analyses** — Active cattle H5N1 surveillance, USDA cattle dataset analysis, North American HPAI tracking, h5nx clade analysis
- **Machine learning host classification** — h5n1-host-classification repo classifying sequences as wild/domestic/human origin
- **Genome-wide association studies** — h5n1-gwas identifying host-switching mutations in cattle H5N1 data
- **Influenza genotyping automation** — GenoFLU-multi pipeline forked from USDA

### Public repositories
- `nextstrain-ceirr` — CEIRR network Nextstrain builds
- `illumina_pipeline` — Within-host viral sequence processing
- `avian-flu-USDA-cattle` — Cattle H5N1 surveillance
- `North-American-HPAI` — Continental HPAI tracking
- `h5nx-Clades` — H5Nx clade classification
- `h5n1-host-classification` — ML host prediction
- `h5n1-gwas` — Host-switching mutation discovery
- `GenoFLU-multi` — Automated influenza genotyping

## Team composition

Approximately 9 users (as of 2026-04-22):
- Postdocs
- Graduate students (affiliated with Microbiology/Virology/Parasitology, Genomics and Computational Biology, and Biology programs)
- Rotating students

All running bioinformatics workflows on viral genomic data with H5N1 surveillance as current priority.

## Betty cluster workload characteristics

### Computation profile
**Primary**: CPU-bound bioinformatics pipelines
**Secondary**: Limited GPU needs (ML host classification)
**NOT needed**: LLM fine-tuning, large-scale deep learning

### Typical job patterns
1. **Long-running Bayesian inference** — BEAST phylogenetic jobs, can run for days to weeks, embarrassingly long single-node jobs
2. **Pipeline array jobs** — Many samples processed in parallel (hundreds to thousands), short to medium duration
3. **Sequence alignment / variant calling** — BWA, bowtie2, samtools, bcftools workflows
4. **Phylogenetic tree building** — RAxML, IQ-TREE, FastTree on large sequence sets
5. **QC and filtering** — FastQC, MultiQC, custom scripts on many files
6. **ML host classification** — Small GPU jobs (CPU-based inference likely sufficient)
7. **GWAS analysis** — CPU-bound statistical analysis on variant data

### Resource priorities
- **Storage**: High priority — viral sequence data, alignment files, VCF files, tree files
- **CPU partitions**: Primary compute resource (genoa-std-mem, genoa-lrg-mem)
- **Scheduler intro**: Critical — array jobs, job dependencies, resource requests
- **GPU partitions**: Low priority — only for specific ML tasks
- **Environment management**: conda/mamba for bioinformatics software stacks

## Onboarding priorities

1. **Storage architecture** — `parcc_quota.py`, `/vast/projects/` organization, data lifecycle
2. **Slurm fundamentals** — `sbatch`, array jobs (`--array=1-1000`), dependencies (`--dependency=afterok:JOBID`)
3. **CPU partition selection** — when to use standard vs large-memory nodes
4. **Conda environment setup** — creating shared environments in project space
5. **Common bioinformatics patterns** — pipeline templates for their specific tools
6. **Job monitoring** — `squeue`, `parcc_sfree.py`, `parcc_sdebug.py` for failed jobs
7. **Data management** — best practices for large sequence datasets

## Templates needed

Betty Agent should provide ready-to-use templates for:

- **Phylogenetic inference**: BEAST, RAxML, IQ-TREE job scripts with appropriate CPU/memory/time allocation
- **Pipeline workflows**: Array job templates for sample-parallel processing
- **Sequence alignment**: BWA/bowtie2 array jobs with dependency chains
- **Variant calling**: GATK/bcftools pipelines with scatter-gather patterns
- **Nextstrain builds**: CI/CD-style automated tree building
- **QC batches**: FastQC array jobs with MultiQC aggregation

## Betty Agent interaction patterns

### Sample conversation flows

**User**: "I need to run BEAST on 500 sequences for 50M generations"
**Agent**: Asks about: output frequency, chains, threading preference → Calculates: 1 node, 32 cores, ~72 hours → Generates: Slurm script with checkpoint saving, auto-restart on timeout

**User**: "Process 1200 illumina samples through variant calling pipeline"
**Agent**: Asks about: reference genome, coverage targets, VCF output → Calculates: Array job 1-1200, per-sample resources → Generates: Multi-stage pipeline with dependencies (align → call → filter → QC)

**User**: "Run Nextstrain build on latest cattle H5N1 sequences"
**Agent**: Asks about: data location, build config, augur version → Generates: Slurm job with conda env, references existing Nextstrain setup if present

## Knowledge gaps to fill

- Specific BEAST/RAxML/IQ-TREE runtime characteristics on Betty CPUs
- Typical dataset sizes and processing times for their pipelines
- Storage requirements per analysis type
- Conda environment specifications for their tool stack
- Integration with existing lab data management practices

## See also

- [[betty-cluster]]
- [[genoa-std-mem-partition]]
- [[genoa-lrg-mem-partition]]
- [[parcc-helper-tools]]

## Sources

- User request 2026-04-22 (initial lab description)
