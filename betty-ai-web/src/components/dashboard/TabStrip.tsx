'use client';

import { cn } from '@/lib/utils';

export type DashboardView = 'dashboard' | 'commands' | 'monitoring' | 'workspace';

export const DASHBOARD_VIEWS: readonly DashboardView[] = [
  'dashboard',
  'commands',
  'monitoring',
  'workspace',
];

export function isDashboardView(v: string): v is DashboardView {
  return (DASHBOARD_VIEWS as readonly string[]).includes(v);
}

interface Props {
  current: DashboardView;
  onChange: (next: DashboardView) => void;
}

const TABS: Array<{ id: DashboardView; label: string; hint: string }> = [
  { id: 'dashboard', label: 'Dashboard', hint: 'Cluster + your stats at a glance' },
  { id: 'commands', label: 'Commands', hint: 'Cheat sheet — the ~15 commands you actually use' },
  { id: 'monitoring', label: 'Monitoring', hint: 'Live Slurm health + history' },
  { id: 'workspace', label: 'Workspace', hint: 'Chat with Betty AI + terminal' },
];

export function TabStrip({ current, onChange }: Props) {
  return (
    <nav
      role="tablist"
      aria-label="Betty AI views"
      className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-0.5"
    >
      {TABS.map((t) => {
        const active = t.id === current;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            title={t.hint}
            onClick={() => onChange(t.id)}
            className={cn(
              'rounded-full px-3 py-1 text-[11.5px] font-semibold tracking-wide transition',
              active
                ? 'bg-gradient-to-b from-indigo-500/30 to-indigo-600/20 text-indigo-100 shadow-inner shadow-indigo-950/40 ring-1 ring-indigo-400/40'
                : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
            )}
          >
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}
