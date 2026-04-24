/**
 * Pure helpers for resolving executable candidates used by the terminal
 * bridge.  These functions are platform-aware but do **not** touch the
 * filesystem, making them easy to unit-test.  The actual executability check
 * (`fs.accessSync`) lives in `scripts/terminal-server.mjs` which runs in
 * Node and owns the real I/O.
 */

/**
 * Returns the ordered list of shell candidate paths for a given platform.
 * Candidates are tried in priority order — first match wins.
 * On Windows, short executable names are returned for PATH-based resolution
 * rather than absolute paths.
 */
export function getShellCandidates(platform: NodeJS.Platform): readonly string[] {
  if (platform === 'win32') {
    return ['pwsh.exe', 'powershell.exe', 'cmd.exe'];
  }
  return [
    '/bin/bash',
    '/usr/bin/bash',
    '/usr/local/bin/bash',
    '/bin/sh',
    '/usr/bin/sh',
    '/usr/local/bin/zsh',
    '/usr/bin/zsh',
    '/bin/zsh',
  ];
}

/**
 * Returns the ordered list of fixed SSH candidate paths for a given platform.
 * Candidates are tried in priority order — first match wins.
 * An empty array is returned on Windows, signalling that ssh should be
 * resolved exclusively via PATH (fixed system paths are not reliable there).
 */
export function getSshCandidates(platform: NodeJS.Platform): readonly string[] {
  if (platform === 'win32') {
    // On Windows, ssh is usually found in PATH; fixed paths are less reliable.
    return [];
  }
  return ['/usr/bin/ssh', '/usr/local/bin/ssh', '/opt/homebrew/bin/ssh', '/bin/ssh'];
}

/**
 * Splits a PATH-style string into an ordered list of non-empty directories.
 * `delimiter` is the platform PATH separator (`:` on Unix, `;` on Windows).
 */
export function splitPath(pathEnv: string, delimiter: string): string[] {
  return pathEnv.split(delimiter).filter((d) => d.length > 0);
}
