# Raw Sources

This directory holds **immutable source documents** per the Karpathy LLM Wiki pattern.

## Rules
- **Read-only for the agent.** Never modify files here.
- Drop new sources into the appropriate subfolder.
- After ingestion, source summaries live in `wiki/sources/`.

## Layout

```
raw/
├── docs/                  PARCC documentation, papers, articles, official guides
├── cluster_exploration/   Captured output from Betty exploration sessions (logs, screenshots)
├── experiments/           Raw training logs, metrics dumps, tensorboard exports
└── datasets/              Dataset documentation (the data itself stays in /data)
```

## How to ingest a new source
Tell Betty AI: "Ingest `raw/docs/new-paper.pdf`"
The agent will:
1. Read the source
2. Create a summary at `wiki/sources/YYYY-MM-DD-title.md`
3. Update relevant entity/concept/model pages
4. Update `wiki/index.md` and `wiki/log.md`
