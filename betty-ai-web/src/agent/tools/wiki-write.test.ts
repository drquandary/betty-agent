/**
 * Unit tests for wiki_write.
 *
 * knowledge/loader.ts reads process.env.WIKI_PATH at module load, so we must
 * set WIKI_PATH BEFORE importing wiki-write. Static ES `import` statements are
 * hoisted above any top-level statements, so we use a dynamic `await import()`
 * from inside `beforeAll` after the env is set.
 */

import {
  mkdtempSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  symlinkSync,
  existsSync,
  readFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

type WikiWriteModule = typeof import('./wiki-write');

const TMP_ROOT = mkdtempSync(join(tmpdir(), 'betty-wiki-'));
const WIKI_DIR = join(TMP_ROOT, 'wiki');
const OUTSIDE_DIR = join(TMP_ROOT, 'outside');
mkdirSync(WIKI_DIR, { recursive: true });
mkdirSync(OUTSIDE_DIR, { recursive: true });
writeFileSync(join(WIKI_DIR, 'log.md'), '# Log\n');
process.env.WIKI_PATH = WIKI_DIR;

let mod: WikiWriteModule;

beforeAll(async () => {
  mod = await import('./wiki-write');
});

afterAll(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

beforeEach(() => {
  writeFileSync(join(WIKI_DIR, 'log.md'), '# Log\n');
});

describe('parseFrontmatter', () => {
  it('parses a simple frontmatter block', () => {
    const p = mod.parseFrontmatter('---\ntype: experiment\nname: foo\n---\n\nBody here');
    expect(p).not.toBeNull();
    expect(p!.fields.type).toBe('experiment');
    expect(p!.fields.name).toBe('foo');
    expect(p!.body).toBe('\nBody here');
  });
  it('returns null when no frontmatter', () => {
    expect(mod.parseFrontmatter('# Just a heading\n')).toBeNull();
  });
});

describe('validateCreateFrontmatter', () => {
  it('accepts a complete frontmatter + heading', () => {
    const src = '---\ntype: experiment\nname: foo\n---\n\n# Foo\nbody';
    expect(mod.validateCreateFrontmatter(src).ok).toBe(true);
  });
  it('accepts frontmatter with heading instead of name field', () => {
    const src = '---\ntype: experiment\n---\n\n# Foo Title\nbody';
    expect(mod.validateCreateFrontmatter(src).ok).toBe(true);
  });
  it('rejects missing frontmatter', () => {
    const v = mod.validateCreateFrontmatter('# Foo\nbody');
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/frontmatter/i);
  });
  it('rejects missing type field', () => {
    const src = '---\nname: foo\n---\n\n# Foo\n';
    const v = mod.validateCreateFrontmatter(src);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/type/);
  });
  it('rejects empty body with no description', () => {
    const src = '---\ntype: experiment\nname: foo\n---\n';
    const v = mod.validateCreateFrontmatter(src);
    expect(v.ok).toBe(false);
  });
});

describe('spliceMarkerRegion', () => {
  it('replaces only the marker-delimited region', () => {
    const existing = `# Page

## Goal
user-written goal

${'<!-- betty:auto-start -->'}
old status
${'<!-- betty:auto-end -->'}

## Lessons
user lessons
`;
    const incoming = `irrelevant preamble
${'<!-- betty:auto-start -->'}
NEW status
${'<!-- betty:auto-end -->'}
irrelevant trailer`;
    const result = mod.spliceMarkerRegion(existing, incoming);
    expect(result).toContain('user-written goal');
    expect(result).toContain('user lessons');
    expect(result).toContain('NEW status');
    expect(result).not.toContain('old status');
    expect(result).not.toContain('irrelevant preamble');
    expect(result).not.toContain('irrelevant trailer');
  });
  it('returns incoming when existing has no markers', () => {
    const out = mod.spliceMarkerRegion('plain existing', 'full new body');
    expect(out).toBe('full new body');
  });
  it('returns incoming when incoming has no markers', () => {
    const existing = `pre\n${mod.AUTO_START_MARKER}\nold\n${mod.AUTO_END_MARKER}\npost`;
    const out = mod.spliceMarkerRegion(existing, 'full rewrite');
    expect(out).toBe('full rewrite');
  });
});

describe('writeWikiPage path security', () => {
  it('rejects `..` traversal', async () => {
    const r = await mod.writeWikiPage('../escape.md', 'body', 'create');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/traversal/i);
  });
  it('rejects absolute unix path', async () => {
    const r = await mod.writeWikiPage('/etc/passwd', 'body', 'create');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/absolute/i);
  });
  it('rejects absolute windows path', async () => {
    const r = await mod.writeWikiPage('C:\\Windows\\x.md', 'body', 'create');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/absolute/i);
  });
  it('rejects null byte injection', async () => {
    const r = await mod.writeWikiPage('foo\0bar.md', 'body', 'create');
    expect(r.ok).toBe(false);
  });
  it('rejects writes through a symlink that escapes wiki/', async () => {
    const linkPath = join(WIKI_DIR, 'evil');
    if (!existsSync(linkPath)) symlinkSync(OUTSIDE_DIR, linkPath, 'dir');
    const r = await mod.writeWikiPage(
      'evil/pwned.md',
      '---\ntype: test\nname: pwn\n---\n# x\nbody',
      'create',
    );
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/symlink/i);
  });
});

describe('writeWikiPage create mode', () => {
  it('creates a new file with valid frontmatter', async () => {
    const body =
      '---\ntype: experiment\nname: test-exp\ndescription: a test\n---\n\n# Test Exp\n\nhello';
    const r = await mod.writeWikiPage('experiments/2026-04-17-test.md', body, 'create');
    expect(r.ok).toBe(true);
    expect(existsSync(join(WIKI_DIR, 'experiments/2026-04-17-test.md'))).toBe(true);
  });
  it('rejects create when file already exists', async () => {
    const body = '---\ntype: experiment\nname: dup\n---\n# Dup\nbody';
    await mod.writeWikiPage('experiments/dup.md', body, 'create');
    const r = await mod.writeWikiPage('experiments/dup.md', body, 'create');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/already exists/i);
  });
  it('rejects create without frontmatter', async () => {
    const r = await mod.writeWikiPage('experiments/no-fm.md', '# no fm\n', 'create');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/frontmatter/i);
  });
  it('auto-appends .md extension', async () => {
    const body = '---\ntype: concept\nname: autoext\n---\n# x\nbody';
    const r = await mod.writeWikiPage('concepts/autoext', body, 'create');
    expect(r.ok).toBe(true);
    expect(r.path).toBe('concepts/autoext.md');
  });
});

describe('writeWikiPage update mode', () => {
  it('round-trips marker region while preserving user sections', async () => {
    const original = `---
type: experiment
name: rt
---

# Round Trip

## Goal
USER GOAL BLOCK

<!-- betty:auto-start -->
old agent content
<!-- betty:auto-end -->

## Lessons
USER LESSONS BLOCK
`;
    mkdirSync(join(WIKI_DIR, 'experiments'), { recursive: true });
    writeFileSync(join(WIKI_DIR, 'experiments/rt.md'), original, 'utf8');
    const update = `<!-- betty:auto-start -->
NEW agent content
<!-- betty:auto-end -->`;
    const r = await mod.writeWikiPage('experiments/rt.md', update, 'update');
    expect(r.ok).toBe(true);
    const after = readFileSync(join(WIKI_DIR, 'experiments/rt.md'), 'utf8');
    expect(after).toContain('USER GOAL BLOCK');
    expect(after).toContain('USER LESSONS BLOCK');
    expect(after).toContain('NEW agent content');
    expect(after).not.toContain('old agent content');
  });
  it('fails when file does not exist', async () => {
    const r = await mod.writeWikiPage('experiments/nope.md', 'x', 'update');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/does not exist/i);
  });
});

describe('writeWikiPage append mode', () => {
  it('appends to log.md', async () => {
    const r = await mod.writeWikiPage('log.md', '## [2026-04-17] test\n- thing', 'append');
    expect(r.ok).toBe(true);
    const after = readFileSync(join(WIKI_DIR, 'log.md'), 'utf8');
    expect(after).toMatch(/2026-04-17/);
  });
  it('rejects append to non-allowlisted file', async () => {
    writeFileSync(join(WIKI_DIR, 'index.md'), '# Index\n');
    const r = await mod.writeWikiPage('index.md', 'sneaky\n', 'append');
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/append is only permitted/i);
  });
});

describe('writeWikiPage error paths', () => {
  it('surfaces fs errors gracefully', async () => {
    mkdirSync(join(WIKI_DIR, 'adir'), { recursive: true });
    const r = await mod.writeWikiPage('adir', 'body', 'update');
    expect(r.ok).toBe(false);
  });
});
