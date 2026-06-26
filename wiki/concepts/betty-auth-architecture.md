---
type: concept
tags: [betty, security, authentication, kerberos, pam, ssh]
created: 2026-04-10
updated: 2026-06-26
sources: [2026-06-16-teams-chats-digest, 2026-06-18-teams-chats-digest, 2026-06-26-teams-chats-digest]
related: [betty-cluster, open-ondemand-betty, ood-troubleshooting, kerberos-ssh-macos-fix]
status: current
---

# Betty Authentication Architecture

## One-line summary
Betty uses Kerberos + PennKey + Duo 2FA for SSH login and `pam_slurm_adopt` on compute nodes to restrict SSH access to users with active Slurm jobs.

## Login node authentication

1. **Kerberos** -- user obtains a ticket via `kinit jvadala@UPENN.EDU`
2. **PennKey** -- Penn's central identity system, used as the SSH username
3. **Duo 2FA** -- second factor after password, options:
   - Push notification (recommended)
   - Phone call
   - SMS passcode

SSH target: `jvadala@login.betty.parcc.upenn.edu`

## Compute node access control: pam_slurm_adopt

Compute nodes run `pam_slurm_adopt` in `/etc/pam.d/sshd` to enforce job-based access:

```
# /etc/pam.d/sshd on compute nodes (relevant lines):
pam_listfile.so    with /etc/security/pam_slurm_allow.conf   # admin bypass whitelist
pam_slurm_adopt.so action_no_jobs=deny                       # blocks SSH if no active job
```

**How it works**:
- If the SSH user has an active Slurm job on that compute node, SSH is allowed and the session is adopted into the job's cgroup
- If the user has NO active job on that node, SSH is **denied**
- `/etc/security/pam_slurm_allow.conf` contains a whitelist for admin accounts that can bypass this check

**Deployment status & multi-job caveat** (confirmed by [[jamie-schnaitter]], 2026-06-18): `pam_slurm_adopt` is now in place on Betty, so a user can SSH directly to a node where they have a running job. Caveat: if the user has **multiple jobs on the same node**, the adopted SSH session is only attached to the cgroup of **one** of them (which job is non-deterministic from the user's side). This matters for interactive debugging — the SSH session's CPU/GPU/memory visibility reflects just that one job's cgroup, not the union of the user's allocations on the node.

**Why this matters**: This is the root cause of OOD's "shell-to-compute-node" link failing. When OOD tries to open an SSH session to a compute node, `pam_slurm_adopt` blocks it unless the user already has a Slurm job running there. See [[ood-troubleshooting]] for the full diagnostic chain.

## Open OnDemand authentication

- **Penn WebLogin SSO** via Shibboleth (SAML2)
- Users authenticate through Penn's central identity provider
- OOD host: `ood01.betty.parcc.upenn.edu` (see [[open-ondemand-betty]])
- No Kerberos ticket needed for OOD -- it uses web-based SSO

## macOS client-side failure mode (Heimdal vs MIT)

A common **client-side** SSH failure on macOS is `Permission denied (publickey,gssapi-with-mic)`, caused not by the server but by the Mac presenting a credential from the wrong Kerberos provider. macOS ships **Heimdal**; package managers (conda, brew, …) can install **MIT** Kerberos + their own `ssh`, polluting the environment. The fix is `export KRB5CCNAME="API:"` before `kinit`. Full diagnosis, the diagnostic checklist, and the fix are on the dedicated page [[kerberos-ssh-macos-fix]] (from the [[2026-06-16-teams-chats-digest]], diagnosed by [[jamie-schnaitter]] and [[ryan-bradley]]).

## VPN / Duo support routing for external & sponsored users

When a user (especially an **external collaborator** on a **sponsored PennKey** — e.g. a Pitt user on Keystone) reports their **VPN or Duo has stopped working**, PARCC is *not* the right fixer. The routing rule (from [[kenneth-chaney]], 2026-06-26):

- **Identify who sponsored the PennKey**, then send them to that sponsor's **LSP (Local Support Provider)**.
- Examples: **PARCC → HireIT**, **SEAS → CETS**.
- The sponsor is the one who opens the LSP ticket/email (e.g. Jaime sponsored a Pitt user's PennKey, so Jaime emails HireIT).

Duo/VPN issues are identity-layer problems handled by the central LSP, distinct from Betty's own Kerberos/`pam_slurm_adopt` SSH controls below.

## Practical notes

- Kerberos tickets expire -- if SSH starts failing after hours of work, run `kinit` again
- Duo 2FA fires on every new SSH connection (no caching on Betty)
- Cannot SSH directly to compute nodes without an active Slurm job -- use `srun` or `sbatch` instead
- Admin bypass list is small and not available to regular users

## See also
- [[betty-cluster]]
- [[open-ondemand-betty]]
- [[ood-troubleshooting]] -- the pam_slurm_adopt interaction with OOD shell links
- [[slurm-on-betty]]
- [[kerberos-ssh-macos-fix]] -- the macOS Heimdal-vs-MIT client fix (`KRB5CCNAME="API:"`)

## Sources
- Live inspection of `/etc/pam.d/sshd` on dgx028 (OOD session 5207320, 2026-04-10)
- [[2026-06-16-teams-chats-digest]] -- macOS Kerberos SSH failure + fix thread
- [[2026-06-18-teams-chats-digest]] -- Jamie confirms pam_slurm_adopt is live + multi-job cgroup caveat
- [[2026-06-26-teams-chats-digest]] -- VPN/Duo for sponsored external users routes to the sponsor's LSP (PARCC→HireIT, SEAS→CETS)
