/**
 * Unit tests for the permission-tier classifier in server.ts (decision D4).
 * Keeps scope tight — does NOT spin up the Claude SDK.
 */

import { describe, expect, it } from 'vitest';
import { classifyPermissionTier, summarizePermissionRequest } from './server';

const WIKI_WRITE = 'mcp__betty-ai-tools__wiki_write';

describe('classifyPermissionTier', () => {
  it('tier 0 — append to log.md', () => {
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'append', page: 'log.md' })).toBe(0);
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'append', page: 'log' })).toBe(0);
  });

  it('tier 1 — update any page', () => {
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'update', page: 'experiments/x.md' })).toBe(1);
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'update', page: 'concepts/y' })).toBe(1);
  });

  it('tier 1 — create under experiments/', () => {
    expect(
      classifyPermissionTier(WIKI_WRITE, {
        mode: 'create',
        page: 'experiments/2026-04-17-foo.md',
      }),
    ).toBe(1);
  });

  it('tier 2 — create outside experiments/', () => {
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'create', page: 'concepts/z.md' })).toBe(2);
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'create', page: 'entities/a.md' })).toBe(2);
  });

  it('unknown tools default to tier 2', () => {
    expect(classifyPermissionTier('mcp__other__something', {})).toBe(2);
  });

  it('unknown modes default to tier 2', () => {
    expect(classifyPermissionTier(WIKI_WRITE, { mode: 'bogus', page: 'x.md' })).toBe(2);
  });
});

describe('summarizePermissionRequest', () => {
  it('summarizes wiki_write requests', () => {
    const s = summarizePermissionRequest(WIKI_WRITE, {
      mode: 'create',
      page: 'experiments/foo.md',
    });
    expect(s).toBe('wiki_write create → wiki/experiments/foo.md');
  });
});
