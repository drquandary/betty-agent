'use client';

import { useState } from 'react';

const PARTITIONS = [
  'dgx-b200',
  'b200-mig45',
  'b200-mig90',
  'genoa-lrg-mem',
  'genoa-std-mem',
];

interface SchedulingForm {
  gpus: number;
  hours: number;
  partition: string;
  memGb: number;
  notes: string;
}

const DEFAULT_FORM: SchedulingForm = {
  gpus: 1,
  hours: 2,
  partition: 'dgx-b200',
  memGb: 64,
  notes: '',
};

export function buildSchedulingPrompt(form: SchedulingForm): string {
  const parts = [
    `Recommend an sbatch shape for ${form.gpus} GPU${form.gpus === 1 ? '' : 's'}`,
    `for ${form.hours} hour${form.hours === 1 ? '' : 's'}`,
    `on partition \`${form.partition}\``,
    `with at least ${form.memGb} GB RAM`,
  ];
  if (form.notes.trim()) {
    parts.push(`. Workload notes: ${form.notes.trim()}`);
  }
  parts.push(
    '. Also propose 2–3 alternate start times if the cluster is busy.',
  );
  return parts.join(' ');
}

interface Props {
  onSubmit: (prompt: string) => void;
}

export function SchedulingCard({ onSubmit }: Props) {
  const [form, setForm] = useState<SchedulingForm>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SchedulingForm>(key: K, value: SchedulingForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.gpus < 1) return setError('GPUs must be at least 1.');
    if (form.hours < 0.5 || form.hours > 168) {
      return setError('Hours must be between 0.5 and 168.');
    }
    if (form.memGb < 1) return setError('Memory must be at least 1 GB.');
    onSubmit(buildSchedulingPrompt(form));
  }

  return (
    <section
      data-testid="scheduling-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
          Plan a Job
        </h2>
        <p className="mt-0.5 text-[10.5px] text-zinc-500">
          Describe your run — Betty AI proposes an sbatch shape and time slots.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="GPUs">
            <input
              type="number"
              min={1}
              max={32}
              value={form.gpus}
              onChange={(e) => update('gpus', Math.max(1, Number(e.target.value) || 1))}
              className={inputCls}
            />
          </Field>
          <Field label="Walltime (h)">
            <input
              type="number"
              min={0.5}
              max={168}
              step={0.5}
              value={form.hours}
              onChange={(e) => update('hours', Number(e.target.value) || 0.5)}
              className={inputCls}
            />
          </Field>
          <Field label="Partition">
            <select
              value={form.partition}
              onChange={(e) => update('partition', e.target.value)}
              className={inputCls}
            >
              {PARTITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Memory (GB)">
            <input
              type="number"
              min={1}
              max={2048}
              value={form.memGb}
              onChange={(e) => update('memGb', Math.max(1, Number(e.target.value) || 1))}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Workload notes (optional)">
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="e.g. QLoRA fine-tune of Llama-3.1-8B on a 50k-example dataset"
            className={`${inputCls} resize-none`}
          />
        </Field>

        {error && (
          <p role="alert" className="text-[11px] text-rose-300">
            {error}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-[10.5px] text-zinc-500">
            Builds a prompt and hands it to Betty AI.
          </span>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-b from-indigo-500 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-indigo-950/40 ring-1 ring-white/10 transition hover:from-indigo-400 hover:to-indigo-500"
          >
            Ask Betty AI →
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  'w-full rounded-lg border border-white/10 bg-[var(--surface-elevated)]/60 px-2.5 py-1.5 text-[12px] text-zinc-100 placeholder:text-zinc-600 transition focus:border-indigo-400/60 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';
