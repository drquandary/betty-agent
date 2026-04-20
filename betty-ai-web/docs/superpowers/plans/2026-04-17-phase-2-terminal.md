# Phase 2 Terminal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Phase 1 terminal placeholder with a user-driven live terminal that can start a local shell and SSH to Betty.

**Architecture:** Run a local WebSocket PTY bridge beside Next.js. The browser renders `xterm.js`, sends keystrokes and resize events over WebSocket, and can request a fresh local shell or an SSH process targeting Betty. The chat agent remains read-only in Phase 2 and does not execute terminal commands.

**Tech Stack:** Next.js 15, React 19, `@xterm/xterm`, `@xterm/addon-fit`, `ws`, `node-pty`, Vitest.

---

### Task 1: Terminal Protocol

**Files:**
- Create: `src/lib/terminal-protocol.ts`
- Test: `src/lib/terminal-protocol.test.ts`

- [ ] **Step 1: Write failing tests for URL and Betty target helpers**

```ts
import { describe, expect, it } from 'vitest';
import { getTerminalWsUrl, getBettySshTarget } from './terminal-protocol';

describe('getTerminalWsUrl', () => {
  it('uses localhost port 3001 in the browser by default', () => {
    expect(getTerminalWsUrl('http:', 'localhost')).toBe('ws://localhost:3001/terminal');
  });

  it('uses secure websocket when the page is https', () => {
    expect(getTerminalWsUrl('https:', 'betty.local')).toBe('wss://betty.local:3001/terminal');
  });
});

describe('getBettySshTarget', () => {
  it('combines user and host into a normal SSH target', () => {
    expect(getBettySshTarget('jvadala', 'login.betty.parcc.upenn.edu')).toBe(
      'jvadala@login.betty.parcc.upenn.edu',
    );
  });
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `npm test -- src/lib/terminal-protocol.test.ts`

Expected: FAIL because `src/lib/terminal-protocol.ts` does not exist.

- [ ] **Step 3: Implement helpers and protocol types**

Create `src/lib/terminal-protocol.ts` with exported message types, defaults, `getTerminalWsUrl`, and `getBettySshTarget`.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- src/lib/terminal-protocol.test.ts`

Expected: PASS.

### Task 2: Local PTY Bridge

**Files:**
- Create: `scripts/terminal-server.mjs`
- Create: `scripts/dev-phase2.mjs`
- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Add runtime dependencies**

Run: `npm install @xterm/xterm @xterm/addon-fit ws node-pty && npm install -D @types/ws`

- [ ] **Step 2: Implement the WebSocket PTY bridge**

Create a server bound to `127.0.0.1:3001` by default. On each connection, spawn the user shell. Handle JSON messages: `input`, `resize`, `connect-betty`, `restart-local`, and `disconnect`.

- [ ] **Step 3: Add dev script**

Add `terminal:server` and `dev:phase2` scripts. `dev:phase2` starts `scripts/terminal-server.mjs` and `next dev --turbo` together.

### Task 3: Terminal UI

**Files:**
- Create: `src/components/TerminalPane.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/StatusBar.tsx`

- [ ] **Step 1: Replace `TerminalPlaceholder` with `TerminalPane`**

Render xterm in the right pane with buttons for reconnecting local shell, connecting to Betty, and disconnecting.

- [ ] **Step 2: Dispatch terminal status changes**

Emit browser events for `connecting`, `connected`, `betty`, `disconnected`, and `error`; update the status bar terminal chip.

### Task 4: Verification

**Files:**
- Modify as needed from previous tasks.

- [ ] **Step 1: Run unit tests**

Run: `npm test -- src/lib/terminal-protocol.test.ts src/agent/providers.test.ts`

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck && npm run build`

- [ ] **Step 3: Restart dev server for Phase 2**

Run: `npm run dev:phase2`

- [ ] **Step 4: Browser verify**

Open `http://localhost:3000`, confirm the right pane renders a terminal, the bottom-left Next dev badge stays hidden, and the “Connect Betty” button writes an SSH session prompt into the terminal pane.
