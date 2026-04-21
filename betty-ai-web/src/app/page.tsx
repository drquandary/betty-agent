import { ChatPane } from '@/components/ChatPane';
import { ConnectionBadge } from '@/components/ConnectionBadge';
import { HeaderMenu, HeaderProviderBadge } from '@/components/HeaderMenu';
import { JobsPane } from '@/components/JobsPane';
import { NextDevToolsOffset } from '@/components/NextDevToolsOffset';
import { StatusBar } from '@/components/StatusBar';
import { TerminalPane } from '@/components/TerminalPane';
import { WikiLintButton } from '@/components/WikiLintButton';

export default function HomePage() {
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

      {/* Main split — chat + xterm.js terminal, ALWAYS both visible.
          - >= md (768px): side-by-side (chat left, terminal right)
          - <  md (narrow): stacked (chat on top, terminal below) */}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-white/[0.06] md:border-b-0 md:border-r">
          <ChatPane />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface-terminal)]/60">
          <JobsPane />
          <TerminalPane />
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}
