import { describe, expect, it } from 'vitest';
import { getBettySshTarget, getTerminalWsUrl, parseTerminalPort } from './terminal-protocol';

describe('getTerminalWsUrl', () => {
  it('uses localhost port 3001 in the browser by default', () => {
    expect(getTerminalWsUrl('http:', 'localhost')).toBe('ws://localhost:3001/terminal');
  });

  it('uses secure websocket when the page is https', () => {
    expect(getTerminalWsUrl('https:', 'betty.local')).toBe('wss://betty.local:3001/terminal');
  });

  it('accepts an explicit port override', () => {
    expect(getTerminalWsUrl('http:', '127.0.0.1', 4100)).toBe('ws://127.0.0.1:4100/terminal');
  });
});

describe('getBettySshTarget', () => {
  it('combines user and host into a normal SSH target', () => {
    expect(getBettySshTarget('jvadala', 'login.betty.parcc.upenn.edu')).toBe(
      'jvadala@login.betty.parcc.upenn.edu',
    );
  });

  it('trims accidental whitespace from env-derived values', () => {
    expect(getBettySshTarget(' jvadala ', ' login.betty.parcc.upenn.edu ')).toBe(
      'jvadala@login.betty.parcc.upenn.edu',
    );
  });
});

describe('parseTerminalPort', () => {
  it('falls back to 3001 for invalid values', () => {
    expect(parseTerminalPort(undefined)).toBe(3001);
    expect(parseTerminalPort('wat')).toBe(3001);
  });
});
