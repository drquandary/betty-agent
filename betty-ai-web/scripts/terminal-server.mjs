import http from 'node:http';
import os from 'node:os';
import process from 'node:process';
import pty from 'node-pty';
import { WebSocketServer } from 'ws';

const PORT = parsePort(process.env.BETTY_TERMINAL_WS_PORT, 3001);
const HOST = process.env.BETTY_TERMINAL_WS_HOST || '127.0.0.1';
const BETTY_SSH_USER = (process.env.BETTY_SSH_USER || 'jvadala').trim();
const BETTY_SSH_HOST = (process.env.BETTY_SSH_HOST || 'login.betty.parcc.upenn.edu').trim();
const SHELL = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh');

const server = http.createServer((req, res) => {
  if (req.url === '/healthz') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server, path: '/terminal' });

wss.on('connection', (ws) => {
  let cols = 100;
  let rows = 28;
  let term = null;

  const send = (message) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };

  const spawnLocal = () => {
    spawnTerminal(SHELL, ['-l'], 'connected-local', `Local shell: ${SHELL}`);
  };

  const spawnBetty = () => {
    const target = `${BETTY_SSH_USER}@${BETTY_SSH_HOST}`;
    spawnTerminal('/usr/bin/ssh', [target], 'connected-betty', `SSH: ${target}`);
  };

  const disposeTerminal = () => {
    if (!term) return;
    const current = term;
    term = null;
    current.removeAllListeners();
    current.kill();
  };

  const spawnTerminal = (command, args, status, detail) => {
    disposeTerminal();
    send({ type: 'status', status: 'connecting', detail });
    try {
      term = pty.spawn(command, args, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: process.env.HOME || os.homedir(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      send({ type: 'error', message: `Could not start ${command}: ${message}` });
      send({ type: 'status', status: 'error', detail: `Could not start ${command}` });
      return;
    }

    const spawnedTerm = term;
    spawnedTerm.onData((data) => send({ type: 'output', data }));
    spawnedTerm.onExit(({ exitCode, signal }) => {
      if (term !== spawnedTerm) return;
      term = null;
      send({
        type: 'status',
        status: 'disconnected',
        detail: `Process exited with code ${exitCode}${signal ? ` (${signal})` : ''}`,
      });
    });
    send({ type: 'status', status, detail });
  };

  ws.on('message', (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send({ type: 'error', message: 'Invalid terminal message.' });
      return;
    }

    if (message.type === 'input' && typeof message.data === 'string') {
      term?.write(message.data);
      return;
    }

    if (message.type === 'resize') {
      cols = clampDimension(message.cols, 20, 300, cols);
      rows = clampDimension(message.rows, 5, 120, rows);
      term?.resize(cols, rows);
      return;
    }

    if (message.type === 'connect-betty') {
      spawnBetty();
      return;
    }

    if (message.type === 'restart-local') {
      spawnLocal();
      return;
    }

    if (message.type === 'disconnect') {
      disposeTerminal();
      send({ type: 'status', status: 'disconnected', detail: 'Terminal disconnected.' });
    }
  });

  ws.on('close', disposeTerminal);
  ws.on('error', disposeTerminal);

  spawnLocal();
});

server.listen(PORT, HOST, () => {
  console.log(`[terminal] listening on ws://${HOST}:${PORT}/terminal`);
});

function parsePort(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536 ? parsed : fallback;
}

function clampDimension(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}
