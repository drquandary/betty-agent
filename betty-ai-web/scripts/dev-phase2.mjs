import { spawn } from 'node:child_process';
import process from 'node:process';

const children = [
  spawn('node', ['scripts/terminal-server.mjs'], {
    stdio: 'inherit',
    env: process.env,
  }),
  spawn('npm', ['run', 'dev:turbo'], {
    stdio: 'inherit',
    env: process.env,
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
