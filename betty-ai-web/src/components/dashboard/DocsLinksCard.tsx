'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LinkEntry {
  label: string;
  href: string;
  hint?: string;
}

interface SnippetEntry {
  label: string;
  snippet: string;
  hint: string;
}

const GETTING_STARTED: LinkEntry[] = [
  {
    label: 'Getting Started',
    href: 'https://parcc.upenn.edu/training/getting-started/',
    hint: 'PARCC official onboarding',
  },
  {
    label: 'Logging in',
    href: 'https://parcc.upenn.edu/training/getting-started/logging-in/',
    hint: 'Kerberos + PennKey + Duo + VPN',
  },
  {
    label: 'Windows setup',
    href: 'https://parcc.upenn.edu/training/getting-started/logging-in/windows-setup/',
    hint: 'WSL2 / MobaXterm / SecureCRT',
  },
  {
    label: 'PARCC tools',
    href: 'https://parcc.upenn.edu/training/getting-started/parcc-tools/',
    hint: 'parcc_* helper scripts',
  },
];

const IN_REPO_DOCS: LinkEntry[] = [
  { label: 'Betty System Guide', href: '/docs/BETTY_SYSTEM_GUIDE.md', hint: 'Cluster reference' },
  {
    label: 'LLM & Workflows Guide',
    href: '/docs/BETTY_LLM_AND_WORKFLOWS_GUIDE.md',
    hint: 'Fine-tuning + inference recipes',
  },
  { label: 'Knowledge wiki', href: '/wiki/index.md', hint: 'Entities, models, experiments' },
  { label: 'README', href: '/README.md', hint: 'Project overview' },
];

const HELPER_SNIPPETS: SnippetEntry[] = [
  {
    label: 'Quota',
    snippet: 'parcc_quota.py',
    hint: 'Storage usage by filesystem',
  },
  {
    label: 'Free GPUs',
    snippet: 'parcc_sfree.py',
    hint: 'Idle nodes/GPUs by partition',
  },
  {
    label: 'QOS limits',
    snippet: 'parcc_sqos.py',
    hint: 'Your QOS / association caps',
  },
  {
    label: 'Usage report',
    snippet: 'parcc_sreport.py --user jvadala',
    hint: 'Billing / allocation spend',
  },
  {
    label: 'Debug a job',
    snippet: 'parcc_sdebug.py --job <JOBID>',
    hint: 'Investigate a failed job',
  },
];

export function DocsLinksCard() {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string) {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setCopied(text);
        setTimeout(() => setCopied((c) => (c === text ? null : c)), 1200);
      }
    } catch {
      /* clipboard blocked — silent */
    }
  }

  return (
    <section
      data-testid="docs-links-card"
      className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
    >
      <header className="mb-3">
        <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
          How to use Betty
        </h2>
        <p className="mt-0.5 text-[10.5px] text-zinc-500">
          Docs, helper scripts, and the wiki — start here.
        </p>
      </header>

      <div className="scroll-custom flex-1 overflow-y-auto space-y-3 pr-1">
        <LinkSection title="Getting started" links={GETTING_STARTED} external />
        <LinkSection title="In-repo docs" links={IN_REPO_DOCS} external={false} />

        <div>
          <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
            Helper scripts
          </h3>
          <ul className="space-y-1">
            {HELPER_SNIPPETS.map((s) => (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => void copy(s.snippet)}
                  title={s.hint}
                  className="group flex w-full items-center justify-between gap-2 rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left text-[11.5px] transition hover:bg-white/[0.05]"
                >
                  <span className="font-mono text-zinc-200 group-hover:text-indigo-200">
                    {s.snippet}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] uppercase tracking-wider transition',
                      copied === s.snippet ? 'text-emerald-300' : 'text-zinc-600 group-hover:text-zinc-400',
                    )}
                  >
                    {copied === s.snippet ? 'copied' : 'copy'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function LinkSection({
  title,
  links,
  external,
}: {
  title: string;
  links: LinkEntry[];
  external: boolean;
}) {
  return (
    <div>
      <h3 className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h3>
      <ul className="space-y-0.5">
        {links.map((l) => (
          <li key={l.href}>
            <a
              href={l.href}
              target={external ? '_blank' : undefined}
              rel={external ? 'noopener noreferrer' : undefined}
              className="flex items-baseline justify-between gap-2 rounded-md px-2 py-1 text-[11.5px] text-zinc-300 transition hover:bg-white/[0.04] hover:text-indigo-200"
            >
              <span>
                {l.label}
                {external && <span className="ml-1 text-[10px] text-zinc-600">↗</span>}
              </span>
              {l.hint && <span className="truncate text-[10px] text-zinc-600">{l.hint}</span>}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
