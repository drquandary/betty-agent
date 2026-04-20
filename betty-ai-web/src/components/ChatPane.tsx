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

export function ChatPane() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingPermissions, setPendingPermissions] = useState<ToolPermissionRequest[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-3 backdrop-blur">
        <div className="mx-auto max-w-3xl space-y-2">
          <QuickStartTiles onPick={(p) => void send(p)} disabled={busy} />
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask Betty AI anything about the cluster…"
              rows={2}
              disabled={busy}
              className="w-full resize-none rounded-xl border border-slate-800 bg-slate-900/60 px-3.5 py-2.5 pr-20 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-600 focus:outline-none focus:ring-1 focus:ring-indigo-600 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={busy || !input.trim()}
              onClick={() => void send(input)}
              className="absolute bottom-2 right-2 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
            >
              {busy ? 'Thinking…' : 'Send ↵'}
            </button>
          </div>
          <p className="text-[10px] text-slate-600">
            Enter to send · Shift+Enter for newline · Phase 2: wiki writes + cluster tools live (with confirmation)
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto mt-16 flex max-w-xl flex-col items-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 ring-1 ring-indigo-500/40">
        <span className="text-2xl">👋</span>
      </div>
      <h1 className="text-xl font-semibold text-slate-100">Hi Jeff, I&apos;m Betty AI.</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        I help you use the Betty cluster without writing sbatch by hand. Ask me about
        partitions, storage, OOD, fine-tuning a model, or known issues — I&apos;ll check the
        wiki and answer with citations.
      </p>
      <p className="mt-3 text-xs text-slate-500">Pick a quick-start below, or type a question.</p>
    </div>
  );
}
