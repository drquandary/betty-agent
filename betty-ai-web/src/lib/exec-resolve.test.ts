import { describe, expect, it } from 'vitest';
import { getShellCandidates, getSshCandidates, splitPath } from './exec-resolve';

describe('getShellCandidates', () => {
  it('returns PowerShell variants on win32', () => {
    const candidates = getShellCandidates('win32');
    expect(candidates).toContain('pwsh.exe');
    expect(candidates).toContain('powershell.exe');
    expect(candidates).toContain('cmd.exe');
  });

  it('returns bash and sh before zsh on linux', () => {
    const candidates = getShellCandidates('linux');
    const bashIdx = candidates.indexOf('/bin/bash');
    const shIdx = candidates.indexOf('/bin/sh');
    const zshIdx = candidates.indexOf('/bin/zsh');
    expect(bashIdx).toBeGreaterThanOrEqual(0);
    expect(shIdx).toBeGreaterThanOrEqual(0);
    expect(zshIdx).toBeGreaterThanOrEqual(0);
    // bash and sh come before zsh so a POSIX fallback is tried first
    expect(bashIdx).toBeLessThan(zshIdx);
    expect(shIdx).toBeLessThan(zshIdx);
  });

  it('returns bash and sh before zsh on darwin', () => {
    const candidates = getShellCandidates('darwin');
    const bashIdx = candidates.indexOf('/bin/bash');
    const zshIdx = candidates.indexOf('/bin/zsh');
    expect(bashIdx).toBeGreaterThanOrEqual(0);
    expect(zshIdx).toBeGreaterThanOrEqual(0);
    expect(bashIdx).toBeLessThan(zshIdx);
  });

  it('returns a non-empty list for all major platforms', () => {
    for (const p of ['linux', 'darwin', 'win32'] as NodeJS.Platform[]) {
      expect(getShellCandidates(p).length).toBeGreaterThan(0);
    }
  });
});

describe('getSshCandidates', () => {
  it('returns common Unix SSH paths on linux', () => {
    const candidates = getSshCandidates('linux');
    expect(candidates).toContain('/usr/bin/ssh');
    expect(candidates).toContain('/usr/local/bin/ssh');
  });

  it('returns Homebrew path as a candidate on darwin', () => {
    const candidates = getSshCandidates('darwin');
    expect(candidates).toContain('/opt/homebrew/bin/ssh');
  });

  it('returns an empty array on win32 (ssh is found via PATH there)', () => {
    expect(getSshCandidates('win32')).toHaveLength(0);
  });
});

describe('splitPath', () => {
  it('splits a Unix PATH string correctly', () => {
    const dirs = splitPath('/usr/bin:/usr/local/bin:/bin', ':');
    expect(dirs).toEqual(['/usr/bin', '/usr/local/bin', '/bin']);
  });

  it('splits a Windows PATH string correctly', () => {
    const dirs = splitPath('C:\\Windows\\System32;C:\\Program Files\\OpenSSH', ';');
    expect(dirs).toEqual(['C:\\Windows\\System32', 'C:\\Program Files\\OpenSSH']);
  });

  it('drops empty segments produced by trailing separators', () => {
    const dirs = splitPath('/usr/bin:/bin:', ':');
    expect(dirs).toEqual(['/usr/bin', '/bin']);
  });

  it('returns empty array for an empty PATH string', () => {
    expect(splitPath('', ':')).toEqual([]);
  });
});
