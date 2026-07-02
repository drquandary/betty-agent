---
type: source
tags: [teams, digest, betty, authentication, pennkey, security, accounts]
created: 2026-07-02
updated: 2026-07-02
related: [betty-auth-architecture, jaime-combariza, kenneth-chaney, jamie-schnaitter]
status: current
---

# Teams Chats Digest — 2026-07-02

## One-line summary
A single PARCC Group thread: user Gangaram/Vineeth can't log in to Betty because his PennKey went inactive after an HR role change (deprovisioning cascade), plus a root-password rotation-policy debate (event-driven vs 3-month).

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

## Pages touched
- Updated [[betty-auth-architecture]] — new "PennKey lifecycle: deprovisioning cascades to Betty" and "Root password rotation policy" sections.

## See also
- [[betty-auth-architecture]]
- [[jaime-combariza]] · [[kenneth-chaney]] · [[jamie-schnaitter]]
