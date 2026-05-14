'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CommandEntry {
  cmd: string;
  why: string;
  example?: string;
  daily?: boolean;
}

interface CommandGroup {
  id: string;
  title: string;
  blurb: string;
  entries: CommandEntry[];
}

const GROUPS: CommandGroup[] = [
  {
    id: 'auth',
    title: 'Connect',
    blurb: 'You need a Kerberos ticket before SSH will accept your PennKey.',
    entries: [
      {
        cmd: 'kinit jvadala@UPENN.EDU',
        why: 'Get a Kerberos ticket. Required before SSH on Penn VPN/campus.',
        daily: true,
      },
      {
        cmd: 'ssh jvadala@login.betty.parcc.upenn.edu',
        why: 'Log in to the cluster login node.',
        daily: true,
      },
      {
        cmd: 'klist',
        why: 'See your current Kerberos ticket — useful when SSH suddenly stops working (ticket expired).',
      },
    ],
  },
  {
    id: 'permissions',
    title: 'Permissions',
    blurb:
      'Before guessing why something is "permission denied", read the file. stat shows owner, group, mode, and ACLs in one shot.',
    entries: [
      {
        cmd: 'stat <path>',
        why: 'Read owner / group / mode / ACL flags. Always start here before chmod.',
        example: 'stat /vast/projects/beast2-jcombar1/run.sh',
        daily: true,
      },
      {
        cmd: 'chmod <mode> <path>',
        why: 'Change mode bits. g+rx to let group read+enter a dir; o-rwx to lock out others.',
        example: 'chmod g+rx /vast/projects/beast2-jcombar1',
      },
      {
        cmd: 'chgrp -R <group> <path>',
        why: 'Reassign group ownership recursively when files were created under the wrong umask.',
        example: 'chgrp -R parcc_beast /vast/projects/beast2-jcombar1/runs',
      },
      {
        cmd: 'setfacl -m u:<user>:rx <dir>',
        why: "Grant one specific user read/enter access without changing the group. The right tool when group membership can't change.",
        example: 'setfacl -m u:ryb:rx /vast/projects/beast2-jcombar1',
      },
      {
        cmd: 'getfacl <path>',
        why: 'See the ACLs you set with setfacl — stat shows a "+" suffix but not the actual entries.',
      },
    ],
  },
  {
    id: 'modules',
    title: 'Software (Lmod)',
    blurb:
      "Betty uses environment modules. Load before you run, or your shell won't see the binary.",
    entries: [
      {
        cmd: 'module spider <name>',
        why: 'Search every installed module + version. Use this before `module avail` — it shows more.',
        example: 'module spider cuda',
      },
      {
        cmd: 'module avail',
        why: 'List modules you can load right now in your current stack.',
      },
      {
        cmd: 'module load <name>',
        why: 'Activate a module for this shell.',
        example: 'module load anaconda3',
        daily: true,
      },
      {
        cmd: 'module list',
        why: "See what's currently loaded — handy when a script silently uses the wrong version.",
      },
    ],
  },
  {
    id: 'slurm',
    title: 'Slurm',
    blurb: 'Job scheduling. Never train on a login node — always srun or sbatch.',
    entries: [
      {
        cmd: 'parcc_sfree.py',
        why: 'Simplified view of which partitions actually have free GPUs/nodes right now.',
        daily: true,
      },
      {
        cmd: 'squeue -u $USER',
        why: 'Just your jobs. `--start` adds an estimated start time for pending jobs.',
        daily: true,
      },
      {
        cmd: 'srun -p <part> --gpus=1 -t 00:10:00 --pty bash',
        why: 'Interactive allocation — for debugging only. Always set a short `-t` and release when done.',
        example: 'srun -p dgx-b200 --gpus=1 -t 00:10:00 --pty bash',
      },
      {
        cmd: 'sbatch <script.sh>',
        why: 'Submit a batch script — the right way to run real workloads.',
        daily: true,
      },
      {
        cmd: 'scancel <JOBID>',
        why: 'Kill a job. `scancel -u $USER` nukes all of yours — useful when an experiment goes wrong.',
      },
      {
        cmd: 'parcc_sdebug.py --job <JOBID>',
        why: 'Why did my job fail? Combines sacct + node state + recent logs into one report.',
      },
    ],
  },
  {
    id: 'storage',
    title: 'Storage (VAST)',
    blurb:
      '/vast/home is small; put data in /vast/projects/<project>. Check before you transfer.',
    entries: [
      {
        cmd: 'parcc_quota.py',
        why: 'Your quotas across home + project filesystems. Run before any large transfer.',
        daily: true,
      },
      {
        cmd: 'parcc_du.py <path>',
        why: "Directory-level breakdown — find what's eating your quota.",
        example: 'parcc_du.py /vast/projects/beast2-jcombar1',
      },
      {
        cmd: 'scp <local> <user>@login...:/vast/projects/<proj>/',
        why: 'Copy files up. For bigger transfers, prefer `rsync -av --progress`.',
      },
    ],
  },
];

const DAILY_COUNT = GROUPS.reduce(
  (n, g) => n + g.entries.filter((e) => e.daily).length,
  0,
);

export function CommandsView() {
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
    <main
      data-testid="commands-view"
      className="scroll-custom flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950/10 via-transparent to-transparent px-4 py-4 md:px-6 md:py-6"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
            Betty in ~15 commands
          </h2>
          <p className="mt-1 text-[12px] leading-relaxed text-zinc-400">
            The commands you actually use day-to-day. The{' '}
            <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
              daily
            </span>{' '}
            tag marks the {DAILY_COUNT} you&apos;ll hit every session. Click any
            command to copy it.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {GROUPS.map((group) => (
            <section
              key={group.id}
              data-testid={`commands-group-${group.id}`}
              className="flex min-h-0 flex-col rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-sm"
            >
              <header className="mb-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-zinc-300">
                  {group.title}
                </h3>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
                  {group.blurb}
                </p>
              </header>

              <ul className="space-y-1.5">
                {group.entries.map((entry) => {
                  const toCopy = entry.example ?? entry.cmd;
                  const isCopied = copied === toCopy;
                  return (
                    <li key={entry.cmd}>
                      <button
                        type="button"
                        onClick={() => void copy(toCopy)}
                        title={`Copy: ${toCopy}`}
                        className="group flex w-full flex-col items-start gap-1 rounded-md border border-white/[0.06] bg-white/[0.02] px-2.5 py-2 text-left transition hover:border-indigo-400/30 hover:bg-white/[0.05]"
                      >
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate font-mono text-[11.5px] text-zinc-100 group-hover:text-indigo-200">
                            {entry.cmd}
                          </span>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {entry.daily && (
                              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-indigo-200">
                                daily
                              </span>
                            )}
                            <span
                              className={cn(
                                'text-[9.5px] uppercase tracking-wider transition',
                                isCopied
                                  ? 'text-emerald-300'
                                  : 'text-zinc-600 group-hover:text-zinc-400',
                              )}
                            >
                              {isCopied ? 'copied' : 'copy'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10.5px] leading-snug text-zinc-400">
                          {entry.why}
                        </p>
                        {entry.example && entry.example !== entry.cmd && (
                          <p className="font-mono text-[10.5px] text-zinc-500">
                            e.g. {entry.example}
                          </p>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
