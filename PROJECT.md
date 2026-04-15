# Project Context — For Betty AI Agent

> This file tells the Betty AI agent about YOUR specific research project.
> Copy and customize this template for each project you work on.
> The agent reads this automatically at session start.

## Research Overview

**Project name**: _[Your project name]_
**PI / Lab**: _[Your PI]_
**Group**: _[Your research group]_
**Betty account**: _[e.g. jcombar1-betty-testing]_
**Allocation**: _[e.g. 12,000 PC]_

### Goal
_[1-3 sentence description of what this project is trying to achieve]_

### Current focus
_[What you're actively working on right now]_

---

## Model(s)

### Current base model
- **HF ID**: _[e.g. Qwen/Qwen2.5-VL-7B-Instruct]_
- **Wiki page**: `[[wiki/models/<model>.md]]`
- **Training framework**: _[LLaMA Factory, trl, custom, etc.]_
- **Method**: _[LoRA, full fine-tune, QLoRA, etc.]_

### Models considered but not used
_[List alternatives you've evaluated and why they weren't chosen]_

---

## Dataset

### Location
```
data/...        [describe your data files]
```

### Format
_[JSONL? ShareGPT? Instruction tuning? Image-text pairs?]_

### Size
- Training: _N_ samples
- Validation: _N_ samples
- Test: _N_ samples (if applicable)

### Preprocessing notes
_[Any non-obvious steps the agent should know about]_

---

## Betty-Specific Setup

### Paths on Betty
```
Project storage: /vast/projects/<your-project>
Conda envs:      /vast/projects/<your-project>/envs/
HF cache:        /vast/projects/<your-project>/hf_cache
Training runs:   /vast/projects/<your-project>/runs/
Dataset:         /vast/projects/<your-project>/data
```

### Environment
```bash
module load anaconda3/2023.09-0
source activate /vast/projects/<your-project>/envs/llm-finetune
```

Required packages: _[list non-obvious dependencies beyond the standard llm-finetune env]_

---

## Team Members

| Name | PennKey | Role | Focus |
|------|---------|------|-------|
| _[Name]_ | _[pennkey]_ | _[Role]_ | _[What they work on]_ |

---

## Common Tasks the Agent Should Know How To Do

1. _[Task 1 — e.g. "Train baseline model on current dataset"]_
2. _[Task 2 — e.g. "Evaluate checkpoint on held-out set"]_
3. _[Task 3 — e.g. "Serve model for team access"]_

---

## What Worked / What Didn't

### Worked
- _[Successful experiments with links to `[[wiki/experiments/...]]` pages]_

### Didn't work
- _[Failed experiments — document these so the agent doesn't suggest them again]_

---

## Known Issues & Gotchas

- `conda activate` doesn't work on Betty → use `source activate`
- Home dir is only 50 GB → always set HF_HOME to project storage
- `interact` helper script is broken → use `srun` directly
- _[Add project-specific gotchas here]_

---

## Next Steps / Roadmap

- [ ] _[Your next milestone]_
- [ ] _[Future work]_
