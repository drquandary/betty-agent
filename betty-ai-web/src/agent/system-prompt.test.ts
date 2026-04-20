/**
 * Snapshot-ish assertions for buildSystemPrompt(). We don't use
 * `.toMatchSnapshot()` because the live knowledge snapshot changes over
 * time; instead we assert specific substrings that MUST be present (tool
 * names, whitelist patterns, marker convention) and specific substrings
 * that MUST NOT (outdated Phase 1 framing).
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('./knowledge/loader', () => ({
  loadKnowledgeSnapshot: vi.fn(async () => ({
    indexBody: '',
    logTail: '',
    pageList: [],
  })),
}));

import { buildSystemPrompt } from './system-prompt';
import { SAFE_COMMAND_PATTERNS } from './cluster/whitelist';

describe('buildSystemPrompt', () => {
  it('documents the new tool set', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('wiki_write');
    expect(prompt).toContain('cluster_run');
    expect(prompt).toContain('cluster_submit');
    expect(prompt).toContain('cluster_status');
  });

  it('does not contain outdated Phase 1 framing', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).not.toContain('can only TALK');
    expect(prompt).not.toContain('Phase 1: chat');
  });

  it('renders the whitelist inline (single source of truth)', async () => {
    const prompt = await buildSystemPrompt();
    const firstPattern = SAFE_COMMAND_PATTERNS[0].source;
    expect(prompt).toContain(firstPattern);
  });

  it('documents the marker-region convention', async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain('<!-- betty:auto-start -->');
  });
});
