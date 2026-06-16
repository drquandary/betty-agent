---
type: concept
tags: [betty, kerberos, ssh, macos, heimdal, mit, gssapi, krb5ccname, facilitation]
created: 2026-06-16
updated: 2026-06-16
sources: [2026-06-16-teams-chats-digest]
related: [betty-auth-architecture, betty-cluster, jamie-schnaitter, ryan-bradley, jeffrey-vadala]
status: current
---

# macOS Kerberos SSH Fix (Heimdal vs MIT)

## One-line summary
On macOS, SSH to Betty intermittently fails with `Permission denied (publickey,gssapi-with-mic)` because the system's **Heimdal** Kerberos collides with **MIT** Kerberos pulled in by package managers; the fix is `export KRB5CCNAME="API:"` before `kinit`.

## The symptom
- `ssh <pennkey>@login.betty.parcc.upenn.edu` → `Permission denied (publickey,gssapi-with-mic).`
- Hits Mac users especially; the team knew *why* in principle but not *every* way it triggers.

## Root cause (Jamie + ryb)
- Two Kerberos providers collide: macOS ships **Heimdal** (with Mac-specific defaults); common toolchains pull in **MIT** Kerberos.
- **Environment pollution** is the real mechanism: *any* environment manager that installs binary packages (conda, brew, …) can install its own `ssh` + MIT `kinit`, overriding the system Heimdal. [[jamie-schnaitter]] corrected the earlier "only conda does this" framing — it's not conda-specific.
- GUI apps (VSCode) launch via **launchd**, which skips `~/.bashrc`, so they normally get clean Heimdal — *unless* launched from a polluted terminal (`code` inheriting MIT from bashrc). Open question ryb had: how user "fionay" got non-Heimdal in VSCode on macOS.

## The fix (Jamie's guidance)
- On a Mac, **set `KRB5CCNAME` before running `kinit`**, and it should just be:
  ```bash
  export KRB5CCNAME="API:"
  kinit <pennkey>@UPENN.EDU
  ```
- With `KRB5CCNAME` set correctly, **MIT vs Heimdal no longer matters** (Jamie verified MIT-from-conda works) — *unless* the macOS version is too old to support the `API:` credential cache, in which case use `FILE:`.
- PARCC docs already recommend `export KRB5CCNAME="API:"`.
- Process on the next failure: (1) figure out which `kinit` runs in the client; (2) set `KRB5CCNAME` to `API:` (or `FILE:`) to match.

## ryb's diagnostic checklist (reference notes)
- `klist` — should show `API:` for Heimdal on macOS.
- `echo $KRB5CCNAME`, `echo $KRB5_CONFIG` — blank with Heimdal on macOS.
- `cat /etc/krb5.conf` — absent on macOS (its presence hints at MIT).
- `which kinit; which klist`; `kinit --version` (Heimdal) vs `kinit --V` (MIT).
- `ssh -vvv betty 2>&1` for verbose debugging.
- Confirm `~/.ssh/config` has `GSSAPIAuthentication` + `GSSAPIDelegateCredentials`.
- Cred-cache perms: `ls -la $(echo $KRB5CCNAME | sed 's/FILE://')`, `ls -la /tmp/krb5cc_*`.
- Historically sometimes required: `unset KRB5CCNAME`.
- Reproduce the error by misdirecting the cache: `export KRB5CCNAME=FILE:/tmp/krb5cc_bogus`.

## Relationship to Betty auth
This is the client-side macOS counterpart to the server-side Kerberos + Duo flow described in [[betty-auth-architecture]] — the server expects a valid GSSAPI credential; these failures are the Mac client failing to present one because the wrong `kinit`/cache is in play.

## See also
- [[betty-auth-architecture]] — the server-side Kerberos + Duo + pam_slurm_adopt picture
- [[betty-cluster]]
- [[jamie-schnaitter]] — authored the fix
- [[ryan-bradley]] — diagnostic checklist

## Sources
- [[2026-06-16-teams-chats-digest]] — the PARCC-group Kerberos thread (Jamie + ryb)
