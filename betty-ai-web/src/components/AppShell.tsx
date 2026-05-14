'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConnectionBadge } from './ConnectionBadge';
import { HeaderMenu, HeaderProviderBadge } from './HeaderMenu';
import { JobsPane } from './JobsPane';
import { NextDevToolsOffset } from './NextDevToolsOffset';
import { StatusBar } from './StatusBar';
import { TerminalPane } from './TerminalPane';
import { ChatPane } from './ChatPane';
import { WikiLintButton } from './WikiLintButton';
import { ClusterOverviewCard } from './dashboard/ClusterOverviewCard';
import { UserStatsCard } from './dashboard/UserStatsCard';
import { SchedulingCard } from './dashboard/SchedulingCard';
import { DocsLinksCard } from './dashboard/DocsLinksCard';
import { DashboardChatPanel } from './dashboard/DashboardChatPanel';
import { CommandsView } from './dashboard/CommandsView';
import { MonitoringView } from './monitoring/MonitoringView';
import { TabStrip, isDashboardView, type DashboardView } from './dashboard/TabStrip';

interface Props {
  /** Mirrors process.env.NEXT_PUBLIC_BETTY_DEPLOY_TARGET from the server. */
  deployTarget: string;
  /** Optional override for tests so we don't depend on window.location. */
  initialView?: DashboardView;
}

const STORAGE_VIEW_KEY = 'betty-dashboard-view';

function readInitialView(fallback: DashboardView): DashboardView {
  if (typeof window === 'undefined') return fallback;
  const hash = window.location.hash.replace(/^#/, '');
  if (isDashboardView(hash)) return hash;
  try {
    const stored = window.localStorage.getItem(STORAGE_VIEW_KEY);
    if (stored && isDashboardView(stored)) return stored;
  } catch {
    /* private mode — ignore */
  }
  return fallback;
}

export function AppShell({ deployTarget, initialView }: Props) {
  const [view, setView] = useState<DashboardView>(initialView ?? 'dashboard');
  const [chatPrompt, setChatPrompt] = useState<string | null>(null);
  const showTerminal = deployTarget !== 'ood';

  // Sync initial view from URL hash / localStorage on mount (client only).
  useEffect(() => {
    if (initialView) return;
    setView(readInitialView('dashboard'));
  }, [initialView]);

  // Persist view changes.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.location.hash = view;
      window.localStorage.setItem(STORAGE_VIEW_KEY, view);
    } catch {
      /* ignore */
    }
  }, [view]);

  const handleScheduling = useCallback((prompt: string) => {
    setChatPrompt(prompt);
    setView('workspace');
  }, []);

  const handlePromptConsumed = useCallback(() => {
    setChatPrompt(null);
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <NextDevToolsOffset />
      <header className="relative z-40 flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--surface-raised)]/70 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <HeaderMenu />
          <div>
            <h1 className="bg-gradient-to-b from-white to-zinc-400 bg-clip-text text-sm font-semibold tracking-tight text-transparent">
              Betty AI
            </h1>
            <p className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
              PARCC · Betty HPC
            </p>
          </div>
        </div>
        <TabStrip current={view} onChange={setView} />
        <div className="flex items-center gap-2.5">
          <WikiLintButton />
          <ConnectionBadge />
          <HeaderProviderBadge />
        </div>
      </header>

      {view === 'dashboard' && (
        <main
          data-testid="dashboard-view"
          className="scroll-custom flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/10 via-transparent to-transparent px-4 py-4 md:px-6 md:py-6"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <ClusterOverviewCard />
              <UserStatsCard />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <SchedulingCard onSubmit={handleScheduling} />
              <DocsLinksCard />
            </div>
            <DashboardChatPanel
              initialPrompt={chatPrompt}
              onInitialPromptConsumed={handlePromptConsumed}
              onOpenWorkspace={() => setView('workspace')}
            />
          </div>
        </main>
      )}

      {view === 'commands' && <CommandsView />}

      {view === 'monitoring' && <MonitoringView />}

      {view === 'workspace' && (
        <main
          data-testid="workspace-view"
          className="flex min-h-0 flex-1 flex-col md:flex-row"
        >
          <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/[0.06] md:border-b-0 md:border-r">
            <ChatPane
              initialPrompt={chatPrompt}
              onInitialPromptConsumed={handlePromptConsumed}
            />
          </section>
          <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-terminal)]/60">
            <JobsPane />
            {showTerminal && <TerminalPane />}
          </aside>
        </main>
      )}

      <StatusBar />
    </div>
  );
}
