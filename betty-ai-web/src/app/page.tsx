import { ChatPane } from '@/components/ChatPane';
import { StatusBar } from '@/components/StatusBar';

export default function HomePage() {
  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-md shadow-indigo-950/40">
            B
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-100">Betty AI</h1>
            <p className="text-[11px] text-slate-500">PARCC · Betty HPC Assistant</p>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" />{' '}
          <span className="align-middle">Chat mode</span>
        </div>
      </header>

      {/* Main split — chat on left, terminal placeholder on right
          (Phase 2 will replace the right pane with a real xterm.js + PTY) */}
      <main className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col border-r border-slate-800">
          <ChatPane />
        </section>
        <aside className="hidden min-w-0 flex-1 flex-col lg:flex">
          <TerminalPlaceholder />
        </aside>
      </main>

      <StatusBar />
    </div>
  );
}

function TerminalPlaceholder() {
  return (
    <div className="flex h-full flex-col bg-black/50">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Terminal</span>
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500">
            Phase 2
          </span>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="max-w-sm text-center">
          <div className="mb-3 text-3xl">⌨️</div>
          <p className="text-sm text-slate-400">Live terminal coming in Phase 2.</p>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Will SSH to <code className="rounded bg-slate-800 px-1 py-0.5 text-[11px] text-slate-400">login.betty.parcc.upenn.edu</code> via node-pty and
            let Betty AI preview commands you approve before they run.
          </p>
        </div>
      </div>
    </div>
  );
}
