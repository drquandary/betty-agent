/**
 * Shared validation for `BETTY_SSH_USER`.
 *
 * Why: `cost/route.ts` and `jobs/route.ts` both interpolate this env var
 * directly into a shell command (`parcc_sreport.py --user ${user}`,
 * `squeue -u ${user} …`). If the env value contains shell metacharacters
 * an attacker who can set the env (or a misconfigured deployment) could
 * inject arbitrary commands. We whitelist a conservative POSIX-username
 * shape so any non-conforming value is rejected before it ever reaches
 * the shell.
 *
 * Pattern: starts with a lowercase letter, then up to 31 chars of
 * lowercase / digit / underscore / hyphen — covers all real PennKeys and
 * service accounts on Betty while excluding $`;&|<> etc.
 */
const VALID_USER = /^[a-z][a-z0-9_-]{0,31}$/;

export function getValidatedSshUser(): { ok: true; user: string } | { ok: false; error: string } {
  const user = process.env.BETTY_SSH_USER || 'jvadala';
  if (!VALID_USER.test(user)) {
    return { ok: false, error: 'invalid BETTY_SSH_USER' };
  }
  return { ok: true, user };
}
