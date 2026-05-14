'use client';

import { ChatPane } from '@/components/ChatPane';

interface Props {
  /** Forwarded to ChatPane; cleared after dispatch by parent. */
  initialPrompt?: string | null;
  onInitialPromptConsumed?: () => void;
  /**
   * Caller wants to switch to a full chat view. Surface this so the
   * dashboard tab strip can navigate; the panel itself doesn't own routing.
   */
  onOpenWorkspace?: () => void;
}

/**
 * Compact embed of ChatPane for the dashboard grid. The full chat
 * (with terminal + jobs sidebar) lives on the Workspace tab. We never
 * fork chat logic — this is a layout wrapper that constrains height and
 * surfaces a "open in workspace" affordance.
 */
export function DashboardChatPanel({
  initialPrompt,
  onInitialPromptConsumed,
  onOpenWorkspace,
}: Props) {
  return (
    <section
      data-testid="dashboard-chat-panel"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] backdrop-blur-sm"
    >
      <header className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div>
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Betty AI
          </h2>
          <p className="mt-0.5 text-[10.5px] text-zinc-500">
            Ask anything — partitions, sbatch shapes, the wiki.
          </p>
        </div>
        {onOpenWorkspace && (
          <button
            type="button"
            onClick={onOpenWorkspace}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10.5px] text-zinc-300 transition hover:bg-white/[0.08]"
          >
            Open Workspace →
          </button>
        )}
      </header>
      <div className="flex min-h-[280px] flex-1 flex-col">
        <ChatPane
          initialPrompt={initialPrompt}
          onInitialPromptConsumed={onInitialPromptConsumed}
        />
      </div>
    </section>
  );
}
