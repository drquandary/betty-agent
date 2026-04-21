import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import process from 'node:process';

// Shared secret for the terminal-server /mirror endpoint. The Next.js
// runtime and the terminal-server need the same value; generating it here
// and injecting into both child envs keeps it out of the user's shell
// history and automatically rotates on restart.
const mirrorSecret =
  process.env.BETTY_MIRROR_SECRET?.trim() || randomBytes(24).toString('hex');
const childEnv = { ...process.env, BETTY_MIRROR_SECRET: mirrorSecret };

const children = [
  spawn('node', ['scripts/terminal-server.mjs'], {
    stdio: 'inherit',
    env: childEnv,
  }),
  spawn('npm', ['run', 'dev:turbo'], {
    stdio: 'inherit',
    env: childEnv,
  }),
];

const shutdown = () => {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shutdown();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

for (const child of children) {
  child.on('exit', (code, signal) => {
    if (code === 0 || signal === 'SIGTERM') return;
    shutdown();
    process.exit(code ?? 1);
  });
}
