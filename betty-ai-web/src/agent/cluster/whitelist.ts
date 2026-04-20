/**
 * Cluster-read command whitelist (PLAN.md decision D7).
 *
 * Betty AI's cluster_run tool will ONLY execute commands that match one of the
 * patterns exported here. This module is the single source of truth — the
 * system prompt (Track D) imports `SAFE_COMMAND_PATTERNS` to render the
 * allow-list to the model, so what the model is told matches what the
 * transport will actually accept.
 *
 * Design rules:
 *   1. Fail closed. If no pattern matches exactly, reject.
 *   2. Whole-string match only. Every pattern is anchored `^...$`.
 *   3. No shell metacharacters inside arguments. `;`, `&`, `|`, backticks,
 *      `$(`, `>`, `<`, newlines, and NUL are rejected up front.
 *   4. Paths must start with `/vast/home/j/jvadala/` or `/vast/projects/`.
 *   5. `cat` is restricted to a small set of text-ish extensions under the
 *      user's home.
 *
 * Expansion: new commands are added here with a test in `whitelist.test.ts`.
 */

// ---- Character-level rejection --------------------------------------------

// These characters enable command injection or alter shell control flow.
// Present anywhere in the input => reject, before regex matching.
const FORBIDDEN_CHARS = [
  ';', '&', '|', '`', '$', '>', '<', '\n', '\r', '\0', '\\', '"', "'",
  '(', ')', '{', '}', '*', '?', '[', ']', '!', '#', '~',
];

// Explicit control / zero-width / bidi-override block. Anything outside
// printable ASCII is rejected so unicode homoglyphs (e.g. Cyrillic "а") can't
// smuggle through a pattern that looks like ASCII.
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

// ---- Path fragments used in multiple patterns -----------------------------

// Allowed path character class for VAST paths. No shell metas; no spaces; no
// dot-dot (enforced separately below).
const PATH_CHARS = String.raw`[A-Za-z0-9._/\-]`;
const HOME_PREFIX = String.raw`/vast/home/j/jvadala(?:/${PATH_CHARS}+)*/?`;
const PROJECT_PREFIX = String.raw`/vast/projects/[A-Za-z0-9._\-]+(?:/${PATH_CHARS}+)*/?`;
const READABLE_EXT = String.raw`(?:out|err|log|txt|md|yaml|yml|json)`;
const HOME_READABLE_FILE = String.raw`/vast/home/j/jvadala(?:/${PATH_CHARS}+)+\.${READABLE_EXT}`;

// ---- The patterns ---------------------------------------------------------

export const SAFE_COMMAND_PATTERNS: readonly RegExp[] = Object.freeze([
  // Slurm read-only
  /^squeue$/,
  /^squeue -u jvadala$/,
  /^squeue -j [0-9]+(?:_[0-9]+)?$/,
  /^squeue -p [A-Za-z0-9_\-]+$/,
  /^sinfo$/,
  /^sinfo -p [A-Za-z0-9_\-]+$/,
  /^sacct -j [0-9]+(?:_[0-9]+)?(?: --format=[A-Za-z,]+)?$/,

  // PARCC helper scripts (CLAUDE.md)
  /^parcc_quota\.py$/,
  new RegExp(String.raw`^parcc_du\.py ${PROJECT_PREFIX}$`),
  new RegExp(String.raw`^parcc_du\.py ${HOME_PREFIX}$`),
  /^parcc_sfree\.py$/,
  /^parcc_sqos\.py$/,
  /^parcc_sreport\.py$/,
  /^parcc_sreport\.py --user jvadala$/,
  /^parcc_sdebug\.py --job [0-9]+(?:_[0-9]+)?$/,
  /^parcc_sdebug\.py --node [A-Za-z0-9_\-]+$/,

  // `ls` in jvadala-owned trees
  new RegExp(String.raw`^ls ${HOME_PREFIX}$`),
  new RegExp(String.raw`^ls ${PROJECT_PREFIX}$`),
  new RegExp(String.raw`^ls -la? ${HOME_PREFIX}$`),
  new RegExp(String.raw`^ls -la? ${PROJECT_PREFIX}$`),

  // `cat` of text-ish files under jvadala's home
  new RegExp(String.raw`^cat ${HOME_READABLE_FILE}$`),

  // `tail -n N` of .out/.err/.log under jvadala's home (common for job debug)
  new RegExp(String.raw`^tail -n [0-9]{1,5} ${HOME_READABLE_FILE}$`),
]);

/**
 * Returns `true` iff `cmd` is EXACTLY one of the whitelisted command shapes.
 * Fails closed: anything not matched is rejected.
 */
export function isSafeReadCommand(cmd: string): boolean {
  if (typeof cmd !== 'string') return false;
  if (cmd.length === 0 || cmd.length > 512) return false;

  // Trailing / leading whitespace is suspicious (often used to bypass naive
  // string comparisons). We require the caller to submit a trimmed command.
  if (cmd !== cmd.trim()) return false;

  // No tabs / exotic spaces. Only normal spaces between tokens.
  if (!PRINTABLE_ASCII.test(cmd)) return false;

  // Double-space is rejected — patterns assume single-space separation and we
  // don't want "ls  /vast/..." to ever look different from "ls /vast/...".
  if (cmd.includes('  ')) return false;

  // Reject shell metacharacters outright. This is defense-in-depth; the
  // anchored regexes below would already reject them, but a short-circuit
  // here makes intent obvious and guards against a future looser pattern.
  for (const ch of FORBIDDEN_CHARS) {
    if (cmd.includes(ch)) return false;
  }

  // Dot-dot traversal anywhere in the string => reject.
  if (cmd.includes('..')) return false;

  return SAFE_COMMAND_PATTERNS.some((re) => re.test(cmd));
}
