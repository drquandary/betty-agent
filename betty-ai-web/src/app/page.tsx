import { ChatPane } from '@/components/ChatPane';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { HeaderMenu, HeaderProviderBadge } from '@/components/HeaderMenu';
import { JobsPane } from '@/components/JobsPane';
import { NextDevToolsOffset } from '@/components/NextDevToolsOffset';
import { StatusBar } from '@/components/StatusBar';
import { TerminalPane } from '@/components/TerminalPane';
import { WikiLintButton } from '@/components/WikiLintButton';

export default function HomePage() {
  // Under OOD the user already has a shell via the dashboard's Shell
  // Access tab to the same compute node; the split-pane xterm bridge
  // would duplicate it and require a second find_port / WS bridge.
  // Server-only read so NEXT_PUBLIC_ isn't needed on the client — the
  // page renders server-side and the prop flows down.
  const deployTarget = process.env.NEXT_PUBLIC_BETTY_DEPLOY_TARGET ?? 'local';
  const showTerminal = deployTarget !== 'ood';

  return (
    <div className="flex h-screen flex-col">
      <NextDevToolsOffset />
      {/* Header — translucent with warm gradient */}
      <header className="flex items-center justify-between border-b border-white/[0.06] bg-[var(--surface-raised)]/70 px-5 py-3 backdrop-blur-xl">
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
        <div className="flex items-center gap-2.5">
          <WikiLintButton />
          <ConnectionBadge />
          <HeaderProviderBadge />
        </div>
      </header>

      {/* Main layout.
          - Local dev: chat + xterm.js terminal, always both visible.
          - OOD: chat-only with jobs sidebar; terminal handled by OOD's
                 Shell Access tab. */}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/[0.06] md:border-b-0 md:border-r">
          <ChatPane />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-terminal)]/60">
          <JobsPane />
          {showTerminal && <TerminalPane />}
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}
