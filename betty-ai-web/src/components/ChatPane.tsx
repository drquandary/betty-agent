'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChatMessage, type DisplayMessage } from './ChatMessage';
import { QuickStartTiles } from './QuickStartTiles';
import {
  ToolPermissionCard,
  type ToolPermissionRequest,
} from './ToolPermissionCard';
import { readStoredChatPreferences } from '@/lib/chat-preferences';

type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool'; name: string; status: 'start' | 'end' }
  | { type: 'system'; tools: string[]; model: string }
  | {
      type: 'tool_permission';
      id: string;
      toolName: string;
      tier?: 0 | 1 | 2;
      input: unknown;
      summary?: string;
    }
  | { type: 'done'; result?: string; durationMs?: number; costUsd?: number; turns?: number }
  | { type: 'error'; message: string };

const CHAT_HISTORY_STORAGE_KEY = 'betty-ai-chat-history';

export function ChatPane() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPermissions, setPendingPermissions] = useState<ToolPermissionRequest[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Rehydrate messages from localStorage on mount. We deliberately skip any
  // "streaming" messages from a prior session — those are partial and would
  // confuse the UI; losing a torn-off streaming message is acceptable.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as DisplayMessage[];
      if (Array.isArray(parsed)) {
        setMessages(parsed.filter((m) => !m.streaming));
      }
    } catch {
      /* corrupt storage — ignore */
    }
  }, []);

  // Persist on every change. Writing during streaming is intentional: if the
  // user reloads mid-stream, they still see the partial answer.
  useEffect(() => {
    try {
      window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages));
    } catch {
      /* quota full — drop silently */
    }
  }, [messages]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const clearHistory = useCallback(() => {
    setMessages([]);
    setError(null);
    try {
      window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    setError(null);
    const userMsg: DisplayMessage = { role: 'user', content: trimmed };
    const assistantMsg: DisplayMessage = { role: 'assistant', content: '', streaming: true };
    const nextHistory: DisplayMessage[] = [...messages, userMsg, assistantMsg];
    setMessages(nextHistory);
    setInput('');
    setBusy(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences: readStoredChatPreferences(),
          history: nextHistory
            .filter((m) => !(m.role === 'assistant' && m.streaming))
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed: ${res.status} ${res.statusText}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Read SSE stream
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE messages (separated by \n\n)
        let idx: number;
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith('data:')) continue;
          const payload = raw.slice(5).trim();
          if (!payload) continue;

          try {
            const event: StreamEvent = JSON.parse(payload);
            handleEvent(event);
          } catch (e) {
            console.warn('SSE parse error:', e, payload);
          }
        }
      }

      // Mark assistant message as no longer streaming
      setMessages((ms) => {
        const copy = [...ms];
        for (let i = copy.length - 1; i >= 0; i--) {
          if (copy[i].role === 'assistant' && copy[i].streaming) {
            copy[i] = { ...copy[i], streaming: false };
            break;
          }
        }
        return copy;
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMessages((ms) => ms.filter((m) => !(m.role === 'assistant' && m.streaming)));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }

    function handleEvent(event: StreamEvent) {
      if (event.type === 'text') {
        setMessages((ms) => {
          const copy = [...ms];
          for (let i = copy.length - 1; i >= 0; i--) {
            if (copy[i].role === 'assistant' && copy[i].streaming) {
              copy[i] = { ...copy[i], content: copy[i].content + event.delta };
              break;
            }
          }
          return copy;
        });
      } else if (event.type === 'tool_permission') {
        setPendingPermissions((ps) => [
          ...ps,
          {
            id: event.id,
            toolName: event.toolName,
            tier: event.tier,
            input: event.input,
            summary: event.summary,
          },
        ]);
      } else if (event.type === 'error') {
        setError(event.message);
      }
      // 'done', 'system', 'tool' events are acknowledged but not rendered in Phase 1
    }
  }, [messages, busy]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const showEmpty = messages.length === 0;

  return (
    <div className="flex h-full flex-col">
      {/* Scrollable transcript */}
      <div ref={scrollRef} className="scroll-custom flex-1 overflow-y-auto px-4 py-4">
        {showEmpty ? (
          <EmptyState />
        ) : (
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.length > 0 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-[11px] text-slate-500 transition hover:text-slate-300"
                  title="Clear saved conversation history"
                >
                  Clear chat
                </button>
              </div>
            )}
            {messages.map((m, i) => (
              <ChatMessage key={i} message={m} />
            ))}
            {pendingPermissions.map((req) => (
              <ToolPermissionCard
                key={req.id}
                request={req}
                onResolved={() =>
                  setPendingPermissions((ps) => ps.filter((p) => p.id !== req.id))
                }
              />
            ))}
            {error && (
              <div className="rounded-lg border border-rose-900/60 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
                <span className="font-semibold">Error:</span> {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-white/[0.06] bg-[var(--surface-raised)]/70 px-4 py-3.5 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl space-y-2.5">
          <QuickStartTiles onPick={(p) => void send(p)} disabled={busy} />
          <div className="group relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Betty AI anything about the cluster…"
              rows={2}
              disabled={busy}
              className="w-full resize-none rounded-2xl border border-white/10 bg-[var(--surface-elevated)]/60 px-4 py-3 pr-24 text-sm text-zinc-100 placeholder:text-zinc-500 shadow-inner shadow-black/20 transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send(input)}
              className="absolute bottom-2.5 right-2.5 rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-950/40 ring-1 ring-white/10 transition hover:from-indigo-400 hover:to-indigo-500 disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-800 disabled:shadow-none disabled:ring-white/5"
            >
              {busy ? 'Thinking…' : 'Send ↵'}
            </button>
          </div>
          <p className="text-[10.5px] text-zinc-600">
            <kbd className="mx-0.5 rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">Enter</kbd>
            to send ·{' '}
            <kbd className="mx-0.5 rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">Shift</kbd>+
            <kbd className="mx-0.5 rounded border border-white/10 bg-white/5 px-1 font-mono text-[10px]">Enter</kbd>
            for newline
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-20 flex max-w-xl flex-col items-center text-center">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 blur-xl" aria-hidden="true">
          <div className="h-16 w-16 rounded-full bg-indigo-500/40" />
        </div>
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/30 to-amber-500/20 ring-1 ring-white/10 shadow-xl shadow-indigo-950/50">
          <span className="text-3xl">👋</span>
        </div>
      </div>
      <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
        Hi Jeff, I&apos;m Betty AI.
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-zinc-400">
        I help you use the Betty cluster without writing sbatch by hand. Ask me about
        partitions, storage, OOD, fine-tuning a model, or known issues — I&apos;ll check the
        wiki and answer with citations.
      </p>
      <p className="mt-4 text-xs text-zinc-500">Pick a quick-start below, or type a question.</p>
    </div>
  );
}
