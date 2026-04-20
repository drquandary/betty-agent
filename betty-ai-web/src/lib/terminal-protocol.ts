export const DEFAULT_TERMINAL_WS_PORT = 3001;
export const DEFAULT_BETTY_SSH_USER = 'jvadala';
export const DEFAULT_BETTY_SSH_HOST = 'login.betty.parcc.upenn.edu';

export type TerminalClientMessage =
  | { type: 'input'; data: string }
  | { type: 'resize'; cols: number; rows: number }
  | { type: 'connect-betty' }
  | { type: 'restart-local' }
  | { type: 'disconnect' };

export type TerminalServerMessage =
  | { type: 'output'; data: string }
  | { type: 'status'; status: TerminalSessionStatus; detail?: string }
  | { type: 'error'; message: string };

export type TerminalSessionStatus =
  | 'connecting'
  | 'connected-local'
  | 'connected-betty'
  | 'disconnected'
  | 'error';

export function parseTerminalPort(value: string | number | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed < 65536
    ? parsed
    : DEFAULT_TERMINAL_WS_PORT;
}

export function getTerminalWsUrl(
  protocol: string,
  hostname: string,
  port = DEFAULT_TERMINAL_WS_PORT,
): string {
  const wsProtocol = protocol === 'https:' ? 'wss' : 'ws';
  return `${wsProtocol}://${hostname}:${parseTerminalPort(port)}/terminal`;
}

export function getBettySshTarget(user = DEFAULT_BETTY_SSH_USER, host = DEFAULT_BETTY_SSH_HOST) {
  return `${user.trim()}@${host.trim()}`;
}
