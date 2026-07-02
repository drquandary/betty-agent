---
type: source
tags: [teams, digest, betty, authentication, pennkey, security, accounts, slurm, cli-filter, job-submit, deployment]
created: 2026-07-02
updated: 2026-07-02
related: [betty-auth-architecture, slurm-cli-filter, jaime-combariza, kenneth-chaney, jamie-schnaitter]
status: current
---

# Teams Chats Digest — 2026-07-02

## One-line summary
PARCC Group thread on the Gangaram/Vineeth PennKey-deprovisioning login failure + a root-password rotation-policy debate; separately, [[kenneth-chaney]] opened a working meeting to **deploy the `cli_filter` and `job_submit` Slurm plugins** with AHEAD, and a terse 1:1 note that Ken needs a PennKey (to secure-share a credential).

## Content

### Gangaram / Vineeth login failure — PennKey deprovisioning
- **Jaime**: user **Gangaram** can't log in; `sudo` to the account returns `This account is currently not available` — "new to me." His former PI's ColdFront account looks active.
- **Ken**: he **may have just graduated**; his **PennKey is no longer active** on the Penn side — needs an extension through his PI/department.
- **Jaime**: he was a **radiology resident**, now has a **new faculty appointment since yesterday**; asked the user to check with their IT person.
- **Ken**: the login **shell is `/sbin/nologin`** — likely why `sudo` fails; **Vineeth must contact PMACS** to fix the PennKey setup.
- **Ken**: PennKey listing is **`NOT_ACTIVE`** — whoever **sponsors** it hasn't filed the proper paperwork; once done, access returns.
- **Jaime**: PennKey access "will be done automatically **but there may be a gap**." Appointment is **adjunct faculty → no account upgrade needed**; will continue collaborating with **Witschey**.
- **Jaime** (relaying a message to Vineeth, sig "Susan"): HR terminated him yesterday; the **OMA file** should have flipped access overnight automatically — asked him to verify today.
- **Ken**: the bigger issue — without a properly set-up PennKey he loses **more than PARCC**: **PennVPN, AirPennNet**, and other basic services.

### Root password rotation policy
- **Jaime → Jamie Schnaitter**: please work with **AHEAD** to **reset the root password**; proposed doing it **every 3 months** (security).
- **Jamie Schnaitter**: will **put in a ticket today**, but disagrees with fixed 3-month rotation — **regular password changes don't improve security (NIST 800-63)**. However a reset **is warranted here** because **AHEAD has had people leave** since the last change. Team should **review standards and set a policy**.
- **Jaime**: proposing 3 months but open to discussion; wants the periodic reset **documented**, "even more if people leave the group."

### Deploy cli_filter and job_submit plugins (meeting)
- **Ken** named a meeting **"Deploy cli_filter and job_submit plugins"** (started ~8:59 AM), inviting **Jamie Schnaitter + others** and **AHEAD/vendor guests Swapnil Ninave, Rahul Tiwari, Ryan Heath** (same vendor engineers as the Ceph work). Ryan Heath later left the chat.
- **Swapnil Ninave** posted the prod config path: **`/cm/shared/apps/slurm/etc/slurm/slurm.conf`**.
- Significance: `cli_filter` was previously a **client-side** Lua plugin distributed via `~/.bashrc`; `job_submit` is a **server-side** plugin (`JobSubmitPlugins=` in `slurm.conf`). Deploying both centrally = moving flag validation/policy from per-user opt-in to cluster-enforced. See [[slurm-cli-filter]].

### Ken 1:1 — PennKey (terse)
- **Ken**: "I need a PennKey" / "And I will secure share it over." Context not stated; most likely tied to the [[parcc-tokens-as-a-service]] key-minting for the Dr. Chatterjee beta lab (Ken mints keys and would secure-share the credential). `status: tentative` — attribution inferred, not confirmed.

## Pages touched
- Updated [[betty-auth-architecture]] — new "PennKey lifecycle: deprovisioning cascades to Betty" and "Root password rotation policy" sections.
- Updated [[slurm-cli-filter]] — new "Server-side deployment (2026-07-02)" section (cli_filter + job_submit plugins, prod `slurm.conf` path, AHEAD meeting).

## See also
- [[betty-auth-architecture]] · [[slurm-cli-filter]]
- [[jaime-combariza]] · [[kenneth-chaney]] · [[jamie-schnaitter]]
