'use client';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { useEffect, useRef, useState } from 'react';
import {
  getTerminalWsUrl,
  parseTerminalPort,
  type TerminalClientMessage,
  type TerminalServerMessage,
  type TerminalSessionStatus,
} from '@/lib/terminal-protocol';
import { dispatchTerminalStatus } from '@/lib/terminal-status';
import { cn } from '@/lib/utils';

type WsState = 'connecting' | 'open' | 'closed' | 'error';

export function TerminalPane() {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [wsState, setWsState] = useState<WsState>('connecting');
  const [sessionStatus, setSessionStatus] = useState<TerminalSessionStatus>('connecting');
  const [detail, setDetail] = useState('Starting terminal bridge...');

  useEffect(() => {
    if (!containerRef.current) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily:
        'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      theme: {
        background: '#020617',
        foreground: '#dbe4f0',
        cursor: '#c4b5fd',
        selectionBackground: '#334155',
      },
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(containerRef.current);
    fit.fit();
    terminalRef.current = terminal;
    fitRef.current = fit;

    const connect = () => {
      const port = parseTerminalPort(process.env.NEXT_PUBLIC_BETTY_TERMINAL_WS_PORT);
      const ws = new WebSocket(getTerminalWsUrl(window.location.protocol, window.location.hostname, port));
      wsRef.current = ws;
      setWsState('connecting');
      setSessionStatus('connecting');
      setDetail('Connecting to local terminal bridge...');

      ws.addEventListener('open', () => {
        setWsState('open');
        terminal.writeln('\r\n[Betty AI] Local terminal bridge connected.');
        resize();
      });
      ws.addEventListener('close', () => {
        setWsState('closed');
        setSessionStatus('disconnected');
        setDetail('Terminal bridge disconnected.');
        dispatchTerminalStatus({ status: 'disconnected', detail: 'Terminal bridge disconnected.' });
      });
      ws.addEventListener('error', () => {
        setWsState('error');
        setSessionStatus('error');
        setDetail('Could not reach the terminal bridge on port 3001.');
        dispatchTerminalStatus({ status: 'error', detail: 'Terminal bridge unavailable.' });
      });
      ws.addEventListener('message', (event) => {
        const message = JSON.parse(String(event.data)) as TerminalServerMessage;
        if (message.type === 'output') {
          terminal.write(message.data);
          return;
        }
        if (message.type === 'status') {
          setSessionStatus(message.status);
          setDetail(message.detail || statusLabel(message.status));
          dispatchTerminalStatus({ status: message.status, detail: message.detail });
          return;
        }
        if (message.type === 'error') {
          setSessionStatus('error');
          setDetail(message.message);
          terminal.writeln(`\r\n[Betty AI] ${message.message}`);
          dispatchTerminalStatus({ status: 'error', detail: message.message });
        }
      });
    };

    const sendInput = terminal.onData((data) => send({ type: 'input', data }));
    const resizeObserver = new ResizeObserver(() => resize());

    const resize = () => {
      fit.fit();
      const dimensions = fit.proposeDimensions();
      if (!dimensions) return;
      send({ type: 'resize', cols: dimensions.cols, rows: dimensions.rows });
    };

    const send = (message: TerminalClientMessage) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
    };

    resizeObserver.observe(containerRef.current);
    connect();

    return () => {
      sendInput.dispose();
      resizeObserver.disconnect();
      wsRef.current?.close();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
    };
  }, []);

  const sendControl = (message: TerminalClientMessage) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const isOpen = wsState === 'open';

  return (
    <div className="flex h-full min-h-0 flex-col bg-black/60">
      <div className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-300">Terminal</span>
            <span
              className={cn(
                'rounded-md border px-1.5 py-0.5 text-[10px]',
                sessionStatus === 'connected-local' &&
                  'border-emerald-800/60 bg-emerald-950/30 text-emerald-300',
                sessionStatus === 'connected-betty' &&
                  'border-indigo-700/70 bg-indigo-950/40 text-indigo-200',
                sessionStatus === 'connecting' &&
                  'border-amber-800/60 bg-amber-950/30 text-amber-300',
                (sessionStatus === 'disconnected' || sessionStatus === 'error') &&
                  'border-slate-800 bg-slate-900/50 text-slate-500',
              )}
            >
              {statusLabel(sessionStatus)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500">{detail}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={!isOpen}
            onClick={() => sendControl({ type: 'restart-local' })}
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Local
          </button>
          <button
            type="button"
            disabled={!isOpen}
            onClick={() => sendControl({ type: 'connect-betty' })}
            className="rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            Connect Betty
          </button>
          <button
            type="button"
            disabled={!isOpen}
            onClick={() => sendControl({ type: 'disconnect' })}
            className="rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-300 transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Disconnect
          </button>
        </div>
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 p-2" />
    </div>
  );
}

function statusLabel(status: TerminalSessionStatus): string {
  switch (status) {
    case 'connected-local':
      return 'Local shell';
    case 'connected-betty':
      return 'Betty SSH';
    case 'connecting':
      return 'Connecting';
    case 'error':
      return 'Error';
    case 'disconnected':
      return 'Disconnected';
  }
}
