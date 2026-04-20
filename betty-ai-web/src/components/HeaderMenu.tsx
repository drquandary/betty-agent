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
        className="group flex h-10 items-center gap-2 rounded-lg border border-indigo-400/60 bg-indigo-600 px-2.5 text-sm font-bold text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-300/30 transition hover:border-indigo-300 hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">B</span>
        <span className="text-xs font-semibold">Options</span>
        <span
          aria-hidden="true"
          className={cn('text-[10px] text-indigo-100 transition', open && 'rotate-180')}
        >
          v
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-slate-700 bg-slate-950 p-3 text-slate-100 shadow-2xl shadow-black/50"
        >
          <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <p className="text-sm font-semibold">Preferences</p>
              <p className="mt-0.5 text-xs text-slate-500">Betty routes and model provider</p>
            </div>
            <span className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-2 py-0.5 text-[11px] text-emerald-300">
              {preferences.label}
            </span>
          </div>

          <div className="space-y-2 py-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                type="button"
                role="menuitemradio"
                aria-checked={preferences.provider === provider.id}
                onClick={() => selectProvider(provider.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left transition',
                  preferences.provider === provider.id
                    ? 'border-indigo-500/80 bg-indigo-950/40'
                    : 'border-slate-800 bg-slate-900/50 hover:border-slate-700',
                )}
              >
                <span>
                  <span className="block text-xs font-medium text-slate-100">{provider.name}</span>
                  <span className="block text-[11px] text-slate-500">{provider.detail}</span>
                </span>
                <span
                  className={cn(
                    'h-2.5 w-2.5 rounded-full border',
                    preferences.provider === provider.id
                      ? 'border-indigo-300 bg-indigo-400'
                      : 'border-slate-600',
                  )}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-3">
            <label className="block text-[11px] font-medium uppercase tracking-normal text-slate-500">
              Model
            </label>
            <input
              value={preferences.model}
              onChange={(event) => updatePreferences({ model: event.target.value })}
              className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
            />
            {preferences.baseUrl && (
              <>
                <label className="block text-[11px] font-medium uppercase tracking-normal text-slate-500">
                  Base URL
                </label>
                <input
                  value={preferences.baseUrl}
                  onChange={(event) => updatePreferences({ baseUrl: event.target.value })}
                  className="w-full rounded-md border border-slate-800 bg-slate-900 px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-indigo-500"
                />
              </>
            )}
          </div>

          <div className="mt-3 border-t border-slate-800 pt-3 text-[11px] text-slate-500">
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
    <div className="text-xs text-slate-500">
      <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />{' '}
      <span className="align-middle">{preferences.label}</span>
    </div>
  );
}
