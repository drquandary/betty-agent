'use client';

import { useState } from 'react';

interface LintResult {
  orphans: string[];
  brokenLinks: Array<{ from: string; target: string }>;
  stale: Array<{ page: string; updated: string }>;
  totals: { pages: number; links: number };
}

export function WikiLintButton() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<LintResult | null>(null);
  const [loading, setLoading] = useState(false);

  const runLint = async () => {
    setOpen(true);
    setLoading(true);
    try {
      const res = await fetch('/api/wiki/lint', { cache: 'no-store' });
      const body = await res.json();
      setResult(body as LintResult);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={runLint}
        title="Scan the wiki for orphan pages, broken [[links]], and stale pages"
        className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-zinc-100"
      >
        Lint wiki
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-elevated scroll-custom max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl p-6 text-zinc-100"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Wiki lint</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xs text-slate-500 hover:text-slate-200"
              >
                Close
              </button>
            </div>
            {loading || !result ? (
              <div className="py-8 text-center text-sm text-slate-500">scanning…</div>
            ) : (
              <div className="space-y-4 text-xs">
                <p className="text-slate-500">
                  {result.totals.pages} pages · {result.totals.links} wiki links scanned
                </p>
                <Section
                  title={`Orphan pages (${result.orphans.length})`}
                  hint="No other page links to these. Consider adding cross-references from the index or related pages."
                  items={result.orphans}
                />
                <Section
                  title={`Broken [[links]] (${result.brokenLinks.length})`}
                  hint="Links pointing to pages that don't exist. Either create the page or fix the spelling."
                  items={result.brokenLinks.map((b) => `${b.from} -> [[${b.target}]]`)}
                  color="text-red-300"
                />
                <Section
                  title={`Stale pages (${result.stale.length})`}
                  hint={`Frontmatter "updated:" older than 90 days. Likely safe; review if the content still matches reality.`}
                  items={result.stale.map((s) => `${s.page} (updated ${s.updated.slice(0, 10)})`)}
                  color="text-amber-300"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  hint,
  items,
  color = 'text-slate-200',
}: {
  title: string;
  hint: string;
  items: string[];
  color?: string;
}) {
  return (
    <div>
      <h3 className={`text-[11px] font-semibold uppercase tracking-normal ${color}`}>
        {title}
      </h3>
      <p className="mb-1 text-[10px] text-slate-600">{hint}</p>
      {items.length === 0 ? (
        <p className="text-slate-500">— clean —</p>
      ) : (
        <ul className="space-y-0.5 font-mono">
          {items.map((i) => (
            <li key={i} className="text-slate-300">
              {i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
