import type { TerminalSessionStatus } from './terminal-protocol';

export const TERMINAL_STATUS_EVENT = 'betty-ai:terminal-status';

export interface TerminalStatusDetail {
  status: TerminalSessionStatus;
  detail?: string;
}

export function dispatchTerminalStatus(detail: TerminalStatusDetail) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<TerminalStatusDetail>(TERMINAL_STATUS_EVENT, { detail }));
}
