'use client';

import { useEffect, useRef, useState } from 'react';
import {
  CHAT_PREFERENCES_STORAGE_KEY,
  DEFAULT_CHAT_PREFERENCES,
  readStoredChatPreferences,
  resolveChatPreferences,
  writeStoredChatPreferences,
  type ChatPreferences,
  type ChatProvider,
} from '@/lib/chat-preferences';
import { cn } from '@/lib/utils';

const PROVIDERS: Array<{
  id: ChatProvider;
  name: string;
  detail: string;
}> = [
  {
    id: 'claude-code',
    name: 'Claude Code OAuth',
    detail: 'Tool-enabled Betty agent',
  },
  {
    id: 'local-qwen',
    name: 'Local Qwen',
    detail: '127.0.0.1:1234',
  },
  {
    id: 'openai',
    name: 'OpenAI API key',
    detail: 'Use OPENAI_API_KEY',
  },
  {
    id: 'litellm-parcc',
    name: 'PARCC LiteLLM',
    detail: 'litellm.parcc.upenn.edu',
  },
];

export function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [preferences, setPreferences] = useState<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPreferences(readStoredChatPreferences());
  }, []);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const updatePreferences = (next: Partial<ChatPreferences>) => {
    const draft = { ...preferences, ...next };
    setPreferences(draft);
    window.localStorage.setItem(CHAT_PREFERENCES_STORAGE_KEY, JSON.stringify(draft));
    window.dispatchEvent(
      new CustomEvent('betty-ai:preferences-changed', { detail: resolveChatPreferences(draft) }),
    );
  };

  const selectProvider = (provider: ChatProvider) => {
    const resolved = resolveChatPreferences({ provider });
    setPreferences(writeStoredChatPreferences(resolved));
  };

  const openNextDevTools = () => {
    window.dispatchEvent(new CustomEvent('betty-ai:open-next-devtools'));
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="group flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-gradient-to-b from-indigo-500 to-indigo-600 px-2.5 text-xs font-semibold text-white shadow-md shadow-indigo-950/40 ring-1 ring-white/10 transition hover:from-indigo-400 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/50"
      >
        <span className="flex h-5.5 w-5.5 items-center justify-center rounded-md bg-white/15 text-[11px] font-bold">
          B
        </span>
        <span>Options</span>
        <span
          aria-hidden="true"
          className={cn('text-[9px] opacity-80 transition-transform duration-200', open && 'rotate-180')}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="surface-elevated absolute left-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-xl p-3 text-zinc-100"
        >
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] pb-3">
            <div>
              <p className="text-[13px] font-semibold tracking-tight">Preferences</p>
              <p className="mt-0.5 text-[11px] text-zinc-500">Model provider &amp; routing</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-medium text-emerald-300">
              {preferences.label}
            </span>
          </div>

          <div className="space-y-1.5 py-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                role="menuitemradio"
                aria-checked={preferences.provider === provider.id}
                onClick={() => selectProvider(provider.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left transition',
                  preferences.provider === provider.id
                    ? 'border-indigo-400/40 bg-indigo-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.04]',
                )}
              >
                <span>
                  <span className="block text-[12.5px] font-medium text-zinc-100">{provider.name}</span>
                  <span className="block text-[11px] text-zinc-500">{provider.detail}</span>
                </span>
                <span
                  className={cn(
                    'h-2 w-2 rounded-full transition',
                    preferences.provider === provider.id
                      ? 'bg-indigo-400 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]'
                      : 'bg-zinc-700',
                  )}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2 border-t border-white/[0.06] pt-3">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Model
            </label>
            {preferences.provider === 'litellm-parcc' ? (
              <LiteLLMModelPicker
                value={preferences.model}
                onChange={(model) => updatePreferences({ model })}
              />
            ) : (
              <input
                value={preferences.model}
                onChange={(event) => updatePreferences({ model: event.target.value })}
                className="w-full rounded-md border border-white/10 bg-[var(--surface-canvas)] px-2.5 py-1.5 text-[12px] text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            )}
            {preferences.baseUrl && (
              <>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  Base URL
                </label>
                <input
                  value={preferences.baseUrl}
                  onChange={(event) => updatePreferences({ baseUrl: event.target.value })}
                  className="w-full rounded-md border border-white/10 bg-[var(--surface-canvas)] px-2.5 py-1.5 text-[12px] text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
                />
              </>
            )}
          </div>

          <div className="mt-3 border-t border-white/[0.06] pt-3 text-[11px] text-zinc-500">
            {process.env.NODE_ENV === 'development' && (
              <button
                type="button"
                role="menuitem"
                onClick={openNextDevTools}
                className="mb-3 flex w-full items-center justify-between rounded-md border border-slate-800 bg-slate-900/50 px-2.5 py-2 text-left text-xs text-slate-100 transition hover:border-slate-700 hover:bg-slate-900"
              >
                <span>
                  <span className="block font-medium">Next.js Dev Tools</span>
                  <span className="block text-[11px] text-slate-500">Open framework tools</span>
                </span>
                <span className="text-slate-500">Open</span>
              </button>
            )}
            <div className="flex justify-between gap-3">
              <span>Chat route</span>
              <code className="text-slate-300">/api/chat</code>
            </div>
            <div className="mt-1 flex justify-between gap-3">
              <span>Turbopack</span>
              <code className="text-slate-300">npm run dev:turbo</code>
            </div>
            <p className="mt-2 leading-relaxed">
              ChatGPT login is not used directly here. Use an OpenAI API key on the server.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

interface LiteLLMModelsResponse {
  ok: boolean;
  models: string[];
  error?: string;
}

function LiteLLMModelPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (model: string) => void;
}) {
  const [models, setModels] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/litellm/models', { cache: 'no-store' });
        const body = (await res.json()) as LiteLLMModelsResponse;
        if (cancelled) return;
        if (body.ok) setModels(body.models);
        else setError(body.error ?? 'failed to load models');
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Always include the current value in the options list, even if the
  // gateway hasn't reported it yet (handles stale preference values).
  const options = models
    ? Array.from(new Set([...(models ?? []), value])).filter(Boolean).sort()
    : [value];
  const loading = models === null && !error;

  const displayHint = (id: string) => {
    if (/qwen/i.test(id)) return ' · better tool-calling';
    if (/120b/i.test(id)) return ' · default';
    if (/20b/i.test(id)) return ' · fast';
    return '';
  };

  return (
    <div className="space-y-1">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {id}
            {displayHint(id)}
          </option>
        ))}
      </select>
      <p className="text-[10px] text-slate-600">
        {loading
          ? 'loading models from gateway…'
          : error
            ? `gateway error: ${error}`
            : `${models?.length ?? 0} model${models?.length === 1 ? '' : 's'} available · refreshed on menu open`}
      </p>
    </div>
  );
}

export function HeaderProviderBadge() {
  const [preferences, setPreferences] = useState<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);

  useEffect(() => {
    setPreferences(readStoredChatPreferences());
    const onChange = (event: Event) => {
      setPreferences(resolveChatPreferences((event as CustomEvent<ChatPreferences>).detail));
    };
    window.addEventListener('betty-ai:preferences-changed', onChange);
    return () => window.removeEventListener('betty-ai:preferences-changed', onChange);
  }, []);

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />
      <span>{preferences.label}</span>
    </div>
  );
}
