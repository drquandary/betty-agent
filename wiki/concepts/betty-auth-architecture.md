---
type: concept
tags: [betty, security, authentication, kerberos, pam, ssh]
created: 2026-04-10
updated: 2026-04-10
sources: []
related: [betty-cluster, open-ondemand-betty, ood-troubleshooting]
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

**Why this matters**: This is the root cause of OOD's "shell-to-compute-node" link failing. When OOD tries to open an SSH session to a compute node, `pam_slurm_adopt` blocks it unless the user already has a Slurm job running there. See [[ood-troubleshooting]] for the full diagnostic chain.

## Open OnDemand authentication

- **Penn WebLogin SSO** via Shibboleth (SAML2)
- Users authenticate through Penn's central identity provider
- OOD host: `ood01.betty.parcc.upenn.edu` (see [[open-ondemand-betty]])
- No Kerberos ticket needed for OOD -- it uses web-based SSO

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

## Sources
- Live inspection of `/etc/pam.d/sshd` on dgx028 (OOD session 5207320, 2026-04-10)
