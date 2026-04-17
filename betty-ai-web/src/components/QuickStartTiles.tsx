'use client';

import { cn } from '@/lib/utils';

const TILES: Array<{ label: string; prompt: string; emoji: string }> = [
  {
    label: 'Fine-tune an LLM',
    prompt: 'Walk me through fine-tuning an LLM on Betty. Start by asking what model and dataset I have in mind.',
    emoji: '🧠',
  },
  {
    label: 'Launch Jupyter',
    prompt: 'How do I launch a Jupyter notebook on a GPU node via Open OnDemand?',
    emoji: '📓',
  },
  {
    label: 'Check my jobs',
    prompt: 'How do I check my current Slurm jobs and their status on Betty?',
    emoji: '📊',
  },
  {
    label: "What's new on Betty?",
    prompt: "What's the current state of the Betty cluster? Any known issues or recent changes I should know about?",
    emoji: '🔔',
  },
];

interface Props {
  onPick: (prompt: string) => void;
  disabled?: boolean;
}

export function QuickStartTiles({ onPick, disabled }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {TILES.map((t) => (
        <button
          key={t.label}
          type="button"
          disabled={disabled}
          onClick={() => onPick(t.prompt)}
          className={cn(
            'group flex flex-col items-start gap-1 rounded-lg border border-slate-800 bg-slate-900/50',
            'px-3 py-2.5 text-left transition',
            'hover:border-indigo-700 hover:bg-slate-900 hover:shadow-lg hover:shadow-indigo-950/20',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <span className="text-lg leading-none">{t.emoji}</span>
          <span className="text-xs font-medium text-slate-200 group-hover:text-indigo-200">
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}
