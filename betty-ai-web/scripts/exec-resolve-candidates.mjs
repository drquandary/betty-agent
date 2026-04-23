/**
 * Shared executable candidate paths used by terminal-server.mjs and
 * doctor.mjs.  These lists are the single source of truth — edit here to
 * update both places at once.
 *
 * The TypeScript mirror (src/lib/exec-resolve.ts) exports `getShellCandidates`
 * and `getSshCandidates` with identical values for unit-testing.
 */

/**
 * Splits a PATH-style string into an ordered list of non-empty directories.
 * `delimiter` is the platform PATH separator (`:` on Unix, `;` on Windows).
 */
export function splitPath(pathEnv, delimiter) {
  return pathEnv.split(delimiter).filter((d) => d.length > 0);
}

/** Ordered shell candidate paths for the given Node platform string. */
export function getShellCandidates(platform) {
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

/** Ordered fixed SSH candidate paths for the given Node platform string. */
export function getSshCandidates(platform) {
  if (platform === 'win32') {
    // On Windows, ssh is usually found in PATH; fixed paths are less reliable.
    return [];
  }
  return ['/usr/bin/ssh', '/usr/local/bin/ssh', '/opt/homebrew/bin/ssh', '/bin/ssh'];
}
