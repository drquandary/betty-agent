import { ChatPane } from '@/components/ChatPane';
import { HeaderMenu, HeaderProviderBadge } from '@/components/HeaderMenu';
import { NextDevToolsOffset } from '@/components/NextDevToolsOffset';
import { StatusBar } from '@/components/StatusBar';
import { TerminalPane } from '@/components/TerminalPane';

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col bg-slate-950">
      <NextDevToolsOffset />
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <HeaderMenu />
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Betty AI</h1>
            <p className="text-[11px] text-slate-500">PARCC · Betty HPC Assistant</p>
          </div>
        </div>
        <HeaderProviderBadge />
      </header>

      {/* Main split — chat + xterm.js terminal, ALWAYS both visible.
          - >= md (768px): side-by-side (chat left, terminal right)
          - <  md (narrow): stacked (chat on top, terminal below)
          The terminal connects to the WebSocket bridge at ws://localhost:3001/terminal
          (started by `npm run terminal:server` or the combined `npm run dev:phase2`). */}
      <main className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-slate-800 md:border-b-0 md:border-r">
          <ChatPane />
        </section>
        <aside className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TerminalPane />
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}
