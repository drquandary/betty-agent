# Betty AI — Web GUI

Conversational web app for the PARCC Betty HPC cluster, built on the
[Claude Agent SDK](https://docs.claude.com/en/api/agent-sdk/typescript).

**Status:** Phase 2 — chat plus user-driven terminal. Slurm submission and
learning loop come in later phases.

## Quick start

```bash
# 1. Install dependencies
cd betty-ai-web
npm install

# 2. Set your Anthropic API key
cp .env.example .env.local
# then edit .env.local and fill in ANTHROPIC_API_KEY

# 3. Run the dev server and terminal bridge
npm run dev:phase2
# open http://localhost:3000
```

Ask "What partitions does Betty have?" and Betty AI will search the wiki and
cite `[[entities/betty-cluster]]` in its answer.

## Architecture

```
browser ──SSE──▶ /api/chat ──▶ runAgentQuery() ──▶ Claude Agent SDK
                                       │
                                       ├── wiki_search   (grep wiki/*.md)
                                       ├── wiki_read     (read one wiki page)
                                       └── gpu_calculate (wraps betty-ai/models/gpu_calculator.py)
```

The app reads from `../wiki/` and `../betty-ai/` relative to this directory
(i.e. it expects to live as a subdirectory of `parcc1/`). Override with
`WIKI_PATH` and `BETTY_AI_PATH` env vars.

## Phases

| Phase | Scope | Status |
| --- | --- | --- |
| **P1** | Chat + wiki tools + quick-start tiles + status bar stub | ✅ this commit |
| **P2** | Terminal pane (xterm.js + node-pty), PTY bridge to Betty over SSH | ✅ current |
| **P3** | Slurm submit tools with `pty_preview` / `pty_exec` confirmation gating | 🟡 planned |
| **P4** | Session logging to SQLite + golden eval harness in `harness/` | 🟡 planned |

## File map

```
betty-ai-web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root HTML, dark mode
│   │   ├── page.tsx                   # Split layout: chat | terminal placeholder
│   │   ├── globals.css                # Tailwind + custom prose + scrollbar
│   │   └── api/chat/route.ts          # SSE endpoint — calls runAgentQuery()
│   ├── agent/
│   │   ├── system-prompt.ts           # Port of .claude/agents/betty-ai.md
│   │   ├── server.ts                  # runAgentQuery() + SDK config
│   │   ├── knowledge/loader.ts        # Reads wiki/index.md + log tail
│   │   └── tools/
│   │       ├── wiki-search.ts         # SDK tool: regex over wiki/*.md
│   │       ├── wiki-read.ts           # SDK tool: read one page
│   │       └── gpu-calculate.ts       # SDK tool: wraps Python calculator
│   ├── components/
│   │   ├── ChatPane.tsx               # Transcript + composer + quick-start
│   │   ├── ChatMessage.tsx            # One message bubble (markdown)
│   │   ├── QuickStartTiles.tsx        # 4 starter prompts
│   │   └── StatusBar.tsx              # Bottom chips (placeholders for now)
│   └── lib/utils.ts                   # cn() classname helper
├── .env.example
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.mjs
└── postcss.config.mjs
```

## Dev notes

- **Runtime:** Next.js API routes run on Node.js (not Edge) because the Agent
  SDK uses native modules.
- **Caching:** the system prompt includes a snapshot of `wiki/index.md` +
  `wiki/log.md`. The snapshot is cached in-memory after first load — restart
  the dev server if you edit those files and want to see changes immediately.
- **Security:** Phase 1 only uses read-only tools. Phase 2 will add PTY access
  behind a `canUseTool` confirmation flow.
- **Model:** defaults to `claude-sonnet-4-5`. Override with
  `BETTY_AI_MODEL=claude-opus-4-7` in `.env.local` (requires SDK ≥ 0.2.111).
